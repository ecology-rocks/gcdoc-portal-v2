import { defineStore } from "pinia";
import { db } from "@/firebase";
import { useAuthStore } from "@/stores/authStore";
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
  getDocs,
  query,
  where,
} from "firebase/firestore";

const getClockHours = (log) => {
  const rawClock = Number(log.clockHours);
  if (!Number.isNaN(rawClock) && rawClock > 0) return rawClock;

  // Legacy fallback: infer raw clock hours from credited hours.
  const credited = Number(log.Hours) || 0;
  const type = log.type || "";
  if (type.includes("Cleaning / Maintenance") || type.includes("Trial Setup")) {
    return credited / 2;
  }
  return credited;
};

export const useLogsStore = defineStore("logs", {
  state: () => ({
    logs: [],
    loading: false,
    error: null,
    unsubscribeLogs: null,
    listenerKey: null,
  }),

  getters: {
    logType: (state) => (val) => {
      const TYPES = {
        MAINT: "Cleaning / Maintenance (2x + Blue Ribbon)",
        STANDARD: "Standard / Regular (1x)",
        SETUP: "Trial Setup / Teardown (2x)",
      };
      if (val === TYPES.MAINT || val === "MAINT") return TYPES.MAINT;
      if (val === TYPES.SETUP || val === "SETUP") return TYPES.SETUP;
      return TYPES.STANDARD;
    },

    // 1. All-Time Total
    totalHoursByMember: (state) => {
      const hoursMap = {};
      state.logs.forEach((log) => {
        const email = log.MemberEmail || "unknown";
        const hrs = Number(log.Hours) || 0;
        if (!hoursMap[email]) hoursMap[email] = 0;
        hoursMap[email] += hrs;
      });
      return hoursMap;
    },

    activeSessions: (state) => {
      return state.logs
        .filter((l) => l.Status === "active")
        .sort((a, b) => b.Date?.seconds - a.Date?.seconds);
    },

    pendingLogs: (state) => {
      return state.logs
        .filter((l) => l.Status === "pending")
        .sort((a, b) => b.Date?.seconds - a.Date?.seconds);
    },

    getLogsBySheet: (state) => (sheetShortId) => {
      return state.logs.filter((l) => l.SourceSheet == sheetShortId);
    },

    // 2. Fiscal Year Total (Oct 1 - Sept 30)
    fiscalYearHours: (state) => {
      const hoursMap = {};
      const now = new Date();
      const currentMonth = now.getMonth(); // 0 = Jan, 9 = Oct
      const currentYear = now.getFullYear();

      const startYear = currentMonth >= 9 ? currentYear : currentYear - 1;
      const startDate = new Date(startYear, 9, 1);
      const endDate = new Date(startYear + 1, 9, 1);

      state.logs.forEach((log) => {
        const d = log.Date?.toDate ? log.Date.toDate() : new Date(log.Date);
        if (d >= startDate && d < endDate) {
          const email = log.MemberEmail || "unknown";
          const hrs = Number(log.Hours) || 0;
          if (!hoursMap[email]) hoursMap[email] = 0;
          hoursMap[email] += hrs;
        }
      });
      return hoursMap;
    },

    // 3. Service Vouchers (<50 = 0, >=50 = 1 per 25)
    vouchersByMember: (state) => {
      const hoursMap = state.fiscalYearHours;
      const voucherMap = {};

      for (const email in hoursMap) {
        const hrs = hoursMap[email];
        if (hrs < 50) {
          voucherMap[email] = 0;
        } else {
          voucherMap[email] = Math.floor(hrs / 25);
        }
      }
      return voucherMap;
    },

    // 4. [NEW] Special Hours (Sum of clockHours for Cleaning/Setup in FY)
    specialHoursByMember: (state) => {
      const hoursMap = {};
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const startYear = currentMonth >= 9 ? currentYear : currentYear - 1;
      const startDate = new Date(startYear, 9, 1);
      const endDate = new Date(startYear + 1, 9, 1);

      state.logs.forEach((log) => {
        const d = log.Date?.toDate ? log.Date.toDate() : new Date(log.Date);
        if (d >= startDate && d < endDate) {
          const email = log.MemberEmail || "unknown";
          const type = log.type || "";
          const clock = getClockHours(log);

          if (
            type.includes("Cleaning / Maintenance") ||
            type.includes("Trial Setup")
          ) {
            if (!hoursMap[email]) hoursMap[email] = 0;
            hoursMap[email] += clock;
          }
        }
      });
      return hoursMap;
    },

    // 5. [NEW] Blue Vouchers (Cleaning clockHours / 8)
    blueVouchersByMember: (state) => {
      const hoursMap = {};
      // Re-use FY Logic
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const startYear = currentMonth >= 9 ? currentYear : currentYear - 1;
      const startDate = new Date(startYear, 9, 1);
      const endDate = new Date(startYear + 1, 9, 1);

      state.logs.forEach((log) => {
        const d = log.Date?.toDate ? log.Date.toDate() : new Date(log.Date);
        if (d >= startDate && d < endDate) {
          const email = log.MemberEmail || "unknown";
          const type = log.type || "";
          const clock = getClockHours(log);

          // Only Cleaning/Maintenance
          if (type.includes("Cleaning / Maintenance")) {
            if (!hoursMap[email]) hoursMap[email] = 0;
            hoursMap[email] += clock;
          }
        }
      });

      const voucherMap = {};
      for (const email in hoursMap) {
        // Round to nearest integer
        voucherMap[email] = Math.round(hoursMap[email] / 8);
      }
      return voucherMap;
    },
  },

  actions: {
    async initLogs() {
      const authStore = useAuthStore();
      if (authStore.loading) await authStore.init();

      const userEmail = authStore.user?.email?.toLowerCase();
      if (!userEmail) {
        this.stopLogsListener();
        this.loading = false;
        this.logs = [];
        this.error = "Sign in required to view logs.";
        return;
      }

      const canReadAllLogs = authStore.isAdmin || authStore.isKioskUser;
      const nextListenerKey = canReadAllLogs ? "all" : `member:${userEmail}`;

      if (this.unsubscribeLogs && this.listenerKey === nextListenerKey) {
        return;
      }

      this.stopLogsListener();

      const logsQuery = canReadAllLogs
        ? collection(db, "logs")
        : query(collection(db, "logs"), where("MemberEmail", "==", userEmail));

      this.loading = true;
      this.error = null;
      this.listenerKey = nextListenerKey;
      this.unsubscribeLogs = onSnapshot(
        logsQuery,
        (snapshot) => {
          this.logs = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => {
              const dateA = a.Date?.seconds || 0;
              const dateB = b.Date?.seconds || 0;
              return dateB - dateA;
            });
          this.loading = false;
        },
        (error) => {
          this.loading = false;
          this.error = error?.code === "permission-denied"
            ? "You do not have permission to read logs."
            : error?.message || "Unable to load logs.";
          if (error?.code === "permission-denied") {
            this.logs = [];
          }
        }
      );
    },

    stopLogsListener() {
      if (this.unsubscribeLogs) {
        this.unsubscribeLogs();
        this.unsubscribeLogs = null;
      }
      this.listenerKey = null;
    },

    async cleanLegacyTypes() {
    const q = query(collection(db, "logs"))
    const snapshot = await getDocs(q)
    
    let batch = writeBatch(db)
    let count = 0
    let totalUpdated = 0

    // Use the getter to fetch the "One True String" for each type
    const TARGETS = {
      MAINT: this.logType('MAINT'),
      SETUP: this.logType('SETUP'),
      STANDARD: this.logType('STANDARD')
    }

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data()
      const current = (data.type || '').toLowerCase()
      let target = TARGETS.STANDARD

      // Lazy matching logic
      if (current.includes('cleaning') || current.includes('maint')) {
        target = TARGETS.MAINT
      } else if (current.includes('trial') || current.includes('setup')) {
        target = TARGETS.SETUP
      } 

      // Only update if it doesn't match the standardized string
      if (data.type !== target) {
        batch.update(doc(db, "logs", docSnap.id), { type: target })
        count++
        totalUpdated++
      }

      if (count >= 400) {
        await batch.commit()
        batch = writeBatch(db)
        count = 0
      }
    }

    if (count > 0) await batch.commit()
    return totalUpdated
  },

    async addLog(logData) {
      const status = logData.Status || "approved";
      await addDoc(collection(db, "logs"), {
        ...logData,
        Date: Timestamp.fromDate(new Date(logData.Date)),
        Status: status,
        FiscalYearRollover: "No",
      });
    },

    async checkIn(logData) {
      await addDoc(collection(db, "logs"), {
        ...logData,
        Date: Timestamp.now(),
        Status: "active",
        Hours: 0,
        FiscalYearRollover: "No",
      });
    },

async checkOut(logId, startTimeSeconds, overrideClockHours = null) {
      const start = new Date(startTimeSeconds * 1000);
      const now = new Date();
      const diffMs = now - start;

      // Use the override if provided, otherwise calculate from start/now
      let realHours = overrideClockHours !== null
        ? parseFloat(overrideClockHours)
        : diffMs / 3600000;

      // Round to nearest quarter hour (0.25) and enforce a minimum of 0.25
      realHours = Math.max(0.25, Math.round(realHours * 4) / 4);

      const logRef = doc(db, "logs", logId);
      const logSnap = await getDoc(logRef);
      if (!logSnap.exists()) throw new Error("Log not found");

      const logData = logSnap.data();
      const type = logData.type || "Standard / Regular (1x)";

      let multiplier = 1;
      if (
        type.includes("Cleaning / Maintenance") ||
        type.includes("Trial Setup")
      ) {
        multiplier = 2;
      }

      const creditedHours = realHours * multiplier;

      await updateDoc(logRef, {
        Hours: creditedHours,
        clockHours: realHours,
        Status: "pending",
      });
    },

    async updateLog(id, updates) {
      const data = { ...updates };
      if (data.Date && !(data.Date instanceof Timestamp)) {
        data.Date = Timestamp.fromDate(new Date(data.Date));
      }
      await updateDoc(doc(db, "logs", id), data);
    },

    async batchSave(newLogs, updatedLogs, sheetId) {
      const batch = writeBatch(db);

      const prepareLogData = (log) => {
        const rawHours = Number(log.clockHours) || 0;
        const type = log.type || "Standard / Regular (1x)";
        let multiplier = 1;

        if (
          type.includes("Cleaning / Maintenance") ||
          type.includes("Trial Setup")
        ) {
          multiplier = 2;
        }

        return {
          ...log,
          Hours: rawHours * multiplier,
          clockHours: rawHours,
          Date: Timestamp.fromDate(new Date(log.Date)),
        };
      };

      newLogs.forEach((log) => {
        const docRef = doc(collection(db, "logs"));
        const finalData = prepareLogData(log);
        batch.set(docRef, {
          ...finalData,
          SourceSheet: sheetId,
          Status: "approved",
          FiscalYearRollover: "No",
        });
        
        // FIX: Attach the newly generated ID back to the object 
        // so the UI knows it has been saved and won't duplicate it.
        log.id = docRef.id; 
      });

      updatedLogs.forEach((log) => {
        const docRef = doc(db, "logs", log.id);
        const finalData = prepareLogData(log);
        delete finalData.id;
        batch.update(docRef, finalData);
      });

      await batch.commit();
    },

    async deleteLog(logId) {
      await deleteDoc(doc(db, "logs", logId));
    },

    async addBulkLogs(logsArray, sheetId) {
      const batch = writeBatch(db);
      logsArray.forEach((log) => {
        const docRef = doc(collection(db, "logs"));
        batch.set(docRef, {
          ...log,
          Date: Timestamp.fromDate(new Date(log.Date)),
          SourceSheet: sheetId,
          Status: "approved",
          FiscalYearRollover: "No",
        });
      });
      await batch.commit();
    },

    async importGenericRows(rows) {
      if (this.logs.length === 0) {
        const q = query(collection(db, "logs"));
        const snap = await getDocs(q);
        this.logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      const batch = writeBatch(db);
      let count = 0;

      rows.forEach((row) => {
        const email = row["MemberEmail"] || row["Email"];

        if (email) {
          const hours = parseFloat(row["Hours"]) || 0;
          const clockHours = parseFloat(row["clockHours"]) || hours;
          const importedAt = row["importedAt"]
            ? new Date(row["importedAt"])
            : new Date();
          const dateObj = row["Date"] ? new Date(row["Date"]) : new Date();

          let isMaint = false;
          if (row["isMaintenance"]) {
            const val = row["isMaintenance"].toString().toUpperCase();
            isMaint = val === "TRUE" || val === "YES";
          }

          const rowDateStr = dateObj.toISOString().split("T")[0];
          const match = this.logs.find((l) => {
            const lDate = l.Date?.toDate ? l.Date.toDate() : new Date(l.Date);
            const lDateStr = lDate.toISOString().split("T")[0];
            return (
              l.MemberEmail?.toLowerCase() === email.toLowerCase() &&
              lDateStr === rowDateStr &&
              Math.abs((l.Hours || 0) - hours) < 0.01
            );
          });

          const docRef = match
            ? doc(db, "logs", match.id)
            : doc(collection(db, "logs"));

          batch.set(
            docRef,
            {
              MemberEmail: email,
              MemberName: row["MemberName"] || "",
              Date: Timestamp.fromDate(dateObj),
              importedAt: Timestamp.fromDate(importedAt),
              Hours: hours,
              clockHours: clockHours,
              Activity: row["Activity"] || "",
              type: row["type"] || "Regular",
              isMaintenance: isMaint,
              Status: row["Status"] || "approved",
              SourceSheet: row["SourceSheet"] || "",
              FiscalYearRollover: row["FiscalYearRollover"] || "No",
            },
            { merge: true },
          );
          count++;
        }
      });

      await batch.commit();
      return count;
    },

    async getExportData() {
      const q = query(collection(db, "logs"));
      const snap = await getDocs(q);
      const rawLogs = snap.docs.map((d) => d.data());

      return rawLogs.map((l) => ({
        MemberEmail: l.MemberEmail,
        MemberName: l.MemberName,
        Date: l.Date?.toDate ? l.Date.toDate().toISOString() : l.Date,
        Hours: l.Hours,
        clockHours: l.clockHours,
        Activity: l.Activity,
        type: l.type,
        isMaintenance: l.isMaintenance,
        Status: l.Status,
        SourceSheet: l.SourceSheet,
        FiscalYearRollover: l.FiscalYearRollover,
        importedAt: l.importedAt?.toDate
          ? l.importedAt.toDate().toISOString()
          : l.importedAt,
      }));
    },
  },
});

<template>
  <div class="dashboard-container">
    <h1 class="dashboard-title">Welcome, Admin</h1>
    
    <div class="dashboard-grid">
      <div class="card card-blue">
        <div class="card-body">
          <div class="card-icon blue-bg">
            <span>📅</span>
          </div>
          <div class="card-info">
            <dt>Board Meeting</dt>
            <dd>Prep Tools</dd>
          </div>
        </div>
        <div class="card-footer">
          <RouterLink to="/meeting" class="link-blue">
            View applicants & hours &rarr;
          </RouterLink>
        </div>
      </div>

      <div class="card card-yellow">
        <div class="card-body">
          <div class="card-icon yellow-bg">
            <span>💾</span>
          </div>
          <div class="card-info">
            <dt>System Data</dt>
            <dd>Import CSVs</dd>
          </div>
        </div>
        <div class="card-footer">
          <RouterLink to="/import" class="link-yellow">
            Run Importer &rarr;
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2.5rem 1rem;
  font-family: system-ui, -apple-system, sans-serif;
}

.dashboard-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 1.5rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

/* Card Styles */
.card {
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
  border-left-width: 4px;
  border-left-style: solid;
}

.card-body {
  padding: 1.25rem;
  display: flex;
  align-items: center;
}

.card-icon {
  flex-shrink: 0;
  padding: 0.75rem;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.card-info {
  margin-left: 1.25rem;
}

.card-info dt {
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
}

.card-info dd {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.card-footer {
  background-color: #f9fafb;
  padding: 0.75rem 1.25rem;
}

.card-footer a {
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
}

.card-footer a:hover {
  text-decoration: underline;
}

/* Color Variants */
.card-blue { border-left-color: #3b82f6; }
.blue-bg { background-color: #dbeafe; }
.link-blue { color: #1d4ed8; }

.card-yellow { border-left-color: #eab308; }
.yellow-bg { background-color: #fef9c3; }
.link-yellow { color: #a16207; }

/* Breakpoints */
@media (min-width: 768px) {
  .dashboard-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
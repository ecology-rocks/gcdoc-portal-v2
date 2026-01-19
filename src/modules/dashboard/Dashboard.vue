<template>
  <div class="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-6">Welcome, Admin</h1>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div class="bg-white overflow-hidden shadow rounded-lg border-l-4 border-blue-500">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <span class="text-2xl">📅</span>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">Board Meeting</dt>
                <dd class="flex items-baseline">
                  <div class="text-lg font-semibold text-gray-900">Prep Tools</div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 px-5 py-3">
          <RouterLink to="/meeting" class="text-sm font-medium text-blue-700 hover:text-blue-900">
            View applicants & hours &rarr;
          </RouterLink>
        </div>
      </div>

       <div class="bg-white overflow-hidden shadow rounded-lg border-l-4 border-yellow-500">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0 bg-yellow-100 rounded-md p-3">
              <span class="text-2xl">💾</span>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">System Data</dt>
                <dd class="flex items-baseline">
                  <div class="text-lg font-semibold text-gray-900">Import CSVs</div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 px-5 py-3">
          <RouterLink to="/import" class="text-sm font-medium text-yellow-700 hover:text-yellow-900">
            Run Importer &rarr;
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
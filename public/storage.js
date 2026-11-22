(() => {
  const KEY = 'college-made-easy-search-v1';
  const demoSearches = [
    { major: 'Marketing', filters: { state: 'Any', cost: 'Any', size: 'Any' } },
    { major: 'Computer science', filters: { state: 'Any', cost: 'Any', size: 'Any' } },
    { major: 'Nursing', filters: { state: 'Any', cost: 'Any', size: 'Any' } },
  ];

  window.collegeStorage = {
    loadLastSearch() {
      try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
      catch { return null; }
    },
    saveLastSearch(search) {
      localStorage.setItem(KEY, JSON.stringify({ ...search, savedAt: new Date().toISOString() }));
    },
    demoSearches,
  };
})();

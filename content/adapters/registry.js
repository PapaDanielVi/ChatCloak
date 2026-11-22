(() => {
  'use strict';

  const entries = [];
  const byId = new Map();

  function register(entry) {
    if (!entry || !entry.id || !entry.adapter) return;
    const record = {
      id: entry.id,
      displayName: entry.displayName || entry.adapter.displayName || entry.id,
      hostPatterns: entry.hostPatterns || entry.adapter.hostPatterns || [],
      pathRegex: entry.pathRegex || entry.adapter.pathRegex || null,
      adapter: entry.adapter
    };

    const existingIdx = entries.findIndex((item) => item.id === record.id);
    if (existingIdx !== -1) {
      entries[existingIdx] = record;
    } else {
      entries.push(record);
    }
    byId.set(record.id, record);
  }

  function resolve(locationObj) {
    const loc = locationObj || window.location;
    const hostname = (loc.hostname || '').toLowerCase();
    const pathname = loc.pathname || '/';

    for (const entry of entries) {
      if (typeof entry.adapter.matches === 'function') {
        if (entry.adapter.matches(hostname, pathname)) {
          return entry.adapter;
        }
      }
    }
    return null;
  }

  function getById(id) {
    const entry = byId.get(id);
    return entry ? entry.adapter : null;
  }

  function getAll() {
    return entries.map((e) => ({
      id: e.id,
      displayName: e.displayName,
      hostPatterns: e.hostPatterns,
      pathRegex: e.pathRegex
    }));
  }

  // Register any adapters pushed before registry.js executed
  const queued = window.ChatCloakAdapters || [];
  for (const item of queued) {
    if (item && item.adapter && item.id) {
      register(item);
    } else if (item && item.id) {
      register({
        id: item.id,
        displayName: item.displayName || item.label,
        hostPatterns: item.hostPatterns || [],
        pathRegex: item.pathRegex || null,
        adapter: item
      });
    }
  }

  window.ChatCloakAdapterRegistry = {
    register,
    resolve,
    getById,
    getAll
  };
})();

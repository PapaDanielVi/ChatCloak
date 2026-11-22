(() => {
  'use strict';

  const LOCAL_CACHE_KEY = 'chatcloak_boot_cache_v1';

  const DEFAULT_SETTINGS = {
    enabled: true,
    style: 'blur',
    blurIntensity: 'medium',
    categories: {
      sidebar: true,
      profile: true,
      media: false,
      pii: true
    },
    peekMode: false,
    caseInsensitive: true,
    customKeywords: []
  };

  function resolveAdapter() {
    const adapters = window.ChatCloakAdapters || [];
    const host = window.location.hostname;
    return adapters.find((a) => a.matches(host)) || null;
  }

  const adapter = resolveAdapter();
  if (!adapter) return;

  // Synchronous zero-flicker boot protection before first paint at document_start
  const rootEl = document.documentElement;
  rootEl.setAttribute('data-chatcloak-host', adapter.id);

  try {
    const cachedRaw = window.localStorage.getItem(LOCAL_CACHE_KEY);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached && cached.enabled !== false) {
        rootEl.classList.add('chatcloak-booting');
        if (cached.blurIntensity) {
          rootEl.classList.add(`chatcloak-blur-${cached.blurIntensity}`);
        }
      }
    } else {
      // Default to booting cloaked on first visit to prevent initial flash
      rootEl.classList.add('chatcloak-booting', 'chatcloak-blur-medium');
    }
  } catch (_) {
    rootEl.classList.add('chatcloak-booting', 'chatcloak-blur-medium');
  }

  let currentSettings = structuredClone(DEFAULT_SETTINGS);
  let lastUrl = window.location.href;
  let observer = null;
  let throttleTimer = null;
  let lastFlushTime = 0;
  const pendingElements = new Set();
  const pendingTextNodes = new Set();

  function normalizeSettings(raw) {
    const s = raw || {};
    return {
      enabled: typeof s.enabled === 'boolean' ? s.enabled : DEFAULT_SETTINGS.enabled,
      style: s.style === 'blackout' ? 'blackout' : 'blur',
      blurIntensity: ['light', 'medium', 'heavy'].includes(s.blurIntensity)
        ? s.blurIntensity
        : DEFAULT_SETTINGS.blurIntensity,
      categories: {
        sidebar:
          s.categories && typeof s.categories.sidebar === 'boolean'
            ? s.categories.sidebar
            : DEFAULT_SETTINGS.categories.sidebar,
        profile:
          s.categories && typeof s.categories.profile === 'boolean'
            ? s.categories.profile
            : DEFAULT_SETTINGS.categories.profile,
        media:
          s.categories && typeof s.categories.media === 'boolean'
            ? s.categories.media
            : DEFAULT_SETTINGS.categories.media,
        pii:
          s.categories && typeof s.categories.pii === 'boolean'
            ? s.categories.pii
            : DEFAULT_SETTINGS.categories.pii
      },
      peekMode: typeof s.peekMode === 'boolean' ? s.peekMode : DEFAULT_SETTINGS.peekMode,
      caseInsensitive:
        typeof s.caseInsensitive === 'boolean'
          ? s.caseInsensitive
          : DEFAULT_SETTINGS.caseInsensitive,
      customKeywords: Array.isArray(s.customKeywords)
        ? s.customKeywords.filter((k) => typeof k === 'string' && k.trim().length > 0)
        : []
    };
  }

  function writeBootCache(settings) {
    try {
      window.localStorage.setItem(
        LOCAL_CACHE_KEY,
        JSON.stringify({
          enabled: settings.enabled,
          blurIntensity: settings.blurIntensity
        })
      );
    } catch (_) {
      // Ignore storage quota or restricted storage errors
    }
  }

  function syncRootClasses(settings) {
    rootEl.classList.remove(
      'chatcloak-booting',
      'chatcloak-enabled',
      'chatcloak-style-blur',
      'chatcloak-style-blackout',
      'chatcloak-blur-light',
      'chatcloak-blur-medium',
      'chatcloak-blur-heavy',
      'chatcloak-cat-sidebar',
      'chatcloak-cat-profile',
      'chatcloak-cat-media',
      'chatcloak-peek-enabled'
    );

    rootEl.classList.add(`chatcloak-blur-${settings.blurIntensity}`);

    if (!settings.enabled) {
      rootEl.classList.remove('chatcloak-alt-held');
      return;
    }

    rootEl.classList.add('chatcloak-enabled');
    rootEl.classList.add(
      settings.style === 'blackout' ? 'chatcloak-style-blackout' : 'chatcloak-style-blur'
    );

    if (settings.categories.sidebar) rootEl.classList.add('chatcloak-cat-sidebar');
    if (settings.categories.profile) rootEl.classList.add('chatcloak-cat-profile');
    if (settings.categories.media) rootEl.classList.add('chatcloak-cat-media');
    if (settings.peekMode) rootEl.classList.add('chatcloak-peek-enabled');
  }

  function applyFullPass() {
    syncRootClasses(currentSettings);
    window.ChatCloakRedactor.applyFullRedaction(adapter, currentSettings);
    if (observer) {
      observer.takeRecords();
    }
  }

  function flushPendingMutations() {
    throttleTimer = null;
    lastFlushTime = Date.now();

    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      pendingElements.clear();
      pendingTextNodes.clear();
      applyFullPass();
      return;
    }

    if (!currentSettings.enabled) {
      pendingElements.clear();
      pendingTextNodes.clear();
      return;
    }

    const els = Array.from(pendingElements);
    const texts = Array.from(pendingTextNodes);
    pendingElements.clear();
    pendingTextNodes.clear();

    window.ChatCloakRedactor.applyIncrementalNodes(adapter, currentSettings, els, texts);
    if (observer) {
      observer.takeRecords();
    }
  }

  function scheduleFlush() {
    const elapsed = Date.now() - lastFlushTime;
    const minInterval = 90;

    if (elapsed >= minInterval && throttleTimer === null) {
      // Leading-edge flush via rAF so streamed tokens are redacted promptly without layout thrash
      throttleTimer = window.setTimeout(() => {
        window.requestAnimationFrame(flushPendingMutations);
      }, 16);
    } else if (throttleTimer === null) {
      throttleTimer = window.setTimeout(() => {
        window.requestAnimationFrame(flushPendingMutations);
      }, minInterval - elapsed);
    }
  }

  function isOwnMutation(mutation) {
    if (mutation.type === 'attributes') {
      if (mutation.attributeName && mutation.attributeName.startsWith('data-chatcloak-')) {
        return true;
      }
    }
    const target = mutation.target;
    if (target && target.nodeType === Node.ELEMENT_NODE) {
      if (
        target.getAttribute('data-chatcloak-ignore') === 'true' ||
        target.getAttribute('data-chatcloak-redacted') === 'true'
      ) {
        return true;
      }
    }
    return false;
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      let sawRelevant = false;

      if (window.location.href !== lastUrl) {
        sawRelevant = true;
      }

      for (const m of mutations) {
        if (isOwnMutation(m)) continue;

        if (m.type === 'characterData') {
          pendingTextNodes.add(m.target);
          sawRelevant = true;
        } else if (m.type === 'childList') {
          for (const added of m.addedNodes) {
            if (added.nodeType === Node.ELEMENT_NODE) {
              if (
                added.getAttribute('data-chatcloak-ignore') === 'true' ||
                added.getAttribute('data-chatcloak-redacted') === 'true'
              ) {
                continue;
              }
              pendingElements.add(added);
              sawRelevant = true;
            } else if (added.nodeType === Node.TEXT_NODE) {
              pendingTextNodes.add(added);
              sawRelevant = true;
            }
          }
        }
      }

      if (sawRelevant) {
        scheduleFlush();
      }
    });

    observer.observe(rootEl, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  // Peek mode Alt-key tracking (strictly gated behind currentSettings.peekMode)
  function setAltHeld(held) {
    if (!currentSettings.enabled || !currentSettings.peekMode) {
      rootEl.classList.remove('chatcloak-alt-held');
      return;
    }
    rootEl.classList.toggle('chatcloak-alt-held', held);
  }

  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Alt' || e.altKey) {
        setAltHeld(true);
      }
    },
    true
  );

  window.addEventListener(
    'keyup',
    (e) => {
      if (e.key === 'Alt' || !e.altKey) {
        setAltHeld(false);
      }
    },
    true
  );

  window.addEventListener('blur', () => {
    setAltHeld(false);
  });

  // SPA navigation listeners + fallback URL check
  window.addEventListener('popstate', () => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      applyFullPass();
    }
  });

  window.addEventListener('hashchange', () => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      applyFullPass();
    }
  });

  window.setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      applyFullPass();
    }
  }, 900);

  // Sync settings changes across tabs immediately
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    chrome.storage.local.get(null, (stored) => {
      currentSettings = normalizeSettings(stored);
      writeBootCache(currentSettings);
      applyFullPass();
    });
  });

  // Popup RPC messages
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) return false;

    if (message.type === 'GET_TAB_STATE') {
      sendResponse({
        supported: true,
        host: adapter.id,
        label: adapter.label,
        manualCount: window.ChatCloakPicker.getManualCount(),
        pickerActive: window.ChatCloakPicker.isActive()
      });
      return true;
    }

    if (message.type === 'START_PICKER') {
      if (!currentSettings.enabled) {
        chrome.storage.local.set({ enabled: true });
      }
      window.ChatCloakPicker.start();
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'CLEAR_MANUAL_CLOAKS') {
      const count = window.ChatCloakPicker.clearManualCloaks();
      sendResponse({ ok: true, manualCount: count });
      return true;
    }

    return false;
  });

  // Bootstrap
  startObserver();
  chrome.storage.local.get(null, (stored) => {
    currentSettings = normalizeSettings(stored);
    writeBootCache(currentSettings);
    applyFullPass();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyFullPass();
    });
  }
})();

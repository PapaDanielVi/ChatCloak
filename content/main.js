(() => {
  'use strict';

  const LOCAL_CACHE_KEY = 'chatcloak_boot_cache_v2';

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
    customKeywords: [],
    siteSettings: {}
  };

  const registry = window.ChatCloakAdapterRegistry;
  const rootEl = document.documentElement;

  let activeAdapter = registry ? registry.resolve(window.location) : null;
  let currentSettings = structuredClone(DEFAULT_SETTINGS);
  let lastUrl = window.location.href;
  let observer = null;
  let shadowObserver = null;
  const observedShadowRoots = new WeakSet();
  let throttleTimer = null;
  let lastFlushTime = 0;
  const pendingElements = new Set();
  const pendingTextNodes = new Set();

  function isSiteEnabledInSettings(adapter, settings) {
    if (!adapter) return false;
    if (!settings || !settings.siteSettings) return true;
    return settings.siteSettings[adapter.id] !== false;
  }

  function isEffectivelyEnabled(adapter, settings) {
    return Boolean(adapter && settings.enabled && isSiteEnabledInSettings(adapter, settings));
  }

  // Synchronous zero-flicker boot protection before first paint at document_start
  if (activeAdapter) {
    rootEl.setAttribute('data-chatcloak-site', activeAdapter.id);
    try {
      const cachedRaw = window.localStorage.getItem(LOCAL_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        const siteAllowed =
          !cached.siteSettings || cached.siteSettings[activeAdapter.id] !== false;
        if (cached && cached.enabled !== false && siteAllowed) {
          rootEl.classList.add('chatcloak-booting');
          if (cached.blurIntensity) {
            rootEl.classList.add(`chatcloak-blur-${cached.blurIntensity}`);
          }
        }
      } else {
        rootEl.classList.add('chatcloak-booting', 'chatcloak-blur-medium');
      }
    } catch (_) {
      rootEl.classList.add('chatcloak-booting', 'chatcloak-blur-medium');
    }
  }

  function normalizeSettings(raw) {
    const s = raw || {};
    const siteSettings = {};
    if (s.siteSettings && typeof s.siteSettings === 'object') {
      for (const [k, v] of Object.entries(s.siteSettings)) {
        if (typeof v === 'boolean') siteSettings[k] = v;
      }
    }
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
        : [],
      siteSettings
    };
  }

  function writeBootCache(settings) {
    try {
      window.localStorage.setItem(
        LOCAL_CACHE_KEY,
        JSON.stringify({
          enabled: settings.enabled,
          blurIntensity: settings.blurIntensity,
          siteSettings: settings.siteSettings
        })
      );
    } catch (_) {
      // Ignore storage quota or restricted storage errors
    }
  }

  function clearRootState() {
    rootEl.removeAttribute('data-chatcloak-site');
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
      'chatcloak-peek-enabled',
      'chatcloak-alt-held'
    );
  }

  function syncRootClasses(adapter, settings) {
    clearRootState();
    if (!adapter) return;

    rootEl.setAttribute('data-chatcloak-site', adapter.id);
    rootEl.classList.add(`chatcloak-blur-${settings.blurIntensity}`);

    if (!isEffectivelyEnabled(adapter, settings)) {
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

  function observeNewShadowRoots() {
    if (!activeAdapter || !activeAdapter.supportsShadowDom || !shadowObserver) return;
    const roots = activeAdapter.collectRoots(document);
    for (const r of roots) {
      if (r instanceof ShadowRoot && !observedShadowRoots.has(r)) {
        observedShadowRoots.add(r);
        shadowObserver.observe(r, {
          childList: true,
          subtree: true,
          characterData: true
        });
      }
    }
  }

  function deactivateAdapter(prevAdapter) {
    pendingElements.clear();
    pendingTextNodes.clear();
    if (throttleTimer !== null) {
      window.clearTimeout(throttleTimer);
      throttleTimer = null;
    }
    window.ChatCloakPicker.stop();
    window.ChatCloakPicker.clearManualCloaks(prevAdapter);
    if (prevAdapter) {
      window.ChatCloakRedactor.restoreAllTextRedactions(prevAdapter);
      window.ChatCloakRedactor.clearAllCloaks(prevAdapter);
    }
    clearRootState();
    if (observer) observer.takeRecords();
    if (shadowObserver) shadowObserver.takeRecords();
  }

  function applyFullPass() {
    if (!activeAdapter) {
      clearRootState();
      return;
    }
    const effective = isEffectivelyEnabled(activeAdapter, currentSettings);
    syncRootClasses(activeAdapter, currentSettings);
    window.ChatCloakRedactor.applyFullRedaction(activeAdapter, currentSettings, effective);
    observeNewShadowRoots();
    if (observer) observer.takeRecords();
    if (shadowObserver) shadowObserver.takeRecords();
  }

  function handleRouteChange() {
    if (window.location.href === lastUrl) return;
    lastUrl = window.location.href;
    pendingElements.clear();
    pendingTextNodes.clear();

    const nextAdapter = registry ? registry.resolve(window.location) : null;
    if (activeAdapter && (!nextAdapter || nextAdapter.id !== activeAdapter.id)) {
      deactivateAdapter(activeAdapter);
    }
    activeAdapter = nextAdapter;
    if (activeAdapter) {
      applyFullPass();
    }
  }

  function flushPendingMutations() {
    throttleTimer = null;
    lastFlushTime = Date.now();

    if (window.location.href !== lastUrl) {
      handleRouteChange();
      return;
    }

    if (!isEffectivelyEnabled(activeAdapter, currentSettings)) {
      pendingElements.clear();
      pendingTextNodes.clear();
      return;
    }

    const els = Array.from(pendingElements);
    const texts = Array.from(pendingTextNodes);
    pendingElements.clear();
    pendingTextNodes.clear();

    window.ChatCloakRedactor.applyIncrementalNodes(
      activeAdapter,
      currentSettings,
      els,
      texts,
      true
    );
    observeNewShadowRoots();
    if (observer) observer.takeRecords();
    if (shadowObserver) shadowObserver.takeRecords();
  }

  function scheduleFlush() {
    const elapsed = Date.now() - lastFlushTime;
    const minInterval = 90;

    if (elapsed >= minInterval && throttleTimer === null) {
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

  function handleMutationBatch(mutations) {
    if (window.location.href !== lastUrl) {
      handleRouteChange();
      return;
    }

    if (!isEffectivelyEnabled(activeAdapter, currentSettings)) {
      return;
    }

    let sawRelevant = false;
    for (const m of mutations) {
      if (isOwnMutation(m)) continue;

      if (m.type === 'characterData') {
        pendingTextNodes.add(m.target);
        sawRelevant = true;
      } else if (m.type === 'attributes') {
        if (m.target && m.target.nodeType === Node.ELEMENT_NODE) {
          pendingElements.add(m.target);
          sawRelevant = true;
        }
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
  }

  function startObservers() {
    if (!observer) {
      observer = new MutationObserver(handleMutationBatch);
      observer.observe(rootEl, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['open', 'aria-expanded', 'hidden']
      });
    }
    if (!shadowObserver) {
      shadowObserver = new MutationObserver(handleMutationBatch);
    }
  }

  function setAltHeld(held) {
    if (!isEffectivelyEnabled(activeAdapter, currentSettings) || !currentSettings.peekMode) {
      rootEl.classList.remove('chatcloak-alt-held');
      return;
    }
    rootEl.classList.toggle('chatcloak-alt-held', held);
  }

  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Alt' || e.altKey) setAltHeld(true);
    },
    true
  );

  window.addEventListener(
    'keyup',
    (e) => {
      if (e.key === 'Alt' || !e.altKey) setAltHeld(false);
    },
    true
  );

  window.addEventListener('blur', () => setAltHeld(false));

  // SPA navigation detection (history hooks, Navigation API, popstate/hashchange, and polling fallback)
  const rawPushState = window.history.pushState;
  const rawReplaceState = window.history.replaceState;
  window.history.pushState = function (...args) {
    const res = rawPushState.apply(this, args);
    handleRouteChange();
    return res;
  };
  window.history.replaceState = function (...args) {
    const res = rawReplaceState.apply(this, args);
    handleRouteChange();
    return res;
  };

  window.addEventListener('popstate', handleRouteChange);
  window.addEventListener('hashchange', handleRouteChange);
  if (window.navigation && typeof window.navigation.addEventListener === 'function') {
    window.navigation.addEventListener('navigatesuccess', handleRouteChange);
  }
  window.setInterval(handleRouteChange, 500);

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
      if (!activeAdapter) {
        sendResponse({ supported: false });
        return true;
      }
      sendResponse({
        supported: true,
        siteId: activeAdapter.id,
        host: activeAdapter.id,
        displayName: activeAdapter.displayName,
        label: activeAdapter.displayName,
        siteEnabled: isSiteEnabledInSettings(activeAdapter, currentSettings),
        effectivelyEnabled: isEffectivelyEnabled(activeAdapter, currentSettings),
        manualCount: window.ChatCloakPicker.getManualCount(),
        pickerActive: window.ChatCloakPicker.isActive()
      });
      return true;
    }

    if (message.type === 'START_PICKER') {
      if (!activeAdapter) {
        sendResponse({ ok: false });
        return true;
      }
      const patch = {};
      if (!currentSettings.enabled) patch.enabled = true;
      if (!isSiteEnabledInSettings(activeAdapter, currentSettings)) {
        patch.siteSettings = {
          ...currentSettings.siteSettings,
          [activeAdapter.id]: true
        };
      }
      if (Object.keys(patch).length > 0) {
        chrome.storage.local.set(patch);
      }
      window.ChatCloakPicker.start();
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'CLEAR_MANUAL_CLOAKS') {
      const count = window.ChatCloakPicker.clearManualCloaks(activeAdapter);
      sendResponse({ ok: true, manualCount: count });
      return true;
    }

    return false;
  });

  // Bootstrap
  startObservers();
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

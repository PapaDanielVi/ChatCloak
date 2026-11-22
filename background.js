'use strict';

importScripts('shared/sites.js');

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
  siteSettings: globalThis.ChatCloakSites.createDefaultSiteSettings()
};

const BADGE_BG_COLOR = '#0d9488';
const BADGE_TEXT_COLOR = '#ffffff';

function mergeSettings(stored) {
  const s = stored || {};
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
    siteSettings: globalThis.ChatCloakSites.mergeSiteSettings(s.siteSettings)
  };
}

async function updateBadge(enabled) {
  try {
    await chrome.action.setBadgeText({ text: enabled ? 'ON' : '' });
    if (enabled) {
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_BG_COLOR });
      if (typeof chrome.action.setBadgeTextColor === 'function') {
        await chrome.action.setBadgeTextColor({ color: BADGE_TEXT_COLOR });
      }
    }
  } catch (err) {
    console.warn('[ChatCloak] Failed to update badge:', err);
  }
}

async function ensureDefaultsAndSyncBadge() {
  try {
    const stored = await chrome.storage.local.get(null);
    const merged = mergeSettings(stored);
    await chrome.storage.local.set(merged);
    await updateBadge(merged.enabled);
  } catch (err) {
    console.warn('[ChatCloak] Failed to initialize defaults:', err);
  }
}

async function syncBadgeFromStorage() {
  try {
    const stored = await chrome.storage.local.get(['enabled']);
    const enabled =
      typeof stored.enabled === 'boolean' ? stored.enabled : DEFAULT_SETTINGS.enabled;
    await updateBadge(enabled);
  } catch (err) {
    console.warn('[ChatCloak] Failed to sync badge:', err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaultsAndSyncBadge();
});

chrome.runtime.onStartup.addListener(() => {
  syncBadgeFromStorage();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes.enabled) {
    updateBadge(Boolean(changes.enabled.newValue));
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-chatcloak') return;
  try {
    const stored = await chrome.storage.local.get(['enabled']);
    const current =
      typeof stored.enabled === 'boolean' ? stored.enabled : DEFAULT_SETTINGS.enabled;
    const next = !current;
    await chrome.storage.local.set({ enabled: next });
    await updateBadge(next);
  } catch (err) {
    console.warn('[ChatCloak] Failed to toggle via command:', err);
  }
});

syncBadgeFromStorage();

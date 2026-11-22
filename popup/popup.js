'use strict';

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

const els = {
  masterToggle: document.getElementById('master-toggle'),
  statusPill: document.getElementById('status-pill'),
  siteBadge: document.getElementById('site-badge'),
  pickBtn: document.getElementById('pick-btn'),
  clearManualBtn: document.getElementById('clear-manual-btn'),
  manualCount: document.getElementById('manual-count'),
  styleButtons: document.querySelectorAll('[data-style]'),
  intensityButtons: document.querySelectorAll('[data-intensity]'),
  intensityRow: document.getElementById('intensity-row'),
  catSidebar: document.getElementById('cat-sidebar'),
  catProfile: document.getElementById('cat-profile'),
  catMedia: document.getElementById('cat-media'),
  catPii: document.getElementById('cat-pii'),
  peekMode: document.getElementById('peek-mode'),
  caseInsensitive: document.getElementById('case-insensitive'),
  keywordForm: document.getElementById('keyword-form'),
  keywordInput: document.getElementById('keyword-input'),
  keywordChips: document.getElementById('keyword-chips')
};

let currentSettings = structuredClone(DEFAULT_SETTINGS);
let activeTabId = null;

function mergeSettings(raw) {
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

function renderKeywords(keywords) {
  els.keywordChips.textContent = '';

  if (!keywords || keywords.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'keyword-empty';
    empty.textContent = 'No custom keywords added yet.';
    els.keywordChips.appendChild(empty);
    return;
  }

  for (const kw of keywords) {
    const chip = document.createElement('span');
    chip.className = 'chip';

    const label = document.createElement('span');
    label.className = 'chip-text';
    label.textContent = kw;
    label.title = kw;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'chip-remove';
    removeBtn.setAttribute('aria-label', `Remove ${kw}`);
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => removeKeyword(kw));

    chip.appendChild(label);
    chip.appendChild(removeBtn);
    els.keywordChips.appendChild(chip);
  }
}

function renderSettings(settings) {
  els.masterToggle.checked = settings.enabled;
  els.statusPill.textContent = settings.enabled ? 'Active' : 'Paused';
  els.statusPill.classList.toggle('status-on', settings.enabled);
  els.statusPill.classList.toggle('status-off', !settings.enabled);

  for (const btn of els.styleButtons) {
    btn.classList.toggle('active', btn.dataset.style === settings.style);
  }

  for (const btn of els.intensityButtons) {
    btn.classList.toggle('active', btn.dataset.intensity === settings.blurIntensity);
  }
  els.intensityRow.classList.toggle('disabled', settings.style === 'blackout');

  els.catSidebar.checked = settings.categories.sidebar;
  els.catProfile.checked = settings.categories.profile;
  els.catMedia.checked = settings.categories.media;
  els.catPii.checked = settings.categories.pii;
  els.peekMode.checked = settings.peekMode;
  els.caseInsensitive.checked = settings.caseInsensitive;

  renderKeywords(settings.customKeywords);
}

async function savePartial(patch) {
  currentSettings = mergeSettings({ ...currentSettings, ...patch });
  renderSettings(currentSettings);
  await chrome.storage.local.set(currentSettings);
}

async function saveCategory(key, value) {
  currentSettings = mergeSettings({
    ...currentSettings,
    categories: {
      ...currentSettings.categories,
      [key]: value
    }
  });
  renderSettings(currentSettings);
  await chrome.storage.local.set({ categories: currentSettings.categories });
}

async function addKeyword(raw) {
  const value = raw.trim();
  if (!value) return;

  const exists = currentSettings.customKeywords.some(
    (k) => k.toLowerCase() === value.toLowerCase()
  );
  if (exists) {
    els.keywordInput.value = '';
    return;
  }

  const next = [...currentSettings.customKeywords, value];
  els.keywordInput.value = '';
  await savePartial({ customKeywords: next });
}

async function removeKeyword(target) {
  const next = currentSettings.customKeywords.filter((k) => k !== target);
  await savePartial({ customKeywords: next });
}

function setUnsupportedTabState() {
  els.siteBadge.textContent = 'Open ChatGPT, Gemini, or Claude';
  els.siteBadge.classList.remove('supported');
  els.pickBtn.disabled = true;
  els.clearManualBtn.disabled = true;
  els.manualCount.textContent = '0';
}

async function queryActiveTabState() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || typeof tab.id !== 'number') {
      setUnsupportedTabState();
      return;
    }

    activeTabId = tab.id;
    const response = await chrome.tabs.sendMessage(activeTabId, { type: 'GET_TAB_STATE' });
    if (!response || !response.supported) {
      setUnsupportedTabState();
      return;
    }

    els.siteBadge.textContent = `Connected: ${response.label}`;
    els.siteBadge.classList.add('supported');
    els.pickBtn.disabled = false;

    const count = Number(response.manualCount) || 0;
    els.manualCount.textContent = String(count);
    els.clearManualBtn.disabled = count === 0;
  } catch (_) {
    setUnsupportedTabState();
  }
}

function bindEvents() {
  els.masterToggle.addEventListener('change', () => {
    savePartial({ enabled: els.masterToggle.checked });
  });

  for (const btn of els.styleButtons) {
    btn.addEventListener('click', () => {
      savePartial({ style: btn.dataset.style });
    });
  }

  for (const btn of els.intensityButtons) {
    btn.addEventListener('click', () => {
      savePartial({ blurIntensity: btn.dataset.intensity });
    });
  }

  els.catSidebar.addEventListener('change', () => {
    saveCategory('sidebar', els.catSidebar.checked);
  });
  els.catProfile.addEventListener('change', () => {
    saveCategory('profile', els.catProfile.checked);
  });
  els.catMedia.addEventListener('change', () => {
    saveCategory('media', els.catMedia.checked);
  });
  els.catPii.addEventListener('change', () => {
    saveCategory('pii', els.catPii.checked);
  });

  els.peekMode.addEventListener('change', () => {
    savePartial({ peekMode: els.peekMode.checked });
  });

  els.caseInsensitive.addEventListener('change', () => {
    savePartial({ caseInsensitive: els.caseInsensitive.checked });
  });

  els.keywordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addKeyword(els.keywordInput.value);
  });

  els.pickBtn.addEventListener('click', async () => {
    if (activeTabId === null) return;
    try {
      await chrome.tabs.sendMessage(activeTabId, { type: 'START_PICKER' });
      window.close();
    } catch (_) {
      setUnsupportedTabState();
    }
  });

  els.clearManualBtn.addEventListener('click', async () => {
    if (activeTabId === null) return;
    try {
      const res = await chrome.tabs.sendMessage(activeTabId, {
        type: 'CLEAR_MANUAL_CLOAKS'
      });
      const count = Number(res && res.manualCount) || 0;
      els.manualCount.textContent = String(count);
      els.clearManualBtn.disabled = count === 0;
    } catch (_) {
      setUnsupportedTabState();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    chrome.storage.local.get(null, (stored) => {
      currentSettings = mergeSettings(stored);
      renderSettings(currentSettings);
    });
  });
}

async function init() {
  bindEvents();
  const stored = await chrome.storage.local.get(null);
  currentSettings = mergeSettings(stored);
  renderSettings(currentSettings);
  await queryActiveTabState();
}

init();

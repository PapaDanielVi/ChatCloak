(() => {
  'use strict';

  const SITE_DEFINITIONS = [
    {
      id: 'chatgpt',
      displayName: 'ChatGPT',
      hostPatterns: ['chatgpt.com', '*.chatgpt.com']
    },
    {
      id: 'gemini',
      displayName: 'Google Gemini',
      hostPatterns: ['gemini.google.com']
    },
    {
      id: 'claude',
      displayName: 'Claude',
      hostPatterns: ['claude.ai', '*.claude.ai']
    },
    {
      id: 'grok',
      displayName: 'Grok',
      hostPatterns: ['grok.com', '*.grok.com', 'x.com', 'www.x.com']
    },
    {
      id: 'deepseek',
      displayName: 'DeepSeek',
      hostPatterns: ['chat.deepseek.com']
    },
    {
      id: 'perplexity',
      displayName: 'Perplexity',
      hostPatterns: ['www.perplexity.ai', 'perplexity.ai']
    },
    {
      id: 'copilot',
      displayName: 'Microsoft Copilot',
      hostPatterns: ['copilot.microsoft.com', 'copilot.cloud.microsoft']
    },
    {
      id: 'meta',
      displayName: 'Meta AI',
      hostPatterns: ['www.meta.ai', 'meta.ai']
    },
    {
      id: 'qwen',
      displayName: 'Qwen',
      hostPatterns: ['chat.qwen.ai']
    },
    {
      id: 'mistral',
      displayName: 'Mistral',
      hostPatterns: ['chat.mistral.ai']
    },
    {
      id: 'poe',
      displayName: 'Poe',
      hostPatterns: ['poe.com', 'www.poe.com']
    },
    {
      id: 'kimi',
      displayName: 'Kimi',
      hostPatterns: ['kimi.com', 'www.kimi.com']
    },
    {
      id: 'duckai',
      displayName: 'Duck.ai',
      hostPatterns: ['duck.ai']
    }
  ];

  function createDefaultSiteSettings() {
    const map = {};
    for (const site of SITE_DEFINITIONS) {
      map[site.id] = true;
    }
    return map;
  }

  function mergeSiteSettings(raw) {
    const defaults = createDefaultSiteSettings();
    if (!raw || typeof raw !== 'object') return defaults;
    for (const site of SITE_DEFINITIONS) {
      if (typeof raw[site.id] === 'boolean') {
        defaults[site.id] = raw[site.id];
      }
    }
    return defaults;
  }

  globalThis.ChatCloakSites = {
    SITE_DEFINITIONS,
    createDefaultSiteSettings,
    mergeSiteSettings
  };
})();

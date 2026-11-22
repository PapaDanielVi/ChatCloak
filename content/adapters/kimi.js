(() => {
  'use strict';

  const BaseAdapter = window.ChatCloakBaseAdapter;

  class KimiAdapter extends BaseAdapter {
    constructor() {
      super({
        id: 'kimi',
        displayName: 'Kimi',
        hostPatterns: ['kimi.com', 'www.kimi.com']
      });
    }

    getSidebarSelectors() {
      return [
        ...super.getSidebarSelectors(),
        'nav a[href*="/chat/"]',
        'aside a[href*="/chat/"]',
        '[class*="history-list"] a',
        '[class*="chat-item"]'
      ];
    }

    getProfileSelectors() {
      return [
        ...super.getProfileSelectors(),
        '[class*="user-info"]',
        '[class*="avatar"]',
        'aside button:has(img)',
        'nav button:has(img)'
      ];
    }

    getMediaSelectors() {
      return [
        ...super.getMediaSelectors(),
        '[class*="file-card"]',
        '[class*="attachment"]'
      ];
    }

    getMessageContainerSelectors() {
      return [
        ...super.getMessageContainerSelectors(),
        '[class*="message"]',
        '[class*="markdown"]',
        '[class*="think"]',
        '[class*="reasoning"]',
        'main details'
      ];
    }
  }

  window.ChatCloakAdapters.push(new KimiAdapter());
})();

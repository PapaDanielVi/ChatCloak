(() => {
  'use strict';

  const BaseAdapter = window.ChatCloakBaseAdapter;

  class QwenAdapter extends BaseAdapter {
    constructor() {
      super({
        id: 'qwen',
        displayName: 'Qwen',
        hostPatterns: ['chat.qwen.ai']
      });
    }

    getSidebarSelectors() {
      return [
        ...super.getSidebarSelectors(),
        'nav a[href*="/c/"]',
        'aside a[href*="/c/"]',
        '[class*="chat-list"] a',
        '[class*="chat-item"]',
        '[class*="history"] [role="listitem"]'
      ];
    }

    getProfileSelectors() {
      return [
        ...super.getProfileSelectors(),
        '[class*="user-avatar"]',
        '[class*="user-info"]',
        'aside button:has(img)',
        'nav button:has(img)'
      ];
    }

    getMediaSelectors() {
      return [
        ...super.getMediaSelectors(),
        '[class*="file-item"]',
        '[class*="attachment"]',
        '[class*="upload-preview"]'
      ];
    }

    getMessageContainerSelectors() {
      return [
        ...super.getMessageContainerSelectors(),
        '[class*="message"]',
        '[class*="markdown"]',
        '[class*="thinking"]',
        '[class*="thought"]',
        '[class*="reasoning"]',
        'main details'
      ];
    }
  }

  window.ChatCloakAdapters.push(new QwenAdapter());
})();

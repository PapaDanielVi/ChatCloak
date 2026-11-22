(() => {
  'use strict';

  const BaseAdapter = window.ChatCloakBaseAdapter;

  class DeepSeekAdapter extends BaseAdapter {
    constructor() {
      super({
        id: 'deepseek',
        displayName: 'DeepSeek',
        hostPatterns: ['chat.deepseek.com']
      });
    }

    getSidebarSelectors() {
      return [
        ...super.getSidebarSelectors(),
        'nav a[href*="/a/chat/"]',
        'aside a[href*="/a/chat/"]',
        'a[href*="/a/chat/s/"]',
        '[class*="chat-history"] a',
        '[class*="session-item"]',
        '[class*="chat-list"] [role="button"]'
      ];
    }

    getProfileSelectors() {
      return [
        ...super.getProfileSelectors(),
        '[class*="user-info"]',
        '[class*="user-profile"]',
        'aside [class*="avatar"]',
        'nav [class*="avatar"]',
        'aside button:has(img)'
      ];
    }

    getMediaSelectors() {
      return [
        ...super.getMediaSelectors(),
        '[class*="file-card"]',
        '[class*="attachment"]',
        '[class*="upload-preview"]'
      ];
    }

    getMessageContainerSelectors() {
      return [
        ...super.getMessageContainerSelectors(),
        '.ds-markdown',
        '.ds-message',
        '[class*="ds-think"]',
        '[class*="thinking"]',
        '[class*="thought"]',
        '[class*="reasoning"]',
        'main details',
        'main [role="region"]'
      ];
    }
  }

  window.ChatCloakAdapters.push(new DeepSeekAdapter());
})();

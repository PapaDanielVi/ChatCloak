(() => {
  'use strict';

  const BaseAdapter = window.ChatCloakBaseAdapter;

  class GeminiAdapter extends BaseAdapter {
    constructor() {
      super({
        id: 'gemini',
        displayName: 'Google Gemini',
        hostPatterns: ['gemini.google.com']
      });
    }

    getSidebarSelectors() {
      return [
        'bard-sidenav conversations-list',
        'bard-sidenav [role="listitem"]',
        '[data-test-id="all-conversations"]',
        '[data-test-id="pinned-conversations"]',
        '[data-test-id="conversation"]',
        '[data-test-id="gems-list"]',
        'gems-list',
        'a[href^="/app/"]',
        'a[href^="/gem/"]',
        'nav [role="listitem"]',
        'location-footer',
        '[data-test-id="location-info"]',
        '[data-test-id="conversation-title"]'
      ];
    }

    getProfileSelectors() {
      return [
        'a[aria-label*="Google Account" i]',
        'button[aria-label*="Google Account" i]',
        '[data-ogsr-up]',
        'a[href*="accounts.google.com"]',
        'img[src*="googleusercontent.com/a/"]',
        '[data-test-id="user-profile"]',
        '[data-test-id="bard-avatar"]',
        '[aria-label*="Account" i] img',
        'bard-greeting',
        'modular-greeting',
        '[data-test-id*="greeting" i]'
      ];
    }

    getMediaSelectors() {
      return [
        'user-query img',
        'model-response img',
        'chat-window img[src^="blob:"]',
        'chat-window img[src^="data:"]',
        'chat-window img[src*="googleusercontent.com"]:not([src*="/a/"])',
        'uploaded-file',
        'file-preview',
        '[data-test-id="uploaded-file"]',
        '[data-test-id="image-preview"]'
      ];
    }

    getMessageContainerSelectors() {
      return [
        'user-query',
        'model-response',
        'message-content',
        '[data-test-id="user-query"]',
        '[data-test-id="model-response"]',
        '.conversation-container'
      ];
    }
  }

  window.ChatCloakAdapters.push(new GeminiAdapter());
})();

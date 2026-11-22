(() => {
  'use strict';

  const BaseAdapter = window.ChatCloakBaseAdapter;

  class ChatGptAdapter extends BaseAdapter {
    constructor() {
      super({
        id: 'chatgpt',
        displayName: 'ChatGPT',
        hostPatterns: ['chatgpt.com', '*.chatgpt.com']
      });
    }

    getSidebarSelectors() {
      return [
        'nav #history a',
        'nav #history li',
        'nav a[href^="/c/"]',
        'nav a[href^="/g/"]',
        'nav a[href^="/project"]',
        'nav [data-testid^="history-item"]',
        'nav [data-testid="chat-history-item"]',
        'nav [data-testid="project-item"]',
        'nav [data-testid*="gizmo"]',
        'nav [data-testid*="workspace"]',
        'nav [role="listitem"]',
        'aside a[href^="/c/"]',
        'aside a[href^="/g/"]',
        '[data-testid="workspace-switcher"]',
        '[data-testid="conversation-header"]'
      ];
    }

    getProfileSelectors() {
      return [
        '[data-testid="profile-button"]',
        '[data-testid="accounts-profile-button"]',
        '[data-testid*="user-profile"]',
        '[data-testid="user-menu"]',
        '[data-testid="account-menu"]',
        '[data-testid="plan-badge"]',
        'button[aria-label*="profile" i]',
        'button[aria-label*="account" i]',
        'nav button:has(img[alt])',
        'aside button:has(img[alt])',
        'header button:has(img[alt])'
      ];
    }

    getMediaSelectors() {
      return [
        'main [data-testid^="conversation-turn"] img:not([alt="User"]):not([data-chatcloak-ignore])',
        'main article img[src^="blob:"]',
        'main article img[src^="data:"]',
        'main article img[src*="oaiusercontent.com"]',
        'main [data-testid="image-attachment"]',
        'main [data-testid="file-tile"]',
        'main [data-testid*="attachment"]'
      ];
    }

    getMessageContainerSelectors() {
      return [
        '[data-testid^="conversation-turn"]',
        '[data-message-id]',
        '[data-message-author-role]',
        'main article'
      ];
    }
  }

  window.ChatCloakAdapters.push(new ChatGptAdapter());
})();

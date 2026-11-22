(() => {
  'use strict';

  const BaseAdapter = window.ChatCloakBaseAdapter;

  class ClaudeAdapter extends BaseAdapter {
    constructor() {
      super({
        id: 'claude',
        displayName: 'Claude',
        hostPatterns: ['claude.ai', '*.claude.ai']
      });
    }

    getSidebarSelectors() {
      return [
        'nav a[href^="/chat/"]',
        'nav a[href^="/project/"]',
        'nav a[href^="/recents"]',
        'aside a[href^="/chat/"]',
        'aside a[href^="/project/"]',
        '[data-testid="chat-list"]',
        '[data-testid="recent-chats"]',
        '[data-testid="starred-chats"]',
        '[data-testid="projects-list"]',
        '[data-testid="org-selector"]',
        '[data-testid="workspace-switcher"]',
        '[data-testid="chat-title-button"]'
      ];
    }

    getProfileSelectors() {
      return [
        '[data-testid="user-menu-button"]',
        '[data-testid="profile-button"]',
        '[data-testid="user-avatar"]',
        '[data-testid="user-name"]',
        '[data-testid="user-email"]',
        '[data-testid="plan-badge"]',
        'button[aria-label*="User menu" i]',
        'button[aria-label*="Account" i]',
        'nav button[aria-haspopup="menu"]',
        'aside button[aria-haspopup="menu"]'
      ];
    }

    getMediaSelectors() {
      return [
        '[data-testid="user-message"] img',
        '[data-testid="file-thumbnail"]',
        '[data-testid="attachment-preview"]',
        '[data-testid="image-preview"]',
        'main img[src^="blob:"]',
        'main img[src^="data:"]',
        'main [data-testid*="attachment"]',
        'main [data-testid*="file-preview"]'
      ];
    }

    getMessageContainerSelectors() {
      return [
        '[data-testid="user-message"]',
        '[data-testid="chat-message"]',
        '[data-is-streaming]',
        '.font-claude-response',
        '.font-claude-message',
        '.font-user-message',
        'main [data-test-render-count]'
      ];
    }
  }

  window.ChatCloakAdapters.push(new ClaudeAdapter());
})();

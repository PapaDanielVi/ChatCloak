(() => {
  'use strict';

  const BaseAdapter = window.ChatCloakBaseAdapter;

  class PoeAdapter extends BaseAdapter {
    constructor() {
      super({
        id: 'poe',
        displayName: 'Poe',
        hostPatterns: ['poe.com', 'www.poe.com']
      });
    }

    getSidebarSelectors() {
      return [
        ...super.getSidebarSelectors(),
        'nav a[href^="/chat/"]',
        'aside a[href^="/chat/"]',
        '[class*="ChatHistoryList"] a',
        '[class*="BotList"] a',
        '[class*="Sidebar"] a[href^="/chat/"]',
        '[role="navigation"] [role="listitem"]'
      ];
    }

    getProfileSelectors() {
      return [
        ...super.getProfileSelectors(),
        '[class*="UserProfile"]',
        '[class*="ProfileButton"]',
        'a[href="/settings"]',
        'a[href="/profile"]'
      ];
    }

    getMediaSelectors() {
      return [
        ...super.getMediaSelectors(),
        '[class*="FileAttachment"]',
        '[class*="MessageImage"]'
      ];
    }

    getMessageContainerSelectors() {
      return [
        ...super.getMessageContainerSelectors(),
        '[class*="Message_row"]',
        '[class*="ChatMessage"]'
      ];
    }
  }

  window.ChatCloakAdapters.push(new PoeAdapter());
})();

(() => {
  'use strict';

  const BaseAdapter = window.ChatCloakBaseAdapter;

  class DuckAiAdapter extends BaseAdapter {
    constructor() {
      super({
        id: 'duckai',
        displayName: 'Duck.ai',
        hostPatterns: ['duck.ai']
      });
    }

    getSidebarSelectors() {
      return [
        ...super.getSidebarSelectors(),
        'nav [role="listitem"]',
        'aside [role="listitem"]',
        '[data-testid*="chat-history"]',
        '[aria-label*="Recent chats" i] li',
        '[aria-label*="Conversations" i] li',
        'aside ul li button'
      ];
    }

    getProfileSelectors() {
      return [
        ...super.getProfileSelectors(),
        '[data-testid*="account" i]'
      ];
    }

    getMediaSelectors() {
      return [
        ...super.getMediaSelectors()
      ];
    }

    getMessageContainerSelectors() {
      return [
        ...super.getMessageContainerSelectors(),
        '[data-testid*="turn"]',
        '[role="article"]'
      ];
    }
  }

  window.ChatCloakAdapters.push(new DuckAiAdapter());
})();

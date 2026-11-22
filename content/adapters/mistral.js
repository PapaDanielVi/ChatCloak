(() => {
  'use strict';

  const BaseAdapter = window.ChatCloakBaseAdapter;

  class MistralAdapter extends BaseAdapter {
    constructor() {
      super({
        id: 'mistral',
        displayName: 'Mistral',
        hostPatterns: ['chat.mistral.ai']
      });
    }

    getSidebarSelectors() {
      return [
        ...super.getSidebarSelectors(),
        'nav a[href^="/chat/"]',
        'aside a[href^="/chat/"]',
        '[data-testid*="workspace" i]',
        '[data-testid*="organization" i]',
        '[aria-label*="Workspace" i]',
        'nav [role="listitem"]'
      ];
    }

    getProfileSelectors() {
      return [
        ...super.getProfileSelectors(),
        'nav button[aria-haspopup="menu"]',
        'aside button[aria-haspopup="menu"]',
        'aside button:has(img)'
      ];
    }

    getMediaSelectors() {
      return [
        ...super.getMediaSelectors(),
        'main [data-testid*="file"]'
      ];
    }

    getMessageContainerSelectors() {
      return [
        ...super.getMessageContainerSelectors(),
        '.prose',
        'main [class*="prose"]'
      ];
    }
  }

  window.ChatCloakAdapters.push(new MistralAdapter());
})();

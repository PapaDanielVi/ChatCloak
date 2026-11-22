(() => {
  'use strict';

  const BaseAdapter = window.ChatCloakBaseAdapter;

  class MetaAiAdapter extends BaseAdapter {
    constructor() {
      super({
        id: 'meta',
        displayName: 'Meta AI',
        hostPatterns: ['www.meta.ai', 'meta.ai']
      });
    }

    getSidebarSelectors() {
      return [
        ...super.getSidebarSelectors(),
        'nav a[href^="/c/"]',
        'aside a[href^="/c/"]',
        '[aria-label*="Threads" i] a',
        '[role="navigation"] a[href^="/c/"]'
      ];
    }

    getProfileSelectors() {
      return [
        ...super.getProfileSelectors(),
        'img[src*="fbcdn.net"]',
        'img[src*="cdninstagram.com"]',
        '[aria-label*="Meta account" i]',
        '[aria-label*="Facebook" i]',
        '[aria-label*="Instagram" i]',
        'nav button:has(img)',
        'aside button:has(img)'
      ];
    }

    getMediaSelectors() {
      return [
        ...super.getMediaSelectors(),
        'main video'
      ];
    }

    getMessageContainerSelectors() {
      return [
        ...super.getMessageContainerSelectors(),
        '[role="article"]',
        'main [dir="auto"]'
      ];
    }
  }

  window.ChatCloakAdapters.push(new MetaAiAdapter());
})();

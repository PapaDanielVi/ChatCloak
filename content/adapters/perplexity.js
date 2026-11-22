(() => {
  'use strict';

  const BaseAdapter = window.ChatCloakBaseAdapter;

  class PerplexityAdapter extends BaseAdapter {
    constructor() {
      super({
        id: 'perplexity',
        displayName: 'Perplexity',
        hostPatterns: ['www.perplexity.ai', 'perplexity.ai']
      });
    }

    getSidebarSelectors() {
      return [
        ...super.getSidebarSelectors(),
        'nav a[href^="/search/"]',
        'nav a[href^="/spaces/"]',
        'nav a[href^="/collections/"]',
        'aside a[href^="/search/"]',
        'aside a[href^="/spaces/"]',
        'aside a[href^="/collections/"]',
        '[data-testid="sidebar-thread"]',
        '[data-testid*="library"]',
        '[data-testid*="space"]',
        '[data-testid*="collection"]'
      ];
    }

    getProfileSelectors() {
      return [
        ...super.getProfileSelectors(),
        '[data-testid*="pro-badge" i]',
        'a[href^="/settings"]',
        'nav button:has(img[alt])',
        'aside button:has(img[alt])'
      ];
    }

    getMediaSelectors() {
      return [
        ...super.getMediaSelectors(),
        '[data-testid="uploaded-file"]',
        '[data-testid*="file-chip"]',
        '[data-testid*="document-chip"]',
        'main [data-testid*="file"]'
      ];
    }

    getMessageContainerSelectors() {
      return [
        ...super.getMessageContainerSelectors(),
        '[data-testid="answer"]',
        '[data-testid="user-query"]',
        '.prose',
        'main [class*="prose"]',
        'main h1'
      ];
    }
  }

  window.ChatCloakAdapters.push(new PerplexityAdapter());
})();

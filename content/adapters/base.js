(() => {
  'use strict';

  class BaseAdapter {
    constructor(config) {
      const cfg = config || {};
      this.id = cfg.id || 'base';
      this.displayName = cfg.displayName || cfg.label || this.id;
      this.label = this.displayName;
      this.hostPatterns = Array.isArray(cfg.hostPatterns) ? cfg.hostPatterns : [];
      this.pathRegex = cfg.pathRegex || null;
      this.supportsShadowDom = Boolean(cfg.supportsShadowDom);
    }

    matchesHostPattern(hostname, pattern) {
      if (!hostname || !pattern) return false;
      if (pattern instanceof RegExp) return pattern.test(hostname);
      if (typeof pattern === 'string') {
        if (pattern.startsWith('*.')) {
          const suffix = pattern.slice(1); // ".domain.com"
          return hostname === pattern.slice(2) || hostname.endsWith(suffix);
        }
        return hostname === pattern;
      }
      if (typeof pattern === 'object' && pattern.host) {
        return this.matchesHostPattern(hostname, pattern.host);
      }
      return false;
    }

    matches(hostname, pathname = '/') {
      const normalizedHost = (hostname || '').toLowerCase();
      const normalizedPath = pathname || '/';

      for (const pattern of this.hostPatterns) {
        if (!this.matchesHostPattern(normalizedHost, pattern)) continue;
        const ruleRegex =
          pattern && typeof pattern === 'object' && !(pattern instanceof RegExp) && pattern.pathRegex
            ? pattern.pathRegex
            : this.pathRegex;
        if (ruleRegex && !ruleRegex.test(normalizedPath)) {
          continue;
        }
        return true;
      }
      return false;
    }

    getSidebarSelectors() {
      return [
        'aside [role="list"] [role="listitem"]',
        '[role="navigation"] [role="list"] [role="listitem"]',
        '[aria-label*="history" i] a',
        '[aria-label*="history" i] [role="listitem"]',
        '[aria-label*="recent" i] a',
        '[aria-label*="conversations" i] a',
        '[data-testid*="history" i] a',
        '[data-testid*="conversation" i] a'
      ];
    }

    getProfileSelectors() {
      return [
        'img[alt*="avatar" i]',
        'img[alt*="profile" i]',
        'button[aria-label*="account" i]',
        'button[aria-label*="profile" i]',
        'a[aria-label*="account" i]',
        'a[aria-label*="profile" i]',
        '[data-testid*="user-profile"]',
        '[data-testid*="account-menu"]',
        '[data-testid*="user-menu"]'
      ];
    }

    getMediaSelectors() {
      return [
        'main img[src^="blob:"]',
        'main img[src^="data:"]',
        'main [data-testid*="attachment"]',
        'main [data-testid*="file-preview"]',
        'main [aria-label*="attachment" i]'
      ];
    }

    getMessageContainerSelectors() {
      return [
        '[data-testid*="message" i]',
        '[data-message-id]',
        '[data-message-author-role]',
        'main article'
      ];
    }

    getProfileTextPatterns() {
      return [];
    }

    getExtraCloakElements(_category) {
      return [];
    }

    /**
     * Collects the starting root plus any open Shadow DOM roots inside it when enabled.
     */
    collectRoots(startRoot) {
      const root = startRoot || document;
      if (!this.supportsShadowDom) return [root];

      const roots = [root];
      const visited = new Set([root]);
      const queue = [root];

      while (queue.length > 0) {
        const current = queue.shift();
        const searchRoot = current === document ? document.documentElement || document : current;
        if (!searchRoot || typeof searchRoot.querySelectorAll !== 'function') continue;

        if (current instanceof Element && current.shadowRoot && !visited.has(current.shadowRoot)) {
          visited.add(current.shadowRoot);
          roots.push(current.shadowRoot);
          queue.push(current.shadowRoot);
        }

        const allEls = searchRoot.querySelectorAll('*');
        for (const el of allEls) {
          if (el.shadowRoot && !visited.has(el.shadowRoot)) {
            visited.add(el.shadowRoot);
            roots.push(el.shadowRoot);
            queue.push(el.shadowRoot);
          }
        }
      }

      return roots;
    }

    queryAll(root, selectors) {
      if (!root || !Array.isArray(selectors) || selectors.length === 0) return [];
      const roots = this.collectRoots(root);
      const results = new Set();

      for (const r of roots) {
        if (!r || typeof r.querySelectorAll !== 'function') continue;
        for (const selector of selectors) {
          try {
            const list = r.querySelectorAll(selector);
            for (const el of list) {
              results.add(el);
            }
          } catch (_) {
            // Ignore unsupported selectors in older or partial DOM states
          }
        }
      }

      return Array.from(results);
    }

    matchesAny(el, selectors) {
      if (!el || el.nodeType !== Node.ELEMENT_NODE || !Array.isArray(selectors)) return false;

      let current = el;
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        for (const sel of selectors) {
          try {
            if (current.matches(sel) || current.closest(sel)) return true;
          } catch (_) {
            // Ignore invalid selector
          }
        }
        if (!this.supportsShadowDom) break;
        const rootNode = current.getRootNode();
        current = rootNode && rootNode.host ? rootNode.host : null;
      }

      return false;
    }
  }

  window.ChatCloakBaseAdapter = BaseAdapter;
  window.ChatCloakAdapters = window.ChatCloakAdapters || [];
})();

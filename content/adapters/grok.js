(() => {
  'use strict';

  const BaseAdapter = window.ChatCloakBaseAdapter;

  const HISTORY_SECTION_HEADING_RE =
    /^(?:chats?|projects?|grok\s+bots?|bots?|today|yesterday|previous\s+\d+\s+days|last\s+\d+\s+days|this\s+week|this\s+month|older|pinned|history|recent(?:\s+chats)?|conversations?)$/i;

  const STATIC_NAV_LABELS_RE =
    /^(?:\+\s*)?(?:new\s+chat|new\s+project|create\s+a\s+bot|library|imagine|voice|upgrade(?:\s+to\s+premium)?|see\s+more|show\s+more)$/i;

  const ROW_SELECTOR =
    'a, button, [role="button"], [role="link"], [role="listitem"], [role="option"], li, [tabindex="0"]';

  class GrokAdapter extends BaseAdapter {
    constructor() {
      super({
        id: 'grok',
        displayName: 'Grok',
        hostPatterns: [
          'grok.com',
          '*.grok.com',
          { host: 'x.com', pathRegex: /^\/i\/grok/ },
          { host: 'www.x.com', pathRegex: /^\/i\/grok/ }
        ]
      });
    }

    getSidebarSelectors() {
      return [
        ...super.getSidebarSelectors(),
        'a[href^="/chat/"]',
        'a[href^="/chat?"]',
        'a[href*="/chat/"]',
        'a[href^="/c/"]',
        'a[href*="/c/"]',
        'a[href^="/project/"]',
        'a[href*="/i/grok?"]',
        'a[href*="/i/grok/"]',
        'a[href*="conversation="]',
        '[data-testid*="grok-history" i]',
        '[data-testid*="history" i] a',
        '[data-testid*="history" i] [role="button"]',
        '[data-testid*="history" i] li',
        '[data-testid*="conversation" i]',
        '[data-testid*="chat-item" i]',
        '[data-testid="GrokDrawer"] a',
        '[data-testid="GrokDrawer"] [role="button"]',
        '[aria-label*="Chat history" i] a',
        '[aria-label*="Chat history" i] [role="button"]',
        '[aria-label*="History" i] [role="listitem"]',
        '[aria-label*="History" i] [role="button"]',
        '[role="dialog"] a[href*="/c/"]',
        '[role="dialog"] a[href*="/chat"]',
        '[role="dialog"] a[href*="conversation="]',
        '[role="dialog"] [role="listitem"]',
        '[role="menu"] a[href*="/c/"]',
        '[role="menu"] a[href*="/chat"]'
      ];
    }

    getExtraCloakElements(category) {
      if (category !== 'sidebar' || !document.body) return [];
      const results = new Set();

      const candidates = document.body.querySelectorAll('h2, h3, h4, span, div, p');
      for (const label of candidates) {
        if (label.children.length > 0) continue;
        const text = (label.textContent || '').trim();
        if (!text || text.length > 32 || !HISTORY_SECTION_HEADING_RE.test(text)) continue;

        // Ignore text inside chat messages, inputs, or our own UI
        if (
          label.closest(
            '[data-chatcloak-ignore="true"], [data-testid*="message" i], [role="article"], form, textarea, input, [contenteditable="true"]'
          )
        ) {
          continue;
        }

        // Restrict to sidebar / drawer / dialog geometry so main-pane text is never affected
        const rect = label.getBoundingClientRect();
        const inSidebarContainer = Boolean(
          label.closest(
            'aside, nav, [data-sidebar], [role="complementary"], [role="dialog"], [role="listbox"], [data-testid*="drawer" i], [data-testid*="sidebar" i]'
          )
        );
        if (!inSidebarContainer && (rect.width <= 0 || rect.left > 420)) {
          continue;
        }

        // Climb single-child wrappers to reach the sibling list level
        let headingBlock = label;
        while (
          headingBlock.parentElement &&
          headingBlock.parentElement !== document.body &&
          headingBlock.parentElement.children.length === 1
        ) {
          headingBlock = headingBlock.parentElement;
        }

        const isStaticAction = (el) => {
          const href = el.getAttribute && (el.getAttribute('href') || '');
          if (
            href === '/' ||
            href === '/i/grok' ||
            href === '/imagine' ||
            href === '/voice'
          ) {
            return true;
          }
          const elText = (el.textContent || '').trim();
          return STATIC_NAV_LABELS_RE.test(elText);
        };

        const addRow = (el) => {
          if (!el || el === label || el.contains(label)) return;
          if (isStaticAction(el)) return;
          if (!(el.textContent || '').trim()) return;
          results.add(el);
        };

        let sibling = headingBlock.nextElementSibling;
        while (sibling) {
          const tag = sibling.tagName;
          const sibText = (sibling.textContent || '').trim();

          if (tag === 'FOOTER' || tag === 'NAV') break;
          if (/^upgrade\s+to\s+premium$/i.test(sibText)) break;
          if (
            sibling.querySelector &&
            sibling.querySelector(
              '[data-testid="SideNav_AccountSwitcher_Button"], img[src*="pbs.twimg.com/profile_images"]'
            )
          ) {
            break;
          }

          // Stop if we hit another section heading
          if (
            sibling.children.length <= 1 &&
            sibText.length > 0 &&
            sibText.length <= 32 &&
            !sibling.matches(ROW_SELECTOR) &&
            HISTORY_SECTION_HEADING_RE.test(sibText)
          ) {
            break;
          }

          if (sibling.matches && sibling.matches(ROW_SELECTOR)) {
            addRow(sibling);
          } else {
            const rows = sibling.querySelectorAll(ROW_SELECTOR);
            if (rows.length > 0) {
              for (const row of rows) {
                addRow(row);
              }
            } else if (sibling.children.length > 0) {
              // Handle React Native Web / Tailwind clickable div rows with no role/a tag
              for (const child of sibling.children) {
                addRow(child);
              }
            } else if (sibText.length > 0) {
              addRow(sibling);
            }
          }

          sibling = sibling.nextElementSibling;
        }
      }

      return Array.from(results);
    }

    getProfileSelectors() {
      return [
        ...super.getProfileSelectors(),
        '[data-testid="SideNav_AccountSwitcher_Button"]',
        '[data-testid^="UserAvatar-Container"]',
        '[data-testid="User-Name"]',
        '[data-testid="UserCell"]',
        'img[src*="pbs.twimg.com/profile_images"]',
        'header button:has(img[alt])',
        'aside button:has(img[alt])'
      ];
    }

    getMediaSelectors() {
      return [
        ...super.getMediaSelectors(),
        '[data-testid*="imagine" i]',
        '[aria-label*="Imagine" i]',
        '[data-testid="image-preview"]',
        '[data-testid="video-preview"]',
        'main img[src*="imagine"]',
        'main img[src*="grok"]',
        'main video'
      ];
    }

    getMessageContainerSelectors() {
      return [
        ...super.getMessageContainerSelectors(),
        '[data-testid="message-bubble"]',
        '[data-testid*="grok-message" i]',
        '[class*="message-bubble"]',
        'main [role="article"]'
      ];
    }

    getProfileTextPatterns() {
      return [
        {
          category: 'profile',
          regex: /(?<![A-Za-z0-9_.])@[A-Za-z0-9_]{1,15}\b/g
        }
      ];
    }
  }

  window.ChatCloakAdapters.push(new GrokAdapter());
})();

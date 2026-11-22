(() => {
  'use strict';

  const FORBIDDEN_TAG_SELECTOR =
    'textarea, input, select, option, script, style, noscript, svg, math, canvas, template, [contenteditable="true"], [contenteditable=""], [data-chatcloak-ignore="true"], [data-chatcloak-redacted="true"]';

  // Maps an original anchor Text node to the extra nodes created by splitText()
  let splitArtifacts = new WeakMap();
  // Maps a Text node to `${rulesSignature}\n${nodeValue}` to avoid redundant regex work
  let processedTextCache = new WeakMap();

  let currentRulesSignature = '';
  let cachedCustomRegex = null;
  let cachedCustomKey = '';

  function getCustomRegex(settings) {
    const key = `${settings.caseInsensitive !== false ? 'i' : 's'}:${JSON.stringify(
      settings.customKeywords || []
    )}`;
    if (key !== cachedCustomKey) {
      cachedCustomKey = key;
      cachedCustomRegex = window.ChatCloakPatterns.buildCustomKeywordRegex(
        settings.customKeywords,
        settings.caseInsensitive !== false
      );
    }
    return cachedCustomRegex;
  }

  const GREETING_CONTAINER_SELECTOR =
    'h1, h2, [role="heading"], [data-testid*="greeting" i], [data-test-id*="greeting" i], modular-greeting, bard-greeting';

  function computeRulesSignature(settings) {
    const pii = settings.categories && settings.categories.pii ? '1' : '0';
    const profile = settings.categories && settings.categories.profile ? '1' : '0';
    const ci = settings.caseInsensitive !== false ? 'i' : 's';
    const kw = JSON.stringify(settings.customKeywords || []);
    return `${pii}:${profile}:${ci}:${kw}`;
  }

  function safeQueryAll(root, selectors) {
    if (!root || !Array.isArray(selectors) || selectors.length === 0) return [];
    const results = new Set();
    for (const selector of selectors) {
      try {
        const list = root.querySelectorAll(selector);
        for (const el of list) {
          results.add(el);
        }
      } catch (_) {
        // Ignore individual selectors unsupported by a given DOM state
      }
    }
    return Array.from(results);
  }

  function clearCategoryCloaks(category) {
    const els = document.querySelectorAll(`[data-chatcloak-cloaked="${category}"]`);
    for (const el of els) {
      el.removeAttribute('data-chatcloak-cloaked');
    }
  }

  function applyCategoryCloaks(adapter, settings) {
    const categories = settings.categories || {};

    if (!settings.enabled) {
      clearCategoryCloaks('sidebar');
      clearCategoryCloaks('profile');
      clearCategoryCloaks('media');
      return;
    }

    const mapping = [
      ['sidebar', Boolean(categories.sidebar), adapter.getSidebarSelectors()],
      ['profile', Boolean(categories.profile), adapter.getProfileSelectors()],
      ['media', Boolean(categories.media), adapter.getMediaSelectors()]
    ];

    for (const [catName, active, selectors] of mapping) {
      if (!active) {
        clearCategoryCloaks(catName);
        continue;
      }

      const matched = new Set(safeQueryAll(document, selectors));

      // Remove stale attributes on nodes that no longer match
      const existing = document.querySelectorAll(`[data-chatcloak-cloaked="${catName}"]`);
      for (const el of existing) {
        if (!matched.has(el)) {
          el.removeAttribute('data-chatcloak-cloaked');
        }
      }

      for (const el of matched) {
        if (el.closest('[data-chatcloak-ignore="true"]')) continue;
        if (el.getAttribute('data-chatcloak-manual') === 'true') continue;
        // Skip tiny UI icons when cloaking media
        if (catName === 'media' && el.tagName === 'IMG') {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.width <= 24 && rect.height > 0 && rect.height <= 24) {
            continue;
          }
        }
        if (el.getAttribute('data-chatcloak-cloaked') !== catName) {
          el.setAttribute('data-chatcloak-cloaked', catName);
        }
      }
    }
  }

  function isSafeTextNode(textNode) {
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return false;
    if (!textNode.nodeValue || textNode.nodeValue.trim().length < 2) return false;
    const parent = textNode.parentElement;
    if (!parent) return false;
    if (parent.closest(FORBIDDEN_TAG_SELECTOR)) return false;
    if (parent.closest('[data-chatcloak-cloaked]')) return false;
    return true;
  }

  function isInsideStrictMessageContainer(node, adapter) {
    if (!adapter) return false;
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!el) return false;
    const selectors = adapter.getMessageContainerSelectors();
    for (const sel of selectors) {
      try {
        if (el.matches(sel) || el.closest(sel)) return true;
      } catch (_) {
        // Ignore invalid selector
      }
    }
    return false;
  }

  function cleanupSplitArtifacts(anchorNode) {
    const artifacts = splitArtifacts.get(anchorNode);
    if (!artifacts) return;
    for (const node of artifacts) {
      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
    splitArtifacts.delete(anchorNode);
  }

  function applyMatchesToTextNode(textNode, matches) {
    const artifacts = [];
    // Process backwards so earlier offsets remain valid across splitText() calls.
    // textNode itself stays as a direct child of its parent to preserve React/Angular node refs.
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      if (m.start < 0 || m.end > textNode.nodeValue.length || m.start >= m.end) {
        continue;
      }

      const matchNode = textNode.splitText(m.start);
      const afterNode = matchNode.splitText(m.end - m.start);

      const span = document.createElement('span');
      span.className = 'chatcloak-redacted';
      span.setAttribute('data-chatcloak-redacted', 'true');
      span.setAttribute('data-chatcloak-category', m.category);

      matchNode.parentNode.insertBefore(span, matchNode);
      span.appendChild(matchNode);

      artifacts.push(span);
      if (afterNode.nodeValue.length === 0) {
        if (afterNode.parentNode) {
          afterNode.parentNode.removeChild(afterNode);
        }
      } else {
        artifacts.push(afterNode);
        processedTextCache.set(afterNode, `${currentRulesSignature}\n${afterNode.nodeValue}`);
      }
    }

    splitArtifacts.set(textNode, artifacts);
    processedTextCache.set(textNode, `${currentRulesSignature}\n${textNode.nodeValue}`);
  }

  function redactTextNode(textNode, settings, adapter) {
    if (!isSafeTextNode(textNode)) return;

    const text = textNode.nodeValue;
    const signature = `${currentRulesSignature}\n${text}`;
    if (processedTextCache.get(textNode) === signature) {
      return;
    }

    const inMessage = isInsideStrictMessageContainer(textNode, adapter);
    const enablePii = Boolean(settings.categories && settings.categories.pii);
    const enableProfile = Boolean(settings.categories && settings.categories.profile);
    const customRegex = getCustomRegex(settings);

    const matchOptions = inMessage
      ? { enablePii, customRegex }
      : {
          enablePii: false,
          enableEmail: enableProfile || enablePii,
          enableProfileIdentity: enableProfile,
          customRegex
        };

    if (
      !matchOptions.enablePii &&
      !matchOptions.enableEmail &&
      !matchOptions.enableProfileIdentity &&
      !matchOptions.customRegex
    ) {
      processedTextCache.set(textNode, signature);
      return;
    }

    const matches = window.ChatCloakPatterns.findSensitiveMatches(text, matchOptions);

    if (matches.length === 0) {
      processedTextCache.set(textNode, signature);
      return;
    }

    applyMatchesToTextNode(textNode, matches);
  }

  function redactSplitGreetingElement(el, settings, adapter) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    if (el.closest(FORBIDDEN_TAG_SELECTOR) || el.closest('[data-chatcloak-cloaked]')) return;
    if (isInsideStrictMessageContainer(el, adapter)) return;
    if (!settings.categories || !settings.categories.profile) return;

    if (el.querySelector('[data-chatcloak-redacted="true"]')) {
      el.setAttribute('data-chatcloak-processed', 'true');
      return;
    }

    const fullText = el.textContent;
    if (!fullText || fullText.length < 4 || fullText.length > 160) return;

    const matches = window.ChatCloakPatterns.findSensitiveMatches(fullText, {
      enableProfileIdentity: true,
      enableEmail: true
    });

    if (matches.length > 0) {
      // Map character ranges across child Text nodes in case greeting & name live in separate spans
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node || !node.nodeValue) return NodeFilter.FILTER_REJECT;
          const p = node.parentElement;
          if (!p || p.closest(FORBIDDEN_TAG_SELECTOR)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      const segments = [];
      let offset = 0;
      let node;
      while ((node = walker.nextNode()) !== null) {
        const len = node.nodeValue.length;
        segments.push({ node, start: offset, end: offset + len });
        offset += len;
      }

      for (const seg of segments) {
        const localMatches = [];
        for (const m of matches) {
          const overlapStart = Math.max(seg.start, m.start);
          const overlapEnd = Math.min(seg.end, m.end);
          if (overlapStart < overlapEnd) {
            localMatches.push({
              start: overlapStart - seg.start,
              end: overlapEnd - seg.start,
              category: m.category
            });
          }
        }
        if (localMatches.length > 0) {
          applyMatchesToTextNode(seg.node, localMatches);
        }
      }
    }

    el.setAttribute('data-chatcloak-processed', 'true');
  }

  function walkAndRedact(rootElement, settings, adapter) {
    if (!rootElement || rootElement.nodeType !== Node.ELEMENT_NODE) return;
    if (rootElement.closest(FORBIDDEN_TAG_SELECTOR)) return;

    const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return isSafeTextNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    });

    const textNodes = [];
    let current;
    while ((current = walker.nextNode()) !== null) {
      textNodes.push(current);
    }

    for (const textNode of textNodes) {
      redactTextNode(textNode, settings, adapter);
    }

    if (settings.categories && settings.categories.profile) {
      if (rootElement.matches && rootElement.matches(GREETING_CONTAINER_SELECTOR)) {
        redactSplitGreetingElement(rootElement, settings, adapter);
      }
      const greetingEls = rootElement.querySelectorAll(GREETING_CONTAINER_SELECTOR);
      for (const gEl of greetingEls) {
        redactSplitGreetingElement(gEl, settings, adapter);
      }
    }
  }

  function findMessageRoots(adapter) {
    const selectors = adapter.getMessageContainerSelectors();
    const matched = safeQueryAll(document, selectors);
    if (matched.length > 0) {
      // Filter out containers that are nested inside another matched container
      return matched.filter(
        (el) => !matched.some((other) => other !== el && other.contains(el))
      );
    }

    // Fallback to <main> if a platform changes message container markup
    const main = document.querySelector('main');
    return main ? [main] : [];
  }

  function isInsideMessageRoot(node, adapter) {
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!el) return false;
    const selectors = adapter.getMessageContainerSelectors();
    for (const sel of selectors) {
      try {
        if (el.matches(sel) || el.closest(sel)) return true;
      } catch (_) {
        // Ignore invalid selector
      }
    }
    return Boolean(el.closest('main'));
  }

  function restoreAllTextRedactions() {
    const spans = document.querySelectorAll('[data-chatcloak-redacted="true"]');
    const touchedParents = new Set();

    for (const span of spans) {
      const parent = span.parentNode;
      if (!parent) continue;
      touchedParents.add(parent);
      const fragment = document.createDocumentFragment();
      while (span.firstChild) {
        fragment.appendChild(span.firstChild);
      }
      parent.replaceChild(fragment, span);
    }

    for (const parent of touchedParents) {
      try {
        parent.normalize();
      } catch (_) {
        // Ignore detached parents
      }
    }

    const processed = document.querySelectorAll('[data-chatcloak-processed]');
    for (const el of processed) {
      el.removeAttribute('data-chatcloak-processed');
    }

    splitArtifacts = new WeakMap();
    processedTextCache = new WeakMap();
  }

  function applyFullRedaction(adapter, settings) {
    applyCategoryCloaks(adapter, settings);

    const nextSig = computeRulesSignature(settings);
    const categories = settings.categories || {};
    const shouldRedactText =
      settings.enabled &&
      (Boolean(categories.pii) ||
        Boolean(categories.profile) ||
        (settings.customKeywords && settings.customKeywords.length > 0));

    if (!shouldRedactText) {
      restoreAllTextRedactions();
      currentRulesSignature = nextSig;
      return;
    }

    if (nextSig !== currentRulesSignature) {
      restoreAllTextRedactions();
      currentRulesSignature = nextSig;
    }

    if (document.body) {
      walkAndRedact(document.body, settings, adapter);
    }

    const roots = findMessageRoots(adapter);
    for (const root of roots) {
      root.setAttribute('data-chatcloak-processed', 'true');
    }
  }

  function applyIncrementalNodes(adapter, settings, mutatedNodes, mutatedTextNodes) {
    applyCategoryCloaks(adapter, settings);

    const categories = settings.categories || {};
    const shouldRedactText =
      settings.enabled &&
      (Boolean(categories.pii) ||
        Boolean(categories.profile) ||
        (settings.customKeywords && settings.customKeywords.length > 0));

    if (!shouldRedactText) return;

    currentRulesSignature = computeRulesSignature(settings);

    for (const textNode of mutatedTextNodes) {
      if (!textNode.isConnected) continue;
      // If React/Angular updated the anchor text node during streaming, clear stale split spans first
      if (splitArtifacts.has(textNode)) {
        cleanupSplitArtifacts(textNode);
      }
      redactTextNode(textNode, settings, adapter);
    }

    for (const el of mutatedNodes) {
      if (!el.isConnected || el.nodeType !== Node.ELEMENT_NODE) continue;
      if (el.closest(FORBIDDEN_TAG_SELECTOR)) continue;
      walkAndRedact(el, settings, adapter);
      if (isInsideMessageRoot(el, adapter)) {
        el.setAttribute('data-chatcloak-processed', 'true');
      }
    }
  }

  window.ChatCloakRedactor = {
    applyFullRedaction,
    applyIncrementalNodes,
    restoreAllTextRedactions
  };
})();

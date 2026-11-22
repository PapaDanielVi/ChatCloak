(() => {
  'use strict';

  let active = false;
  let highlightEl = null;
  let hudEl = null;
  let rafId = null;
  let pendingTarget = null;
  const manualCloaked = new Set();

  function pruneDisconnected() {
    for (const el of manualCloaked) {
      if (!el.isConnected || el.getAttribute('data-chatcloak-manual') !== 'true') {
        manualCloaked.delete(el);
      }
    }
    return manualCloaked.size;
  }

  function getManualCount() {
    return pruneDisconnected();
  }

  function updateHudCount() {
    if (!hudEl) return;
    const countSpan = hudEl.querySelector('.chatcloak-hud-count');
    if (countSpan) {
      const count = getManualCount();
      countSpan.textContent = `${count} hidden`;
    }
  }

  function ensureOverlayElements() {
    if (!highlightEl) {
      highlightEl = document.createElement('div');
      highlightEl.id = 'chatcloak-picker-highlight';
      highlightEl.setAttribute('data-chatcloak-ignore', 'true');
      document.documentElement.appendChild(highlightEl);
    }

    if (!hudEl) {
      hudEl = document.createElement('div');
      hudEl.id = 'chatcloak-picker-hud';
      hudEl.setAttribute('data-chatcloak-ignore', 'true');

      const dot = document.createElement('span');
      dot.className = 'chatcloak-hud-dot';
      dot.setAttribute('data-chatcloak-ignore', 'true');

      const text = document.createElement('span');
      text.className = 'chatcloak-hud-text';
      text.setAttribute('data-chatcloak-ignore', 'true');
      text.textContent = 'Click any element to cloak • Esc to exit (';

      const countSpan = document.createElement('span');
      countSpan.className = 'chatcloak-hud-count';
      countSpan.setAttribute('data-chatcloak-ignore', 'true');

      const closingParen = document.createTextNode(')');
      text.appendChild(countSpan);
      text.appendChild(closingParen);

      const doneBtn = document.createElement('button');
      doneBtn.type = 'button';
      doneBtn.className = 'chatcloak-hud-btn';
      doneBtn.setAttribute('data-chatcloak-ignore', 'true');
      doneBtn.textContent = 'Done';
      doneBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        stop();
      });

      hudEl.appendChild(dot);
      hudEl.appendChild(text);
      hudEl.appendChild(doneBtn);
      document.documentElement.appendChild(hudEl);
    }

    updateHudCount();
  }

  function resolvePickableTarget(target) {
    if (!target || target.nodeType !== Node.ELEMENT_NODE) return null;
    if (target === document.documentElement || target === document.body) return null;
    if (target.closest('[data-chatcloak-ignore="true"]')) return null;
    return target;
  }

  function positionHighlight(target) {
    if (!highlightEl) return;
    if (!target) {
      highlightEl.style.display = 'none';
      return;
    }
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      highlightEl.style.display = 'none';
      return;
    }
    highlightEl.style.display = 'block';
    highlightEl.style.top = `${rect.top}px`;
    highlightEl.style.left = `${rect.left}px`;
    highlightEl.style.width = `${rect.width}px`;
    highlightEl.style.height = `${rect.height}px`;
  }

  function onMouseMove(e) {
    if (!active) return;
    pendingTarget = resolvePickableTarget(e.target);
    if (rafId !== null) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      positionHighlight(pendingTarget);
    });
  }

  function onClick(e) {
    if (!active) return;
    if (e.target && e.target.closest && e.target.closest('#chatcloak-picker-hud')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const target = resolvePickableTarget(e.target);
    if (!target) return;

    // Toggle manual cloak if user clicks an already-manually-cloaked element
    if (target.getAttribute('data-chatcloak-manual') === 'true') {
      target.removeAttribute('data-chatcloak-manual');
      target.removeAttribute('data-chatcloak-cloaked');
      manualCloaked.delete(target);
    } else {
      target.setAttribute('data-chatcloak-manual', 'true');
      target.setAttribute('data-chatcloak-cloaked', 'manual');
      manualCloaked.add(target);
    }

    updateHudCount();
  }

  function onKeyDown(e) {
    if (!active) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      stop();
    }
  }

  function start() {
    if (active) return;
    active = true;
    ensureOverlayElements();
    if (document.body) {
      document.body.classList.add('chatcloak-picking');
    }
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  function stop() {
    if (!active) return;
    active = false;
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    pendingTarget = null;
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);

    if (document.body) {
      document.body.classList.remove('chatcloak-picking');
    }
    if (highlightEl && highlightEl.parentNode) {
      highlightEl.parentNode.removeChild(highlightEl);
      highlightEl = null;
    }
    if (hudEl && hudEl.parentNode) {
      hudEl.parentNode.removeChild(hudEl);
      hudEl = null;
    }
  }

  function clearManualCloaks() {
    const els = document.querySelectorAll('[data-chatcloak-manual="true"]');
    for (const el of els) {
      el.removeAttribute('data-chatcloak-manual');
      if (el.getAttribute('data-chatcloak-cloaked') === 'manual') {
        el.removeAttribute('data-chatcloak-cloaked');
      }
    }
    manualCloaked.clear();
    updateHudCount();
    return 0;
  }

  window.ChatCloakPicker = {
    start,
    stop,
    isActive: () => active,
    getManualCount,
    clearManualCloaks
  };
})();

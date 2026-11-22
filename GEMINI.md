# GEMINI.md

Project instructions for AI coding agents working on **ChatCloak**.

## Overview & Hard Constraints

ChatCloak is a zero-build, zero-dependency Chrome Extension (Manifest V3) written in vanilla JavaScript, HTML, and CSS. It hides, blurs, or blacks out sensitive UI elements and text on ChatGPT, Google Gemini, and Claude during screen sharing.

- **100% local privacy:** Never add external network calls, analytics, telemetry, remote scripts, or remote web fonts.
- **Minimal permissions:** Keep `manifest.json` limited to `storage` and `activeTab` permissions scoped to `https://chatgpt.com/*`, `https://gemini.google.com/*`, and `https://claude.ai/*`.
- **Stateless service worker:** `background.js` must not rely on in-memory state across wakeups. Persist settings in `chrome.storage.local` and react to `chrome.storage.onChanged`.
- **DOM & CSS namespace:** Prefix every injected CSS class with `chatcloak-` and every custom DOM attribute with `data-chatcloak-`.

## Architecture & Script Load Order

Content scripts are plain IIFEs (no bundler or ES module imports) loaded in exact order by `manifest.json` at `run_at: "document_start"`:

1. `content/patterns.js` -> exposes `window.ChatCloakPatterns` (`buildCustomKeywordRegex`, `findSensitiveMatches`)
2. `content/adapters/chatgpt.js`, `content/adapters/gemini.js`, `content/adapters/claude.js` -> push onto `window.ChatCloakAdapters`
3. `content/redactor.js` -> exposes `window.ChatCloakRedactor` (`applyFullRedaction`, `applyIncrementalNodes`, `restoreAllTextRedactions`)
4. `content/picker.js` -> exposes `window.ChatCloakPicker` (interactive click-to-cloak overlay and manual cloak counter)
5. `content/main.js` -> resolves adapter, applies zero-flicker boot class, runs throttled `MutationObserver`, detects SPA navigation, tracks `Alt` for Peek Mode, and handles popup RPC messages

Supporting files:

- `styles/chatcloak.css` - zero-flicker boot rules, blur/blackout styling, Peek Mode hover rules, and picker HUD styling
- `background.js` - `chrome.storage.local` default seeding, `Alt+Shift+P` (`toggle-chatcloak`) command handler, and toolbar `ON` badge updates
- `popup/popup.html`, `popup/popup.css`, `popup/popup.js` - 344px dark-mode popup UI
- `icons/chatcloak.svg`, `icons/generate-icons.js` - vector source and zero-dependency Node.js PNG generator for `icon-16.png`, `icon-48.png`, `icon-128.png`

## Critical Invariants (Do Not Break)

1. **Zero-flicker startup:** `content/main.js` synchronously reads `localStorage` (`chatcloak_boot_cache_v1`) at `document_start` and sets `data-chatcloak-host` + `chatcloak-booting` on `document.documentElement` before first paint. When adding critical sidebar, profile, or start-page greeting selectors to an adapter, mirror them under `html.chatcloak-booting` in `styles/chatcloak.css`.
2. **Framework-safe DOM redaction:** React and Angular break with `NotFoundError` if an extension detaches or replaces a framework-owned `Text` node. In `content/redactor.js`, keep the original anchor `Text` node as a direct child of its parent by calling `splitText()` from back to front, and track created spans in `splitArtifacts` (`WeakMap`) so `characterData` streaming updates clean up stale spans before re-redacting.
3. **Never touch interactive or non-text elements:** `FORBIDDEN_TAG_SELECTOR` in `content/redactor.js` must continue excluding `textarea`, `input`, `select`, `option`, `script`, `style`, `noscript`, `svg`, `math`, `canvas`, `template`, `[contenteditable="true"]`, `[contenteditable=""]`, `[data-chatcloak-ignore="true"]`, and `[data-chatcloak-redacted="true"]`.
4. **Clean restoration:** Turning ChatCloak OFF must unwrap all `[data-chatcloak-redacted="true"]` spans and call `parent.normalize()` so original `Text` nodes are restored cleanly.
5. **MutationObserver loop prevention:** Keep `isOwnMutation()` filtering `data-chatcloak-*` attributes and `data-chatcloak-ignore` / `data-chatcloak-redacted` nodes, and call `observer.takeRecords()` at the end of synchronous DOM passes in `content/main.js`.
6. **Peek Mode default:** `peekMode` defaults to `false` in `background.js`, `content/main.js`, and `popup/popup.js`. Only uncloak on `:hover` when both `chatcloak-peek-enabled` and `chatcloak-alt-held` are present on `<html>`.

## Common Development Tasks

### Updating or Adding a Site Adapter

Adapters in `content/adapters/*.js` must implement:

- `id` (string), `label` (string), `matches(hostname)` (boolean)
- `getSidebarSelectors()`, `getProfileSelectors()`, `getMediaSelectors()`, `getMessageContainerSelectors()` (each returning `string[]`)

Selector guidelines:
- Prefer `nav`, `aside`, `aria-label`, `data-testid`, `data-test-id`, landmark roles, and `href` prefixes (`a[href^="/c/"]`, `a[href^="/app/"]`, `a[href^="/chat/"]`) over generated or hashed CSS class names.
- Wrap `querySelectorAll` calls safely (as `safeQueryAll` does) so one unsupported selector never breaks the rest.
- If adding a new host domain, update `manifest.json` (`host_permissions` and `content_scripts[0].matches`) and register the new adapter file before `content/redactor.js` in `manifest.json`.

### Modifying Settings or PII Patterns

- **Settings schema:** Keep `DEFAULT_SETTINGS` and `mergeSettings()` / `normalizeSettings()` synchronized across `background.js`, `content/main.js`, and `popup/popup.js`.
- **Text redaction cache:** If a new setting changes what text gets redacted, include it in `computeRulesSignature()` inside `content/redactor.js` so `processedTextCache` invalidates properly.
- **Regex safety:** Always reset `regex.lastIndex = 0` before running `/g` patterns in `content/patterns.js`, and add a `validate()` guard for numeric or colon patterns to avoid false positives on ISO dates, millisecond timestamps, or `std::vector` style tokens.

## Verification Checklist

Run these checks after editing code and before committing:

```bash
# 1. Syntax check every JavaScript file
for f in background.js popup/popup.js icons/generate-icons.js content/*.js content/adapters/*.js; do
  node --check "$f" || exit 1
done

# 2. Verify manifest paths and PNG icon dimensions
node -e '
const fs = require("fs");
const m = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const files = [m.background.service_worker, m.action.default_popup, ...Object.values(m.icons), ...m.content_scripts.flatMap(c => [...c.css, ...c.js])];
for (const f of files) if (!fs.existsSync(f)) throw new Error("Missing: " + f);
console.log("Manifest files OK:", files.length);
'
```

If you modify `icons/generate-icons.js`, regenerate the PNG assets with:

```bash
node icons/generate-icons.js
```

After code changes, reload the unpacked extension at `chrome://extensions` and test live behavior on ChatGPT, Gemini, and Claude (initial load zero-flicker, token streaming redaction, `Alt+Shift+P` toggle, click-to-cloak picker, and `Esc` exit).

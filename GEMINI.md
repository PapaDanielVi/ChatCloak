# GEMINI.md

Project instructions for AI coding agents working on **ChatCloak**.

## Overview & Hard Constraints

ChatCloak is a zero-build, zero-dependency Chrome Extension (Manifest V3) written in vanilla JavaScript, HTML, and CSS. It hides, blurs, or blacks out sensitive UI elements and text across 13 AI chat web applications during screen sharing.

- **100% local privacy:** Never add external network calls, analytics, telemetry, remote scripts, or remote web fonts.
- **Minimal permissions:** Keep `manifest.json` limited to `storage` and `activeTab` permissions scoped strictly to the supported AI chat domains.
- **Stateless service worker:** `background.js` must not rely on in-memory state across wakeups. Persist settings in `chrome.storage.local` and react to `chrome.storage.onChanged`.
- **DOM & CSS namespace:** Prefix every injected CSS class with `chatcloak-` and every custom DOM attribute with `data-chatcloak-`.

## Architecture & Script Load Order

Content scripts are plain IIFEs (no bundler or ES module imports) loaded in exact order by `manifest.json` at `run_at: "document_start"`:

1. `content/adapters/base.js` -> exposes `window.ChatCloakBaseAdapter` (`BaseAdapter`) and initializes `window.ChatCloakAdapters`
2. Site adapters (`chatgpt.js`, `gemini.js`, `claude.js`, `grok.js`, `deepseek.js`, `perplexity.js`, `copilot.js`, `meta.js`, `qwen.js`, `mistral.js`, `poe.js`, `kimi.js`, `duckai.js`) -> extend `BaseAdapter` and push instances onto `window.ChatCloakAdapters`
3. `content/adapters/registry.js` -> exposes `window.ChatCloakAdapterRegistry` (`register`, `resolve`, `getById`, `getAll`)
4. `content/patterns.js` -> exposes `window.ChatCloakPatterns` (`buildCustomKeywordRegex`, `findSensitiveMatches`)
5. `content/redactor.js` -> exposes `window.ChatCloakRedactor` (`applyFullRedaction`, `applyIncrementalNodes`, `restoreAllTextRedactions`, `clearAllCloaks`)
6. `content/picker.js` -> exposes `window.ChatCloakPicker` (interactive click-to-cloak overlay, Shadow DOM `composedPath()` support, and manual cloak counter)
7. `content/main.js` -> resolves adapter on load and SPA route changes, applies zero-flicker boot class, runs throttled `MutationObserver` (plus open Shadow DOM observers), tracks `Alt` for Peek Mode, and handles popup RPC messages

Supporting files:

- `shared/sites.js` - canonical 13-site list (`SITE_DEFINITIONS`, `createDefaultSiteSettings`, `mergeSiteSettings`) loaded by `background.js` via `importScripts` and `popup/popup.html` via `<script>`
- `styles/chatcloak.css` - zero-flicker boot rules scoped by `[data-chatcloak-site]`, blur/blackout styling, Peek Mode hover rules, and picker HUD styling
- `background.js` - `chrome.storage.local` default seeding, `Alt+Shift+P` (`toggle-chatcloak`) command handler, and toolbar `ON` badge updates
- `popup/popup.html`, `popup/popup.css`, `popup/popup.js` - 344px dark-mode popup UI with active-site status pill, per-site toggle, and collapsible Supported Platforms list
- `icons/chatcloak.svg`, `icons/generate-icons.js` - vector source and zero-dependency Node.js PNG generator for `icon-16.png`, `icon-48.png`, `icon-128.png`

## Critical Invariants (Do Not Break)

1. **Zero-flicker startup & route gating:** `content/main.js` resolves `AdapterRegistry.resolve(window.location)` synchronously at `document_start`. Only when an adapter matches (and `chatcloak_boot_cache_v2` shows both global `enabled` and `siteSettings[adapter.id]` are active) does it set `data-chatcloak-site` and `chatcloak-booting` on `document.documentElement`. On `x.com`, `/home` must never receive `data-chatcloak-site` or `chatcloak-booting`, and navigating away from `/i/grok` must immediately call `deactivateAdapter()` to strip all attributes, classes, redactions, and Shadow DOM styles.
2. **Framework-safe DOM redaction:** React and Angular break with `NotFoundError` if an extension detaches or replaces a framework-owned `Text` node. In `content/redactor.js`, keep the original anchor `Text` node as a direct child of its parent by calling `splitText()` from back to front, and track created spans in `splitArtifacts` (`WeakMap`) so `characterData` streaming updates clean up stale spans before re-redacting.
3. **Never touch interactive or non-text elements:** `FORBIDDEN_TAG_SELECTOR` in `content/redactor.js` must continue excluding `textarea`, `input`, `select`, `option`, `script`, `style`, `noscript`, `svg`, `math`, `canvas`, `template`, `[contenteditable="true"]`, `[contenteditable=""]`, `[data-chatcloak-ignore="true"]`, and `[data-chatcloak-redacted="true"]`.
4. **Open Shadow DOM styling & cleanup:** Document-level CSS does not pierce Shadow DOM boundaries. When `adapter.supportsShadowDom` is `true` (e.g., Microsoft Copilot), `content/redactor.js` injects `<style data-chatcloak-ignore="true" data-chatcloak-shadow-style="true">` into each discovered open `ShadowRoot` and `content/main.js` observes each `ShadowRoot` via `observedShadowRoots`. Turning protection OFF or leaving the site must clean up those injected styles.
5. **Clean restoration:** Turning ChatCloak OFF (globally or per-site) must unwrap all `[data-chatcloak-redacted="true"]` spans across document and open Shadow DOM roots and call `parent.normalize()` so original `Text` nodes are restored cleanly.
6. **MutationObserver loop prevention:** Keep `isOwnMutation()` filtering `data-chatcloak-*` attributes and `data-chatcloak-ignore` / `data-chatcloak-redacted` nodes, and call `observer.takeRecords()` (and `shadowObserver.takeRecords()`) at the end of synchronous DOM passes in `content/main.js`. Keep `attributeFilter: ['open', 'aria-expanded', 'hidden']` active so collapsible reasoning panels (DeepSeek, Qwen, Kimi) redact when expanded.
7. **Peek Mode default:** `peekMode` defaults to `false` in `background.js`, `content/main.js`, and `popup/popup.js`. Only uncloak on `:hover` when both `chatcloak-peek-enabled` and `chatcloak-alt-held` are present on `<html>`.
8. **Site list synchronization:** Every site ID in `shared/sites.js` (`SITE_DEFINITIONS`) must match an adapter registered in `content/adapters/registry.js` 1:1.

## Common Development Tasks

### Updating or Adding a Site Adapter

Adapters in `content/adapters/*.js` extend `BaseAdapter` (`window.ChatCloakBaseAdapter`) and pass `{ id, displayName, hostPatterns, pathRegex?, supportsShadowDom? }` to `super(...)`. Override only what differs from `BaseAdapter`:

- `getSidebarSelectors()`, `getProfileSelectors()`, `getMediaSelectors()`, `getMessageContainerSelectors()` (returning `string[]`)
- Optional `getExtraCloakElements(category)` (returning `Element[]`) for structural heuristics such as Grok's `Chats` section rows
- Optional `getProfileTextPatterns()` (returning `{ category, regex, validate? }[]`) for site-specific identity tokens such as Grok `@handle` strings

Checklist when adding a new platform:
1. Create `content/adapters/<site>.js` extending `BaseAdapter` and push an instance onto `window.ChatCloakAdapters`.
2. Add the site script before `content/adapters/registry.js` and add its URL patterns to `host_permissions` and `content_scripts[0].matches` in `manifest.json`.
3. Add `{ id, displayName, hostPatterns }` to `SITE_DEFINITIONS` in `shared/sites.js`.
4. Add first-paint boot selectors under `html.chatcloak-booting[data-chatcloak-site="<id>"]` in `styles/chatcloak.css`.

### Modifying Settings or PII Patterns

- **Settings schema:** Keep `DEFAULT_SETTINGS` and `mergeSettings()` / `normalizeSettings()` synchronized across `background.js`, `content/main.js`, and `popup/popup.js`.
- **Text redaction cache:** `computeRulesSignature(adapter, settings)` in `content/redactor.js` includes `adapter.id`, `pii`, `profile`, `caseInsensitive`, and `customKeywords`. Update it if a new setting alters text matching.
- **Regex safety:** Always reset `regex.lastIndex = 0` before running `/g` patterns in `content/patterns.js`, and add a `validate()` guard for numeric or colon patterns to avoid false positives on ISO dates, millisecond timestamps, or `std::vector` style tokens.

## Verification Checklist

Run these checks after editing code and before committing:

```bash
# 1. Syntax check every JavaScript file
for f in shared/*.js background.js popup/popup.js icons/generate-icons.js content/*.js content/adapters/*.js; do
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

After code changes, reload the unpacked extension at `chrome://extensions` and verify zero-flicker loading, streaming redaction, `Alt+Shift+P` toggle, click-to-cloak picker, `x.com/home` <-> `x.com/i/grok` SPA transitions, and Shadow DOM redaction on Copilot.

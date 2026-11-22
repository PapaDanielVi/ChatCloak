<div align="center">
  <img src="icons/chatcloak.svg" alt="ChatCloak Logo" width="84" height="84" />
  <h1>ChatCloak</h1>
  <p>Hide, blur, or blackout sensitive info on ChatGPT, Google Gemini, and Claude while screen sharing or recording.</p>
  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-0d9488.svg" alt="MIT License" /></a>
    <img src="https://img.shields.io/badge/manifest-v3-1e293b.svg" alt="Chrome Manifest V3" />
    <img src="https://img.shields.io/badge/privacy-100%25%20local-0d9488.svg" alt="100% Local" />
  </p>
</div>

ChatCloak is a Chrome extension (Manifest V3) built for live demos, pair programming, calls, and screen recordings. It runs strictly on your device with zero network requests, zero telemetry, and minimal permissions (`storage` and `activeTab`).

## Supported Sites

- ChatGPT (`https://chatgpt.com/*`)
- Google Gemini (`https://gemini.google.com/*`)
- Claude (`https://claude.ai/*`)

## Features

- **Zero-flicker loading:** Injects CSS guards at `document_start` alongside a local boot cache so sidebar titles, profile badges, and start-page greetings do not flash during reloads.
- **Panic shortcut (`Alt+Shift+P`):** Toggles protection ON or OFF across all open supported tabs at once (`Option+Shift+P` on macOS, configurable at `chrome://extensions/shortcuts`).
- **Sidebar and history cloaking:** Blurs or blacks out past chats, folders, projects, pinned conversations, custom GPTs, Gems, and workspace switchers.
- **Profile and start-page identity protection:** Hides user avatars, account buttons, plan badges, emails, and personalized start-page greetings (such as `Good to see you, <Name>.`).
- **Uploaded media toggle:** Optionally blurs image attachments and uploaded file previews inside conversation threads.
- **Automatic PII and secret redaction:** Detects and masks emails, phone numbers, IPv4 and IPv6 addresses, credit card sequences, Bearer tokens, JWTs, and common API key prefixes (`sk-`, `sk-ant-`, `AIza`, `ghp_`, `github_pat_`, `AKIA`, `xox*`, Stripe keys) as tokens stream in.
- **Custom keywords and phrases:** Add names, client names, companies, or internal codenames with optional case-insensitive matching.
- **Blur or Blackout styles:** Pick `Blur` (`Light`, `Medium`, or `Heavy`) or solid `Blackout` bars.
- **Click-to-cloak element picker:** Highlight and click any message, code block, image, or UI block to hide it for the current session. Press `Esc` to exit picker mode.
- **Peek Mode (off by default):** When enabled, holding `Alt` and hovering over a cloaked item temporarily reveals it.

## Install from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/PapaDanielVi/ChatCloak.git
   cd ChatCloak
   ```
2. (Optional) Regenerate PNG icons from scratch using Node.js:
   ```bash
   node icons/generate-icons.js
   ```
3. Open `chrome://extensions` in Chrome.
4. Enable **Developer mode** in the top-right corner.
5. Click **Load unpacked** and select the `ChatCloak` directory.
6. Pin ChatCloak to your toolbar. A teal `ON` badge indicates protection is active.

## Architecture

- `manifest.json` declares MV3 permissions, the `Alt+Shift+P` command, and `document_start` content scripts.
- `background.js` keeps `chrome.storage.local` defaults synced, updates the toolbar badge, and handles keyboard commands without relying on in-memory state.
- `styles/chatcloak.css` defines `chatcloak-` prefixed zero-flicker rules, blur/blackout styles, Peek Mode hover rules, and the picker overlay.
- `content/patterns.js` contains PII, secret, greeting-name, and custom keyword matchers.
- `content/adapters/` isolates DOM selectors per platform (`chatgpt.js`, `gemini.js`, `claude.js`).
- `content/redactor.js` applies category attributes and splits `Text` nodes safely without detaching framework-owned anchor nodes or touching `<textarea>`, `<input>`, or `[contenteditable="true"]`.
- `content/picker.js` manages the interactive click-to-cloak overlay and session counter.
- `content/main.js` coordinates `MutationObserver` throttling during token streaming, SPA URL checks, and live storage updates.
- `popup/` renders the 344px dark-mode settings popup.

## Updating a Site Adapter

If ChatGPT, Gemini, or Claude changes its markup:

1. Open DevTools on the page and prefer stable attributes (`nav`, `aside`, `aria-label`, `data-testid`, `href` prefixes) over generated class hashes.
2. Update the selectors in `content/adapters/chatgpt.js`, `content/adapters/gemini.js`, or `content/adapters/claude.js`.
3. Mirror any new critical first-paint sidebar or profile selectors under `html.chatcloak-booting` in `styles/chatcloak.css`.
4. Reload the extension in `chrome://extensions` and refresh the tab.

## Contributing

Issues and pull requests are welcome, especially selector updates when AI chat platforms change their DOM. Please avoid adding external dependencies, remote fonts, or network calls.

## License

[MIT](LICENSE)

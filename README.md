# RightClickGPT

RightClickGPT is an independent Chrome extension for sending selected webpage text to ChatGPT or t3.chat from the right-click menu. It is not affiliated with, endorsed by, or produced by OpenAI or t3.chat.

## Features

- Right-click delivery of selected text to ChatGPT or t3.chat.
- Multiple named prompt presets with enable toggles and per-preset behavior.
- New-chat, existing-tab, and configured-conversation delivery.
- First-use disclosure and affirmative consent before any prompt can be sent.
- Local-only preset and preference storage; no analytics, ads, tracking, or developer server.
- Least-privilege Store package with access limited to the supported provider domains.
- Separate Advanced GitHub package with experimental embedded side-panel support.

## Release variants

### Store

`dist/store` is the default and Chrome Web Store-targeted build. It includes the core context-menu, preset, ChatGPT, and t3.chat features. It does not include provider framing, response-header modification, or the T3 WebSocket session workaround.

### Advanced

`dist/advanced` is for informed users who deliberately install the extension unpacked from GitHub. It adds the embedded side panel. The Advanced build narrowly removes CSP/X-Frame-Options only for provider subframes initiated by this extension and injects the T3 session workaround only into this extension's own embedded T3 frame.

The Advanced build is not intended for Chrome Web Store submission. Provider changes, authentication challenges, and third-party cookie restrictions can still break embedded pages.

## Build and validate

Requires Node.js 20 or later.

```sh
npm run check
```

This creates both unpacked variants in `dist/`, validates their manifests and package allowlists, and runs automated tests.

To install locally:

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select `dist/store` for the launch-safe build or `dist/advanced` for the experimental build.
5. Review the disclosure that opens after installation and explicitly enable the extension.

## Usage

1. Select text on a webpage.
2. Right-click the selection.
3. Choose a preset. The menu identifies the destination provider.
4. The extension formats the preset and sends it only after this explicit action.

Use the toolbar popup or full options page to manage presets, provider, conversation target, existing-tab reuse, and—on the Advanced build only—side-panel behavior.

For normal-length T3 prompts, the extension uses t3.chat's native new-chat query flow. Longer prompts, existing tabs, configured conversations, and ChatGPT use the provider composer automation.

## Privacy

Read the [privacy notice](docs/PRIVACY.md). Store publishers must host this notice at a stable public HTTPS URL and enter that URL in the Chrome Web Store Privacy tab.

## Release documentation

- [Store listing and privacy answers](docs/STORE_SUBMISSION.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)

## Source map

- `manifest.json`: least-privilege Store manifest.
- `manifests/advanced.json`: Advanced GitHub manifest.
- `background.js`: consent gating, context menus, provider routing, and Advanced frame-rule setup.
- `content.js`: provider composer insertion and submission.
- `onboarding.*`: prominent data disclosure and affirmative consent.
- `options.*` / `popup.html`: local settings UI.
- `sidechat.*`: Advanced-only embedded panel.
- `t3-frame-bootstrap.js` / `t3-bridge.js`: Advanced-only, frame-scoped T3 compatibility workaround.
- `scripts/`: deterministic build and validation scripts.

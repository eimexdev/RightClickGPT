# RightClickGPT

RightClickGPT is a Chrome extension for sending selected webpage text to ChatGPT or t3.chat from the right-click menu. You can keep multiple prompt presets, choose where each prompt opens, and optionally reuse an existing chat tab or conversation.

## Features

- Right-click context menu for selected text.
- ChatGPT and t3.chat provider support.
- Multiple named prompt presets with custom prompt formats.
- Collapsed preset editor with chevrons, per-preset enable toggles, and delete confirmation.
- Global default behavior for opening prompts in a new tab or in Chrome's side panel.
- Per-preset behavior overrides: Default, New tab, or Sidechat.
- Optional conversation URL or legacy chat ID for sending prompts to a specific conversation.
- Optional reuse of an existing ChatGPT or t3.chat tab.
- Sidechat panel with embedded chat, reload control, and an "Open tab" fallback.
- Popup and full options page for configuration.
- Autosaved settings stored in Chrome local extension storage.
- Prompt URL support for fresh chats, with content-script automation for existing tabs, configured conversations, long ChatGPT prompts, and submission fallback.
- t3.chat session bridge for smoother prompt submission in t3.chat.

## Installation

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the `RightClickGPT` folder.
6. Pin RightClickGPT to the Chrome toolbar if you want quick access to the popup settings.

## Usage

### Send Selected Text

1. Select text on a webpage.
2. Right-click the selection.
3. Choose a RightClickGPT preset.
   - If one enabled preset is available, it appears directly in the context menu.
   - If multiple enabled presets are available, they appear under the provider menu, such as **Ask ChatGPT** or **Ask t3.chat**.
4. RightClickGPT formats the preset by replacing `<prompt>` with the selected text, then opens or updates the configured chat target.

### Configure Presets

Open the toolbar popup or the extension options page.

Click **Add preset** to create a new preset. New presets open expanded so you can name them and edit the prompt format immediately.

For each preset:

- Click the chevron to expand or collapse the preset details.
- Edit the preset name shown in the context menu.
- Write a prompt format that includes `<prompt>`.
- Choose a behavior:
  - **Default** uses the global default behavior.
  - **New tab** opens the prompt in a browser tab.
  - **Sidechat** opens the prompt in Chrome's side panel.
- Use the on/off toggle to keep a preset without showing it in the context menu.
- Expand a preset and click the trash icon to delete it.

Settings autosave shortly after changes. Enabled presets must have a name and include `<prompt>` to be usable.

### Choose a Provider

Use **Chat provider** to choose where prompts are sent:

- **ChatGPT** sends prompts to `chatgpt.com`.
- **t3.chat (beta)** sends prompts to `t3.chat`.

You may need to be signed in to the selected provider before prompts can submit successfully.

### Choose Opening Behavior

Use **Default behavior** to choose what presets do when their behavior is set to **Default**:

- **New tab** opens a provider tab.
- **Sidechat** opens Chrome's side panel and loads the provider inside it.

Each preset can override this default.

### Reuse an Existing Chat Tab

Turn on **Use existing ChatGPT tab** or **Use existing t3.chat tab** to send prompts to the first matching open provider tab. If no matching tab exists, RightClickGPT opens the configured target instead.

### Send to a Specific Conversation

Use **Conversation URL** to target an existing conversation. You can enter:

- A full ChatGPT or t3.chat conversation URL.
- A legacy bare chat ID.

Leave it blank to start a new chat each time.

### Use Sidechat

When a prompt uses **Sidechat**, RightClickGPT opens Chrome's side panel for the current tab and loads the prompt there.

The Sidechat panel includes:

- An embedded provider frame.
- A reload button.
- An **Open tab** link for opening the same prompt in a normal browser tab.
- A status message if Chrome cannot open the side panel for the current page.

## How Prompt Delivery Works

For fresh chats, RightClickGPT builds provider URLs with the prompt in the `q` query parameter. For configured conversations, existing tabs, long ChatGPT prompts, or cases where the provider does not submit automatically, the extension injects `content.js` to fill and submit the provider composer.

## Files

- `manifest.json`: Chrome extension manifest, permissions, popup, options page, side panel, and content script registration.
- `background.js`: Context menu setup, preset filtering, prompt formatting, tab routing, side panel routing, and chat URL normalization.
- `options.html`: Full options page.
- `popup.html`: Toolbar popup settings UI.
- `options.js`: Settings UI behavior, preset editing, autosave, validation, provider selection, and conversation URL normalization.
- `content.js`: ChatGPT and t3.chat composer detection, prompt insertion, and submission fallback.
- `sidechat.html`: Chrome side panel UI.
- `sidechat.js`: Sidechat frame loading, reload handling, open-tab fallback, and status updates.
- `t3-bridge.js`: t3.chat WebSocket session patch used by the t3 integration.
- `rules/chatgpt-embed.json`: Header rules that allow supported chat providers to load in the side panel frame.
- `logo16.png`, `logo48.png`, `logo128.png`: Extension icons.

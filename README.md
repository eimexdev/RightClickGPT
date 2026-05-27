# RightClickGPT

RightClickGPT is a Chrome extension that allows you to quickly send selected text from a webpage to ChatGPT or t3.chat for explanations or other interactions. The extension provides a context menu option to send the selected text to a predefined chat.

## Features

- Right-click context menu integration.
- Configurable prompt presets, chat provider, and conversation URL.
- Sidechat presets that open the selected provider in Chrome's side panel.
- Option to use an existing provider tab if available.
- Popup for easy configuration of settings.
- Uses provider prompt URLs for fresh chats, with UI automation only for existing or configured chats where needed.

## Installation

1. Clone or download this repository to your local machine.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" by toggling the switch in the top right corner.
4. Click "Load unpacked" and select the directory containing the `RightClickGPT` extension files.
5. The RightClickGPT icon should appear in your Chrome toolbar.

## Usage

### Right-Click Context Menu

1. Select the text on any webpage that you want to send to ChatGPT.
2. Right-click on the selected text.
3. Click the prompt preset you want to use. If you only have one preset, it appears directly in the context menu. If you have multiple presets, they appear under the selected provider's ask menu.
4. The text will be sent to the configured chat provider.

### Popup Configuration Menu
(also available via extension options)

1. Click on the RightClickGPT icon in the Chrome toolbar to open the popup.
2. In the popup, you can:
   - Add one or more named prompt presets and include `<prompt>` where you want the selected text to appear.
   - Turn on Sidechat for any preset that should open in Chrome's side panel.
   - Choose ChatGPT or t3.chat (beta) as the chat provider.
   - Optionally enter a conversation URL or legacy chat ID.
   - Toggle the option to focus on an existing provider tab if available.
3. Click "Save" to save your settings.

## Files

- `manifest.json`: The manifest file that defines the extension.
- `background.js`: The background script that handles context menu actions and tab management.
- `options.html`: The HTML file for the configuration page.
- `popup.html`: The HTML file for the configuration popup.
- `options.js`: The JavaScript file for handling popup interactions.
- `content.js`: The content script that interacts with the ChatGPT page (if needed).
- `logo16.png, logo48.png, logo128.png`: Extension Icons

# RightClickGPT Privacy Notice

Effective July 15, 2026.

RightClickGPT is an independent browser extension and is not affiliated with OpenAI or t3.chat.

## Data handled

The extension handles webpage text that you explicitly select and send, your prompt preset text, your selected provider, an optional provider conversation URL, your existing-tab preference, and your privacy-consent choice.

## How data is used and shared

When you invoke a context-menu action, the selected text and preset instructions are transferred directly to the provider you chose—ChatGPT or t3.chat—solely to submit your prompt. Those providers process the content under their own terms and privacy policies. The extension developer does not receive, sell, or use this content for advertising.

For normal-length T3 prompts, the extension uses t3.chat's native prompt URL. That URL, including the prompt, may appear in your local browser history. Longer T3 prompts and ChatGPT prompts are inserted into the provider composer instead.

## Local storage and retention

Preferences and presets are stored locally through Chrome's extension storage and remain until you change them, clear extension data, or uninstall the extension. A new-tab prompt may be held for up to five minutes in Chrome's in-memory extension session storage while its provider tab loads; it is deleted after successful submission, when the tab closes, or when the five-minute expiry alarm runs. The Advanced GitHub build keeps its latest prompt-bearing side-panel URL in the same in-memory session storage until it is replaced, cleared, or the browser exits. The extension does not write selected webpage text to disk.

## Advanced GitHub build

The separately packaged Advanced build can embed provider pages. It narrowly removes framing headers only for subframes initiated by the extension and applies a T3 session compatibility workaround only inside the extension's embedded t3.chat frame. Session identifiers are not sent to the extension developer or stored by the extension.

## Security and limited use

Provider transfers use HTTPS. RightClickGPT's use of information is limited to its user-facing purpose of sending text you choose to your selected chat provider. It does not use analytics, advertising, tracking, or a developer-operated server.

## Contact and changes

Questions can be filed through the project's GitHub issue tracker. Material changes to these practices will require an updated in-product disclosure and consent.

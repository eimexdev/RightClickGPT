# Chrome Web Store submission copy

Replace the product name after choosing the final non-infringing brand. Keep all claims aligned with the submitted `dist/store` ZIP.

## Single purpose

Send webpage text that the user explicitly selects to the user's chosen supported chat provider using configurable prompt presets.

## Short description

Send selected webpage text to your chosen chat provider from the right-click menu.

## Detailed description

Select text on a webpage, right-click, and choose a preset to send a formatted prompt to ChatGPT or t3.chat. Configure multiple local prompt presets, reuse an existing provider tab, or target a conversation URL.

The extension sends text only after you invoke a context-menu action. Presets and preferences stay in Chrome local extension storage. The extension has no analytics, ads, tracking, or developer-operated server.

This independent extension is not affiliated with, endorsed by, or produced by OpenAI or t3.chat. An account with the selected provider may be required.

## Permission justifications

- `contextMenus`: Adds the user-invoked action for selected webpage text.
- `storage`: Stores privacy consent, presets, provider choice, conversation target, and tab preference locally.
- `https://chatgpt.com/*` and `https://chat.openai.com/*`: Inserts and submits the user-approved prompt in ChatGPT and can locate an already-open ChatGPT tab.
- `https://t3.chat/*`: Inserts and submits the user-approved prompt in T3 and can locate an already-open T3 tab.

The Store package does not request `<all_urls>`, `tabs`, `scripting`, `sidePanel`, web-request, DNR, cookies, history, identity, or remote-code permissions.

## Privacy practices

- Single purpose: use the text a user explicitly selects to create and submit a prompt to the provider they chose.
- Website content: **Yes**—only the selected text the user explicitly invokes the extension on.
- User-provided/user-generated content: **Yes**—prompt presets and an optional provider conversation target.
- Authentication information: **No** in the Store build.
- Web history: **No collection by the extension.** Note that a normal-length T3 prompt is placed in a t3.chat URL and Chrome may retain that URL in local browser history.
- Transfers: selected text and formatted prompt are sent only to OpenAI/ChatGPT or t3.chat as necessary for the user-facing purpose.
- Developer access: none.
- Advertising, analytics, tracking, sale, or unrelated use: none.
- Remote hosted code: **No.** All extension logic is packaged locally.
- Limited Use certification: **Yes.** Data use is limited to the disclosed single purpose.

Host `docs/PRIVACY.md` at a stable public HTTPS URL and enter it in the Privacy policy field.

## Reviewer test instructions

1. Install the submitted Store ZIP and confirm the disclosure page opens.
2. Confirm no context-menu item is available before consent.
3. Check the consent box and click **Agree and enable**.
4. Open a normal webpage, select visible text, right-click, and choose **Explain command → ChatGPT**.
5. Confirm ChatGPT opens and the formatted prompt is submitted. A free ChatGPT account may be required.
6. In the popup, switch to **t3.chat (beta)**.
7. Select text on a webpage and invoke the preset again. Confirm a T3 new-chat URL opens with the prompt. T3 may present hCaptcha or require an account; do not bypass it.
8. Verify presets autosave, an existing provider tab can be reused, and the conversation target accepts only the selected provider's host.
9. Open **Review consent**, click **Clear local data**, and confirm the context menu is disabled until consent is granted again.

If reviewers need authenticated features, provide dedicated restricted test credentials in the dashboard Test instructions tab. Never place credentials in this repository.

## Listing assets still required

- At least one accurate 1280×800 or 640×400 screenshot of the Store build.
- 440×280 small promotional tile.
- Final category, language, support URL, distribution regions, and privacy-policy URL.
- Verified developer email, 2-Step Verification, and developer account registration.

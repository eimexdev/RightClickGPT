# Launch-readiness test report

Tested July 15, 2026 with Chrome for Testing 149 through Playwright CLI against freshly built `dist/store` and `dist/advanced` directories.

## Automated package checks

- `npm run check` passed: both variants built, all manifest/package invariants passed, Node parsed every script, unit tests passed, and both ZIP archives passed integrity checks.
- Store permissions were limited to `contextMenus`, `storage`, `alarms`, and exact ChatGPT/T3 origins.
- The Store artifact contained no side panel, DNR, `scripting`, T3 bridge, remote code, or `<all_urls>` access.
- Advanced DNR matching was verified for extension-initiated provider subframes and produced no match for unrelated initiators or top-level requests.

## Store browser flows passed

- Fresh install opened the disclosure and kept enablement gated behind explicit consent.
- Popup provider switching and autosave worked; Store UI exposed only new-tab behavior and migrated legacy Sidechat behavior.
- ChatGPT new-tab prompt delivery, existing-tab reuse, and the in-memory long-prompt handoff submitted the exact probe text.
- T3 native `/new?q=` delivery and the in-memory long-prompt fallback submitted the exact probe text. T3's hCaptcha was observed and was not bypassed.
- Successful handoffs removed prompt data from `storage.session`.
- Clear local data removed local and session data and disabled the extension until consent was granted again.

## Advanced browser flows passed

- The Advanced popup exposed Sidechat while the Store popup did not.
- T3 loaded in the extension-owned side-panel frame.
- The T3 WebSocket compatibility wrapper existed in that exact T3 frame, not in the extension parent, hCaptcha frames, or a normal top-level T3 tab.
- A top-level T3 native-query prompt still submitted normally with no compatibility wrapper installed.

## Manual release checks still required

- Repeat signed-in account flows for both providers, including a configured existing conversation and provider logout/login transitions.
- Recheck keyboard navigation and visible layout in the current stable Chrome release on each supported desktop platform.
- Inspect `chrome://extensions` after those authenticated flows; provider-owned console noise and hCaptcha logs are not extension errors.
- Test an upgrade from the last published/unpacked version with representative saved presets.

Provider DOM, query parameters, framing rules, anti-bot checks, and authentication behavior are external dependencies and can change after this report.

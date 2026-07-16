# Release checklist

## Code and package

- [ ] Replace the temporary product name everywhere after the final brand is chosen.
- [ ] Run `npm run check` on a clean checkout.
- [ ] Confirm `dist/store/manifest.json` contains no `<all_urls>`, DNR, `scripting`, `sidePanel`, T3 bridge, or sidechat files.
- [ ] Test the exact `dist/store` directory unpacked in stable Chrome.
- [ ] Zip the *contents* of `dist/store` so `manifest.json` is at the ZIP root.
- [ ] Inspect the ZIP file list before upload.

## Functional testing

- [ ] Fresh install: disclosure opens and context menu stays disabled until consent.
- [ ] Consent, clear-data, reinstall, and upgrade paths work.
- [ ] ChatGPT: signed out, signed in, new chat, existing tab, configured conversation, and long prompt.
- [ ] T3: signed out, signed in, native query flow, existing tab, configured conversation, long prompt, and hCaptcha/error path.
- [ ] Popup and options page: presets, provider selection, autosave, validation, enable/disable, deletion, and keyboard navigation.
- [ ] No extension errors appear in `chrome://extensions`.

## Policy and listing

- [ ] Host `docs/PRIVACY.md` at a stable public HTTPS URL.
- [ ] Complete the Privacy tab using `docs/STORE_SUBMISSION.md`.
- [ ] Add accurate screenshots and promotional tile from the Store build only.
- [ ] Include the independent/unaffiliated statement in the listing.
- [ ] Provide reviewer instructions and restricted test credentials if required.
- [ ] Confirm the final name and listing comply with third-party trademark rules.
- [ ] Verify developer email, 2-Step Verification, account registration, category, language, regions, and support URL.

## Advanced GitHub release

- [ ] Label the Advanced artifact experimental and not for Web Store submission.
- [ ] Confirm dynamic frame rules match only extension-initiated provider subframes.
- [ ] Confirm the T3 bridge is absent from top-level T3 and unrelated frames.
- [ ] Document known provider, cookie, authentication, and anti-bot limitations.

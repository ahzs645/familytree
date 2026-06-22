# Intentionally unsupported MacFamilyTree features

The web port runs entirely in the browser sandbox. A small number of MacFamilyTree 11
features depend on native-only capabilities that no Web API exposes, so they are
**intentionally not implemented** rather than deferred. They are listed here so the
gap is documented and not mistaken for an oversight.

## #78 — Direct FTP / SFTP website upload

MacFamilyTree can publish a generated website by opening a raw FTP or SFTP socket to a
host. Browsers deliberately forbid arbitrary TCP/socket connections from page
JavaScript, so an in-browser FTP/SFTP client is not possible.

**What the web app offers instead:** the website export produces a downloadable `.zip`
and a webhook/HTTP publish target (see `src/lib/publishTargets.js` and the Publish
section in `src/routes/Websites.jsx`). Users upload the zip with their own host's tooling,
or point the webhook at an HTTP endpoint that accepts the bundle.

## #93 — Direct hardware scanner (TWAIN / ICA) capture

MacFamilyTree can drive a connected document/photo scanner to capture media directly.
That requires native scanner drivers (TWAIN/Image Capture); browsers have no scanner API.

**What the web app offers instead:** media import via file picker, drag-and-drop, the
device camera (`getUserMedia` in `src/components/media/useMediaCapture.js`), and the
Contact Picker. Users scan with their OS's scanner utility and import the resulting file.

---

These are the only two audited parity gaps classified as browser-impossible. Everything
else from the 2026-06-21 parity audit has been implemented; see the project memory notes
for the full history.

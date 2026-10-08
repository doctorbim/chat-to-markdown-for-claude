# Chat to Markdown for Claude

A small, independently written Chrome extension that downloads the open claude.ai conversation as Markdown. No build tools or API key required. Not affiliated with Anthropic.

## Install

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this `claude-markdown` folder.
4. Open a conversation on `https://claude.ai/chat/…` while signed in.
5. Click the extension (pin it using Chrome's puzzle-piece menu) and **Download Markdown**. Keep the popup open until the download starts.

After editing files, click the extension's Reload button on `chrome://extensions`.

## Behavior and limits

- Uses `activeTab` and `scripting`; runs only after you click. No persistent site access, background worker, telemetry, or external server.
- Reads Claude's organization list and this chat using your existing browser session. Does not read or store session cookies directly.
- Walks each message's content blocks in order. Text written between tool calls is treated as working notes (collapse/show/hide); text after the last working tool call is the reply. `present_files`-style calls that only hand over files don't count as work.
- claude.ai sends thinking with the full text hidden (`thinking_hidden`, empty `thinking`), so the Thinking option exports the visible step summaries instead.
- Options (remembered between uses): YAML front matter, per-message timestamps, files Claude wrote via tools (memory writes are skipped), extracted text of attached files, thinking blocks.
- Attachments are always listed by name and size. Binaries, tool output, and skipped blocks are counted in a "Not included" line at the top.
- Edited chats: follows parent links back from `current_leaf_message_uuid`, so only the branch on screen is exported. If the current leaf isn't reported, export stops rather than mixing branches.
- **Save raw JSON** downloads the unmodified response. Use it to check field names when Claude changes the endpoint.
- Claude's private website endpoints can change. This is not the supported Anthropic developer API.
- Live login, download behavior, and edited conversation branch behavior require verification in Chrome. No live account test was performed during creation.

## Project layout

- Extension (what ships): `manifest.json`, `popup.html`, `popup.js`, `convert.js`, `icons/`.
- `tools/make_icons.py`: redraws the icons and the promo tile (needs Pillow).
- `tools/make_screenshot.js` + `tools/sample-fixture.json`: builds the store screenshot from a synthetic chat. The fixture also works as a converter test: `node -e "const {toMarkdown}=require('./convert.js'); console.log(toMarkdown(require('./tools/sample-fixture.json'),'url',{}))"`
- `tools/pack.ps1`: builds `dist/chat-to-markdown-<version>.zip` for the Chrome Web Store.
- `CHROMEWEBSTORE.md`: listing text, permission justifications and privacy answers for the dashboard. `PRIVACY.md`: the privacy policy to host publicly.

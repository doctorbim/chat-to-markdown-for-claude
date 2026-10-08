# Chrome Web Store submission notes

Keep this file current whenever the manifest, permissions, or data handling change.
Everything below can be pasted into the Developer Dashboard (https://chrome.google.com/webstore/devconsole).

## Package

- Build: `powershell -ExecutionPolicy Bypass -File tools/pack.ps1` → `dist/chat-to-markdown-<version>.zip`
- The zip contains only `manifest.json`, `popup.html`, `popup.js`, `convert.js`, `icons/`. No `tools/`, `store/`, fixtures or docs.
- Bump `version` in `manifest.json` before every upload; the store rejects a repeated version.

## Store listing

**Name:** Chat to Markdown for Claude
(“for Claude” is the descriptive, non-affiliated form. Do not use Anthropic or Claude logos, and do not name it “Claude …”.)

**Summary (≤132 chars):**
Save the open claude.ai conversation as a clean Markdown file. Runs only when you click; nothing leaves your browser.

**Category:** Productivity → Tools (or Workflow & Planning)

**Description:**

> Export any claude.ai conversation to a tidy Markdown (.md) file with one click.
>
> • Clean structure: “## You” / “## Claude” headings, optional timestamps and YAML front matter (title, dates, model)
> • Files Claude created are included as fenced code blocks
> • Text Claude writes between tool calls (“working notes”) can be collapsed, shown, or hidden
> • Optional thinking summaries and attachment text, both in collapsible blocks
> • Edited chats export only the branch you are looking at
> • Attachments listed by name and size; a “Not included” line counts what was left out
> • Save raw JSON for archiving or debugging
>
> Private by design: the extension has no background process and no host permissions. It only runs on the tab you are looking at, when you click it. The conversation is read using your existing claude.ai session and converted inside your browser. Nothing is sent anywhere, and no analytics are collected.
>
> This is an independent project and is not affiliated with, endorsed by, or sponsored by Anthropic. Claude is a trademark of Anthropic, PBC. It relies on claude.ai’s website data, which may change without notice.

**Language:** English

## Assets

| Asset | File | Required |
|---|---|---|
| Store icon 128×128 | `icons/icon128.png` | yes |
| Screenshot 1280×800 | `store/screenshot-1280x800.png` | at least 1 (up to 5) |
| Small promo tile 440×280 | `store/promo-440x280.png` | yes |
| Marquee 1400×560 | — | optional |

Regenerate: `python tools/make_icons.py`, then `node tools/make_screenshot.js` and capture `store/screenshot.html` at 1280×800
(e.g. serve the folder with `python -m http.server` and use Chrome headless `--screenshot --window-size=1280,800`).
A real screenshot of the popup over a claude.ai chat is a good second screenshot. Use a chat with nothing private in it.

## Privacy tab

**Single purpose:**
Export the claude.ai conversation open in the current tab to a Markdown (or raw JSON) file on the user’s computer.

**Permission justifications:**

- `activeTab`: Grants temporary access to the current claude.ai tab only after the user clicks the toolbar button, so the extension can read the conversation they chose to export. No access to any other tab or site.
- `scripting`: Runs one function in that tab (via `chrome.scripting.executeScript`) that requests the conversation from claude.ai with the user’s existing session, so the request is same-origin. The result goes back to the popup for conversion. No persistent content scripts.

**Host permissions:** none.

**Remote code:** No, I am not using remote code. All JavaScript is in the package.

**Data usage (check exactly these):**
- ☑ Website content: the conversation text is read from the active claude.ai tab, but only to convert it locally into the file the user downloads.
- Everything else unchecked (no PII, health, financial, authentication, personal communications collection, location, web history, user activity).

Note: the extension does not *collect* data in the store’s sense (nothing is sent off the device), but the conversation is website content that it handles, so declaring it is the conservative choice.

**Certifications (all true):**
- ☑ I do not sell or transfer user data to third parties, outside of the approved use cases
- ☑ I do not use or transfer user data for purposes that are unrelated to my item’s single purpose
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** host `PRIVACY.md` publicly (GitHub repo, GitHub Pages, or a public Gist) and paste the link.

## Distribution

- **Visibility:** *Unlisted* (only people with the link can install) is the low-risk way to share with friends. *Public* makes it searchable.
- Regions: all.
- Pricing: free.

## Review risks to know about

- **Trademark:** “Claude” appears in the name and description. Referential use (“for Claude”) is common for claude.ai exporters, but Anthropic could still file a complaint. The disclaimer above and the custom icon reduce the risk.
- **Private endpoints:** claude.ai’s `/api/organizations/...` endpoints are undocumented. If they change, the extension breaks until it is updated. Reviewers don’t block this, but users will notice.
- **Keyword spam / misleading claims:** keep the description factual. Don’t list competitor names.

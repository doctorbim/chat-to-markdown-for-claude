# Privacy policy - Chat to Markdown for Claude

_Last updated: 2026-10-08_

Chat to Markdown for Claude (“the extension”) exports the claude.ai conversation open in your current tab to a file on your computer.

## What the extension accesses

When you click the toolbar button and choose an export, the extension reads the open conversation from claude.ai using your existing signed-in browser session. This includes the messages, the names and sizes of attachments, and any files Claude created in that chat.

## What happens to it

- The conversation is converted to Markdown (or saved as raw JSON) **inside your browser** and handed to Chrome’s normal download mechanism.
- **Nothing is sent to the developer or any third party.** The extension makes no network requests except the claude.ai requests needed to read the chat you chose.
- The extension does not read or store your cookies, passwords, or session tokens.
- There is no analytics, telemetry, advertising, or tracking.

## What is stored

Only your export preferences (which checkboxes are on) are saved, in the extension’s own local storage on your device. They are never transmitted. Removing the extension deletes them.

## Permissions

- `activeTab`: temporary access to the current tab, granted only when you click the extension.
- `scripting`: runs the export function in that tab.

The extension has no background process and no access to other websites.

## Changes

If this policy changes, the updated version will be posted at this address with a new date.

## Contact

Questions: open an issue at the project’s page, or email the address listed on the Chrome Web Store listing.

_Not affiliated with Anthropic. Claude is a trademark of Anthropic, PBC._

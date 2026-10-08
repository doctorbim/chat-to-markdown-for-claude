// Builds store/screenshot.html: the real popup beside real converter output for a synthetic chat.
// Then capture it at 1280x800 (see CHROMEWEBSTORE.md, "Assets").
const fs = require('fs');
const path = require('path');
const { toMarkdown } = require('../convert.js');

const root = path.join(__dirname, '..');
const data = require('./sample-fixture.json');
const md = toMarkdown(data, 'https://claude.ai/chat/example', {
  frontMatter: true, timestamps: true, files: true, thinking: false, narration: 'collapse'
}).replace(/^exported: .*$/m, 'exported: "2026-10-08 19:00"');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const html = `<!doctype html><meta charset="utf-8">
<style>
  body { margin: 0; width: 1280px; height: 800px; overflow: hidden; background: #efe9de; font-family: system-ui, "Segoe UI", sans-serif; display: flex; gap: 48px; align-items: center; padding: 0 56px; box-sizing: border-box; }
  .left { flex: none; }
  h2 { font-size: 34px; margin: 0 0 8px; color: #292724; }
  .left p { margin: 0 0 24px; font-size: 18px; color: #6b665d; }
  iframe { width: 320px; height: 600px; border: 0; border-radius: 14px; box-shadow: 0 18px 50px rgb(60 40 20 / .22); zoom: 1.0; background: #faf9f5; }
  .file { flex: 1; height: 700px; background: #fffdf9; border-radius: 14px; box-shadow: 0 18px 50px rgb(60 40 20 / .16); overflow: hidden; }
  .bar { padding: 12px 18px; border-bottom: 1px solid #e8e3d8; font-size: 14px; color: #6b665d; }
  pre { margin: 0; padding: 16px 20px; font: 13.5px/1.5 Consolas, "Cascadia Mono", monospace; color: #3a3631; white-space: pre-wrap; }
</style>
<div class="left">
  <h2>Chat to Markdown</h2>
  <p>Your claude.ai chat, saved as a clean .md file.</p>
  <iframe src="../popup.html"></iframe>
</div>
<div class="file"><div class="bar">📄 2026-10-06 Sourdough starter schedule.md</div><pre>${esc(md)}</pre></div>`;

fs.writeFileSync(path.join(root, 'store', 'screenshot.html'), html);
console.log('wrote store/screenshot.html');

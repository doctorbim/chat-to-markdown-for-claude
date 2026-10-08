'use strict';
// Builds Markdown from the JSON that claude.ai's own conversation endpoint returns.
// The endpoint is private and can change, so every field is read defensively.

const DEFAULT_OPTIONS = {
  frontMatter: true,      // YAML header: title, url, dates, model
  timestamps: true,       // time under each "## You" / "## Claude"
  narration: 'collapse',  // text Claude wrote between tool calls: 'show' | 'collapse' | 'hide'
  files: true,            // file/artifact contents Claude wrote via tools
  attachmentText: false,  // extracted text of attached files, in a collapsed block
  thinking: false         // thinking blocks, in a collapsed block
};

const LANGS = {
  js: 'javascript', mjs: 'javascript', ts: 'typescript', py: 'python', ps1: 'powershell',
  psm1: 'powershell', sh: 'bash', bat: 'bat', md: 'markdown', html: 'html', htm: 'html',
  css: 'css', json: 'json', jsonl: 'json', yml: 'yaml', yaml: 'yaml', csv: 'csv',
  xml: 'xml', svg: 'xml', sql: 'sql', c: 'c', cpp: 'cpp', h: 'c', cs: 'csharp',
  java: 'java', rs: 'rust', go: 'go', r: 'r', txt: ''
};

const PRESENT_TOOLS = /^(present_files|SendUserFile|send_user_file)$/i;

const pad = n => String(n).padStart(2, '0');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function formatTime(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return ` (${bytes.toFixed(i ? 1 : 0)} ${units[i]})`;
}

// Fence one backtick longer than any run inside the body, so embedded ``` can't close it.
function fence(body, lang = '') {
  const longest = Math.max(0, ...(body.match(/`+/g) || []).map(run => run.length));
  const f = '`'.repeat(Math.max(3, longest + 1));
  return `${f}${lang}\n${body.replace(/\n+$/, '')}\n${f}`;
}

function details(summary, body) {
  return `<details>\n<summary>${escapeHtml(summary)}</summary>\n\n${body.trim()}\n\n</details>`;
}

// Returns the messages on the branch currently shown in the chat.
// Edited chats contain several branches; follow parent links back from the current leaf.
function selectPath(all, leafId) {
  const children = new Map();
  for (const m of all) {
    const p = m.parent_message_uuid;
    if (p) children.set(p, (children.get(p) || 0) + 1);
  }
  const branched = [...children.values()].some(count => count > 1);
  if (!branched) return { messages: all, branched: false };

  const byId = new Map(all.map(m => [m.uuid, m]));
  if (!leafId || !byId.has(leafId)) {
    throw new Error('This chat has edited branches and Claude did not say which one is current. Export stopped to avoid mixing replies.');
  }
  const path = [];
  const seen = new Set();
  for (let m = byId.get(leafId); m && !seen.has(m.uuid); m = byId.get(m.parent_message_uuid)) {
    seen.add(m.uuid);
    path.push(m);
  }
  return { messages: path.reverse(), branched: true };
}

// A tool call that wrote a file or artifact, if its input carries the content.
function fileFromTool(block) {
  const name = String(block.name || 'tool');
  if (/memory/i.test(name)) return null; // memory writes aren't part of the conversation
  const input = block.input && typeof block.input === 'object' ? block.input : {};
  const body = ['content', 'file_text', 'code'].map(k => input[k]).find(v => typeof v === 'string' && v.trim());
  if (!body) return null;
  const label = String(input.file_path || input.path || input.title || input.id || name).split(/[\\/]/).pop();
  const ext = label.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || '';
  const lang = ext in LANGS ? LANGS[ext] : (typeof input.language === 'string' ? input.language : ext);
  return { label, body, lang };
}

function renderAttachments(message, opts) {
  const lines = [];
  const seen = new Set();
  const all = [
    ...(Array.isArray(message.attachments) ? message.attachments : []),
    ...(Array.isArray(message.files) ? message.files : []),
    ...(Array.isArray(message.files_v2) ? message.files_v2 : [])
  ];
  for (const a of all) {
    const name = String(a.file_name || a.name || 'attachment');
    const key = a.file_uuid || a.uuid || a.id || name;
    if (seen.has(key) || seen.has(name)) continue;
    seen.add(key);
    seen.add(name);
    const dims = a.preview_asset?.image_width && a.preview_asset?.image_height
      ? ` ${a.preview_asset.image_width}×${a.preview_asset.image_height}` : '';
    lines.push(`> 📎 ${name}${formatSize(Number(a.file_size ?? a.size_bytes ?? a.size))}${dims}`);
    if (opts.attachmentText && typeof a.extracted_content === 'string' && a.extracted_content.trim()) {
      const ext = name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || '';
      lines.push(details(name, fence(a.extracted_content, LANGS[ext] ?? '')));
    }
  }
  return lines;
}

// claude.ai shows your messages as plain text, so pasted terminal output keeps its lines and columns.
// Markdown would join those lines into one paragraph, so fence console-looking runs and hard-break the rest.
const PROMPT_LINE = /^(PS [A-Za-z]:\\[^>]*>|[A-Za-z]:\\[^>]*>|\$ |[\w.-]+@[\w.-]+:\S*[$#] )/;
const PRE_LINE = /^(\s{2,}\S|\t)|\S {3,}\S|^\s*\||^(Line \||At line:|Exception:|WARNING:|ERROR:|VERBOSE:)|^-{3,}\s+-{3,}/;

function renderUserText(text) {
  if (/^\s*(```|~~~)/m.test(text)) return text; // already Markdown with its own fences
  const lines = text.split(/\r?\n/);
  const out = [];
  let pre = null;   // lines of the current console block
  let inPrompt = false; // a prompt line was seen: keep fencing until a blank line
  let prose = [];
  const endProse = () => { if (prose.length) out.push(prose.join('  \n')); prose = []; };
  const endPre = () => {
    if (pre) out.push(fence(pre.join('\n').replace(/\n+$/, ''), ''));
    pre = null;
    inPrompt = false;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      // A blank line stays inside a console block only if the block carries on after it.
      const next = lines.slice(i + 1).find(l => l.trim());
      if (pre && next !== undefined && (PRE_LINE.test(next) || PROMPT_LINE.test(next))) { pre.push(''); inPrompt = false; continue; }
      endPre();
      endProse();
      continue;
    }
    if (PROMPT_LINE.test(line) || PRE_LINE.test(line) || (pre && inPrompt)) {
      endProse();
      if (!pre) pre = [];
      if (PROMPT_LINE.test(line)) inPrompt = true;
      pre.push(line);
    } else {
      endPre();
      prose.push(line.trimEnd());
    }
  }
  endPre();
  endProse();
  return out.join('\n\n');
}

function renderMessage(message, opts, stats) {
  const who = message.sender === 'human' ? 'You' : 'Claude';
  const time = opts.timestamps ? formatTime(message.created_at) : '';
  const out = [`## ${who}`];
  if (time) out.push(`*${time}*`);

  const attachments = renderAttachments(message, opts);
  if (attachments.length) out.push(attachments.join('\n\n'));

  const blocks = Array.isArray(message.content) ? message.content : [];
  // Tools that only hand files to the user come after the answer; they don't end the working phase.
  const presentIds = new Set(blocks.filter(b => b.type === 'tool_use' && PRESENT_TOOLS.test(String(b.name || ''))).map(b => b.id));
  const isTool = b => (b.type === 'tool_use' && !PRESENT_TOOLS.test(String(b.name || '')))
    || (b.type === 'tool_result' && !presentIds.has(b.tool_use_id) && !PRESENT_TOOLS.test(String(b.name || '')));
  const lastTool = blocks.map(isTool).lastIndexOf(true);
  const parts = [];
  let interim = [];

  // Text before the final tool call is working narration, not the answer.
  const flush = () => {
    if (!interim.length) return;
    const body = interim.join('\n\n');
    interim = [];
    if (opts.narration === 'show') parts.push(body);
    else if (opts.narration === 'collapse') parts.push(details('Working notes', body));
    else stats.narration++;
  };

  blocks.forEach((b, i) => {
    if (b.type === 'text' || (!b.type && typeof b.text === 'string')) {
      const text = String(b.text || '').trim();
      if (!text) return;
      if (message.sender === 'human') parts.push(renderUserText(text));
      else if (i < lastTool) interim.push(text);
      else { flush(); parts.push(text); }
    } else if (b.type === 'thinking') {
      // claude.ai usually sends thinking_hidden with an empty string; the visible summaries are what's left.
      const full = String(b.thinking || '').trim();
      const summaries = (Array.isArray(b.summaries) ? b.summaries : [])
        .map(x => String(x?.summary || '').trim()).filter(Boolean);
      if (!full && !summaries.length) return;
      if (!opts.thinking) { stats.thinking++; return; }
      flush();
      if (full) parts.push(details('Thinking', full));
      else parts.push(details('Thinking (summary)', summaries.map(x => `- ${x}`).join('\n')));
    } else if (b.type === 'tool_use') {
      flush();
      const file = opts.files ? fileFromTool(b) : null;
      if (file) parts.push(`**📄 ${file.label}**\n\n${fence(file.body, file.lang)}`);
      else stats.tools++;
    } else if (b.type === 'tool_result') {
      flush();
      stats.results++;
    } else if (b.type) {
      stats.other++;
    }
  });
  flush();

  // Older or simpler responses may only carry the flattened text field.
  if (!parts.length && typeof message.text === 'string' && message.text.trim()) {
    parts.push(message.sender === 'human' ? renderUserText(message.text.trim()) : message.text.trim());
  }
  out.push(parts.length ? parts.join('\n\n') : '*No text content in this message.*');
  return out.join('\n\n');
}

function toMarkdown(data, url, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (!Array.isArray(data?.chat_messages)) throw new Error('Claude changed its conversation response: chat_messages is missing.');

  const { messages: path, branched } = selectPath(data.chat_messages, data.current_leaf_message_uuid);
  const messages = path.filter(m => m.sender === 'human' || m.sender === 'assistant');
  if (!messages.length) throw new Error('No conversation messages found. Wait for Claude to finish and try again.');

  const stats = { tools: 0, results: 0, thinking: 0, narration: 0, other: 0 };
  const sections = messages.map(m => renderMessage(m, opts, stats));
  const title = String(data.name || 'Claude conversation').replace(/[\r\n]+/g, ' ').trim() || 'Claude conversation';

  const head = [];
  if (opts.frontMatter) {
    const fm = [
      ['title', title],
      ['url', url],
      ['created', formatTime(data.created_at)],
      ['updated', formatTime(data.updated_at)],
      ['model', data.model],
      ['messages', messages.length],
      ['branch', branched ? 'current (chat has edited branches)' : ''],
      ['exported', formatTime(new Date().toISOString())]
    ].filter(([, v]) => v !== undefined && v !== null && v !== '');
    head.push(`---\n${fm.map(([k, v]) => `${k}: ${typeof v === 'number' ? v : JSON.stringify(String(v))}`).join('\n')}\n---`);
  }
  head.push(`# ${title}`);
  if (!opts.frontMatter) head.push(url);

  const omitted = [];
  if (stats.tools) omitted.push(plural(stats.tools, 'tool call'));
  if (stats.results) omitted.push(plural(stats.results, 'tool result'));
  if (stats.thinking) omitted.push(plural(stats.thinking, 'thinking block'));
  if (stats.narration) omitted.push(plural(stats.narration, 'working-notes block'));
  if (stats.other) omitted.push(plural(stats.other, 'other block'));
  if (omitted.length) head.push(`> Not included: ${omitted.join(', ')}.`);

  return `${head.join('\n\n')}\n\n${sections.join('\n\n---\n\n')}\n`;
}

function suggestedFilename(data, ext) {
  const base = String(data?.name || 'Claude conversation')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ').trim().slice(0, 100).replace(/[. ]+$/, '') || 'Claude conversation';
  const date = formatTime(data?.created_at).slice(0, 10);
  return `${date ? `${date} ` : ''}${base}.${ext}`;
}

if (typeof module !== 'undefined') module.exports = { DEFAULT_OPTIONS, toMarkdown, suggestedFilename, fence, selectPath };
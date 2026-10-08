// This function runs in the Claude tab so fetch uses the user's existing session.
async function readConversation() {
  try {
    const chatId = location.pathname.match(/^\/chat\/([a-f0-9-]+)(?:\/|$)/i)?.[1];
    if (location.origin !== 'https://claude.ai' || !chatId) {
      throw new Error('Open a conversation at claude.ai/chat/… first.');
    }
    async function get(path) {
      const response = await fetch(path, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) {
        const error = new Error(`Claude returned HTTP ${response.status}. Refresh the chat and check that you are signed in.`);
        error.status = response.status;
        throw error;
      }
      return response.json();
    }
    const orgs = await get('/api/organizations');
    if (!Array.isArray(orgs)) throw new Error('Claude returned an unexpected organization response.');
    const eligible = orgs.filter(org => org.uuid);
    eligible.sort((a, b) => Number(b.capabilities?.includes('chat') ?? false) - Number(a.capabilities?.includes('chat') ?? false));
    for (const org of eligible) {
      try {
        const data = await get(`/api/organizations/${encodeURIComponent(org.uuid)}/chat_conversations/${encodeURIComponent(chatId)}?rendering_mode=messages&render_all_tools=true`);
        if (!Array.isArray(data.chat_messages)) throw new Error('Claude changed its conversation response: chat_messages is missing.');
        return { ok: true, data, url: `https://claude.ai/chat/${chatId}` };
      } catch (error) {
        if (error.status !== 403 && error.status !== 404) throw error;
      }
    }
    throw new Error('This chat could not be read in any of your Claude organizations.');
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

const CHECKBOXES = ['frontMatter', 'timestamps', 'files', 'attachmentText', 'thinking'];
const STORAGE_KEY = 'exportOptions';
const $ = id => document.getElementById(id);

function loadOptions() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { /* use defaults */ }
  const opts = { ...DEFAULT_OPTIONS, ...saved };
  for (const id of CHECKBOXES) $(id).checked = Boolean(opts[id]);
  const radio = document.querySelector(`input[name="narration"][value="${opts.narration}"]`)
    || document.querySelector('input[name="narration"][value="collapse"]');
  radio.checked = true;
}

function readOptions() {
  const opts = { narration: document.querySelector('input[name="narration"]:checked')?.value || 'collapse' };
  for (const id of CHECKBOXES) opts[id] = $(id).checked;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(opts)); } catch { /* not fatal */ }
  return opts;
}

async function fetchCurrentChat() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith('https://claude.ai/chat/')) throw new Error('Open a Claude conversation first, then click this extension.');
  const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: readConversation });
  const result = results[0]?.result;
  if (!result?.ok) throw new Error(result?.error || 'Could not read this tab. Refresh it and try again.');
  return result;
}

function download(text, filename, type) {
  const blobUrl = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
}

function setStatus(text, state) {
  const status = $('status');
  status.textContent = text;
  status.dataset.state = state;
}

async function run(kind) {
  const buttons = document.querySelectorAll('button');
  buttons.forEach(b => { b.disabled = true; });
  setStatus('Reading conversation… keep this popup open.', 'busy');
  try {
    const { data, url } = await fetchCurrentChat();
    if (kind === 'json') {
      download(JSON.stringify(data, null, 2), suggestedFilename(data, 'json'), 'application/json;charset=utf-8');
    } else {
      download(toMarkdown(data, url, readOptions()), suggestedFilename(data, 'md'), 'text/markdown;charset=utf-8');
    }
    setStatus(`Downloading “${data.name || 'Untitled chat'}”. Check Chrome’s downloads.`, 'ok');
  } catch (error) {
    setStatus(error.message || String(error), 'error');
  } finally {
    buttons.forEach(b => { b.disabled = false; });
  }
}

loadOptions();
requestAnimationFrame(() => document.body.classList.add('ready')); // no switch animation on open
$('export').addEventListener('click', () => run('md'));
$('raw').addEventListener('click', () => run('json'));
document.querySelectorAll('input, select').forEach(el => el.addEventListener('change', readOptions));
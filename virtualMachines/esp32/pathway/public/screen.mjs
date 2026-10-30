import { createPendingRequestStore } from './request-recovery.mjs';

const container = document.querySelector('#screen');
const message = document.querySelector('#message');
const button = document.querySelector('#send');
const newButton = document.querySelector('#new-request');
const requestIdLabel = document.querySelector('#request-id');
const controls = new Map();
const outputs = new Map();
let sending = false;
async function json(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}
try {
  const description = await json('/api/screen');
  const screen = description.screens[description.initialScreen];
  if (!navigator.locks || !crypto.randomUUID) throw new Error('Requester recovery requires a secure localhost browser with Web Locks');
  const recoveryKey = `pulse.pathway.pending.${description.id}`;
  const recovery = createPendingRequestStore(localStorage, recoveryKey);
  container.style.width = `${screen.columns}ch`;
  container.style.height = `${screen.rows * 1.5}em`;
  for (const field of screen.fields) {
    const editable = field.binding && field.direction !== 'FROM';
    const element = document.createElement(editable ? 'input' : 'span');
    element.className = 'field';
    element.style.left = `${field.column - 1}ch`;
    element.style.top = `${(field.row - 1) * 1.5}em`;
    element.style.width = `${field.width}ch`;
    const value = field.literal ?? description.fields[field.binding].value;
    if (editable) {
      element.value = value.trimEnd();
      element.maxLength = field.width;
      element.setAttribute('aria-label', field.label);
      if (!controls.has(field.binding)) controls.set(field.binding, []);
      controls.get(field.binding).push(element);
      element.addEventListener('input', () => {
        for (const peer of controls.get(field.binding)) if (peer !== element) peer.value = element.value;
      });
    } else element.textContent = value;
    if (field.binding) {
      if (!outputs.has(field.binding)) outputs.set(field.binding, []);
      outputs.get(field.binding).push(element);
    }
    container.append(element);
  }
  const updatePending = () => {
    const pending = recovery.load();
    for (const [name, elements] of controls) {
      for (const element of elements) {
        element.disabled = pending !== null;
        if (pending) element.value = pending.values[name] ?? '';
      }
    }
    button.textContent = pending ? 'Retry saved request' : 'Send request (Enter)';
    if (pending) {
      requestIdLabel.textContent = `Pending request: ${pending.requestId}`;
      message.textContent = 'A request is awaiting a confirmed reply. Retry uses the same ID and command.';
    } else {
      requestIdLabel.textContent = '';
      message.textContent = 'Ready.';
    }
  };
  updatePending();
  window.addEventListener('storage', event => {
    if (event.key !== recoveryKey && event.key !== null) return;
    try { updatePending(); }
    catch (error) { message.textContent = error.message; button.disabled = true; }
  });
  document.querySelector('#requester').addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    sending = true;
    button.disabled = true;
    newButton.disabled = true;
    message.textContent = 'Sending...';
    try {
      await navigator.locks.request(recoveryKey, async () => {
        const values = Object.fromEntries([...controls].map(([name, elements]) => [name, elements[0].value]));
        const pending = recovery.begin(values, crypto.randomUUID());
        updatePending();
        const result = await json('/api/requester', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(pending),
        });
        if (result.requestId !== pending.requestId) throw new Error('Requester reply identity does not match the saved request');
        for (const [name, value] of Object.entries(result.values)) {
          for (const element of outputs.get(name) ?? []) {
            if (element instanceof HTMLInputElement) element.value = value.trimEnd();
            else element.textContent = value;
          }
        }
        recovery.complete(pending.requestId);
        updatePending();
        requestIdLabel.textContent = `Completed request: ${pending.requestId}`;
        message.textContent = 'Reply received.';
      });
    } catch (error) { message.textContent = error.message; }
    finally { sending = false; button.disabled = false; newButton.disabled = false; }
  });
  newButton.addEventListener('click', async () => {
    try {
      await navigator.locks.request(recoveryKey, () => {
        if (recovery.load() && !window.confirm('The previous request may already have committed. Abandon its recovery ID and start a different request?')) return;
        recovery.abandon();
        updatePending();
        requestIdLabel.textContent = '';
        message.textContent = 'Ready for a new request. Starting a new ID does not undo a previous transaction.';
      });
    } catch (error) { message.textContent = error.message; }
  });
  if (!recovery.load()) message.textContent = 'Ready.';
  async function status() {
    try {
      const snapshot = await json('/api/status');
      document.querySelector('#status').textContent =
        `Controller ${snapshot.controllerId}\n` +
        (snapshot.stockPrimary ? `Stock primary: ${snapshot.stockPrimary} (JS replicas are fallback)\n` : '') +
        (snapshot.inventoryPrimary ? `Inventory primary: ${snapshot.inventoryPrimary} (same-ID JS recovery)\n` : '') +
        snapshot.classes.map(item => `${item.name}: ${snapshot.placements.filter(p => p.name === item.name).length}/${item.replicas} instances`).join('\n') +
        '\n' + snapshot.placements.map(item => `${item.name} -> ${item.nodeId}`).join('\n');
    } catch (error) { document.querySelector('#status').textContent = error.message; }
  }
  await status();
  setInterval(status, 2000);
} catch (error) { message.textContent = error.message; button.disabled = true; newButton.disabled = true; }

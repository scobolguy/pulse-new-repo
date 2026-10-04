import * as vscode from 'vscode';
export function looksLikeHanoi(source, fileName = '') {
    return /hanoi/i.test(fileName) || /towers\s+of\s+hanoi/i.test(source);
}
function nonce() {
    let value = '';
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let index = 0; index < 32; index += 1)
        value += alphabet[Math.floor(Math.random() * alphabet.length)];
    return value;
}
// Webview that replays "Move disk d from a to b" program output as a Towers of
// Hanoi animation and mirrors the debugger's current line and variables.
export class HanoiPanel {
    panel;
    trackedSessions = new Set();
    pending = [];
    ready = false;
    trackSession(sessionId, enabled) {
        if (enabled)
            this.trackedSessions.add(sessionId);
        else
            this.trackedSessions.delete(sessionId);
    }
    isTracking(sessionId) {
        return this.trackedSessions.has(sessionId);
    }
    show(title) {
        if (this.panel) {
            this.panel.title = `Hanoi · ${title}`;
            this.panel.reveal(vscode.ViewColumn.Beside, true);
            return;
        }
        this.ready = false;
        this.panel = vscode.window.createWebviewPanel('pulsePmachineHanoi', `Hanoi · ${title}`, {
            viewColumn: vscode.ViewColumn.Beside,
            preserveFocus: true,
        }, { enableScripts: true, retainContextWhenHidden: true });
        this.panel.webview.html = this.html();
        this.panel.webview.onDidReceiveMessage((message) => {
            if (message?.type !== 'ready')
                return;
            this.ready = true;
            for (const item of this.pending.splice(0))
                void this.panel?.webview.postMessage(item);
        });
        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.ready = false;
            this.pending = [];
        });
    }
    post(message) {
        if (!this.panel)
            return;
        if (!this.ready) {
            this.pending.push(message);
            return;
        }
        void this.panel.webview.postMessage(message);
    }
    dispose() {
        this.panel?.dispose();
        this.trackedSessions.clear();
    }
    html() {
        const scriptNonce = nonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${scriptNonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 10px; }
  #title { font-weight: 600; margin-bottom: 6px; }
  #board { position: relative; height: 230px; border-bottom: 6px solid var(--vscode-editorWidget-border, #888); margin: 8px 0 4px; }
  .peg { position: absolute; bottom: 0; width: 8px; height: 190px; background: var(--vscode-editorWidget-border, #888); border-radius: 4px 4px 0 0; }
  .peg-label { position: absolute; bottom: -26px; width: 40px; text-align: center; opacity: .7; font-size: 12px; }
  .disk { position: absolute; height: 18px; border-radius: 9px; transition: left .35s ease, bottom .35s ease; color: #111; font-size: 11px; text-align: center; line-height: 18px; font-weight: 600; }
  #status { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 30px; font-size: 13px; }
  #status b { font-variant-numeric: tabular-nums; }
  #controls { display: flex; gap: 8px; align-items: center; margin: 8px 0; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 0; padding: 4px 10px; cursor: pointer; }
  table { border-collapse: collapse; font-family: var(--vscode-editor-font-family); font-size: 12px; margin-top: 6px; }
  td, th { border: 1px solid var(--vscode-editorWidget-border, #555); padding: 2px 8px; text-align: left; }
  th { opacity: .8; }
  .changed { background: rgba(255, 200, 0, .25); }
  #line { font-family: var(--vscode-editor-font-family); white-space: pre; }
  #error { color: var(--vscode-errorForeground); }
</style>
</head>
<body>
<div id="title">Towers of Hanoi</div>
<div id="board" data-testid="hanoi-board"></div>
<div id="status">
  <span>Move <b id="move">0</b> of <b id="total">0</b></span>
  <span>Status: <b id="state">waiting</b></span>
  <span id="solved"></span>
</div>
<div id="controls">
  <button id="replay">Replay</button>
  <label>Speed <input id="speed" type="range" min="50" max="1200" step="50" value="400"> <span id="speedValue">400</span>ms</label>
</div>
<div>Line <b id="lineNo">-</b>: <span id="line"></span></div>
<div id="error"></div>
<table><thead><tr><th>Variable</th><th>Value</th><th>Scope</th></tr></thead><tbody id="vars"></tbody></table>
<script nonce="${scriptNonce}">
  const vscode = acquireVsCodeApi();
  const colors = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#818cf8', '#e879f9', '#a3e635', '#f472b6', '#2dd4bf'];
  const board = document.getElementById('board');
  let diskCount = 0;
  let moves = [];
  let shown = 0;
  let timer = null;
  let previous = {};
  let stepMs = 400;

  function parseLine(line) {
    const header = /Towers of Hanoi for (\\d+) disks?/i.exec(line);
    if (header) { diskCount = Number(header[1]); moves = []; shown = 0; render(); return; }
    const move = /Move disk (\\d+) from (\\d+) to (\\d+)/i.exec(line);
    if (move) {
      const disk = Number(move[1]);
      if (!diskCount) diskCount = Math.max(diskCount, disk);
      diskCount = Math.max(diskCount, disk);
      moves.push({ disk, from: Number(move[2]), to: Number(move[3]) });
      document.getElementById('total').textContent = String(moves.length);
      schedule();
    }
  }

  function pegsAfter(count) {
    const pegs = { 1: [], 2: [], 3: [] };
    for (let disk = diskCount; disk >= 1; disk -= 1) pegs[1].push(disk);
    let error = '';
    for (const move of moves.slice(0, count)) {
      const top = pegs[move.from]?.at(-1);
      if (top !== move.disk) { error = 'Illegal move: disk ' + move.disk + ' is not on top of peg ' + move.from; break; }
      const target = pegs[move.to]?.at(-1);
      if (target !== undefined && target < move.disk) { error = 'Illegal move: disk ' + move.disk + ' onto smaller disk ' + target; break; }
      pegs[move.from].pop();
      pegs[move.to].push(move.disk);
    }
    return { pegs, error };
  }

  function render() {
    const width = board.clientWidth || 480;
    const pegX = [0, width / 6, width / 2, (5 * width) / 6];
    if (!board.querySelector('.peg')) {
      for (let peg = 1; peg <= 3; peg += 1) {
        const element = document.createElement('div');
        element.className = 'peg';
        element.dataset.peg = String(peg);
        board.appendChild(element);
        const label = document.createElement('div');
        label.className = 'peg-label';
        label.dataset.peg = String(peg);
        label.textContent = 'Peg ' + peg;
        board.appendChild(label);
      }
    }
    for (const element of board.querySelectorAll('.peg')) element.style.left = (pegX[Number(element.dataset.peg)] - 4) + 'px';
    for (const element of board.querySelectorAll('.peg-label')) element.style.left = (pegX[Number(element.dataset.peg)] - 20) + 'px';
    for (const element of [...board.querySelectorAll('.disk')]) if (Number(element.dataset.disk) > diskCount) element.remove();
    const { pegs, error } = pegsAfter(shown);
    const maxWidth = width / 3 - 16;
    for (let peg = 1; peg <= 3; peg += 1) {
      pegs[peg].forEach((disk, level) => {
        let element = board.querySelector('.disk[data-disk="' + disk + '"]');
        if (!element) {
          element = document.createElement('div');
          element.className = 'disk';
          element.dataset.disk = String(disk);
          element.textContent = String(disk);
          element.style.background = colors[(disk - 1) % colors.length];
          board.appendChild(element);
        }
        const diskWidth = 24 + (maxWidth - 24) * (disk / Math.max(diskCount, 1));
        element.style.width = diskWidth + 'px';
        element.style.left = (pegX[peg] - diskWidth / 2) + 'px';
        element.style.bottom = (level * 19) + 'px';
      });
    }
    document.getElementById('move').textContent = String(shown);
    document.getElementById('total').textContent = String(moves.length);
    document.getElementById('error').textContent = error;
    document.getElementById('solved').textContent = diskCount && pegs[3].length === diskCount ? 'Solved ✔' : '';
  }

  function schedule() {
    if (timer) return;
    const tick = () => {
      if (shown >= moves.length) { timer = null; return; }
      shown += 1;
      render();
      timer = setTimeout(tick, stepMs);
    };
    timer = setTimeout(tick, 0);
  }

  function renderVariables(globals, locals) {
    const rows = [];
    const next = {};
    for (const [scope, values] of [['global', globals || {}], ['local', locals || {}]]) {
      for (const [name, value] of Object.entries(values)) {
        const key = scope + ':' + name;
        const text = JSON.stringify(value);
        next[key] = text;
        const changed = previous[key] !== undefined && previous[key] !== text;
        rows.push('<tr class="' + (changed ? 'changed' : '') + '"><td>' + escapeHtml(name) + '</td><td>' + escapeHtml(text) + '</td><td>' + scope + '</td></tr>');
      }
    }
    previous = next;
    document.getElementById('vars').innerHTML = rows.join('');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function reset(title) {
    if (timer) { clearTimeout(timer); timer = null; }
    diskCount = 0; moves = []; shown = 0; previous = {};
    for (const element of [...board.querySelectorAll('.disk')]) element.remove();
    document.getElementById('title').textContent = title || 'Towers of Hanoi';
    document.getElementById('state').textContent = 'starting';
    document.getElementById('lineNo').textContent = '-';
    document.getElementById('line').textContent = '';
    renderVariables({}, {});
    render();
  }

  window.addEventListener('message', (event) => {
    const message = event.data || {};
    if (message.type === 'reset') reset(message.title);
    if (message.type === 'output') parseLine(String(message.line || ''));
    if (message.type === 'run') {
      reset('Run result');
      for (const line of message.lines || []) parseLine(String(line));
      renderVariables(message.globals, {});
      document.getElementById('state').textContent = 'completed';
    }
    if (message.type === 'state') {
      document.getElementById('state').textContent = message.status === 'terminated' ? 'completed' : message.status;
      if (message.line) document.getElementById('lineNo').textContent = String(message.line);
      document.getElementById('line').textContent = message.sourceText || '';
      renderVariables(message.globals, message.locals);
    }
  });

  document.getElementById('replay').addEventListener('click', () => {
    if (timer) { clearTimeout(timer); timer = null; }
    shown = 0; render(); schedule();
  });
  document.getElementById('speed').addEventListener('input', (event) => {
    stepMs = Number(event.target.value);
    document.getElementById('speedValue').textContent = String(stepMs);
  });
  window.addEventListener('resize', render);
  render();
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
    }
}
//# sourceMappingURL=hanoiPanel.js.map
/* global acquireVsCodeApi */
(() => {
  'use strict';
  const vscode = acquireVsCodeApi();
  const byId = id => document.getElementById(id);
  let state;
  let selected = -1;
  let sourcePath = '';
  let pending = false;
  let busy = false;
  let valid = false;
  let resultVersion;
  let operationType = '';
  const backendButtons = ['metadata', 'source-pick', 'target-pick', 'refresh-schemas', 'import', 'publish', 'test-cases', 'run'];
  const fieldButtons = { source: new Map(), target: new Map() };
  function status(message, error = false) {
    byId('status').textContent = message;
    byId('status').className = error ? 'error' : '';
  }
  function edit(action) {
    if (pending || busy || !valid || !state) return;
    operationType = 'edit';
    pending = true;
    properties();
    vscode.postMessage({ type: 'edit', version: state.version, action });
  }
  function properties(resetConversion = false) {
    const rule = state?.rules[selected];
    byId('selection').textContent = rule ? `${rule.sourcePath} -> ${rule.targetPath}`
      : 'Select a connection to edit its conversion rule.';
    byId('conversion').disabled = !rule || pending || busy || !valid;
    if (resetConversion || !rule) byId('conversion').value = rule?.conversionRule || '';
    byId('apply').disabled = !rule || pending || busy || !valid;
    byId('remove').disabled = !rule || pending || busy || !valid;
    backendButtons.forEach(id => { byId(id).disabled = pending || busy || (!valid && id !== 'import'); });
    byId('payload').disabled = busy;
    byId('test-case').disabled = busy;
    byId('designer').inert = !valid || busy || pending;
    document.querySelectorAll('.link').forEach((button, index) => button.classList.toggle('selected', index === selected));
    draw();
  }
  function connect(targetPath) {
    if (!sourcePath) { status('Select or drag a source field first.', true); return; }
    edit({ type: 'connect', sourcePath, targetPath });
  }
  function renderFields(side) {
    const container = byId(side);
    container.replaceChildren();
    fieldButtons[side].clear();
    const query = byId(`${side}-search`).value.trim().toLowerCase();
    for (const field of state[side].filter(field => field.path.toLowerCase().includes(query))) {
      const button = document.createElement('button');
      button.className = 'field';
      button.type = 'button';
      button.dataset.path = field.path;
      button.title = field.path;
      const name = document.createElement('span');
      name.textContent = `${'  '.repeat(Math.min(field.depth, 8))}${field.path}`;
      const type = document.createElement('small');
      type.textContent = field.valueType;
      button.append(name, type);
      button.classList.toggle('mapped', state.rules.some(rule => rule[`${side}Path`] === field.path));
      if (side === 'source') {
        button.draggable = true;
        button.classList.toggle('selected', sourcePath === field.path);
        button.addEventListener('click', () => {
          sourcePath = field.path;
          fieldButtons.source.forEach((item, path) => item.classList.toggle('selected', path === sourcePath));
          status(`Source selected: ${sourcePath}. Click a target to connect.`);
        });
        button.addEventListener('dragstart', event => {
          sourcePath = field.path;
          event.dataTransfer.setData('application/x-pulse-field', field.path);
          event.dataTransfer.effectAllowed = 'link';
        });
      } else {
        button.addEventListener('click', () => connect(field.path));
        button.addEventListener('dragover', event => {
          if (event.dataTransfer.types.includes('application/x-pulse-field')) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'link';
            button.classList.add('over');
          }
        });
        button.addEventListener('dragleave', () => button.classList.remove('over'));
        button.addEventListener('drop', event => {
          event.preventDefault();
          button.classList.remove('over');
          const path = event.dataTransfer.getData('application/x-pulse-field');
          if (!state.source.some(item => item.path === path)) { status('Invalid source field.', true); return; }
          sourcePath = path;
          connect(field.path);
        });
      }
      fieldButtons[side].set(field.path, button);
      container.append(button);
    }
    if (!fieldButtons[side].size) container.textContent = query ? 'No matching fields.' : 'No fields. Choose a Librarian schema above.';
  }
  function draw() {
    const svg = byId('wires');
    svg.replaceChildren();
    if (!state) return;
    const bounds = svg.getBoundingClientRect();
    state.rules.forEach((rule, index) => {
      const source = fieldButtons.source.get(rule.sourcePath)?.getBoundingClientRect();
      const target = fieldButtons.target.get(rule.targetPath)?.getBoundingClientRect();
      if (!source || !target) return;
      const x1 = source.right - bounds.left;
      const x2 = target.left - bounds.left;
      const y1 = source.top + source.height / 2 - bounds.top;
      const y2 = target.top + target.height / 2 - bounds.top;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1} ${y1} C ${bounds.width / 2} ${y1}, ${bounds.width / 2} ${y2}, ${x2} ${y2}`);
      if (index === selected) path.classList.add('selected');
      svg.append(path);
    });
  }
  window.addEventListener('message', event => {
    if (event.data.type === 'backend') {
      byId('backend').textContent = `Aggregator: ${event.data.url} (configured by pulse-pmachine.backendUrl)`;
      byId('result-status').textContent = 'Backend configuration changed. Run again against the selected backend.';
      byId('result-output').textContent = 'No run for this backend.';
      byId('result-diagnostics').textContent = '';
      resultVersion = undefined;
      return;
    }
    if (event.data.type === 'busy') {
      busy = event.data.busy;
      if (busy) {
        status(event.data.message);
        byId('result-status').textContent = 'Backend action in progress…';
      } else if (byId('result-status').textContent === 'Backend action in progress…') {
        byId('result-status').textContent = 'Backend action finished. Run the published map to see results.';
      }
      properties();
      return;
    }
    if (event.data.type === 'notice') { status(event.data.message); return; }
    if (event.data.type === 'testCases') {
      const select = byId('test-case');
      const previous = select.value;
      select.replaceChildren();
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select test case';
      select.append(placeholder);
      for (const item of event.data.testCases) {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.id}: ${item.name}`;
        select.append(option);
      }
      select.value = previous;
      status(`Loaded ${event.data.testCases.length} test cases. Test cases use schema-generated sample data.`);
      return;
    }
    if (event.data.type === 'result') {
      if (event.data.version !== state?.version) return;
      resultVersion = event.data.version;
      operationType = '';
      byId('result-output').textContent = JSON.stringify(event.data.result.output, null, 2);
      byId('result-diagnostics').textContent = JSON.stringify(event.data.result.diagnostics, null, 2);
      byId('result-status').textContent = `Completed ${event.data.result.mapId} at ${new Date().toLocaleTimeString()}. ${event.data.result.diagnostics.filter(item => item.level === 'warning').length} warning(s).`;
      status('Published mapping run completed. Review output and diagnostics.');
      return;
    }
    if (event.data.type === 'error') {
      pending = false;
      busy = false;
      if (!event.data.actionError) valid = false;
      properties();
      status(event.data.message, true);
      if (operationType === 'run') {
        byId('result-output').textContent = 'Run failed. See the error above.';
        byId('result-diagnostics').textContent = '';
      }
      operationType = '';
      byId('result-status').textContent = 'Action failed. Previous output, if any, is not a result of this action.';
      return;
    }
    if (event.data.type !== 'state') return;
    if (state?.version === event.data.version && !pending && valid) return;
    const previousRule = state?.rules[selected];
    if (resultVersion !== undefined && resultVersion !== event.data.version) {
      byId('result-status').textContent = 'Document changed. Previous output is stale; publish and run again.';
    }
    state = event.data;
    pending = false;
    valid = true;
    selected = previousRule ? state.rules.findIndex(rule =>
      rule.sourcePath === previousRule.sourcePath && rule.targetPath === previousRule.targetPath) : -1;
    if (!state.source.some(field => field.path === sourcePath)) sourcePath = '';
    byId('name').textContent = `${state.name || 'Untitled mapping'}${state.id ? ` | ${state.id}` : ' | set a map ID before publishing'}`;
    byId('source-schema').textContent = state.sourceSchema || 'Embedded source structure';
    byId('target-schema').textContent = state.targetSchema || 'Embedded target structure';
    renderFields('source');
    renderFields('target');
    byId('links').replaceChildren();
    state.rules.forEach((rule, index) => {
      const button = document.createElement('button');
      button.className = 'link';
      button.textContent = `${rule.sourcePath} -> ${rule.targetPath}${rule.conversionRule ? ' (fx)' : ''}`;
      button.addEventListener('click', () => {
        if (pending || busy) return;
        const current = state.rules[selected];
        if (current && byId('conversion').value !== (current.conversionRule || '')) {
          status('Apply the conversion rule before selecting another connection.', true);
          return;
        }
        selected = index;
        properties(true);
      });
      byId('links').append(button);
    });
    if (!state.rules.length) byId('links').textContent = 'Drag fields to create your first connection.';
    properties(true);
    status(`${state.rules.length} connection(s). Changes use the standard VS Code save workflow.`);
  });
  byId('text').addEventListener('click', () => vscode.postMessage({ type: 'text' }));
  byId('apply').addEventListener('click', () => edit({
    type: 'conversion', index: selected, conversionRule: byId('conversion').value,
  }));
  byId('remove').addEventListener('click', () => edit({ type: 'remove', index: selected }));
  function operation(type, extra = {}) {
    if (busy || pending || (!state && type !== 'import')) return;
    const rule = state?.rules[selected];
    if (rule && byId('conversion').value !== (rule.conversionRule || '')) {
      status('Apply the conversion rule before starting another action.', true);
      return;
    }
    busy = true;
    operationType = type;
    properties();
    if (type === 'run') {
      byId('result-output').textContent = 'Running…';
      byId('result-diagnostics').textContent = '';
      resultVersion = undefined;
    }
    vscode.postMessage({ type, version: state?.version, ...extra });
  }
  byId('metadata').addEventListener('click', () => operation('metadata'));
  byId('source-pick').addEventListener('click', () => operation('schema', { side: 'source' }));
  byId('target-pick').addEventListener('click', () => operation('schema', { side: 'target' }));
  byId('refresh-schemas').addEventListener('click', () => operation('refreshSchemas'));
  byId('import').addEventListener('click', () => operation('import'));
  byId('publish').addEventListener('click', () => operation('publish'));
  byId('test-cases').addEventListener('click', () => operation('testCases'));
  byId('run').addEventListener('click', () => {
    try {
      const text = byId('payload').value.trim();
      const input = text ? { payload: JSON.parse(text) } : { testCaseId: byId('test-case').value };
      if (text && (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload))) {
        throw new Error('Sample input must be a JSON object.');
      }
      if (!text && !input.testCaseId) throw new Error('Enter a JSON payload or select a test case.');
      operation('run', { input });
    } catch (error) { status(error.message, true); }
  });
  for (const side of ['source', 'target']) {
    byId(`${side}-search`).addEventListener('input', () => { if (state) { renderFields(side); draw(); } });
  }
  byId('payload').value = vscode.getState()?.payload || '';
  byId('payload').addEventListener('input', () => {
    vscode.setState({ payload: byId('payload').value });
    byId('result-status').textContent = 'Sample input changed. Run again for current input.';
  });
  properties();
  new ResizeObserver(draw).observe(byId('designer'));
  vscode.postMessage({ type: 'ready' });
})();

import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { PMachineScheduler, parsePcode } from '../../pmachines/javascript/index.mjs';
import { runRequester } from '../../pathway/src/requester.mjs';
import { compileScreenCobol } from '../../../../languages/screencobol/src/compiler.mjs';
import { compileCobolishToPcode } from '../../../../languages/cobolish85/src/compile-cobolish-to-pcode.mjs';

async function waitFor(predicate, message, timeoutMs = 5000) {
  const deadline = performance.now() + timeoutMs;
  while (!predicate() && performance.now() < deadline) await delay(10);
  assert.ok(predicate(), message);
}

async function fixture(processes, role, ...args) {
  const child = fork(fileURLToPath(new URL('./fixtures/delayed-broker-process.mjs', import.meta.url)), [role, ...args], {
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  const messages = [];
  let errors = '';
  child.stdout.resume();
  child.stderr.on('data', chunk => { errors = (errors + chunk).slice(-4000); });
  child.on('message', message => messages.push(message));
  const exited = once(child, 'exit');
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const timeout = setTimeout(() => child.kill(), 2000);
      try {
        if (child.connected) {
          await new Promise((resolve, reject) => child.send({ type: 'stop' }, error => {
            if (error && error.code !== 'ERR_IPC_CHANNEL_CLOSED') reject(error);
            else resolve();
          }));
        }
        await exited;
      } finally { clearTimeout(timeout); }
    }
  };
  processes.push({ stop });
  await waitFor(() => messages.some(message => message.type === 'ready')
    || child.exitCode !== null || child.signalCode !== null, `${role} did not start: ${errors}`, 30000);
  const ready = messages.find(message => message.type === 'ready');
  assert.ok(ready, `${role} exited during startup: ${errors}`);
  return { child, ready, messages };
}

test('COBOL waits for a real 30-second broker reply while its single pmachine slot runs another COBOL program',
  { timeout: 120000 }, async t => {
    const processes = [];
    const cancellation = new AbortController();
    t.after(async () => {
      cancellation.abort(new Error('Broker proof stopped'));
      for (const process of processes.reverse()) await process.stop();
    });
    const broker = await fixture(processes, 'broker');
    const responder = await fixture(processes, 'responder', broker.ready.origin);
    assert.notEqual(responder.child.pid, process.pid);
    assert.notEqual(broker.child.pid, responder.child.pid);
    const scheduler = new PMachineScheduler({ slots: 1, maxContexts: 4 });
    const requester = compileScreenCobol(await fs.readFile(
      new URL('../../pathway/examples/echo.scob', import.meta.url), 'utf8'));
    const other = compileCobolishToPcode(`IDENTIFICATION DIVISION.
PROGRAM-ID. OTHER-WORK.
PROCEDURE DIVISION.
DISPLAY "slot reused"
STOP RUN.`);
    let sends = 0;
    let correlationId;
    const requestJson = async (route, body) => {
      const response = await fetch(`${broker.ready.origin}${route}`, {
        ...(body === undefined ? {} : {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
        }),
        signal: cancellation.signal,
      });
      assert.ok(response.ok, `Broker HTTP ${response.status}`);
      return response.json();
    };
    let finished = false;
    const requested = runRequester(requester, { 'REQUEST-TEXT': 'slow query' }, async (service, record, { requestId }) => {
      sends += 1;
      correlationId = requestId;
      await requestJson('/request', { id: requestId, service, record });
      for (;;) {
        const reply = await requestJson(`/reply/${requestId}`);
        if (reply) {
          assert.equal(reply.id, requestId);
          assert.ok(reply.elapsedMs >= 30000, `Responder waited only ${reply.elapsedMs} ms`);
          return reply;
        }
        await delay(50, undefined, { signal: cancellation.signal });
      }
    }, { scheduler, requestId: 'virtual-broker-request-0001', signal: cancellation.signal })
      .then(result => { finished = true; return result; });
    // Install rejection handling immediately so a failed assertion can safely cancel the proof.
    requested.catch(() => {});
    await waitFor(() => responder.messages.some(message => message.type === 'waiting'), 'Responder did not receive the query');
    const waiting = scheduler.getStatus();
    assert.equal(waiting.slots, 1);
    assert.equal(waiting.active, 0);
    assert.equal(waiting.available, 1);
    assert.equal(waiting.waiting, 1);
    assert.equal(waiting.contexts[0].waitReason, 'pathway.send');
    assert.equal(responder.messages.find(message => message.type === 'waiting').id, correlationId);
    const startedOther = performance.now();
    const result = await scheduler.execute({
      instructions: parsePcode(other.pcodeText), programMap: other.programMap, opcodeMap: new Map(),
      sourceMessage: '', debugLogger() {},
    }, { name: 'other-cobol-program' });
    assert.deepEqual(result.stdout, ['slot reused']);
    assert.equal(result.error, null);
    assert.equal(result.stepLimitHit, false);
    assert.ok(performance.now() - startedOther < 5000, 'Unrelated COBOL work was blocked by the broker wait');
    assert.equal(finished, false);
    assert.equal(scheduler.getStatus().waiting, 1);
    t.diagnostic('Requester swapped out: active=0, available=1; another compiled COBOL program completed before the reply.');
    const completed = await requested;
    assert.equal(completed.values['REPLY-TEXT'], 'REPLIED slow query'.padEnd(40));
    assert.equal(sends, 1);
    assert.deepEqual(await requestJson('/status'), { queries: 1, replies: 1, delivered: 1 });
    const status = scheduler.getStatus();
    assert.equal(status.completed, 2);
    assert.equal(status.failed, 0);
    assert.equal(status.available, 1);
    assert.equal(status.resumptions, 1);
    assert.deepEqual(status.contexts, []);
    t.diagnostic('Correlated reply arrived after >=30,000 ms; requester resumed to completion without re-sending its query.');
  });

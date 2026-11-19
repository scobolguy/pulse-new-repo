import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createXmlStreamBindings } from '../../pmachines/javascript/src/xml-bindings.mjs';

function readEvents(bindings, handle) {
  const events = [];
  let event;
  while ((event = bindings['host.xml_stream_next'](handle)) !== '') events.push(JSON.parse(event));
  return events;
}

test('XML stream emits ordered namespace-aware events and decoded text', () => {
  const bindings = createXmlStreamBindings();
  const handle = bindings['host.xml_stream_open'](
    '<p:Root xmlns:p="urn:payments"><p:Amount Ccy="CAD">12&amp;34<![CDATA[tail]]></p:Amount></p:Root>'
  );
  const events = readEvents(bindings, handle);
  assert.deepEqual(events.map(event => [event.kind, event.path]), [
    ['start', '/Root'],
    ['start', '/Root/Amount'],
    ['text', '/Root/Amount'],
    ['text', '/Root/Amount'],
    ['end', '/Root/Amount'],
    ['end', '/Root']
  ]);
  assert.equal(events[0].namespace, 'urn:payments');
  assert.deepEqual(events[1].attributes, { Ccy: 'CAD' });
  assert.deepEqual(events.filter(event => event.kind === 'text').map(event => event.text), ['12&34', 'tail']);
});

test('XML stream rejects DTDs, malformed documents, and capacity violations', () => {
  const bindings = createXmlStreamBindings({ maxBytes: 128, maxDepth: 2, maxNodes: 3 });
  const dtd = bindings['host.xml_stream_open']('<!DOCTYPE r><r/>');
  assert.throws(() => readEvents(bindings, dtd), /DTD/);
  assert.throws(() => bindings['host.xml_stream_open'](`<r>${'x'.repeat(200)}</r>`), /capacity/);

  const malformed = bindings['host.xml_stream_open']('<r>\n<x></r>');
  assert.throws(() => readEvents(bindings, malformed), error => {
    assert.match(error.message, /Invalid XML at line 2, position/);
    assert.equal(error.line, 2);
    assert.ok(error.position > 1);
    assert.equal(error.xmlDiagnostic, true);
    return true;
  });

  const deep = bindings['host.xml_stream_open']('<r><x><y/></x></r>');
  assert.throws(() => readEvents(bindings, deep), /depth capacity/);

  const tooMany = bindings['host.xml_stream_open']('<r><x/><y/><z/></r>');
  assert.throws(() => readEvents(bindings, tooMany), /node capacity/);
});

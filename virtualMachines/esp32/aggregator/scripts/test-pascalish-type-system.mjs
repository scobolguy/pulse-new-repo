import assert from 'node:assert/strict';
import { compilePascalishProgramWithAntlr } from './compile-pascalish-program-antlr-to-pcode.mjs';
import { resolveQueueTypeIds } from '../src/backend/queueDslCompiler.mjs';

const source = `
daemon test on local
  refresh 500 ms;

  type MessageType = string;
  type MessageList = list of MessageType;

  var
    inputTypes  : MessageList from librarian;
    outputTypes : MessageList from librarian;

  function CleanAmount(raw : string) : decimal export;
  begin
    return 12.34;
  end;

begin
end.
`;

try {
  const compiled = compilePascalishProgramWithAntlr(source);
  assert.ok(compiled && typeof compiled.pcodeText === 'string');
  assert.match(compiled.pcodeText, /PROC_|HALT|PUSH/);
  assert.ok(compiled.programMap.typeRegistry, 'missing nominal type registry');
  assert.ok(compiled.programMap.typeRegistry.MessageList, 'missing MessageList nominal type');
  assert.ok(compiled.programMap.exportedFunctions.includes('CleanAmount'), 'missing exported function metadata');

  const resolved = resolveQueueTypeIds(['MessageList', { type: 'TypeRef', kind: 'list', elementType: { type: 'TypeRef', kind: 'user', id: 'MessageType' } }], compiled.programMap.typeRegistry);
  assert.deepEqual(resolved, ['type:messagelist', 'type:messagetype']);

  const imported = compilePascalishProgramWithAntlr(source, {
    typeRegistry: [
      { logicalId: 'MessageType', canonicalId: 'type:imported-message-v2' },
      { logicalId: 'MessageList', canonicalId: 'type:imported-list-v2' }
    ]
  });
  assert.equal(imported.programMap.typeRegistry.MessageType.canonicalId, 'type:imported-message-v2');
  assert.equal(imported.programMap.typeRegistry.MessageList.canonicalId, 'type:imported-list-v2');
  assert.deepEqual(
    resolveQueueTypeIds(['MessageList', 'MessageType'], imported.programMap.typeRegistry),
    ['type:imported-list-v2', 'type:imported-message-v2']
  );

  console.log('[pascalish-type-system] PASS: Librarian canonical type ids, exported function metadata, and queue type resolution are present');
} catch (error) {
  console.error('[pascalish-type-system] FAIL');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
}

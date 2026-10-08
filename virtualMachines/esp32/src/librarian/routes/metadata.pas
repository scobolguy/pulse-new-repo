service 'pulse-data-librarian-http-metadata';
use "JSON";
use "JSONArrays";
var request: JSONDocument;
    response: JSONDocument;
    action: JSONDocument;
    actions: JSONArray;
    position: integer;
    actionId: string;
    routePath: string;
    routeMethod: string;

function librarianActions(): string;
begin
  return '[{"id":"listFiles","method":"GET","path":"/api/librarian/files","description":"List files available to the data librarian.","requestSchema":null,"responseShape":{"files":"array"}},' +
    '{"id":"listSchemas","method":"GET","path":"/api/librarian/schemas","description":"Return schema catalog with inferred structure trees and lifecycle status.","requestSchema":null,"responseShape":{"schemas":[{"typeId":"string","path":"string","structure":"tree","lifecycle":"object"}]}},' +
    '{"id":"listSubschemas","method":"GET","path":"/api/librarian/subschemas","description":"List field-restricted virtual schemas and their parent schema contracts.","requestSchema":null,"responseShape":{"subschemas":[{"id":"string","parentSchemaPath":"string","accessibleFields":"string[]","structure":"tree"}]}},' +
    '{"id":"createSubschema","method":"POST","path":"/api/librarian/subschemas","description":"Create a virtual schema that exposes only selected canonical field paths from a parent schema.","requestSchema":{"id":"string","label":"string","parentSchemaPath":"string","accessibleFields":"string[]"},"responseShape":{"status":"created","subschema":"object"}},' +
    '{"id":"listDataTypes","method":"GET","path":"/api/librarian/data-types","description":"List managed data type IDs used by mapper contracts.","requestSchema":null,"responseShape":{"types":[{"id":"string","label":"string","builtin":"boolean"}]}},' +
    '{"id":"createDataType","method":"POST","path":"/api/librarian/data-types","description":"Create normalized custom data type entry.","requestSchema":{"id":"string","label":"string"},"responseShape":{"status":"created","type":"object"}},' +
    '{"id":"uploadSchema","method":"POST","path":"/api/librarian/upload/schemas","description":"Upload raw schema asset. Requires x-filename header and binary body.","requestSchema":{"headers":{"x-filename":"string","content-type":"mime-type"},"body":"binary"},"responseShape":{"status":"ok","filename":"string","dest":"schemas","size":"number"}},' +
    '{"id":"setSchemaLifecycle","method":"POST","path":"/api/librarian/schema-lifecycle","description":"Configure active/reject dates for schema selection policy.","requestSchema":{"path":"string","activeFrom":"iso-date?","rejectAfter":"iso-date?","keepForDisplay":"boolean?"},"responseShape":{"status":"updated","lifecycle":"object"}},' +
    '{"id":"searchFiles","method":"GET","path":"/api/librarian/search?q=<query>&ext=<ext>","description":"Search cataloged files by name and extension.","requestSchema":{"query":{"q":"string?","ext":"string?"}},"responseShape":{"files":"array"}},' +
    '{"id":"listMapperRulesets","method":"GET","path":"/api/librarian/mapper-rulesets","description":"List mapper rulesets used to constrain source->destination map transforms.","requestSchema":null,"responseShape":{"rulesets":[{"id":"string","sourcePatterns":"string[]","targetPatterns":"string[]"}]}}]'
end;

function envelope(matched: boolean; status: integer; body: string): string;
begin
  response.load('{}');
  response.setBoolean('matched', matched);
  response.setInteger('status', status);
  response.embed('body', body);
  return response.serialize()
end;

function capabilityResponse(): string;
begin
  return '{"service":"data-librarian","version":"1.0","purpose":"Schema and contract intelligence for map generation and validation.","outputsForMapper":["sourceTypeId and targetTypeId","sourceSchemaPath and targetSchemaPath","sourceStructure and targetStructure snapshots","schema lifecycle status for safe selection"],"recommendedFlow":["Call /api/librarian/schemas and select active schemas","Extract typeId/path/structure for source and target contracts","Call mapper /api/mapper/llm/pcode-map-template","Create map via /api/mapper/maps and validate via /api/mapper/maps/:id/run"],"endpoints":{"capabilities":"/api/librarian/llm/base","actions":"/api/librarian/llm/actions","actionSchema":"/api/librarian/llm/actions/:id","schemaCatalog":"/api/librarian/schemas","subschemas":"/api/librarian/subschemas","dataTypes":"/api/librarian/data-types","mapperRulesets":"/api/librarian/mapper-rulesets"}}'
end;

post '/dispatch';
begin
  request.load(host.event_body());
  routePath := request.text('path');
  routeMethod := host.string_upper(request.text('method'));

  if (routeMethod = 'GET') and (routePath = '/health') then
    return envelope(true, 200, '{"status":"ok","service":"data-librarian"}');

  if routeMethod = 'GET' then
  begin
    if routePath = '/api/librarian/llm/base' then
      return envelope(true, 200, capabilityResponse());
    if routePath = '/api/librarian/files' then
    begin
      response.load('{}');
      response.embed('files', request.value('files'));
      return envelope(true, 200, response.serialize())
    end;
    if routePath = '/api/librarian/llm/actions' then
    begin
      actions.load(librarianActions());
      response.load('{"service":"data-librarian"}');
      response.setInteger('actionCount', actions.count());
      response.embed('actions', actions.serialize());
      return envelope(true, 200, response.serialize())
    end;
    actionId := host.string_replace(routePath,
      '^/api/librarian/llm/actions/', '', '');
    if (actionId <> routePath) and (host.string_index(actionId, '/') < 0) then
    begin
      actionId := host.text_trim(actionId);
      actions.load(librarianActions());
      position := 0;
      while position < actions.count() do
      begin
        action.load(actions.item(position));
        if action.text('id') = actionId then
        begin
          response.load('{"service":"data-librarian"}');
          response.embed('action', action.serialize());
          return envelope(true, 200, response.serialize())
        end;
        position := position + 1
      end;
      response.load('{}');
      response.setText('error', 'Unknown librarian action: ' + actionId);
      return envelope(true, 404, response.serialize())
    end
  end;

  return envelope(false, 200, 'null')
end
end.

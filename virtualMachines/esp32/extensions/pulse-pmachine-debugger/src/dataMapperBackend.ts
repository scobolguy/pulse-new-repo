import { JsonObject, MappingDocument, object, parseMapping, publicationPayload, samePublishedMapping } from './dataMapperModel.js';

export type LibrarianSchema = JsonObject & { path: string; typeId?: string; name?: string; structure?: JsonObject | null; mtime?: string };
export type MapSummary = { id: string; name: string };
export type TestCase = { id: string; name: string };
export type MappingResult = { mapId: string; input: JsonObject; output: JsonObject; diagnostics: JsonObject[] };

export class MapperHttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export class DataMapperBackend {
  readonly baseUrl: string;
  constructor(baseUrl: string, private readonly signal?: AbortSignal) {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('pulse-pmachine.backendUrl must be an HTTP/HTTPS base URL without credentials, query or fragment.');
    }
    this.baseUrl = url.toString().replace(/\/+$/, '');
  }

  private async request(route: string, method = 'GET', body?: unknown, timeout = 30000): Promise<JsonObject> {
    const signals = [AbortSignal.timeout(timeout)];
    if (this.signal) signals.push(this.signal);
    const response = await fetch(`${this.baseUrl}${route}`, {
      method, redirect: 'error', signal: AbortSignal.any(signals),
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    let data: unknown;
    try { data = await response.json(); }
    catch { throw new MapperHttpError(response.status, `${method} ${route}: expected JSON (HTTP ${response.status}).`); }
    if (!response.ok) {
      throw new MapperHttpError(response.status,
        `${method} ${route}: ${object(data) && typeof data.error === 'string' ? data.error : `HTTP ${response.status}`}`);
    }
    if (!object(data)) throw new Error(`${method} ${route}: invalid response object.`);
    return data;
  }

  async schemas(): Promise<LibrarianSchema[]> {
    const data = await this.request('/api/librarian/schemas');
    if (!Array.isArray(data.schemas)) throw new Error('Librarian returned an invalid schemas list.');
    return data.schemas.map((schema: unknown) => {
      if (!object(schema) || typeof schema.path !== 'string' || !schema.path
        || (schema.structure != null && (!object(schema.structure) || !Array.isArray(schema.structure.children)))) {
        throw new Error('Librarian returned a schema without a path or a valid field structure.');
      }
      return schema as LibrarianSchema;
    });
  }

  async maps(): Promise<MapSummary[]> {
    const data = await this.request('/api/mapper/maps');
    return this.namedList(data.maps, 'maps');
  }

  async testCases(): Promise<TestCase[]> {
    const data = await this.request('/api/mapper/test-cases');
    return this.namedList(data.testCases, 'test cases');
  }

  private namedList(value: unknown, label: string): MapSummary[] {
    if (!Array.isArray(value)) throw new Error(`Aggregator returned an invalid ${label} list.`);
    return value.map((item: unknown) => {
      if (!object(item) || typeof item.id !== 'string' || !item.id || typeof item.name !== 'string') {
        throw new Error(`Aggregator returned an invalid ${label} entry.`);
      }
      return { id: item.id, name: item.name };
    });
  }

  async map(id: string): Promise<MappingDocument> {
    const data = await this.request(`/api/mapper/maps/${encodeURIComponent(id)}`);
    return parseMapping(JSON.stringify(data.map));
  }

  async existingMap(id: string): Promise<MappingDocument | undefined> {
    try { return await this.map(id); }
    catch (error) {
      if (error instanceof MapperHttpError && error.status === 404) return undefined;
      throw error;
    }
  }

  async publish(map: MappingDocument, existing?: MappingDocument): Promise<MappingDocument> {
    const payload = publicationPayload(map);
    if (existing) {
      // The current API has no conditional PUT; catch intervening edits before sending.
      const latest = await this.map(String(map.id));
      if (JSON.stringify(latest) !== JSON.stringify(existing)) {
        throw new Error('The backend map changed during confirmation. Refresh and publish again.');
      }
    }
    const data = await this.request(existing ? `/api/mapper/maps/${encodeURIComponent(String(map.id))}` : '/api/mapper/maps',
      existing ? 'PUT' : 'POST', payload);
    let saved = parseMapping(JSON.stringify(data.map));
    // POST creates a default map and does not accept submaps; preserve them with the supported PUT.
    if (!existing && Array.isArray(payload.submaps) && payload.submaps.length) {
      try {
        const updated = await this.request(`/api/mapper/maps/${encodeURIComponent(String(saved.id))}`, 'PUT', payload);
        saved = parseMapping(JSON.stringify(updated.map));
      } catch (error) {
        throw new Error(`Map created, but submaps were not published. Retry publishing before running. ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (!samePublishedMapping(map, saved)) throw new Error('Backend saved a different mapping. Import it to inspect before running.');
    return saved;
  }

  async run(map: MappingDocument, input: unknown): Promise<MappingResult> {
    publicationPayload(map);
    if (!object(input) || !('payload' in input || 'testCaseId' in input)) throw new Error('Provide a JSON payload object or a test case.');
    if ('payload' in input && !object(input.payload)) throw new Error('Sample input must be a JSON object, not an array or scalar.');
    if (!('payload' in input) && (typeof input.testCaseId !== 'string' || !input.testCaseId)) throw new Error('Select a test case.');
    const saved = await this.map(String(map.id));
    if (!samePublishedMapping(map, saved)) throw new Error('Local changes are not published. Publish this map before running it.');
    const data = await this.request(`/api/mapper/maps/${encodeURIComponent(String(map.id))}/run`, 'POST', input, 120000);
    if (typeof data.mapId !== 'string' || !object(data.input) || !object(data.output)
      || !Array.isArray(data.diagnostics) || !data.diagnostics.every(object)) {
      throw new Error('Aggregator returned an invalid mapping run result.');
    }
    return data as MappingResult;
  }
}

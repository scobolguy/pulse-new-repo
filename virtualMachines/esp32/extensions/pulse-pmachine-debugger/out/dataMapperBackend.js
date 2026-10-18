import { object, parseMapping, publicationPayload, samePublishedMapping } from './dataMapperModel.js';
import { LogicalServiceTransactions } from './logicalServiceTransactions.js';
const LIBRARIAN_SERVICE_ID = 'pulse-data-librarian';
const MAPPER_SERVICE_ID = 'pulse-data-mapper';
export function structurePending(schema) {
    return !schema.structure && schema.structureLoaded === false;
}
export class MapperHttpError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
export class DataMapperBackend {
    baseUrl;
    transactions;
    constructor(baseUrl, signal) {
        this.transactions = new LogicalServiceTransactions(baseUrl, signal);
        this.baseUrl = this.transactions.baseUrl;
    }
    async request(serviceId, route, method = 'GET', body) {
        const response = await this.transactions.request(serviceId, {
            method,
            path: route,
            ...(body === undefined ? {} : { body }),
        });
        const data = response.body;
        if (response.status < 200 || response.status >= 300) {
            throw new MapperHttpError(response.status, `${method} ${route}: ${object(data) && typeof data.error === 'string' ? data.error : `HTTP ${response.status}`}`);
        }
        if (!object(data))
            throw new Error(`${method} ${route}: invalid response object.`);
        return data;
    }
    async schemas() {
        const data = await this.request(LIBRARIAN_SERVICE_ID, '/api/librarian/schemas');
        if (!Array.isArray(data.schemas))
            throw new Error('Librarian returned an invalid schemas list.');
        return data.schemas.map((schema) => {
            if (!object(schema) || typeof schema.path !== 'string' || !schema.path
                || (schema.structure != null && (!object(schema.structure) || !Array.isArray(schema.structure.children)))) {
                throw new Error('Librarian returned a schema without a path or a valid field structure.');
            }
            return schema;
        });
    }
    // Schema lists are lazy; structures are parsed and cached by the Librarian on first request.
    async schemaStructure(path, reparse = false) {
        const data = await this.request(LIBRARIAN_SERVICE_ID, `/api/librarian/schema-structure?path=${encodeURIComponent(path)}${reparse ? '&reparse=true' : ''}`);
        const structure = data.structure;
        if (structure != null && (!object(structure) || !Array.isArray(structure.children))) {
            throw new Error(`Librarian returned an invalid field structure for ${path}.`);
        }
        return { structure: structure ?? null,
            ...(typeof data.mtime === 'string' ? { mtime: data.mtime } : {}) };
    }
    async schemaWithStructure(schema) {
        if (!structurePending(schema))
            return schema;
        const loaded = await this.schemaStructure(schema.path);
        return { ...schema, structure: loaded.structure, structureLoaded: true, ...(loaded.mtime ? { mtime: loaded.mtime } : {}) };
    }
    async maps() {
        const data = await this.request(MAPPER_SERVICE_ID, '/api/mapper/maps');
        return this.namedList(data.maps, 'maps');
    }
    async testCases() {
        const data = await this.request(MAPPER_SERVICE_ID, '/api/mapper/test-cases');
        return this.namedList(data.testCases, 'test cases');
    }
    namedList(value, label) {
        if (!Array.isArray(value))
            throw new Error(`Aggregator returned an invalid ${label} list.`);
        return value.map((item) => {
            if (!object(item) || typeof item.id !== 'string' || !item.id || typeof item.name !== 'string') {
                throw new Error(`Aggregator returned an invalid ${label} entry.`);
            }
            return { id: item.id, name: item.name };
        });
    }
    async map(id) {
        const data = await this.request(MAPPER_SERVICE_ID, `/api/mapper/maps/${encodeURIComponent(id)}`);
        return parseMapping(JSON.stringify(data.map));
    }
    async existingMap(id) {
        try {
            return await this.map(id);
        }
        catch (error) {
            if (error instanceof MapperHttpError && error.status === 404)
                return undefined;
            throw error;
        }
    }
    async publish(map, existing) {
        const payload = publicationPayload(map);
        if (existing) {
            // The current API has no conditional PUT; catch intervening edits before sending.
            const latest = await this.map(String(map.id));
            if (JSON.stringify(latest) !== JSON.stringify(existing)) {
                throw new Error('The backend map changed during confirmation. Refresh and publish again.');
            }
        }
        const data = await this.request(MAPPER_SERVICE_ID, existing ? `/api/mapper/maps/${encodeURIComponent(String(map.id))}` : '/api/mapper/maps', existing ? 'PUT' : 'POST', payload);
        let saved = parseMapping(JSON.stringify(data.map));
        // POST creates a default map and does not accept submaps; preserve them with the supported PUT.
        if (!existing && Array.isArray(payload.submaps) && payload.submaps.length) {
            try {
                const updated = await this.request(MAPPER_SERVICE_ID, `/api/mapper/maps/${encodeURIComponent(String(saved.id))}`, 'PUT', payload);
                saved = parseMapping(JSON.stringify(updated.map));
            }
            catch (error) {
                throw new Error(`Map created, but submaps were not published. Retry publishing before running. ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        if (!samePublishedMapping(map, saved))
            throw new Error('Backend saved a different mapping. Import it to inspect before running.');
        return saved;
    }
    async run(map, input) {
        publicationPayload(map);
        if (!object(input) || !('payload' in input || 'testCaseId' in input))
            throw new Error('Provide a JSON payload object or a test case.');
        if ('payload' in input && !object(input.payload))
            throw new Error('Sample input must be a JSON object, not an array or scalar.');
        if (!('payload' in input) && (typeof input.testCaseId !== 'string' || !input.testCaseId))
            throw new Error('Select a test case.');
        const saved = await this.map(String(map.id));
        if (!samePublishedMapping(map, saved))
            throw new Error('Local changes are not published. Publish this map before running it.');
        const data = await this.request(MAPPER_SERVICE_ID, `/api/mapper/maps/${encodeURIComponent(String(map.id))}/run`, 'POST', input);
        if (typeof data.mapId !== 'string' || !object(data.input) || !object(data.output)
            || !Array.isArray(data.diagnostics) || !data.diagnostics.every(object)) {
            throw new Error('Aggregator returned an invalid mapping run result.');
        }
        return data;
    }
}
//# sourceMappingURL=dataMapperBackend.js.map
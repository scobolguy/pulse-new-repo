import React, { useEffect, useState } from 'react';

const SECTION_STYLE = {
  border: '1px solid #ccc',
  borderRadius: 6,
  padding: 16,
  background: '#fff',
  marginBottom: 16,
};

const TH = { textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 8px', fontSize: 13, color: '#444' };
const TD = { borderBottom: '1px solid #f0f0f0', padding: '6px 8px', fontSize: 13 };

export default function DataLibrarian() {
  const [dataTypes, setDataTypes] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [newTypeId, setNewTypeId] = useState('');
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [schemaSearch, setSchemaSearch] = useState('');

  async function loadAll() {
    setLoading(true);
    try {
      const [typesRes, schemasRes] = await Promise.all([
        fetch('/api/librarian/data-types'),
        fetch('/api/librarian/schemas'),
      ]);
      if (typesRes.ok) {
        const d = await typesRes.json();
        setDataTypes(d.types || []);
      }
      if (schemasRes.ok) {
        const d = await schemasRes.json();
        setSchemas(d.schemas || []);
      }
    } catch (e) {
      setMsg(`Load failed: ${e.message}`);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleAddType(e) {
    e.preventDefault();
    const id = newTypeId.trim();
    const label = newTypeLabel.trim();
    if (!id || !label) {
      setMsg('Both ID and label are required.');
      return;
    }
    try {
      const res = await fetch('/api/librarian/data-types', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, label }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Error: ${data.error}`);
        return;
      }
      setMsg(`Added type "${data.type.label}" (${data.type.id})`);
      setNewTypeId('');
      setNewTypeLabel('');
      await loadAll();
    } catch (e) {
      setMsg(`Failed: ${e.message}`);
    }
  }

  const filteredSchemas = schemas.filter(s =>
    !schemaSearch ||
    s.name.toLowerCase().includes(schemaSearch.toLowerCase()) ||
    s.type.toLowerCase().includes(schemaSearch.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 860 }}>
      <h2 style={{ marginBottom: 16 }}>Data Librarian</h2>

      {/* Data Types */}
      <div style={SECTION_STYLE}>
        <h3 style={{ marginTop: 0 }}>Message Data Types</h3>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
          These types can be assigned to queues. <strong>Text String</strong> is always available.
        </p>

        <form onSubmit={handleAddType} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input
            value={newTypeId}
            onChange={e => setNewTypeId(e.target.value)}
            placeholder="Type ID (e.g. json-order)"
            style={{ minWidth: 160 }}
          />
          <input
            value={newTypeLabel}
            onChange={e => setNewTypeLabel(e.target.value)}
            placeholder="Display label (e.g. JSON Order)"
            style={{ minWidth: 180 }}
          />
          <button type="submit">Add Type</button>
          <button type="button" onClick={loadAll} style={{ background: 'none', border: '1px solid #ccc', cursor: 'pointer' }}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </form>

        {msg && (
          <div style={{ fontSize: 12, color: '#444', marginBottom: 8, padding: '6px 10px', background: '#f5f5f5', borderRadius: 4 }}>
            {msg}
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>ID</th>
              <th style={TH}>Label</th>
              <th style={TH}>Built-in</th>
            </tr>
          </thead>
          <tbody>
            {dataTypes.length === 0 && (
              <tr><td colSpan={3} style={{ ...TD, color: '#888' }}>No types loaded. Is the Data Librarian service running?</td></tr>
            )}
            {dataTypes.map(t => (
              <tr key={t.id}>
                <td style={TD}><code>{t.id}</code></td>
                <td style={TD}>{t.label}</td>
                <td style={TD}>{t.builtin ? '✓ yes' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Schemas */}
      <div style={SECTION_STYLE}>
        <h3 style={{ marginTop: 0 }}>Schemas</h3>
        <input
          value={schemaSearch}
          onChange={e => setSchemaSearch(e.target.value)}
          placeholder="Search schemas by name or type…"
          style={{ marginBottom: 10, minWidth: 240 }}
        />
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={TH}>Name</th>
              <th style={TH}>Type</th>
              <th style={TH}>Version</th>
              <th style={TH}>Size</th>
            </tr>
          </thead>
          <tbody>
            {filteredSchemas.length === 0 && (
              <tr><td colSpan={4} style={{ ...TD, color: '#888' }}>No schemas found.</td></tr>
            )}
            {filteredSchemas.map((s, i) => (
              <tr key={i}>
                <td style={TD}>{s.name}</td>
                <td style={TD}><code>{s.type}</code></td>
                <td style={TD}>{s.version ?? '—'}</td>
                <td style={TD}>{s.size != null ? `${s.size} B` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

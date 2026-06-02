import { useCallback, useEffect, useState } from 'react';

export function DataMapperMapsPanel() {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedMapId, setSelectedMapId] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [importingMapId, setImportingMapId] = useState('');

  const loadMaps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mapper/maps');
      const data = res.ok ? await res.json() : { maps: [] };
      setMaps(Array.isArray(data.maps) ? data.maps : []);
      setStatus('');
    } catch (e) {
      setStatus(`Failed to load maps: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => void loadMaps(), 0);
  }, [loadMaps]);

  const createMap = useCallback(async () => {
    const mapName = prompt('Enter map name:', 'New Map');
    if (!mapName) return;

    const mapId = mapName
      .toLowerCase()
      .replaceAll(/[^a-z0-9_-]/g, '_')
      .slice(0, 50);

    setLoading(true);
    try {
      const res = await fetch('/api/mapper/maps', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: mapId, name: mapName, description: '' }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create map');
      }
      setStatus(`✓ Created map "${mapName}"`);
      await loadMaps();
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [loadMaps]);

  const deleteMap = useCallback(async (mapId) => {
    if (!confirm(`Delete map "${mapId}"?`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/mapper/maps/${mapId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete map');
      setStatus(`✓ Deleted map`);
      await loadMaps();
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [loadMaps]);

  const renameMap = useCallback(async (mapId) => {
    const newName = prompt('Enter new map name:', mapId);
    if (!newName) return;

    const newId = newName
      .toLowerCase()
      .replaceAll(/[^a-z0-9_-]/g, '_')
      .slice(0, 50);

    setLoading(true);
    try {
      const res = await fetch(`/api/mapper/maps/${mapId}/rename`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newId }),
      });
      if (!res.ok) throw new Error('Failed to rename map');
      setStatus(`✓ Renamed map to "${newName}"`);
      await loadMaps();
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [loadMaps]);

  const exportMap = useCallback(async (mapId) => {
    try {
      const res = await fetch(`/api/mapper/maps/${mapId}/export-csv`);
      if (!res.ok) throw new Error('Failed to export map');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${mapId}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus(`✓ Exported map to ${mapId}.csv`);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  }, []);

  const handleImportCsv = useCallback(async () => {
    if (!csvContent.trim()) {
      setStatus('CSV content is empty');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/mapper/maps/${importingMapId}/import-csv`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csvContent }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Import failed');
      }
      const data = await res.json();
      setStatus(`✓ Imported ${data.rulesAdded} rules`);
      setCsvContent('');
      setShowImportDialog(false);
      await loadMaps();
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [importingMapId, csvContent, loadMaps]);

  const handleContextMenu = (event, mapId) => {
    event.preventDefault();
    setSelectedMapId(mapId);
    setContextMenu({ x: event.clientX, y: event.clientY });
  };

  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 6, padding: 16, background: '#fff', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Maps</h3>
        <button
          type="button"
          onClick={createMap}
          disabled={loading}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            background: '#4f46e5',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          + New Map
        </button>
      </div>

      {status && (
        <div
          style={{
            marginBottom: 12,
            padding: 8,
            borderRadius: 4,
            background: status.startsWith('✓') ? '#dcfce7' : '#fee2e2',
            color: status.startsWith('✓') ? '#166534' : '#991b1b',
            fontSize: 12,
            border: `1px solid ${status.startsWith('✓') ? '#86efac' : '#fca5a5'}`,
          }}
        >
          {status}
        </div>
      )}

      <div
        style={{
          border: '1px solid #d6dbe1',
          borderRadius: 6,
          minHeight: 200,
          maxHeight: 350,
          overflow: 'auto',
          background: '#fafbfd',
        }}
      >
        {maps.length === 0 && (
          <div style={{ padding: 16, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
            No maps yet. Create one to get started.
          </div>
        )}
        {maps.map(map => (
          <div
            key={map.id}
            onContextMenu={e => handleContextMenu(e, map.id)}
            style={{
              padding: 12,
              borderBottom: '1px solid #e3e8ef',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'context-menu',
              fontSize: 12,
              background: selectedMapId === map.id ? '#f0f4f8' : '#fff',
            }}
          >
            <div>
              <div style={{ fontWeight: 500 }}>{map.name}</div>
              <div style={{ color: '#667085', fontSize: 11 }}>
                {map.ruleCount} rules • {map.submapCount} submaps
              </div>
              <div style={{ color: '#999', fontSize: 10 }}>
                Updated: {new Date(map.updatedAt).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => {
                  setImportingMapId(map.id);
                  setShowImportDialog(true);
                }}
                disabled={loading}
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: 3,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                Import CSV
              </button>
              <button
                type="button"
                onClick={() => exportMap(map.id)}
                disabled={loading}
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: 3,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                Export
              </button>
            </div>
          </div>
        ))}
      </div>

      {contextMenu && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 998,
            }}
            onClick={() => setContextMenu(null)}
          />
          <div
            style={{
              position: 'fixed',
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
              background: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              zIndex: 999,
              minWidth: 160,
              fontSize: 12,
            }}
          >
            <button
              type="button"
              onClick={() => {
                renameMap(selectedMapId);
                setContextMenu(null);
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                textAlign: 'left',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 12,
              }}
              onMouseEnter={e => {
                e.target.style.background = '#f3f4f6';
              }}
              onMouseLeave={e => {
                e.target.style.background = 'transparent';
              }}
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                deleteMap(selectedMapId);
                setContextMenu(null);
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                textAlign: 'left',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 12,
                color: '#dc2626',
              }}
              onMouseEnter={e => {
                e.target.style.background = '#fee2e2';
              }}
              onMouseLeave={e => {
                e.target.style.background = 'transparent';
              }}
            >
              Delete
            </button>
          </div>
        </>
      )}

      {showImportDialog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        >
          <div style={{
            background: '#fff',
            borderRadius: 8,
            border: '1px solid #d4dbe3',
            padding: 20,
            width: 'min(600px, 90vw)',
            maxHeight: '80vh',
            overflow: 'auto',
          }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h4 style={{ margin: 0 }}>Import CSV to Map: {importingMapId}</h4>
              <button
                type="button"
                onClick={() => {
                  setShowImportDialog(false);
                  setCsvContent('');
                }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                CSV Content (FROM, TO, DESCRIPTION columns)
              </label>
              <textarea
                value={csvContent}
                onChange={e => setCsvContent(e.target.value)}
                placeholder="FROM,TO,DESCRIPTION&#10;sourceField,targetField,trim the input"
                style={{
                  width: '100%',
                  minHeight: 200,
                  padding: 8,
                  fontSize: 12,
                  border: '1px solid #cbd5e1',
                  borderRadius: 4,
                  fontFamily: 'Consolas, monospace',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowImportDialog(false);
                  setCsvContent('');
                }}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportCsv}
                disabled={loading || !csvContent.trim()}
                style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  background: '#4f46e5',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: loading || !csvContent.trim() ? 'not-allowed' : 'pointer',
                  opacity: loading || !csvContent.trim() ? 0.6 : 1,
                }}
              >
                {loading ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

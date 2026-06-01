import { useCallback, useEffect, useMemo, useState } from 'react';

function parsePrivileges(value) {
  return Array.from(
    new Set(
      String(value || '')
        .split(/[\n,]+/)
        .map(item => item.trim())
        .filter(Boolean)
    )
  );
}

export default function GroupManagementDashboard({ actorPermissions = [] }) {
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [privilegesText, setPrivilegesText] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [status, setStatus] = useState('');
  const permissions = useMemo(
    () => (Array.isArray(actorPermissions) ? actorPermissions : []),
    [actorPermissions]
  );
  const hasPermission = useCallback(
    (permission) => permissions.includes('*') || permissions.includes(permission) || permissions.includes('users.*'),
    [permissions]
  );
  const canRead = hasPermission('users.read');
  const canManage = hasPermission('users.manage');

  const selectedGroup = useMemo(
    () => groups.find(group => group.groupId === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  const hydrateEditorFromGroup = useCallback((group) => {
    if (!group) {
      setLabel('');
      setDescription('');
      setPrivilegesText('');
      return;
    }
    setLabel(group.label || group.groupId || '');
    setDescription(group.description || '');
    setPrivilegesText((group.privileges || []).join('\n'));
  }, []);

  const selectGroup = useCallback((groupId, availableGroups = groups) => {
    const nextId = String(groupId || '').trim();
    setSelectedGroupId(nextId);
    const group = availableGroups.find((item) => item.groupId === nextId) || null;
    hydrateEditorFromGroup(group);
  }, [groups, hydrateEditorFromGroup]);

  const loadGroups = useCallback(async (preferredGroupId = null) => {
    const query = includeDeleted ? '?includeDeleted=1' : '';
    const res = await fetch(`/api/users/groups${query}`);
    if (!res.ok) throw new Error(`Load groups failed (${res.status})`);
    const payload = await res.json();
    const items = Array.isArray(payload.groups) ? payload.groups : [];
    setGroups(items);

    const preferredId = String(preferredGroupId || selectedGroupId || '').trim();
    const existing = preferredId ? items.find((group) => group.groupId === preferredId) : null;
    if (existing) {
      selectGroup(existing.groupId, items);
      return;
    }
    if (items.length > 0) {
      selectGroup(items[0].groupId, items);
      return;
    }
    selectGroup('', items);
  }, [includeDeleted, selectedGroupId, selectGroup]);

  const refreshAll = useCallback(async () => {
    try {
      await loadGroups();
      setStatus('');
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }, [loadGroups]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshAll();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshAll, includeDeleted]);

  async function handleCreateGroup() {
    try {
      const groupId = window.prompt('New group id:', '')?.trim();
      if (!groupId) return;
      const res = await fetch('/api/users/groups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          groupId,
          label: groupId,
          description: '',
          privileges: []
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Create failed (${res.status})`);
      await loadGroups(groupId);
      setStatus(`Created group ${groupId}.`);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  async function handleSaveGroup() {
    if (!selectedGroupId) return;
    try {
      const res = await fetch(`/api/users/groups/${encodeURIComponent(selectedGroupId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          description: description.trim(),
          privileges: parsePrivileges(privilegesText)
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Save failed (${res.status})`);
      await loadGroups(selectedGroupId);
      setStatus(`Saved group ${selectedGroupId}.`);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  async function handleSoftDeleteGroup() {
    if (!selectedGroupId) return;
    if (!window.confirm(`Soft delete group ${selectedGroupId}?`)) return;

    try {
      const res = await fetch(`/api/users/groups/${encodeURIComponent(selectedGroupId)}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'user-admin-soft-delete' })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Delete failed (${res.status})`);
      await loadGroups();
      setStatus(`Soft deleted group ${selectedGroupId}.`);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  if (!canRead) {
    return <div style={{ color: '#b71c1c' }}>You do not have permission to view groups.</div>;
  }

  return (
    <div>
      <h2>Group Management / Gestion des groupes</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={event => setIncludeDeleted(event.target.checked)}
          />
          Show soft-deleted groups / Afficher les groupes supprimes (soft delete)
        </label>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 280, border: '1px solid #c7cdd4', borderRadius: 6, padding: 10, background: '#f8f9fb' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Groups / Groupes</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 220, overflowY: 'auto' }}>
            {groups.map(group => (
              <li key={group.groupId} style={{ marginBottom: 4 }}>
                <button
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: '1px solid #c7cdd4',
                    borderRadius: 4,
                    padding: '6px 8px',
                    background: selectedGroupId === group.groupId ? '#eef1f5' : '#f8f9fb',
                    cursor: 'pointer',
                    opacity: group.deletedAt ? 0.65 : 1
                  }}
                  onClick={() => selectGroup(group.groupId)}
                >
                  {group.groupId}{group.deletedAt ? ' (soft-deleted)' : ''}
                </button>
              </li>
            ))}
          </ul>
          {canManage && (
            <button style={{ marginTop: 8 }} onClick={handleCreateGroup}>Create Group / Creer un groupe</button>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 360, border: '1px solid #c7cdd4', borderRadius: 6, padding: 12, background: '#f8f9fb' }}>
          {!selectedGroup && <div>Select a group.</div>}
          {selectedGroup && (
            <>
              <div style={{ marginBottom: 8, fontSize: 12, color: '#4a5565' }}>
                Group ID / Identifiant groupe: {selectedGroup.groupId}
              </div>
              {selectedGroup.deletedAt && (
                <div style={{ marginBottom: 8, fontSize: 12, color: '#9c4c00' }}>
                  Soft deleted at / Supprime (soft delete) le {selectedGroup.deletedAt} by / par {selectedGroup.deletedBy || 'unknown'}
                </div>
              )}
              <label style={{ display: 'block', marginBottom: 8 }}>
                Label / Libelle
                <input
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  value={label}
                  onChange={event => setLabel(event.target.value)}
                  disabled={!canManage || Boolean(selectedGroup.deletedAt)}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Description / Description
                <input
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  disabled={!canManage || Boolean(selectedGroup.deletedAt)}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Privileges / Privileges (comma or newline separated / separes par virgule ou ligne)
                <textarea
                  style={{ display: 'block', width: '100%', marginTop: 4, minHeight: 150 }}
                  value={privilegesText}
                  onChange={event => setPrivilegesText(event.target.value)}
                  disabled={!canManage || Boolean(selectedGroup.deletedAt)}
                />
              </label>
              {canManage && !selectedGroup.deletedAt && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleSaveGroup}>Save / Enregistrer</button>
                  <button onClick={handleSoftDeleteGroup}>Soft Delete / Suppression logique</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {status && <div style={{ marginTop: 10, fontSize: 12, color: status.toLowerCase().includes('failed') ? '#b71c1c' : '#333' }}>{status}</div>}
    </div>
  );
}

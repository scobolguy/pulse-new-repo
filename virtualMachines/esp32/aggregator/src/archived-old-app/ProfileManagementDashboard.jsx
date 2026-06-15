import { useCallback, useEffect, useMemo, useState } from 'react';

export default function ProfileManagementDashboard({ actorPermissions = [] }) {
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [permissionsText, setPermissionsText] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
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

  const selectedProfile = useMemo(
    () => profiles.find(profile => profile.profileId === selectedProfileId) || null,
    [profiles, selectedProfileId]
  );

  function parsePermissions(value) {
    return Array.from(
      new Set(
        String(value || '')
          .split(/[\n,]+/)
          .map(item => item.trim())
          .filter(Boolean)
      )
    );
  }

  const hydrateEditorFromProfile = useCallback((profile) => {
    if (!profile) {
      setLabel('');
      setDescription('');
      setPermissionsText('');
      return;
    }
    setLabel(profile.label || profile.profileId || '');
    setDescription(profile.description || '');
    setPermissionsText((profile.permissions || []).join('\n'));
  }, []);

  const selectProfile = useCallback((profileId, availableProfiles = profiles) => {
    const nextId = String(profileId || '').trim();
    setSelectedProfileId(nextId);
    const profile = availableProfiles.find((item) => item.profileId === nextId) || null;
    hydrateEditorFromProfile(profile);
  }, [hydrateEditorFromProfile, profiles]);

  const loadProfiles = useCallback(async (preferredProfileId = null) => {
    const res = await fetch('/api/users/profiles');
    if (!res.ok) throw new Error(`Load profiles failed (${res.status})`);
    const payload = await res.json();
    const items = Array.isArray(payload.profiles) ? payload.profiles : [];
    setProfiles(items);
    const preferredId = String(preferredProfileId || selectedProfileId || '').trim();
    const existing = preferredId ? items.find((item) => item.profileId === preferredId) : null;
    if (existing) {
      selectProfile(existing.profileId, items);
      return;
    }
    if (items.length > 0) {
      selectProfile(items[0].profileId, items);
      return;
    }
    selectProfile('', items);
  }, [selectedProfileId, selectProfile]);

  const refreshAll = useCallback(async () => {
    try {
      await loadProfiles();
      setStatus('');
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }, [loadProfiles]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshAll();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshAll]);

  async function handleCreateProfile() {
    try {
      const profileId = window.prompt('New profile id:', '')?.trim();
      if (!profileId) return;
      const res = await fetch('/api/users/profiles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          profileId,
          label: profileId,
          description: '',
          permissions: []
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Create failed (${res.status})`);
      await loadProfiles(profileId);
      setStatus(`Created profile ${profileId}.`);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  async function handleSaveProfile() {
    if (!selectedProfileId) return;
    try {
      const res = await fetch(`/api/users/profiles/${encodeURIComponent(selectedProfileId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label: label.trim(),
          description: description.trim(),
          permissions: parsePermissions(permissionsText)
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Save failed (${res.status})`);
      await loadProfiles(selectedProfileId);
      setStatus(`Saved profile ${selectedProfileId}.`);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  async function handleDeleteProfile() {
    if (!selectedProfileId) return;
    if (!window.confirm(`Delete profile ${selectedProfileId}?`)) return;
    try {
      const res = await fetch(`/api/users/profiles/${encodeURIComponent(selectedProfileId)}`, { method: 'DELETE' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Delete failed (${res.status})`);
      await loadProfiles();
      setStatus(`Deleted profile ${selectedProfileId}.`);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  if (!canRead) {
    return <div style={{ color: '#b71c1c' }}>You do not have permission to view profiles.</div>;
  }

  return (
    <div>
      <h2>Profile Management / Gestion des profils</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260, border: '1px solid #c7cdd4', borderRadius: 6, padding: 10, background: '#f8f9fb' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Profiles / Profils</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {profiles.map(profile => (
              <li key={profile.profileId} style={{ marginBottom: 4 }}>
                <button
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: '1px solid #c7cdd4',
                    borderRadius: 4,
                    padding: '6px 8px',
                    background: selectedProfileId === profile.profileId ? '#eef1f5' : '#f8f9fb',
                    cursor: 'pointer'
                  }}
                  onClick={() => selectProfile(profile.profileId)}
                >
                  {profile.profileId}
                </button>
              </li>
            ))}
          </ul>
          {canManage && (
            <button style={{ marginTop: 8 }} onClick={handleCreateProfile}>Create Profile / Creer un profil</button>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 340, border: '1px solid #c7cdd4', borderRadius: 6, padding: 12, background: '#f8f9fb' }}>
          {!selectedProfile && <div>Select a profile.</div>}
          {selectedProfile && (
            <>
              <div style={{ marginBottom: 8, fontSize: 12, color: '#4a5565' }}>Profile ID / Identifiant profil: {selectedProfile.profileId}</div>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Label / Libelle
                <input
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  value={label}
                  onChange={event => setLabel(event.target.value)}
                  disabled={!canManage}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Description / Description
                <input
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  disabled={!canManage}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Permissions / Permissions (comma or newline separated / separees par virgule ou ligne)
                <textarea
                  style={{ display: 'block', width: '100%', marginTop: 4, minHeight: 160 }}
                  value={permissionsText}
                  onChange={event => setPermissionsText(event.target.value)}
                  disabled={!canManage}
                />
              </label>
              {canManage && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleSaveProfile}>Save / Enregistrer</button>
                  <button onClick={handleDeleteProfile}>Delete / Supprimer</button>
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

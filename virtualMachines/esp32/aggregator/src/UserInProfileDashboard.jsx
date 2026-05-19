import React, { useEffect, useMemo, useState } from 'react';

export default function UserInProfileDashboard() {
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedProfileIds, setSelectedProfileIds] = useState([]);
  const [status, setStatus] = useState('');
  const [canRead, setCanRead] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const selectedUser = useMemo(
    () => users.find(user => user.userId === selectedUserId) || null,
    [users, selectedUserId]
  );

  async function loadAuthz() {
    const res = await fetch('/api/authz/me');
    if (!res.ok) throw new Error(`Authz failed (${res.status})`);
    const payload = await res.json();
    const permissions = Array.isArray(payload.permissions) ? payload.permissions : [];
    const has = (permission) => permissions.includes('*') || permissions.includes(permission) || permissions.includes('users.*');
    setCanRead(has('users.read'));
    setCanManage(has('users.manage'));
  }

  async function loadData() {
    const [usersRes, profilesRes] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/users/profiles')
    ]);

    if (!usersRes.ok) throw new Error(`Load users failed (${usersRes.status})`);
    if (!profilesRes.ok) throw new Error(`Load profiles failed (${profilesRes.status})`);

    const usersPayload = await usersRes.json();
    const profilesPayload = await profilesRes.json();
    const nextUsers = Array.isArray(usersPayload.users) ? usersPayload.users : [];
    const nextProfiles = Array.isArray(profilesPayload.profiles) ? profilesPayload.profiles : [];

    setUsers(nextUsers);
    setProfiles(nextProfiles);

    if (!nextUsers.some(user => user.userId === selectedUserId)) {
      setSelectedUserId(nextUsers[0]?.userId || '');
    }
  }

  async function refreshAll() {
    try {
      await loadAuthz();
      await loadData();
      setStatus('');
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    setSelectedProfileIds(Array.isArray(selectedUser.profileIds) ? selectedUser.profileIds : []);
  }, [selectedUser]);

  function toggleProfile(profileId) {
    setSelectedProfileIds(prev => (
      prev.includes(profileId)
        ? prev.filter(item => item !== profileId)
        : [...prev, profileId]
    ));
  }

  async function handleSaveMembership() {
    if (!selectedUserId) return;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(selectedUserId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profileIds: selectedProfileIds })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Save failed (${res.status})`);
      await loadData();
      setStatus(`Updated profiles for ${selectedUserId}.`);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  if (!canRead) {
    return <div style={{ color: '#b71c1c' }}>You do not have permission to view user profile assignments.</div>;
  }

  return (
    <div>
      <h2>User In Profile / Utilisateur dans profil</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260, border: '1px solid #c7cdd4', borderRadius: 6, padding: 10, background: '#f8f9fb' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Users / Utilisateurs</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {users.map(user => (
              <li key={user.userId} style={{ marginBottom: 4 }}>
                <button
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: '1px solid #c7cdd4',
                    borderRadius: 4,
                    padding: '6px 8px',
                    background: selectedUserId === user.userId ? '#eef1f5' : '#f8f9fb',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedUserId(user.userId)}
                >
                  {user.email || user.userId}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ flex: 1, minWidth: 340, border: '1px solid #c7cdd4', borderRadius: 6, padding: 12, background: '#f8f9fb' }}>
          {!selectedUser && <div>Select a user to manage profile membership / Selectionnez un utilisateur pour gerer les profils.</div>}
          {selectedUser && (
            <>
              <div style={{ marginBottom: 8, fontSize: 12, color: '#4a5565' }}>Email / Courriel: {selectedUser.email || selectedUser.userId}</div>
              <div style={{ marginBottom: 8, fontSize: 13 }}>Profiles assigned / Profils assignes</div>
              <div style={{ border: '1px solid #c7cdd4', borderRadius: 4, padding: 8, maxHeight: 220, overflowY: 'auto', background: '#fff' }}>
                {profiles.map(profile => (
                  <label key={profile.profileId} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={selectedProfileIds.includes(profile.profileId)}
                      onChange={() => toggleProfile(profile.profileId)}
                      disabled={!canManage}
                    />
                    {profile.profileId}
                  </label>
                ))}
              </div>
              {canManage && (
                <div style={{ marginTop: 10 }}>
                  <button onClick={handleSaveMembership}>Update Membership / Mettre a jour l'affectation</button>
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

import React, { useEffect, useMemo, useState } from 'react';

export default function UserManagementDashboard({ actorPermissions = [] }) {
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [officeLocation, setOfficeLocation] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [selectedProfileIds, setSelectedProfileIds] = useState([]);
  const [status, setStatus] = useState('');
  const [canRead, setCanRead] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const selectedUser = useMemo(
    () => users.find(user => user.userId === selectedUserId) || null,
    [users, selectedUserId]
  );

  useEffect(() => {
    const permissions = Array.isArray(actorPermissions) ? actorPermissions : [];
    const has = (permission) => permissions.includes('*') || permissions.includes(permission) || permissions.includes('users.*');
    setCanRead(has('users.read'));
    setCanManage(has('users.manage'));
  }, [actorPermissions]);

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
    if (!selectedUserId && nextUsers.length > 0) {
      setSelectedUserId(nextUsers[0].userId);
    }
  }

  async function refreshAll() {
    try {
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
    setEmail((selectedUser.email || selectedUser.userId || '').toLowerCase());
    setDisplayName(selectedUser.displayName || selectedUser.userId);
    setEnabled(selectedUser.enabled !== false);
    setDepartment(selectedUser.department || 'Operations');
    setJobTitle(selectedUser.jobTitle || 'Operations Analyst');
    setOfficeLocation(selectedUser.officeLocation || 'HQ');
    setManagerEmail(selectedUser.managerEmail || '');
    setSelectedProfileIds(Array.isArray(selectedUser.profileIds) ? selectedUser.profileIds : []);
  }, [selectedUser]);

  function toggleProfile(profileId) {
    setSelectedProfileIds(prev => (
      prev.includes(profileId)
        ? prev.filter(item => item !== profileId)
        : [...prev, profileId]
    ));
  }

  async function handleCreateUser() {
    try {
      const userId = window.prompt('New user email / Nouvel email utilisateur:', '')?.trim().toLowerCase();
      if (!userId) return;
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId,
          email: userId,
          displayName: userId,
          enabled: true,
          profileIds: []
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Create failed (${res.status})`);
      await loadData();
      setSelectedUserId(userId);
      setStatus(`Created user ${userId}.`);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  async function handleSaveUser() {
    if (!selectedUserId) return;
    try {
      const body = {
        displayName: displayName.trim(),
        enabled,
        department: department.trim(),
        jobTitle: jobTitle.trim(),
        officeLocation: officeLocation.trim(),
        managerEmail: managerEmail.trim().toLowerCase(),
        profileIds: selectedProfileIds
      };
      if (selectedUserId !== 'system-admin') {
        body.email = email.trim().toLowerCase();
      }

      const res = await fetch(`/api/users/${encodeURIComponent(selectedUserId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Save failed (${res.status})`);
      await loadData();
      setSelectedUserId(email.trim().toLowerCase() || selectedUserId);
      setStatus(`Saved user ${email || selectedUserId}.`);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  async function handleDeleteUser() {
    if (!selectedUserId) return;
    if (!window.confirm(`Delete user ${selectedUserId}?`)) return;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(selectedUserId)}`, { method: 'DELETE' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Delete failed (${res.status})`);
      setSelectedUserId('');
      await loadData();
      setStatus(`Deleted user ${selectedUserId}.`);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  async function handleRefreshFromOutlook() {
    if (!selectedUserId) return;
    try {
      const selectedEmail = (email || selectedUser?.email || selectedUser?.userId || '').trim().toLowerCase();
      if (!selectedEmail) {
        throw new Error('Email is required to refresh from Outlook');
      }
      const res = await fetch(`/api/users/${encodeURIComponent(selectedUserId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: selectedEmail,
          refreshDirectory: true
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Refresh failed (${res.status})`);
      await loadData();
      setSelectedUserId(selectedEmail || selectedUserId);
      setStatus(`Refreshed user details from Outlook for ${selectedEmail}.`);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  if (!canRead) {
    return <div style={{ color: '#b71c1c' }}>You do not have permission to view users.</div>;
  }

  return (
    <div>
      <h2>User Management / Gestion des utilisateurs</h2>
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
          {canManage && (
            <button style={{ marginTop: 8 }} onClick={handleCreateUser}>Create User / Creer un utilisateur</button>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 340, border: '1px solid #c7cdd4', borderRadius: 6, padding: 12, background: '#f8f9fb' }}>
          {!selectedUser && <div>Select a user.</div>}
          {selectedUser && (
            <>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Email / Courriel
                <input
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  disabled={!canManage || selectedUser.userId === 'system-admin'}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Display Name / Nom affiche
                <input
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  value={displayName}
                  onChange={event => setDisplayName(event.target.value)}
                  disabled={!canManage}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Department / Departement
                <input
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  value={department}
                  onChange={event => setDepartment(event.target.value)}
                  disabled={!canManage}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Job Title / Poste
                <input
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  value={jobTitle}
                  onChange={event => setJobTitle(event.target.value)}
                  disabled={!canManage}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Office Location / Bureau
                <input
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  value={officeLocation}
                  onChange={event => setOfficeLocation(event.target.value)}
                  disabled={!canManage}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Manager Email / Courriel du gestionnaire
                <input
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  value={managerEmail}
                  onChange={event => setManagerEmail(event.target.value)}
                  disabled={!canManage}
                />
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={event => setEnabled(event.target.checked)}
                  disabled={!canManage}
                />
                Enabled / Active
              </label>
              <div style={{ marginBottom: 8, fontSize: 13 }}>Profiles / Profils</div>
              <div style={{ border: '1px solid #c7cdd4', borderRadius: 4, padding: 8, maxHeight: 180, overflowY: 'auto', background: '#fff' }}>
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
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={handleSaveUser}>Save / Enregistrer</button>
                  <button onClick={handleRefreshFromOutlook}>Refresh From Outlook / Actualiser depuis Outlook</button>
                  <button onClick={handleDeleteUser}>Delete / Supprimer</button>
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

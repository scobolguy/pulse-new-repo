import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * User Provisioner Component
 * 
 * Implements the User Provisioner role from the architecture specification.
 * Responsibilities:
 * - Create user profiles
 * - Edit user profiles
 * - Delete user profiles
 * - Submit profiles for verification
 * 
 * Part of the dual-control workflow - cannot approve own work.
 */
export default function UserProvisioner({ actorPermissions = [] }) {
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [userRequests, setUserRequests] = useState([]);
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
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'draft', 'submitted'

  const permissions = useMemo(
    () => (Array.isArray(actorPermissions) ? actorPermissions : []),
    [actorPermissions]
  );

  const canProvision = useMemo(
    () => permissions.includes('*') || permissions.includes('users.provision') || permissions.includes('users.*'),
    [permissions]
  );

  const selectedUser = useMemo(
    () => users.find(user => user.userId === selectedUserId) || null,
    [users, selectedUserId]
  );

  const loadData = useCallback(async () => {
    try {
      const [usersRes, profilesRes, requestsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/users/profiles'),
        fetch('/api/users/requests')
      ]);

      if (!usersRes.ok) throw new Error(`Load users failed (${usersRes.status})`);
      if (!profilesRes.ok) throw new Error(`Load profiles failed (${profilesRes.status})`);
      if (!requestsRes.ok) throw new Error(`Load requests failed (${requestsRes.status})`);

      const usersPayload = await usersRes.json();
      const profilesPayload = await profilesRes.json();
      const requestsPayload = await requestsRes.json();

      const nextUsers = Array.isArray(usersPayload.users) ? usersPayload.users : [];
      const nextProfiles = Array.isArray(profilesPayload.profiles) ? profilesPayload.profiles : [];
      const nextRequests = Array.isArray(requestsPayload.requests) ? requestsPayload.requests : [];

      setUsers(nextUsers);
      setProfiles(nextProfiles);
      setUserRequests(nextRequests);

      if (!selectedUserId && nextUsers.length > 0) {
        setSelectedUserId(nextUsers[0].userId);
      }
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }, [selectedUserId]);

  const refreshAll = useCallback(async () => {
    try {
      await loadData();
      setStatus('');
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }, [loadData]);

  useEffect(() => {
    setTimeout(() => {
      void refreshAll();
    }, 0);
  }, [refreshAll]);

  useEffect(() => {
    if (!selectedUser) return;
    setTimeout(() => {
      setEmail((selectedUser.email || selectedUser.userId || '').toLowerCase());
      setDisplayName(selectedUser.displayName || selectedUser.userId);
      setEnabled(selectedUser.enabled !== false);
      setDepartment(selectedUser.department || 'Operations');
      setJobTitle(selectedUser.jobTitle || 'Operations Analyst');
      setOfficeLocation(selectedUser.officeLocation || 'HQ');
      setManagerEmail(selectedUser.managerEmail || '');
      setSelectedProfileIds(Array.isArray(selectedUser.profileIds) ? selectedUser.profileIds : []);
    }, 0);
  }, [selectedUser]);

  function toggleProfile(profileId) {
    setSelectedProfileIds(prev => (
      prev.includes(profileId)
        ? prev.filter(item => item !== profileId)
        : [...prev, profileId]
    ));
  }

  async function handleCreateUserRequest() {
    try {
      const userId = window.prompt('New user email / Nouvel email utilisateur:', '')?.trim().toLowerCase();
      if (!userId) return;

      const res = await fetch('/api/users/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          requestType: 'create',
          userId,
          email: userId,
          displayName: userId,
          enabled: true,
          profileIds: [],
          status: 'draft'
        })
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Create request failed (${res.status})`);

      await loadData();
      setStatus(`Created user request for ${userId}.`);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  async function handleSaveUserRequest() {
    if (!selectedUserId) return;
    try {
      const body = {
        requestType: 'update',
        displayName: displayName.trim(),
        enabled,
        department: department.trim(),
        jobTitle: jobTitle.trim(),
        officeLocation: officeLocation.trim(),
        managerEmail: managerEmail.trim().toLowerCase(),
        profileIds: selectedProfileIds,
        status: 'draft'
      };

      if (selectedUserId !== 'system-admin') {
        body.email = email.trim().toLowerCase();
      }

      const res = await fetch(`/api/users/requests/${encodeURIComponent(selectedUserId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Save request failed (${res.status})`);

      await loadData();
      setStatus(`Saved user request for ${email || selectedUserId}.`);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  async function handleSubmitForVerification() {
    if (!selectedUserId) return;
    if (!window.confirm(`Submit user request for ${selectedUserId} for verification?`)) return;

    try {
      const res = await fetch(`/api/users/requests/${encodeURIComponent(selectedUserId)}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' }
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Submit failed (${res.status})`);

      await loadData();
      setSelectedUserId('');
      setStatus(`Submitted user request for ${selectedUserId} for verification.`);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  async function handleDeleteUserRequest() {
    if (!selectedUserId) return;
    if (!window.confirm(`Delete user request for ${selectedUserId}?`)) return;

    try {
      const res = await fetch(`/api/users/requests/${encodeURIComponent(selectedUserId)}`, {
        method: 'DELETE'
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Delete failed (${res.status})`);

      setSelectedUserId('');
      await loadData();
      setStatus(`Deleted user request for ${selectedUserId}.`);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  const filteredRequests = useMemo(() => {
    return userRequests.filter(req => {
      if (activeTab === 'draft') return req.status === 'draft';
      if (activeTab === 'submitted') return req.status === 'pending-verification';
      if (activeTab === 'pending') return req.status === 'draft' || req.status === 'pending-verification';
      return true;
    });
  }, [userRequests, activeTab]);

  if (!canProvision) {
    return <div style={{ color: '#b71c1c' }}>You do not have permission to provision users.</div>;
  }

  return (
    <div>
      <h2>User Provisioner / Approvisionneur d'utilisateurs</h2>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        Create, edit, and submit user profiles for verification. Part of dual-control workflow.
      </p>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, borderBottom: '1px solid #c7cdd4' }}>
        <button
          style={{
            padding: '8px 16px',
            border: 'none',
            borderBottom: activeTab === 'pending' ? '2px solid #3aa3ff' : '2px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'pending' ? 600 : 400
          }}
          onClick={() => setActiveTab('pending')}
        >
          All Pending ({filteredRequests.length})
        </button>
        <button
          style={{
            padding: '8px 16px',
            border: 'none',
            borderBottom: activeTab === 'draft' ? '2px solid #3aa3ff' : '2px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'draft' ? 600 : 400
          }}
          onClick={() => setActiveTab('draft')}
        >
          Drafts
        </button>
        <button
          style={{
            padding: '8px 16px',
            border: 'none',
            borderBottom: activeTab === 'submitted' ? '2px solid #3aa3ff' : '2px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'submitted' ? 600 : 400
          }}
          onClick={() => setActiveTab('submitted')}
        >
          Submitted
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260, border: '1px solid #c7cdd4', borderRadius: 6, padding: 10, background: '#f8f9fb' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>User Requests / Demandes</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 400, overflowY: 'auto' }}>
            {filteredRequests.map(request => (
              <li key={request.userId} style={{ marginBottom: 4 }}>
                <button
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: '1px solid #c7cdd4',
                    borderRadius: 4,
                    padding: '6px 8px',
                    background: selectedUserId === request.userId ? '#eef1f5' : '#f8f9fb',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedUserId(request.userId)}
                >
                  <div>{request.email || request.userId}</div>
                  <div style={{ fontSize: 11, color: '#666' }}>
                    {request.status === 'draft' ? '📝 Draft' : '📤 Submitted'}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <button style={{ marginTop: 8, width: '100%' }} onClick={handleCreateUserRequest}>
            Create User Request / Créer une demande
          </button>
        </div>

        <div style={{ flex: 1, minWidth: 340, border: '1px solid #c7cdd4', borderRadius: 6, padding: 12, background: '#f8f9fb' }}>
          {!selectedUser && <div>Select a user request.</div>}
          {selectedUser && (
            <>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Email / Courriel
                <input
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  disabled={selectedUser.userId === 'system-admin'}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Display Name / Nom affiché
                <input
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  value={displayName}
                  onChange={event => setDisplayName(event.target.value)}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Department / Département
                <input
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  value={department}
                  onChange={event => setDepartment(event.target.value)}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Job Title / Poste
                <input
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  value={jobTitle}
                  onChange={event => setJobTitle(event.target.value)}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Office Location / Bureau
                <input
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  value={officeLocation}
                  onChange={event => setOfficeLocation(event.target.value)}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 8 }}>
                Manager Email / Courriel du gestionnaire
                <input
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                  value={managerEmail}
                  onChange={event => setManagerEmail(event.target.value)}
                />
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={event => setEnabled(event.target.checked)}
                />
                Enabled / Actif
              </label>
              <div style={{ marginBottom: 8, fontSize: 13 }}>Profiles / Profils</div>
              <div style={{ border: '1px solid #c7cdd4', borderRadius: 4, padding: 8, maxHeight: 180, overflowY: 'auto', background: '#fff' }}>
                {profiles.map(profile => (
                  <label key={profile.profileId} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={selectedProfileIds.includes(profile.profileId)}
                      onChange={() => toggleProfile(profile.profileId)}
                    />
                    {profile.profileId}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={handleSaveUserRequest}>Save Draft / Enregistrer</button>
                <button onClick={handleSubmitForVerification} style={{ background: '#3aa3ff', color: '#fff' }}>
                  Submit for Verification / Soumettre
                </button>
                <button onClick={handleDeleteUserRequest} style={{ background: '#b71c1c', color: '#fff' }}>
                  Delete / Supprimer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {status && (
        <div style={{ marginTop: 10, fontSize: 12, color: status.toLowerCase().includes('failed') ? '#b71c1c' : '#333' }}>
          {status}
        </div>
      )}
    </div>
  );
}

// Made with Bob

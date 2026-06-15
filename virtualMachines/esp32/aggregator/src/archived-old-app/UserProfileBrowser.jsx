import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * User Profile Browser Component
 * 
 * Implements the User Profile Browser role from the architecture specification.
 * Responsibilities:
 * - View audit history
 * - Browse user profiles
 * - Read-only access to user data
 * 
 * Part of User Services - provides transparency and audit capabilities.
 */
export default function UserProfileBrowser({ actorPermissions = [] }) {
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEnabled, setFilterEnabled] = useState('all'); // 'all', 'enabled', 'disabled'
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState('details'); // 'details', 'audit'

  const permissions = useMemo(
    () => (Array.isArray(actorPermissions) ? actorPermissions : []),
    [actorPermissions]
  );

  const canBrowse = useMemo(
    () => permissions.includes('*') || permissions.includes('users.read') || permissions.includes('users.*'),
    [permissions]
  );

  const selectedUser = useMemo(
    () => users.find(user => user.userId === selectedUserId) || null,
    [users, selectedUserId]
  );

  const filteredUsers = useMemo(() => {
    let result = users;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(user =>
        (user.userId || '').toLowerCase().includes(query) ||
        (user.email || '').toLowerCase().includes(query) ||
        (user.displayName || '').toLowerCase().includes(query) ||
        (user.department || '').toLowerCase().includes(query)
      );
    }

    // Apply enabled filter
    if (filterEnabled === 'enabled') {
      result = result.filter(user => user.enabled !== false);
    } else if (filterEnabled === 'disabled') {
      result = result.filter(user => user.enabled === false);
    }

    return result;
  }, [users, searchQuery, filterEnabled]);

  const loadData = useCallback(async () => {
    try {
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
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }, [selectedUserId]);

  const loadAuditLog = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}/audit`);
      if (!res.ok) throw new Error(`Load audit log failed (${res.status})`);
      const payload = await res.json();
      const entries = Array.isArray(payload.auditLog) ? payload.auditLog : [];
      setAuditLog(entries);
    } catch (e) {
      setStatus(e.message || String(e));
      setAuditLog([]);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      await loadData();
      if (selectedUserId) {
        await loadAuditLog(selectedUserId);
      }
      setStatus('');
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }, [loadData, loadAuditLog, selectedUserId]);

  useEffect(() => {
    setTimeout(() => {
      void refreshAll();
    }, 0);
  }, [refreshAll]);

  useEffect(() => {
    if (selectedUserId && activeTab === 'audit') {
      void loadAuditLog(selectedUserId);
    }
  }, [selectedUserId, activeTab, loadAuditLog]);

  function getProfileNames(profileIds) {
    if (!Array.isArray(profileIds)) return 'None';
    const names = profileIds
      .map(id => profiles.find(p => p.profileId === id)?.label || id)
      .join(', ');
    return names || 'None';
  }

  function getAuditActionLabel(action) {
    const labels = {
      'user.created': '➕ Created',
      'user.updated': '✏️ Updated',
      'user.deleted': '🗑️ Deleted',
      'user.enabled': '✓ Enabled',
      'user.disabled': '✗ Disabled',
      'profile.assigned': '📋 Profile Assigned',
      'profile.removed': '📋 Profile Removed',
      'request.submitted': '📤 Request Submitted',
      'request.approved': '✓ Request Approved',
      'request.rejected': '✗ Request Rejected',
      'request.breakout': '⊗ Request Terminated'
    };
    return labels[action] || action;
  }

  if (!canBrowse) {
    return <div style={{ color: '#b71c1c' }}>You do not have permission to browse users.</div>;
  }

  return (
    <div>
      <h2>User Profile Browser / Navigateur de profils</h2>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        Browse user profiles and view audit history. Read-only access.
      </p>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            padding: '8px 12px',
            border: '1px solid #c7cdd4',
            borderRadius: 4
          }}
        />
        <select
          value={filterEnabled}
          onChange={e => setFilterEnabled(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #c7cdd4',
            borderRadius: 4
          }}
        >
          <option value="all">All Users</option>
          <option value="enabled">Enabled Only</option>
          <option value="disabled">Disabled Only</option>
        </select>
        <button onClick={refreshAll} style={{ padding: '8px 16px' }}>
          🔄 Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260, border: '1px solid #c7cdd4', borderRadius: 6, padding: 10, background: '#f8f9fb' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            Users / Utilisateurs ({filteredUsers.length})
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 500, overflowY: 'auto' }}>
            {filteredUsers.map(user => (
              <li key={user.userId} style={{ marginBottom: 4 }}>
                <button
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: '1px solid #c7cdd4',
                    borderRadius: 4,
                    padding: '6px 8px',
                    background: selectedUserId === user.userId ? '#eef1f5' : '#f8f9fb',
                    cursor: 'pointer',
                    opacity: user.enabled === false ? 0.6 : 1
                  }}
                  onClick={() => setSelectedUserId(user.userId)}
                >
                  <div style={{ fontWeight: 500 }}>{user.displayName || user.userId}</div>
                  <div style={{ fontSize: 11, color: '#666' }}>
                    {user.email || user.userId}
                  </div>
                  <div style={{ fontSize: 10, color: '#999' }}>
                    {user.enabled === false ? '🔴 Disabled' : '🟢 Enabled'}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {filteredUsers.length === 0 && (
            <div style={{ fontSize: 13, color: '#666', padding: 8 }}>
              No users found.
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 400, border: '1px solid #c7cdd4', borderRadius: 6, padding: 12, background: '#f8f9fb' }}>
          {!selectedUser && <div>Select a user to view details.</div>}
          {selectedUser && (
            <>
              <div style={{ marginBottom: 16, display: 'flex', gap: 8, borderBottom: '1px solid #c7cdd4' }}>
                <button
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderBottom: activeTab === 'details' ? '2px solid #3aa3ff' : '2px solid transparent',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontWeight: activeTab === 'details' ? 600 : 400
                  }}
                  onClick={() => setActiveTab('details')}
                >
                  Details
                </button>
                <button
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderBottom: activeTab === 'audit' ? '2px solid #3aa3ff' : '2px solid transparent',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontWeight: activeTab === 'audit' ? 600 : 400
                  }}
                  onClick={() => setActiveTab('audit')}
                >
                  Audit History
                </button>
              </div>

              {activeTab === 'details' && (
                <div style={{ padding: 12, background: '#fff', borderRadius: 4, border: '1px solid #e0e0e0' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>User Profile</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', fontSize: 13 }}>
                    <div style={{ fontWeight: 600 }}>User ID:</div>
                    <div>{selectedUser.userId}</div>

                    <div style={{ fontWeight: 600 }}>Email:</div>
                    <div>{selectedUser.email || 'N/A'}</div>

                    <div style={{ fontWeight: 600 }}>Display Name:</div>
                    <div>{selectedUser.displayName || 'N/A'}</div>

                    <div style={{ fontWeight: 600 }}>Status:</div>
                    <div>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: selectedUser.enabled ? '#d4edda' : '#f8d7da',
                        color: selectedUser.enabled ? '#155724' : '#721c24',
                        fontSize: 12
                      }}>
                        {selectedUser.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>

                    <div style={{ fontWeight: 600 }}>Department:</div>
                    <div>{selectedUser.department || 'N/A'}</div>

                    <div style={{ fontWeight: 600 }}>Job Title:</div>
                    <div>{selectedUser.jobTitle || 'N/A'}</div>

                    <div style={{ fontWeight: 600 }}>Office Location:</div>
                    <div>{selectedUser.officeLocation || 'N/A'}</div>

                    <div style={{ fontWeight: 600 }}>Manager Email:</div>
                    <div>{selectedUser.managerEmail || 'N/A'}</div>

                    <div style={{ fontWeight: 600 }}>Profiles:</div>
                    <div>{getProfileNames(selectedUser.profileIds)}</div>

                    <div style={{ fontWeight: 600 }}>Employer:</div>
                    <div>{selectedUser.employer || 'N/A'}</div>

                    <div style={{ fontWeight: 600 }}>Country:</div>
                    <div>{selectedUser.country || 'N/A'}</div>
                  </div>
                </div>
              )}

              {activeTab === 'audit' && (
                <div style={{ padding: 12, background: '#fff', borderRadius: 4, border: '1px solid #e0e0e0' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>Audit History</h3>
                  {auditLog.length === 0 && (
                    <div style={{ fontSize: 13, color: '#666', padding: 8 }}>
                      No audit entries found.
                    </div>
                  )}
                  <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                    {auditLog.map((entry, index) => (
                      <div
                        key={index}
                        style={{
                          padding: 10,
                          marginBottom: 8,
                          background: '#f8f9fb',
                          borderRadius: 4,
                          border: '1px solid #e0e0e0'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>
                            {getAuditActionLabel(entry.action)}
                          </span>
                          <span style={{ fontSize: 11, color: '#666' }}>
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#666' }}>
                          By: {entry.actorUserId || 'System'}
                        </div>
                        {entry.details && (
                          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                            {entry.details}
                          </div>
                        )}
                        {entry.changes && Object.keys(entry.changes).length > 0 && (
                          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                            Changed: {Object.keys(entry.changes).join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {status && (
        <div style={{
          marginTop: 10,
          fontSize: 12,
          color: status.toLowerCase().includes('failed') ? '#b71c1c' : '#333'
        }}>
          {status}
        </div>
      )}
    </div>
  );
}

// Made with Bob

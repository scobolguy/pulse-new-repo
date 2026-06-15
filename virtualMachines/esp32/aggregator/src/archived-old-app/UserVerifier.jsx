import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * User Verifier Component
 * 
 * Implements the User Verifier role from the architecture specification.
 * Responsibilities:
 * - Approve or reject submitted profiles
 * - Break out requests (terminate workflow)
 * - Independent from provisioning process
 * - Final authority on user activation
 * 
 * Part of the dual-control workflow - provides independent verification.
 */
export default function UserVerifier({ actorPermissions = [] }) {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [status, setStatus] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const permissions = useMemo(
    () => (Array.isArray(actorPermissions) ? actorPermissions : []),
    [actorPermissions]
  );

  const canVerify = useMemo(
    () => permissions.includes('*') || permissions.includes('users.verify') || permissions.includes('users.*'),
    [permissions]
  );

  const selectedRequest = useMemo(
    () => pendingRequests.find(req => req.requestId === selectedRequestId) || null,
    [pendingRequests, selectedRequestId]
  );

  const loadData = useCallback(async () => {
    try {
      const [requestsRes, profilesRes] = await Promise.all([
        fetch('/api/users/requests?status=pending-verification'),
        fetch('/api/users/profiles')
      ]);

      if (!requestsRes.ok) throw new Error(`Load requests failed (${requestsRes.status})`);
      if (!profilesRes.ok) throw new Error(`Load profiles failed (${profilesRes.status})`);

      const requestsPayload = await requestsRes.json();
      const profilesPayload = await profilesRes.json();

      const nextRequests = Array.isArray(requestsPayload.requests) ? requestsPayload.requests : [];
      const nextProfiles = Array.isArray(profilesPayload.profiles) ? profilesPayload.profiles : [];

      setPendingRequests(nextRequests);
      setProfiles(nextProfiles);

      if (!selectedRequestId && nextRequests.length > 0) {
        setSelectedRequestId(nextRequests[0].requestId);
      }
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }, [selectedRequestId]);

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

  async function handleApprove() {
    if (!selectedRequestId) return;
    if (!window.confirm(`Approve user request ${selectedRequest?.userId || selectedRequestId}?`)) return;

    try {
      const res = await fetch(`/api/users/requests/${encodeURIComponent(selectedRequestId)}/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' }
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Approve failed (${res.status})`);

      await loadData();
      setSelectedRequestId('');
      setStatus(`Approved user request for ${selectedRequest?.userId || selectedRequestId}.`);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  async function handleReject() {
    if (!selectedRequestId) return;
    setShowRejectDialog(true);
  }

  async function confirmReject() {
    if (!selectedRequestId) return;
    if (!rejectionReason.trim()) {
      setStatus('Rejection reason is required.');
      return;
    }

    try {
      const res = await fetch(`/api/users/requests/${encodeURIComponent(selectedRequestId)}/reject`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason.trim() })
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Reject failed (${res.status})`);

      await loadData();
      setSelectedRequestId('');
      setRejectionReason('');
      setShowRejectDialog(false);
      setStatus(`Rejected user request for ${selectedRequest?.userId || selectedRequestId}.`);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  async function handleBreakout() {
    if (!selectedRequestId) return;
    if (!window.confirm(`Breakout (terminate) user request ${selectedRequest?.userId || selectedRequestId}? This action cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/users/requests/${encodeURIComponent(selectedRequestId)}/breakout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' }
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Breakout failed (${res.status})`);

      await loadData();
      setSelectedRequestId('');
      setStatus(`Terminated user request for ${selectedRequest?.userId || selectedRequestId}.`);
    } catch (e) {
      setStatus(e.message || String(e));
    }
  }

  function getProfileNames(profileIds) {
    if (!Array.isArray(profileIds)) return 'None';
    const names = profileIds
      .map(id => profiles.find(p => p.profileId === id)?.label || id)
      .join(', ');
    return names || 'None';
  }

  if (!canVerify) {
    return <div style={{ color: '#b71c1c' }}>You do not have permission to verify users.</div>;
  }

  return (
    <div>
      <h2>User Verifier / Vérificateur d'utilisateurs</h2>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        Review and approve/reject user provisioning requests. Independent verification authority.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 260, border: '1px solid #c7cdd4', borderRadius: 6, padding: 10, background: '#f8f9fb' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            Pending Verification / En attente ({pendingRequests.length})
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 500, overflowY: 'auto' }}>
            {pendingRequests.map(request => (
              <li key={request.requestId} style={{ marginBottom: 4 }}>
                <button
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: '1px solid #c7cdd4',
                    borderRadius: 4,
                    padding: '6px 8px',
                    background: selectedRequestId === request.requestId ? '#eef1f5' : '#f8f9fb',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedRequestId(request.requestId)}
                >
                  <div style={{ fontWeight: 500 }}>{request.email || request.userId}</div>
                  <div style={{ fontSize: 11, color: '#666' }}>
                    {request.requestType === 'create' ? '➕ Create' : '✏️ Update'}
                  </div>
                  <div style={{ fontSize: 10, color: '#999' }}>
                    Submitted: {new Date(request.submittedAt).toLocaleString()}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {pendingRequests.length === 0 && (
            <div style={{ fontSize: 13, color: '#666', padding: 8 }}>
              No pending requests.
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 400, border: '1px solid #c7cdd4', borderRadius: 6, padding: 12, background: '#f8f9fb' }}>
          {!selectedRequest && <div>Select a request to review.</div>}
          {selectedRequest && (
            <>
              <div style={{ marginBottom: 16, padding: 12, background: '#fff', borderRadius: 4, border: '1px solid #e0e0e0' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>Request Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', fontSize: 13 }}>
                  <div style={{ fontWeight: 600 }}>Request Type:</div>
                  <div>{selectedRequest.requestType === 'create' ? 'Create New User' : 'Update User'}</div>

                  <div style={{ fontWeight: 600 }}>User ID:</div>
                  <div>{selectedRequest.userId}</div>

                  <div style={{ fontWeight: 600 }}>Email:</div>
                  <div>{selectedRequest.email || 'N/A'}</div>

                  <div style={{ fontWeight: 600 }}>Display Name:</div>
                  <div>{selectedRequest.displayName || 'N/A'}</div>

                  <div style={{ fontWeight: 600 }}>Department:</div>
                  <div>{selectedRequest.department || 'N/A'}</div>

                  <div style={{ fontWeight: 600 }}>Job Title:</div>
                  <div>{selectedRequest.jobTitle || 'N/A'}</div>

                  <div style={{ fontWeight: 600 }}>Office Location:</div>
                  <div>{selectedRequest.officeLocation || 'N/A'}</div>

                  <div style={{ fontWeight: 600 }}>Manager Email:</div>
                  <div>{selectedRequest.managerEmail || 'N/A'}</div>

                  <div style={{ fontWeight: 600 }}>Enabled:</div>
                  <div>{selectedRequest.enabled ? 'Yes' : 'No'}</div>

                  <div style={{ fontWeight: 600 }}>Profiles:</div>
                  <div>{getProfileNames(selectedRequest.profileIds)}</div>

                  <div style={{ fontWeight: 600 }}>Submitted By:</div>
                  <div>{selectedRequest.submittedBy || 'Unknown'}</div>

                  <div style={{ fontWeight: 600 }}>Submitted At:</div>
                  <div>{new Date(selectedRequest.submittedAt).toLocaleString()}</div>
                </div>
              </div>

              <div style={{ marginBottom: 16, padding: 12, background: '#fffbea', borderRadius: 4, border: '1px solid #f0c36b' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#856404' }}>⚠️ Verification Checklist</h4>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#856404' }}>
                  <li>Verify user identity and authorization</li>
                  <li>Confirm appropriate profile assignments</li>
                  <li>Check department and manager information</li>
                  <li>Ensure compliance with security policies</li>
                  <li>Validate against external system (if applicable)</li>
                </ul>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  onClick={handleApprove}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: '#59c17f',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  ✓ Approve / Approuver
                </button>
                <button
                  onClick={handleReject}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: '#f7768e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  ✗ Reject / Rejeter
                </button>
                <button
                  onClick={handleBreakout}
                  style={{
                    padding: '10px 16px',
                    background: '#b71c1c',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  ⊗ Breakout / Terminer
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showRejectDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowRejectDialog(false)}
        >
          <div
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 8,
              maxWidth: 500,
              width: '90%'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0' }}>Reject User Request</h3>
            <label style={{ display: 'block', marginBottom: 16 }}>
              Rejection Reason (required):
              <textarea
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: 8,
                  minHeight: 100,
                  padding: 8,
                  borderRadius: 4,
                  border: '1px solid #c7cdd4'
                }}
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Provide a clear reason for rejection..."
              />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectionReason('');
                }}
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                style={{
                  padding: '8px 16px',
                  background: '#f7768e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

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

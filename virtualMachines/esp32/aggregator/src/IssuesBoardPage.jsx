import { useCallback, useEffect, useRef, useState } from 'react'
import './issues-board.css'

const columns = [
  ['backlog', 'Backlog'],
  ['in-progress', 'In Progress'],
  ['blocked', 'Blocked'],
  ['done', 'Done'],
]

async function request(url, method = 'GET', body) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`)
  return result
}

export default function IssuesBoardPage() {
  const [issues, setIssues] = useState(null)
  const [canManage, setCanManage] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const working = useRef(false)
  const mounted = useRef(false)

  const perform = useCallback(async action => {
    if (working.current) return
    working.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (failure) {
      if (mounted.current) setError(failure.message || 'Issue tracking failed. Refresh before retrying.')
    } finally {
      working.current = false
      if (mounted.current) setBusy(false)
    }
  }, [])

  const refresh = useCallback(() => perform(async () => {
    const result = await request('/api/issues')
    if (!Array.isArray(result.issues)) throw new Error('The backend returned an invalid issue list.')
    if (mounted.current) {
      setIssues(result.issues)
      setCanManage(result.canManage === true)
    }
  }), [perform])

  useEffect(() => {
    mounted.current = true
    refresh()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 60000)
    return () => {
      mounted.current = false
      clearInterval(timer)
    }
  }, [refresh])

  function move(issue, status) {
    perform(async () => {
      const result = await request(`/api/issues/${issue.number}/status`, 'PATCH', { status, version: issue.version })
      if (mounted.current) {
        setIssues(current => current.map(item => item.number === issue.number ? result.issue : item))
        setNotice(`Issue #${issue.number} moved to ${columns.find(column => column[0] === status)[1]}.`)
      }
    })
  }

  function create(event) {
    event.preventDefault()
    perform(async () => {
      const result = await request('/api/issues', 'POST', { title, body })
      if (mounted.current) {
        setIssues(current => [result.issue, ...(current || [])])
        setTitle('')
        setBody('')
        setNotice(`Created issue #${result.issue.number}.`)
      }
    })
  }

  function signIn(event) {
    event.preventDefault()
    perform(async () => {
      const result = await request('/api/auth/login', 'POST', { userId, password })
      if (typeof result.token !== 'string' || !result.token) throw new Error('Pulse did not return a session token.')
      localStorage.setItem('pulse.authToken', result.token)
      localStorage.setItem('pulse.actorUserId', result.actor.userId)
      if (mounted.current) setPassword('')
      const board = await request('/api/issues')
      if (!Array.isArray(board.issues)) throw new Error('The backend returned an invalid issue list.')
      if (mounted.current) {
        setIssues(board.issues)
        setCanManage(board.canManage === true)
      }
    })
  }

  return (
    <main className="issues-page">
      <header>
        <h1>Issue Board</h1>
        <p><a href="https://github.com/scobolguy/pulse-new-repo/issues" target="_blank" rel="noreferrer">scobolguy/pulse-new-repo</a> is the source of truth. Native migration waits for a clean regression gate.</p>
        <button type="button" onClick={refresh} disabled={busy}>Refresh issues</button>
      </header>
      <details>
        <summary>Sign in to create or change issues / change account</summary>
        <form onSubmit={signIn} className="issues-form">
          <label>User ID<input autoComplete="username" required value={userId} onChange={event => setUserId(event.target.value)} /></label>
          <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
          <button disabled={busy}>Sign in</button>
        </form>
      </details>
      {!canManage && <p>Viewing does not require sign-in. Sign in with issue-management permission to create or change issues.</p>}
      {error && <p role="alert" className="issues-error">{error} {issues && 'Displayed cards may be stale; refresh before retrying.'}</p>}
      <p role="status" aria-live="polite">{busy ? 'Contacting GitHub...' : notice}</p>
      {issues !== null && <>
        {canManage && <details>
          <summary>Create a GitHub issue</summary>
          <form onSubmit={create} className="issues-form">
            <label>Title<input required maxLength={256} value={title} onChange={event => setTitle(event.target.value)} /></label>
            <label>Description<textarea maxLength={65536} rows={5} value={body} onChange={event => setBody(event.target.value)} placeholder="Observed behavior, reproduction, expected result, and acceptance checks" /></label>
            <button disabled={busy || !title.trim()}>Create issue</button>
          </form>
        </details>}
        {issues.length === 0 && <p>No GitHub issues yet.{canManage && ' Create the first issue above.'}</p>}
        <div className="issues-columns" aria-label="Kanban board">
          {columns.map(([status, label]) => {
            const cards = issues.filter(issue => issue.status === status)
            return <section className="issues-column" key={status} aria-label={label}>
              <h2>{label} ({cards.length})</h2>
              {cards.map(issue => <article className="issue-card" key={issue.number}>
                <h3><a href={issue.url} target="_blank" rel="noreferrer">#{issue.number}: {issue.title}</a></h3>
                {issue.conflict && <p className="issues-error">Status labels conflict with each other or the issue state. Select the intended status to correct them.</p>}
                <p>{issue.labels.join(', ') || 'No labels'}</p>
                <p>Assignees: {issue.assignees.join(', ') || 'Unassigned'}</p>
                <label>Status for issue #{issue.number}
                  <select aria-label={`Status for issue #${issue.number}`} disabled={busy || !canManage} value={issue.status} onChange={event => move(issue, event.target.value)}>
                    {columns.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                  </select>
                </label>
                {issue.conflict && canManage && <button disabled={busy} onClick={() => move(issue, issue.status)}>Confirm this status</button>}
              </article>)}
              {cards.length === 0 && <p>No issues in {label}.</p>}
            </section>
          })}
        </div>
      </>}
    </main>
  )
}

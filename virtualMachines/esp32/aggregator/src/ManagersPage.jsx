import { useEffect, useState } from 'react'

function statusLabel(value) {
  const status = String(value || 'unknown').toLowerCase()
  if (status === 'up' || status === 'running' || status === 'available') return 'Online'
  if (status === 'down' || status === 'stopped') return 'Offline'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function ManagerCard({ manager, queues = [] }) {
  const managerId = String(manager.managerId || manager.serverId || 'unknown')
  const provider = String(manager.provider || manager.engine || 'unknown').toUpperCase()
  const ownedQueues = queues.filter(queue => String(queue.managerId || '') === managerId)
  return (
    <article className="manager-card">
      <div className="manager-card-heading">
        <div>
          <strong>{manager.name || managerId}</strong>
          <div className="manager-card-id">{managerId}</div>
        </div>
        <span className="manager-status">{statusLabel(manager.status || manager.serviceState)}</span>
      </div>
      <div className="manager-card-meta">Provider: {provider}</div>
      <div className="manager-card-meta">Host: {manager.host || manager.nodeId || 'local'}</div>
      {manager.port ? <div className="manager-card-meta">Port: {manager.port}</div> : null}
      <div className="manager-card-section-title">Queues ({ownedQueues.length})</div>
      {ownedQueues.length > 0 ? (
        <ul className="manager-resource-list">
          {ownedQueues.map(queue => <li key={queue.queueName || queue.name}>{queue.queueName || queue.name}</li>)}
        </ul>
      ) : <div className="manager-card-empty">No queues currently assigned</div>}
    </article>
  )
}

function DatabaseCard({ database }) {
  const managerId = String(database.managerId || database.serverId || 'unknown')
  const tables = Array.isArray(database.tables) ? database.tables : []
  return (
    <article className="manager-card manager-card-database">
      <div className="manager-card-heading">
        <div>
          <strong>{database.name || managerId}</strong>
          <div className="manager-card-id">{managerId}</div>
        </div>
        <span className="manager-status">{statusLabel(database.status || database.serviceState)}</span>
      </div>
      <div className="manager-card-meta">Provider: {String(database.provider || database.engine || 'unknown').toUpperCase()}</div>
      <div className="manager-card-meta">Connection: {database.host || 'local'}{database.port ? `:${database.port}` : ''}</div>
      <div className="manager-card-section-title">Tables ({tables.length})</div>
      {tables.length > 0 ? (
        <ul className="manager-resource-list">
          {tables.map(table => <li key={table.symbol || table.physicalName}>{table.symbol || table.physicalName} ({Number(table.rowCount || 0)} records)</li>)}
        </ul>
      ) : <div className="manager-card-empty">No WFL table bindings loaded</div>}
    </article>
  )
}

export default function ManagersPage() {
  const [queueManagers, setQueueManagers] = useState([])
  const [databases, setDatabases] = useState([])
  const [queues, setQueues] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function refresh() {
      try {
        const [managerResponse, databaseResponse, queueResponse] = await Promise.all([
          fetch('/api/registry/queue-managers'),
          fetch('/api/registry/databases'),
          fetch('/api/registry/queues')
        ])
        const [managerPayload, databasePayload, queuePayload] = await Promise.all([
          managerResponse.json(), databaseResponse.json(), queueResponse.json()
        ])
        if (!active) return
        setQueueManagers(Array.isArray(managerPayload.queueManagers) ? managerPayload.queueManagers : [])
        setDatabases(Array.isArray(databasePayload.databases) ? databasePayload.databases : [])
        setQueues(Array.isArray(queuePayload.queues) ? queuePayload.queues : [])
        setError('')
      } catch (cause) {
        if (active) setError(String(cause?.message || cause))
      }
    }
    refresh()
    const timer = setInterval(refresh, 5000)
    return () => { active = false; clearInterval(timer) }
  }, [])

  return (
    <div className="managers-page">
      <div className="managers-summary">Live provider inventory. Queue and database cards are populated from the API registry and WFL bindings.</div>
      {error ? <div className="managers-error">{error}</div> : null}
      <section className="managers-section">
        <div className="managers-section-heading"><h2>Queue Managers</h2><span>{queueManagers.length} managers</span></div>
        <div className="manager-card-grid">
          {queueManagers.map(manager => <ManagerCard key={manager.managerId} manager={manager} queues={queues} />)}
          {queueManagers.length === 0 ? <div className="manager-empty">No queue managers registered.</div> : null}
        </div>
      </section>
      <section className="managers-section">
        <div className="managers-section-heading"><h2>Database Managers</h2><span>{databases.length} servers</span></div>
        <div className="manager-card-grid">
          {databases.map(database => <DatabaseCard key={database.managerId || database.serverId} database={database} />)}
          {databases.length === 0 ? <div className="manager-empty">No database managers registered.</div> : null}
        </div>
      </section>
    </div>
  )
}

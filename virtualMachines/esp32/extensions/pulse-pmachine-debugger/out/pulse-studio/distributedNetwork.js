const MAX_PAGES = 75
const MAX_ATTEMPTS = 3

async function readDistributedNetwork(base, requestJson) {
  const origin = new URL(base)
  if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('Cache URL must use HTTP or HTTPS')
  const endpoint = `${origin.href.replace(/\/$/, '')}/api/devices`
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let cursor = '', revision = '', total, metadata
    const records = [], keys = new Set(), cursors = new Set()
    try {
      for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
        const page = await requestJson(`${endpoint}?${new URLSearchParams({ cursor, revision })}`)
        if (!page || !Array.isArray(page.records) || !Number.isSafeInteger(page.total)
          || page.total < 0 || page.total > 150 || typeof page.revision !== 'string'
          || !/^[0-9]{1,16}$/.test(page.revision) || typeof page.nextCursor !== 'string'
          || page.nextCursor.length > 256 || typeof page.completeness !== 'boolean') {
          throw new Error('Invalid distributed cache page')
        }
        if (metadata && (page.revision !== revision || page.total !== total)) {
          throw new Error('Aggregation revision changed; restart pagination')
        }
        metadata ??= page
        revision = page.revision
        total = page.total
        for (const record of page.records) {
          if (!record || typeof record.key !== 'string' || !record.key || keys.has(record.key)
            || typeof record.device?.name !== 'string' || !record.device.name.trim()
            || typeof record.device.address !== 'string' || !record.device.address.trim()) {
            throw new Error('Invalid or duplicate distributed cache device')
          }
          keys.add(record.key)
          records.push(record)
        }
        if (records.length > total) throw new Error('Distributed cache exceeds declared total')
        if (!page.nextCursor) {
          if (records.length !== total) throw new Error('Incomplete distributed cache pagination')
          return { records, completeness: metadata.completeness }
        }
        if (!page.records.length || cursors.has(page.nextCursor)) throw new Error('Distributed cache cursor did not advance')
        cursors.add(page.nextCursor)
        cursor = page.nextCursor
      }
      throw new Error('Distributed cache page limit exceeded')
    } catch (error) {
      if (attempt === MAX_ATTEMPTS - 1 || !/revision changed|cursor expired/i.test(error.message)) throw error
    }
  }
}

module.exports = { readDistributedNetwork }

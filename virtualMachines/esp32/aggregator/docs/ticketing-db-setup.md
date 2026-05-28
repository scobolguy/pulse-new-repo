# Ticketing DB Setup (Database First)

This setup creates the database first, then creates a separate schema for ticketing artifacts.

## 1. Configure connection inputs

Use env vars or CLI args.

- `TICKETING_DB_SERVER` (default: `localhost`)
- `TICKETING_DB_INSTANCE` (default: `SQLEXPRESS`)
- `TICKETING_DB_USER`
- `TICKETING_DB_PASSWORD`
- `TICKETING_DB_NAME` (default: `PulseGovernance`)
- `TICKETING_DB_SCHEMA` (default: `ticketing`)
- `TICKETING_DB_ENCRYPT` (`true`/`false`)
- `TICKETING_DB_TRUST_CERT` (`true`/`false`)

## 2. Provision database and schema

```bash
npm run db:provision:ticketing
```

This does the following in order:

1. Connects to `master`.
2. Creates DB if missing.
3. Connects to the created DB.
4. Creates schema if missing.
5. Creates ticketing tables in that schema.
6. Seeds sequence rows.

## 3. Seed from current JSON store

```bash
npm run db:seed:ticketing
```

This upserts existing ticket/test/project artifacts from `data/issue-test-system.json`.

## Optional CLI override example

```bash
node scripts/provision-ticketing-db.mjs \
  --server localhost \
  --instance SQLEXPRESS \
  --database PulseGovernance \
  --schema ticketing
```

```bash
node scripts/seed-ticketing-db-from-json.mjs \
  --json ./data/issue-test-system.json \
  --server localhost \
  --instance SQLEXPRESS \
  --database PulseGovernance \
  --schema ticketing
```

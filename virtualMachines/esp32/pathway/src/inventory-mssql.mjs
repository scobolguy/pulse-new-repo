import { createRequire } from 'node:module';
import { commandOf, validInventoryRequestId, INVENTORY_SEED } from './inventory-authority.mjs';

const failure = (message, status = 400) => Object.assign(new Error(message), { status });
const schema = `
IF OBJECT_ID('dbo.pathway_inventory_stock','U') IS NULL
BEGIN
  CREATE TABLE dbo.pathway_inventory_stock (
    sku varchar(16) COLLATE Latin1_General_100_BIN2 PRIMARY KEY,
    total int NOT NULL CHECK(total >= 0),
    available int NOT NULL, CHECK(available >= 0 AND available <= total));
  CREATE TABLE dbo.pathway_inventory_reservations (
    id varchar(16) COLLATE Latin1_General_100_BIN2 PRIMARY KEY,
    sku varchar(16) COLLATE Latin1_General_100_BIN2 NOT NULL REFERENCES dbo.pathway_inventory_stock(sku),
    quantity int NOT NULL CHECK(quantity > 0),
    released int NOT NULL CHECK(released IN (0,1)));
  CREATE TABLE dbo.pathway_inventory_requests (
    id varchar(96) COLLATE Latin1_General_100_BIN2 PRIMARY KEY,
    record varchar(256) COLLATE Latin1_General_100_BIN2 NOT NULL,
    reply varchar(128) NOT NULL);
  CREATE TABLE dbo.pathway_inventory_metadata (version int NOT NULL CHECK(version=1));
  INSERT dbo.pathway_inventory_metadata VALUES(1);
END;
IF NOT EXISTS(SELECT 1 FROM dbo.pathway_inventory_metadata WHERE version=1)
  THROW 51000, 'Unsupported inventory schema', 1;
`;

export async function createMssqlInventoryStore({ connectionString, driver = 'msnodesqlv8', maxRequests = 10000 } = {}) {
  if (typeof connectionString !== 'string' || !connectionString.trim() ||
      !['msnodesqlv8', 'tedious'].includes(driver) ||
      !Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 1000000) {
    throw failure('Invalid SQL Server inventory configuration');
  }
  const require = createRequire(new URL('../../aggregator/package.json', import.meta.url));
  const sql = require(driver === 'msnodesqlv8' ? 'mssql/msnodesqlv8.js' : 'mssql');
  const pool = await new sql.ConnectionPool(driver === 'msnodesqlv8' ?
    { connectionString, driver, pool: { min: 1, max: 1 }, requestTimeout: 2000 } : connectionString).connect();
  async function transaction(work) {
    const tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    let rolledBack = false;
    tx.on('rollback', () => { rolledBack = true; });
    try {
      const lock = await new sql.Request(tx).query(`
        DECLARE @result int;
        EXEC @result = sys.sp_getapplock @Resource='pulse.pathway.inventory.v1',
          @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=1000;
        SELECT @result AS result;`);
      if (lock.recordset[0].result < 0) throw failure('Inventory database is busy; retry the same request ID', 503);
      const result = await work(tx);
      await tx.commit();
      return result;
    } catch (error) {
      if (!rolledBack) await tx.rollback();
      throw error;
    }
  }
  try { await transaction(async tx => {
    const existed = (await new sql.Request(tx).query(
      "SELECT OBJECT_ID('dbo.pathway_inventory_stock','U') AS id")).recordset[0].id !== null;
    await new sql.Request(tx).query(schema);
    if (!existed) {
      for (const [sku, quantity] of Object.entries(INVENTORY_SEED)) {
        await new sql.Request(tx).input('sku', sql.VarChar(16), sku).input('quantity', sql.Int, quantity)
          .query('INSERT dbo.pathway_inventory_stock VALUES(@sku,@quantity,@quantity)');
      }
    }
  }); }
  catch (error) { await pool.close(); throw error; }
  const request = (tx, values = {}) => {
    const query = new sql.Request(tx);
    for (const [name, value] of Object.entries(values)) {
      query.input(name, typeof value === 'number' ? sql.Int : sql.VarChar(256), value);
    }
    return query;
  };
  async function savedReply(tx, requestId, canonical) {
    const saved = (await request(tx, { requestId }).query(
      'SELECT record,reply FROM dbo.pathway_inventory_requests WHERE id=@requestId')).recordset[0];
    if (saved && saved.record !== canonical) throw failure('Request ID was already used for a different command', 409);
    return saved;
  }
  async function snapshotOf(tx, item, reservation) {
    const rows = await request(tx, { item, reservation }).query(`
      SELECT sku,quantity,released FROM dbo.pathway_inventory_reservations WHERE id=@reservation;
      SELECT sku,total,available FROM dbo.pathway_inventory_stock
        WHERE sku=CASE WHEN @item<>'' THEN @item ELSE
          (SELECT sku FROM dbo.pathway_inventory_reservations WHERE id=@reservation) END;`);
    const order = rows.recordsets[0][0];
    const stock = rows.recordsets[1][0];
    return JSON.stringify({ sku: stock?.sku ?? '', total: stock?.total ?? 0, available: stock?.available ?? 0,
      reservationSku: order?.sku ?? '', quantity: order?.quantity ?? 0, released: order?.released ?? 0 });
  }
  return {
    async exchange(query) {
      const { action, requestId, canonical, item, reservation } = query ?? {};
      const keys = ['action', 'requestId', 'canonical', 'item', 'reservation'];
      if (action === 'commit') keys.push('snapshot', 'available', 'quantity', 'released', 'writeRow', 'reply');
      if (!query || !['read', 'commit'].includes(action) ||
          Object.keys(query).sort().join(',') !== keys.sort().join(',') ||
          !validInventoryRequestId(requestId) || typeof canonical !== 'string' ||
          canonical.length < 1 || canonical.length > 256 ||
          ![item, reservation].every(value => typeof value === 'string' && /^(?:[A-Z][A-Z0-9_-]{0,15})?$/.test(value))) {
        throw failure('Invalid inventory database exchange');
      }
      if (action === 'commit' && (typeof query.snapshot !== 'string' || query.snapshot.length > 512 ||
          typeof query.reply !== 'string' || query.reply.length < 1 || query.reply.length > 128 ||
          !/^[\x20-\x7e]+$/.test(query.reply) ||
          ![query.available, query.quantity].every(value => Number.isInteger(value) && value >= 0 && value <= 2147483647) ||
          ![0, 1].includes(query.released) || ![0, 1].includes(query.writeRow))) {
        throw failure('Invalid inventory database commit');
      }
      return transaction(async tx => {
        const saved = await savedReply(tx, requestId, canonical);
        if (saved) return { status: 200, reply: saved.reply };
        const size = (await request(tx).query('SELECT COUNT(*) AS count FROM dbo.pathway_inventory_requests')).recordset[0].count;
        if (size >= maxRequests) throw failure('Inventory request ledger is full; operator archival is required', 507);
        const snapshot = await snapshotOf(tx, item, reservation);
        if (action === 'read') return { status: 200, snapshot };
        if (snapshot !== query.snapshot) throw failure('Inventory data changed; retry the same request ID', 503);
        const before = JSON.parse(snapshot);
        if (query.writeRow) {
          if (!before.sku || !reservation || query.quantity < 1 ||
              (before.reservationSku && before.reservationSku !== before.sku)) {
            throw failure('Invalid inventory row write');
          }
          await request(tx, { item: before.sku, available: query.available, reservation,
            quantity: query.quantity, released: query.released }).query(`
            UPDATE dbo.pathway_inventory_stock SET available=@available WHERE sku=@item;
            IF EXISTS(SELECT 1 FROM dbo.pathway_inventory_reservations WHERE id=@reservation)
              UPDATE dbo.pathway_inventory_reservations SET quantity=@quantity,released=@released WHERE id=@reservation;
            ELSE INSERT dbo.pathway_inventory_reservations VALUES(@reservation,@item,@quantity,@released);
            IF (SELECT total-available FROM dbo.pathway_inventory_stock WHERE sku=@item)<>
              (SELECT COALESCE(SUM(CONVERT(bigint,quantity)),0) FROM dbo.pathway_inventory_reservations WHERE sku=@item AND released=0)
              THROW 51001, 'Inventory row invariant failed', 1;`);
        }
        await request(tx, { requestId, canonical, reply: query.reply }).query(
          'INSERT dbo.pathway_inventory_requests VALUES(@requestId,@canonical,@reply)');
        return { status: 200, reply: query.reply };
      });
    },
    async apply(requestId, record) {
      if (!validInventoryRequestId(requestId)) throw failure('A stable inventory request ID is required');
      const command = commandOf(record);
      return transaction(async tx => {
        const parameters = { requestId, canonical: JSON.stringify(command), maxRequests,
          operation: command.operation, item: command.item ?? '', quantity: command.quantity ?? 0,
          reservation: command.reservation ?? '' };
        const result = await request(tx, parameters).query(`
          DECLARE @reply varchar(128), @previous varchar(256), @available int, @total int,
            @sku varchar(16), @qty int, @released int;
          SELECT @previous=record, @reply=reply FROM dbo.pathway_inventory_requests WHERE id=@requestId;
          IF @previous IS NOT NULL
          BEGIN
            SELECT @reply AS reply, CASE WHEN @previous=@canonical THEN 200 ELSE 409 END AS status;
            RETURN;
          END;
          IF (SELECT COUNT(*) FROM dbo.pathway_inventory_requests)>=@maxRequests
          BEGIN SELECT 'Inventory request ledger is full; operator archival is required' AS reply, 507 AS status; RETURN; END;
          IF @operation='RELEASE'
          BEGIN
            SELECT @sku=sku,@qty=quantity,@released=released FROM dbo.pathway_inventory_reservations WHERE id=@reservation;
            IF @sku IS NULL SET @reply=CONCAT('NOT FOUND reservation ',@reservation);
            ELSE IF @released=1 SET @reply=CONCAT('ALREADY RELEASED ',@reservation);
            ELSE BEGIN
              UPDATE dbo.pathway_inventory_stock SET available=available+@qty WHERE sku=@sku;
              UPDATE dbo.pathway_inventory_reservations SET released=1 WHERE id=@reservation;
              SELECT @available=available FROM dbo.pathway_inventory_stock WHERE sku=@sku;
              SET @reply=CONCAT('RELEASED ',@reservation,' ',@sku,' AVAILABLE ',@available);
            END;
          END
          ELSE BEGIN
            SELECT @available=available,@total=total FROM dbo.pathway_inventory_stock WHERE sku=@item;
            IF @available IS NULL SET @reply=CONCAT('NOT FOUND sku ',@item);
            ELSE IF @operation='INQUIRE' SET @reply=CONCAT(@item,' AVAILABLE ',@available,' RESERVED ',@total-@available);
            ELSE IF EXISTS(SELECT 1 FROM dbo.pathway_inventory_reservations WHERE id=@reservation)
              SET @reply=CONCAT('CONFLICT reservation ',@reservation,' already exists');
            ELSE IF @available<@quantity SET @reply=CONCAT('INSUFFICIENT ',@item,' AVAILABLE ',@available);
            ELSE BEGIN
              UPDATE dbo.pathway_inventory_stock SET available=available-@quantity WHERE sku=@item;
              INSERT dbo.pathway_inventory_reservations VALUES(@reservation,@item,@quantity,0);
              SET @reply=CONCAT('RESERVED ',@reservation,' ',@item,' QTY ',@quantity,' AVAILABLE ',@available-@quantity);
            END;
          END;
          INSERT dbo.pathway_inventory_requests VALUES(@requestId,@canonical,@reply);
          SELECT @reply AS reply,200 AS status;
        `);
        const reply = result.recordset[0];
        if (reply.status !== 200) throw failure(reply.status === 409 ?
          'Request ID was already used for a different command' : reply.reply, reply.status);
        return reply.reply;
      });
    },
    async stock(item) {
      if (typeof item !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,15}$/.test(item.trim())) {
        throw failure('Inventory item must be 1..16 letters, digits, hyphens or underscores, starting with a letter');
      }
      return transaction(async tx => {
        const result = await request(tx, { item: item.trim().toUpperCase() }).query(`
          SELECT stock.total AS inStock, stock.available,
            COALESCE(SUM(CASE WHEN orders.released=0 THEN orders.quantity ELSE 0 END),0) AS committed
          FROM dbo.pathway_inventory_stock AS stock
          LEFT JOIN dbo.pathway_inventory_reservations AS orders ON orders.sku=stock.sku
          WHERE stock.sku=@item GROUP BY stock.total,stock.available;`);
        const row = result.recordset[0];
        if (!row) throw failure('Inventory item not found', 404);
        if (!Number.isInteger(row.inStock) || !Number.isInteger(row.committed) ||
            row.inStock < 0 || row.committed < 0 || row.committed > row.inStock ||
            row.inStock - row.committed !== row.available) {
          throw failure('Invalid inventory stock counts', 503);
        }
        return { inStock: row.inStock, committed: row.committed };
      });
    },
    close: () => pool.close(),
  };
}

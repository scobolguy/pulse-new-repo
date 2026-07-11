export function createDatabaseRegistrySnapshotApi(deps = {}) {
  const {
    processRef = process,
    SQL_INSTANCE_NAME,
    SQL_SERVER_HOST,
    execFileSync
  } = deps;

  function getDatabaseRegistrySnapshot() {
    if (processRef.platform !== 'win32') {
      return [];
    }

    const serviceName = SQL_INSTANCE_NAME ? `MSSQL$${SQL_INSTANCE_NAME}` : 'MSSQLSERVER';
    const serviceDisplayName = SQL_INSTANCE_NAME ? `SQL Server (${SQL_INSTANCE_NAME})` : 'SQL Server (MSSQLSERVER)';
    const serverId = SQL_INSTANCE_NAME ? `db-mssql-${String(SQL_INSTANCE_NAME).toLowerCase()}` : 'db-mssql-default';
    const dbName = SQL_INSTANCE_NAME ? `SQL Server ${SQL_INSTANCE_NAME}` : 'SQL Server Default Instance';

    try {
      const script = [
        `      $svc = Get-CimInstance Win32_Service -Filter \"Name='${serviceName.replace('$', '`$')}'\" | Select-Object Name,DisplayName,State,StartMode,Status`,
        '      if ($null -eq $svc) {',
        '        [ordered]@{',
        '          installed = $false',
        `          name = '${serviceName}'`,
        `          displayName = '${serviceDisplayName}'`,
        "          state = 'NotInstalled'",
        "          startMode = 'Disabled'",
        "          status = 'Unknown'",
        '        } | ConvertTo-Json -Compress',
        '      } else {',
        '        [ordered]@{',
        '          installed = $true',
        '          name = [string]$svc.Name',
        '          displayName = [string]$svc.DisplayName',
        '          state = [string]$svc.State',
        '          startMode = [string]$svc.StartMode',
        '          status = [string]$svc.Status',
        '        } | ConvertTo-Json -Compress',
        '      }'
      ].join('\n');

      const raw = execFileSync('powershell.exe', ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
        encoding: 'utf8',
        timeout: 2500,
        windowsHide: true
      });
      const service = raw ? JSON.parse(raw) : null;
      const serviceState = String(service?.state || '').toLowerCase();
      const status = !service?.installed
        ? 'not-installed'
        : serviceState === 'running'
          ? 'up'
          : serviceState === 'stopped'
            ? 'down'
            : 'degraded';

      return [{
        serverId,
        name: dbName,
        engine: 'mssql',
        instanceName: SQL_INSTANCE_NAME || 'MSSQLSERVER',
        serviceName,
        status,
        installed: Boolean(service?.installed),
        host: SQL_SERVER_HOST,
        port: 1433,
        serviceState: String(service?.state || 'Unknown'),
        startMode: String(service?.startMode || 'Unknown')
      }];
    } catch (e) {
      return [{
        serverId,
        name: dbName,
        engine: 'mssql',
        instanceName: SQL_INSTANCE_NAME || 'MSSQLSERVER',
        serviceName,
        status: 'unknown',
        installed: false,
        host: SQL_SERVER_HOST,
        port: 1433,
        serviceState: 'Unknown',
        startMode: 'Unknown',
        error: String(e.message || e)
      }];
    }
  }

  return {
    getDatabaseRegistrySnapshot
  };
}

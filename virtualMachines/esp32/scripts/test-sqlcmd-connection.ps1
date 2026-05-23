$query = @"
SELECT @@SERVERNAME AS ServerName, DB_ID('pulse_fsm') AS PulseDbId;
"@

sqlcmd -S .\SQLEXPRESS -E -Q $query

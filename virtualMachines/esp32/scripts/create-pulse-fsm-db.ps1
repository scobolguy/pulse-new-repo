$query = @"
IF DB_ID('pulse_fsm') IS NULL
BEGIN
  CREATE DATABASE [pulse_fsm];
END;
SELECT name FROM sys.databases WHERE name = 'pulse_fsm';
"@

sqlcmd -S .\SQLEXPRESS -E -Q $query

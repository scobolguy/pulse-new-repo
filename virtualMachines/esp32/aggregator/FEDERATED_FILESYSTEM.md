# Federated File System (Operational Data Root)

The aggregator uses a **Federated File System** for operational data that is kept separate from the project code. This structure enables a code manager/catalog infrastructure.

## Directory Structure

```
c:\dev\pulse-operational-data/          # Default: PULSE_OPERATIONAL_DATA_ROOT
├── qm-primary/                         # Primary Queue Manager data
│   ├── config.json                     # Queue configuration
│   ├── operations.jsonl                # Operation log
│   ├── state.snapshot.json             # Snapshot of queue state
│   └── messages/                       # Message store by queue
│       └── [queue-name]/               # Queue-specific messages
└── qm-secondary/                       # Secondary Queue Manager data
    ├── config.json
    ├── operations.jsonl
    ├── state.snapshot.json
    └── messages/
        └── [queue-name]/
```

## Configuration

### Default Location

- **Windows**: `c:\dev\pulse-operational-data`
- **Linux**: `/opt/pulse/operational-data`

### Custom Location

Set the `PULSE_OPERATIONAL_DATA_ROOT` environment variable:

```bash
# Windows PowerShell
$env:PULSE_OPERATIONAL_DATA_ROOT = "C:\my-operational-data"

# Linux
export PULSE_OPERATIONAL_DATA_ROOT=/mnt/data/pulse-operational-data
```

### Via `.env` file

Create a `.env` file in the aggregator root:

```env
PULSE_OPERATIONAL_DATA_ROOT=c:\dev\pulse-operational-data
```

See [.env.example](.env.example) for all available configuration options.

## Key Points

1. **Separation of Concerns**: Code and operational data are completely separated
   - Project code lives in the Git repository
   - Operational data lives in a federated external root
   - This prevents accidental commits of runtime state

2. **Queue Manager Isolation**: Each queue manager (primary, secondary) has its own subdirectory
   - `qm-primary`: Master queue manager
   - `qm-secondary`: Backup/secondary queue manager

3. **Stateless Code**: The aggregator backend code doesn't embed operational state
   - Configuration seeding still happens from `aggregator/data/` if needed
   - Runtime state is read/written to the external operational root

4. **Multiple Deployments**: Different environments can point to different operational roots
   - Development: Local directory
   - Staging: Network share or NAS
   - Production: High-availability storage

## Backend Initialization

The aggregator backend automatically:

1. Creates the operational data directories if they don't exist
2. Initializes queue managers from the configured root
3. Manages queue state in the external location

No manual setup is required beyond setting the environment variable.

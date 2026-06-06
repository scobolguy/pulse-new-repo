# PMachine Residency and Paging Plan (ESP32)

## Scope
Add lifecycle-aware residency and paged pcode execution for:
- Runtime units: program, service, daemon
- Shared runtime assets: StringPool, GlobalEnumeratedTypes, global types, mapper/data-librarian artifacts
- Memory model: virtual-to-physical paging with LRU and configurable page size/count

## Lifecycle Semantics

### Program
- Loaded for one execution
- Runs
- Automatically unloaded after completion
- No persistent residency unless explicitly pinned

### Service
- Loaded by explicit load command
- Remains resident until explicit unload command
- No refresh cycle

### Daemon
- Loaded by explicit load command
- Remains resident until explicit unload command
- Has refresh cycle timer that triggers daemon refresh callback

## Resident Asset Domains
- StringPool domain
- GlobalEnumeratedTypes domain
- GlobalTypes domain
- MapperArtifacts domain
- ProgramImage domain (pcode pages)

Each domain should support:
- load(domain, id)
- unload(domain, id)
- pin/unpin
- residency state query
- memory footprint query

## Memory Architecture

### Virtual Memory Layer
- Virtual address space for program image pages
- Page table maps virtual page -> physical frame or not present
- On miss: fetch page from Federated File System (FFS)

### Physical Page Cache
- Fixed number of frames
- Configurable page size (bytes)
- LRU eviction policy
- Optional pinning for critical pages/assets

### Proposed Defaults (ESP32-safe baseline)
- pageSizeBytes: 1024
- maxFrames: 24
- cacheBudget: ~24 KB for page payloads (+ metadata)
- StringPool + enums + globals budget: ~16-32 KB depending on board profile

These should be runtime-configurable.

## FFS Interaction
- FFS reads are expensive, so paging must minimize misses
- Read whole pages only
- Keep page-aligned reads
- Track page fault metrics and hot pages
- Add optional read-ahead of next page for sequential execution

## Data Structures
- PageFrame: frameId, vpage, dirty, pinCount, lastAccessTick, bytes
- PageTableEntry: present, frameId, backingOffset, permissions
- LruNode: prev, next, frameId
- ResidentAssetRecord: domain, id, bytes, pinCount, loadedAt, lastUsedAt

## API Surface (PMachine)
- setMemoryConfig(pageSizeBytes, maxFrames)
- loadUnit(kind, id, source)
- unloadUnit(kind, id)
- runUnit(kind, id)
- loadResidentDomain(domain, id)
- unloadResidentDomain(domain, id)
- getResidencyStatus()
- getPagingStats()

## Integration Points

### Compiler/Program Map
Include runtime metadata in program map:
- runtimeUnit: kind, id, refreshMs
- requiredGlobals: type IDs
- requiredMappers: mapper IDs

### PMachine Runtime
- Resolve required globals/mappers before run
- Programs: unload ProgramImage after halt
- Services/Daemons: keep ProgramImage resident until explicit unload
- Daemons: schedule refresh callbacks with refreshMs

## ESP32 Fit Assessment
Yes, this fits on ESP32 with constraints:
- Keep page cache modest (for example 16-32 KB)
- Avoid large JSON materialization in hot paths
- Use compact metadata structures
- Prefer statically bounded containers where possible
- Use board profile presets (ESP32 vs lower-memory boards)

## Phased Delivery

### Phase 1: Lifecycle + Residency Registry
- Add load/unload state machine for program/service/daemon
- Add resident registries for string pool/enums/global types/mappers
- Add telemetry endpoints

### Phase 2: ProgramImage Paging
- Introduce page table + frames + LRU
- Add FFS page fetch and fault handling
- Add configuration knobs

### Phase 3: Optimizations
- Read-ahead
- Pin critical pages
- Warm startup profiles
- Fault-rate based tuning

## Acceptance Tests
- Program run unloads image automatically
- Service remains resident across invocations
- Daemon emits refresh ticks at configured interval
- LRU evicts least-recently-used unpinned pages
- VM still executes correctly under constrained frame count
- Fault/miss metrics visible and stable under load

# MT103 Transaction Flow (Mermaid)

```mermaid
flowchart TD
  A[State: received_mt103\nQueue: swift.mt103.parsed] --> B[Transition: mapped_to_pacs\nAction: MAP mt103-to-pacs]
  B --> C[State: pacs_created\nQueue: tx.pacs.created]

  C --> D[Sanctions Scanning]
  D --> E{Sanctions Result}
  E -- Pass --> F[Liqudity Management]
  E -- Hit --> X[State: rejected\nQueue: tx.rejected]

  F --> G[State: lynx_pending\nQueue: tx.lynx.pending]
  G --> H{BoC / LYNX Decision}
  H -- Approved --> I[State: lynx_approved\nQueue: tx.lynx.approved]
  H -- Rejected --> X

  I --> J[Transition: sent_to_correspondent\nAction: ENQUEUE correspondent.pacs008.outbound]
  J --> K[State: sent_correspondent_unreconciled\nQueue: tx.correspondent.unreconciled]
  K --> L{statement_matched}
  L -- True --> M[State: reconciled\nQueue: tx.reconciled]
  L -- False --> K

  style A fill:#e8f1ff,stroke:#2266aa,stroke-width:1px
  style C fill:#e8f1ff,stroke:#2266aa,stroke-width:1px
  style G fill:#e8f1ff,stroke:#2266aa,stroke-width:1px
  style I fill:#e8f1ff,stroke:#2266aa,stroke-width:1px
  style K fill:#e8f1ff,stroke:#2266aa,stroke-width:1px
  style M fill:#eafaf2,stroke:#238b55,stroke-width:1px
  style D fill:#fff6e6,stroke:#c97a00,stroke-width:1px
  style X fill:#fdeaea,stroke:#b42318,stroke-width:1px
```

## Canonical Path

received_mt103 -> pacs_created -> sanctions_scanning -> liqudity_management -> lynx_pending -> lynx_approved -> sent_correspondent_unreconciled -> reconciled

# Smoke Test Plan

1. Build locally with `scripts/build.sh`.
2. Start with `scripts/run.sh`.
3. Confirm logs show startup and two sample alerts (`person`, `doorbell`).
4. Replace stubs with real broker consumer, BlueZ, and Piper invocation.

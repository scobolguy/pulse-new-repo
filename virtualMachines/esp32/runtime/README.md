# Runtime State

Operational state belongs here: queues, caches, logs, uploaded files, run reports, test results, and experiments. This directory is intentionally ignored except for this guide.

Production deployments should prefer the existing `PULSE_*_DATA_ROOT` environment variables so operational data can live outside the checkout.
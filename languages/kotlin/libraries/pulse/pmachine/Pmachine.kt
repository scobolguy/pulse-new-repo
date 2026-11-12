package pulse.pmachine

/*
 * Net-new pmachine control ABI.
 *
 * The native host owns FFS, signatures, slot accounting, process execution,
 * and recovery. Pulse Kotlin only submits typed scalar requests and receives
 * JSON results.
 */
external fun networkReady(): String
external fun installBundle(fileName: String, bundleBase64: String): String
external fun start(slot: String, fileName: String): String
external fun stop(slot: String): String
external fun status(): String
external fun checkpoint(taskId: String, state: String, transactionContext: String): String
external fun restore(taskId: String, checkpointId: String): String
external fun bootFixed(fileName: String): String

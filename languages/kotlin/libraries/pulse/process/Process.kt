package pulse.process

/*
 * Portable process-recovery API.
 *
 * The host owns durable storage, fencing, and transaction recovery. These
 * declarations keep application code independent of the host implementation.
 */
external fun checkpointProcess(
    processId: String,
    state: String,
    transactionContext: String
): String

external fun restoreCheckpoint(
    processId: String,
    checkpointId: String
): String

external fun beginTransaction(
    transactionId: String,
    parentTransactionId: String
): String

external fun commitTransaction(transactionId: String): String

external fun abortTransaction(transactionId: String): String

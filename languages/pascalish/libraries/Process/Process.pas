program "Process";

function checkpointProcess(processId: string; state: string; transactionContext: string): string;
begin
  return host.checkpoint_process(processId, state, transactionContext)
end;

function restoreCheckpoint(processId: string; checkpointId: string): string;
begin
  return host.restore_checkpoint(processId, checkpointId)
end;

function beginTransaction(transactionId: string; parentTransactionId: string): string;
begin
  return host.begin_transaction(transactionId, parentTransactionId)
end;

function commitTransaction(transactionId: string): string;
begin
  return host.commit_transaction(transactionId)
end;

function abortTransaction(transactionId: string): string;
begin
  return host.abort_transaction(transactionId)
end;

begin
end.

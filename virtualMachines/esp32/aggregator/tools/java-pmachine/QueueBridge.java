import java.util.concurrent.CompletionStage;

public interface QueueBridge {
    enum DeliveryMode {
        SYNC,
        ASYNC
    }

    final class Receipt {
        public final String messageId;
        public final boolean acknowledged;

        public Receipt(String messageId, boolean acknowledged) {
            this.messageId = messageId;
            this.acknowledged = acknowledged;
        }
    }

    CompletionStage<Receipt> write(String logicalQueue, String payload, DeliveryMode mode);
}

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Deque;
import java.util.concurrent.CompletableFuture;

public class PmachineRunner {
    private static final class Instruction {
        final String op;
        final String operand;
        final int argc;

        Instruction(String op, String operand, int argc) {
            this.op = op;
            this.operand = operand;
            this.argc = argc;
        }
    }

    private static final class Machine {
        final List<Instruction> program = new ArrayList<>();
        final Map<String, Integer> labels = new HashMap<>();
        final Map<String, Object> vars = new HashMap<>();
        final Deque<Object> stack = new ArrayDeque<>();
        final Deque<Integer> callStack = new ArrayDeque<>();
        final List<String> emittedQueues = new ArrayList<>();
        final List<CompletableFuture<QueueBridge.Receipt>> pendingWrites = new ArrayList<>();
        final QueueBridge queueBridge;
        String currentMessage = "";
        int ip = 0;
        int steps = 0;

        Machine(QueueBridge queueBridge) {
            this.queueBridge = queueBridge;
        }

        void run() {
            while (ip >= 0 && ip < program.size()) {
                steps += 1;
                Instruction instr = program.get(ip);
                execute(instr);
            }
        }

        void execute(Instruction instr) {
            switch (instr.op) {
                case "PUSH_INT":
                    stack.push(Integer.parseInt(instr.operand));
                    ip += 1;
                    break;
                case "PUSH_STR":
                    stack.push(unquote(instr.operand));
                    ip += 1;
                    break;
                case "LOAD":
                    stack.push(vars.getOrDefault(instr.operand, 0));
                    ip += 1;
                    break;
                case "STORE":
                    vars.put(instr.operand, popStack());
                    ip += 1;
                    break;
                case "ADD":
                    pushBinaryResult((a, b) -> a + b);
                    break;
                case "SUB":
                    pushBinaryResult((a, b) -> a - b);
                    break;
                case "MUL":
                    pushBinaryResult((a, b) -> a * b);
                    break;
                case "DIV":
                    pushBinaryResult((a, b) -> a / b);
                    break;
                case "EQ":
                    pushBinaryResult((a, b) -> a == b ? 1 : 0);
                    break;
                case "NEQ":
                    pushBinaryResult((a, b) -> a != b ? 1 : 0);
                    break;
                case "LT":
                    pushBinaryResult((a, b) -> a < b ? 1 : 0);
                    break;
                case "LE":
                    pushBinaryResult((a, b) -> a <= b ? 1 : 0);
                    break;
                case "GT":
                    pushBinaryResult((a, b) -> a > b ? 1 : 0);
                    break;
                case "GE":
                    pushBinaryResult((a, b) -> a >= b ? 1 : 0);
                    break;
                case "AND":
                    pushBinaryResult((a, b) -> (a != 0 && b != 0) ? 1 : 0);
                    break;
                case "OR":
                    pushBinaryResult((a, b) -> (a != 0 || b != 0) ? 1 : 0);
                    break;
                case "JMP":
                    ip = labels.getOrDefault(instr.operand, 0);
                    break;
                case "JZ":
                    if (popStack() == 0) {
                        ip = labels.getOrDefault(instr.operand, ip + 1);
                    } else {
                        ip += 1;
                    }
                    break;
                case "CALL":
                    callStack.push(ip + 1);
                    ip = labels.getOrDefault(instr.operand, 0);
                    break;
                case "RET":
                    ip = callStack.isEmpty() ? program.size() : callStack.pop();
                    break;
                case "HALT":
                    ip = program.size();
                    break;
                case "ROUTE_SET_MESSAGE":
                    currentMessage = String.valueOf(popValue());
                    ip += 1;
                    break;
                case "ROUTE_EMIT":
                    emittedQueues.add(instr.operand.replaceAll("^\"|\"$", ""));
                    ip += 1;
                    break;
                case "QUEUE_WRITE_SYNC":
                case "QUEUE_WRITE_ASYNC":
                    String queue = unquote(instr.operand);
                    QueueBridge.DeliveryMode mode = instr.op.equals("QUEUE_WRITE_SYNC")
                        ? QueueBridge.DeliveryMode.SYNC
                        : QueueBridge.DeliveryMode.ASYNC;
                    CompletableFuture<QueueBridge.Receipt> write = queueBridge.write(queue, currentMessage, mode).toCompletableFuture();
                    if (mode == QueueBridge.DeliveryMode.SYNC) write.join();
                    else pendingWrites.add(write);
                    emittedQueues.add(queue + ":" + mode.name().toLowerCase());
                    ip += 1;
                    break;
                default:
                    ip += 1;
                    break;
            }
        }

        private void pushBinaryResult(BinaryOp op) {
            int right = popStack();
            int left = popStack();
            stack.push(op.apply(left, right));
            ip += 1;
        }

        private int popStack() {
            Object value = popValue();
            return value instanceof Number ? ((Number) value).intValue() : 0;
        }

        private Object popValue() {
            return stack.isEmpty() ? 0 : stack.pop();
        }

        private String unquote(String value) {
            if (value == null) return "";
            return value.replaceAll("^[\"']|[\"']$", "");
        }

        @FunctionalInterface
        private interface BinaryOp {
            int apply(int left, int right);
        }
    }

    public static void main(String[] args) throws IOException {
        if (args.length == 0) {
            System.err.println("Usage: java PmachineRunner <pcode-file>");
            System.exit(1);
        }

        Path pcodePath = Path.of(args[0]).toAbsolutePath();
        List<String> lines = Files.readAllLines(pcodePath);
        List<String> queueWrites = new ArrayList<>();
        QueueBridge bridge = (queue, payload, mode) -> {
            queueWrites.add(queue + ":" + mode.name().toLowerCase() + ":" + payload);
            return CompletableFuture.completedFuture(new QueueBridge.Receipt("java-local-" + queueWrites.size(), true));
        };
        Machine machine = new Machine(bridge);

        for (String rawLine : lines) {
            String line = rawLine.split("//", 2)[0].trim();
            if (line.isEmpty()) {
                continue;
            }
            if (line.endsWith(":")) {
                machine.labels.put(line.substring(0, line.length() - 1), machine.program.size());
                continue;
            }
            String[] parts = line.split("\\s+", 2);
            String op = parts[0];
            String remainder = parts.length > 1 ? parts[1].trim() : "";
            String operand = null;
            int argc = 0;
            if (!remainder.isEmpty()) {
                if (remainder.startsWith("\"") || remainder.startsWith("'")) {
                    operand = remainder;
                } else {
                    String[] nested = remainder.split("\\s+");
                    operand = nested[0];
                    if (nested.length > 1) {
                        try {
                            argc = Integer.parseInt(nested[1]);
                        } catch (NumberFormatException ignored) {
                            // Some pcode instructions carry a symbolic operand that is not an integer argc.
                        }
                    }
                }
            }
            machine.program.add(new Instruction(op, operand, argc));
        }

        machine.run();
        CompletableFuture.allOf(machine.pendingWrites.toArray(new CompletableFuture[0])).join();
        System.out.println("steps=" + machine.steps);
        System.out.println("sum=" + machine.vars.getOrDefault("sum", 0));
        System.out.println("bonus=" + machine.vars.getOrDefault("bonus", 0));
        System.out.println("active=" + machine.vars.getOrDefault("active", 0));
        System.out.println("emittedQueues=" + machine.emittedQueues);
        System.out.println("queueWrites=" + queueWrites);
    }
}

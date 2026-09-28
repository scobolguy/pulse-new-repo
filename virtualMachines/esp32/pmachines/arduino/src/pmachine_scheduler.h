#pragma once

#include <vector>
#include <map>
#include <queue>
#include <string>
#include <cstdint>
#include "pmachine.h"

namespace pmachine {

// Forward declaration
struct PInstruction;

/**
 * Execution Context State
 */
enum class ContextState : uint8_t {
    READY = 0,      // Ready to run
    RUNNING = 1,    // Currently executing
    BLOCKED = 2,    // Blocked on semaphore or I/O
    TERMINATED = 3  // Finished execution
};

/**
 * Execution Context
 * Represents a single thread of execution in the P-Machine
 */
struct ExecutionContext {
    uint16_t contextId;                     // Unique context identifier
    uint16_t pc;                            // Program counter
    uint16_t sp;                            // Stack pointer
    uint16_t bp;                            // Base pointer (frame pointer)
    uint8_t priority;                       // Scheduling priority (0-255, higher = more important)
    ContextState state;                     // Current state
    uint32_t blockedUntilMs;                // For timed waits (0 = not timed)
    uint16_t blockedOnSemaphore;            // Semaphore ID if blocked (0xFFFF = none)
    std::vector<int> stack;                 // Execution stack
    std::map<std::string, int> locals;      // Named local variables
    uint32_t quantumRemaining;              // Instructions remaining in current quantum
    uint32_t totalInstructions;             // Total instructions executed
    std::string name;                       // Optional context name for debugging
    
    ExecutionContext() 
        : contextId(0), pc(0), sp(0), bp(0), priority(128), 
          state(ContextState::READY), blockedUntilMs(0), 
          blockedOnSemaphore(0xFFFF), quantumRemaining(0), 
          totalInstructions(0), name("") {}
};

/**
 * Semaphore
 * Used for synchronization between contexts
 */
struct Semaphore {
    uint16_t id;                            // Semaphore identifier
    int value;                              // Current value (>= 0)
    std::queue<uint16_t> waitQueue;         // Contexts waiting on this semaphore
    std::string name;                       // Optional name for debugging
    
    Semaphore() : id(0), value(1), name("") {}
    Semaphore(uint16_t id_, int initialValue, const std::string& name_ = "")
        : id(id_), value(initialValue), name(name_) {}
};

/**
 * Scheduler Configuration
 */
struct SchedulerConfig {
    enum class Algorithm {
        ROUND_ROBIN = 0,
        PRIORITY = 1,
        ROUND_ROBIN_PRIORITY = 2  // Round-robin within priority levels
    };
    
    Algorithm algorithm;                    // Scheduling algorithm
    uint32_t quantum;                       // Instructions per quantum (0 = no preemption)
    uint16_t maxContexts;                   // Maximum number of contexts
    uint8_t priorityLevels;                 // Number of priority levels (for priority scheduling)
    bool preemptionEnabled;                 // Enable preemptive scheduling
    
    SchedulerConfig()
        : algorithm(Algorithm::ROUND_ROBIN), quantum(100), 
          maxContexts(16), priorityLevels(4), preemptionEnabled(true) {}
};

/**
 * Scheduler Statistics
 */
struct SchedulerStats {
    uint32_t contextSwitches;               // Total context switches
    uint32_t totalInstructions;             // Total instructions executed across all contexts
    uint32_t semaphoreWaits;                // Total semaphore wait operations
    uint32_t semaphoreSignals;              // Total semaphore signal operations
    uint32_t preemptions;                   // Number of preemptions
    uint32_t yields;                        // Number of voluntary yields
    
    SchedulerStats()
        : contextSwitches(0), totalInstructions(0), semaphoreWaits(0),
          semaphoreSignals(0), preemptions(0), yields(0) {}
    
    void reset() {
        contextSwitches = 0;
        totalInstructions = 0;
        semaphoreWaits = 0;
        semaphoreSignals = 0;
        preemptions = 0;
        yields = 0;
    }
};

/**
 * PMachine Scheduler
 * Manages multiple execution contexts and provides preemptive multitasking
 */
class PMachineScheduler {
public:
    PMachineScheduler();
    ~PMachineScheduler();
    
    // Configuration
    void setConfig(const SchedulerConfig& config);
    SchedulerConfig getConfig() const { return config_; }
    
    // Context Management
    uint16_t createContext(uint16_t startPC, uint8_t priority = 128, const std::string& name = "");
    bool destroyContext(uint16_t contextId);
    ExecutionContext* getContext(uint16_t contextId);
    const ExecutionContext* getContext(uint16_t contextId) const;
    uint16_t getCurrentContextId() const { return currentContextId_; }
    ExecutionContext* getCurrentContext();
    std::vector<uint16_t> getAllContextIds() const;
    size_t getContextCount() const { return contexts_.size(); }
    
    // Semaphore Management
    uint16_t createSemaphore(int initialValue, const std::string& name = "");
    bool destroySemaphore(uint16_t semaphoreId);
    bool semaphoreWait(uint16_t semaphoreId, uint16_t contextId);
    bool semaphoreSignal(uint16_t semaphoreId);
    Semaphore* getSemaphore(uint16_t semaphoreId);
    
    // Scheduling
    bool schedule();                        // Select next context to run
    void yield();                           // Current context yields
    void blockContext(uint16_t contextId, uint16_t semaphoreId = 0xFFFF, uint32_t timeoutMs = 0);
    void unblockContext(uint16_t contextId);
    bool isRunning() const { return running_; }
    void stop() { running_ = false; }
    
    // Execution
    void executeQuantum(const std::vector<PInstruction>& instructions);
    void tick(uint32_t currentTimeMs);      // Update timed waits
    
    // Statistics
    SchedulerStats getStats() const { return stats_; }
    void resetStats() { stats_.reset(); }
    
    // Debugging
    std::string getContextStateString(uint16_t contextId) const;
    std::string getSchedulerStatus() const;
    
private:
    SchedulerConfig config_;
    std::map<uint16_t, ExecutionContext> contexts_;
    std::map<uint16_t, Semaphore> semaphores_;
    std::queue<uint16_t> readyQueue_;       // Queue of ready contexts
    uint16_t currentContextId_;             // Currently executing context
    uint16_t nextContextId_;                // Next available context ID
    uint16_t nextSemaphoreId_;              // Next available semaphore ID
    bool running_;                          // Scheduler is running
    SchedulerStats stats_;
    uint32_t currentTimeMs_;                // Current time for timed waits
    
    // Helper methods
    void addToReadyQueue(uint16_t contextId);
    uint16_t selectNextContext();           // Select next context based on algorithm
    void contextSwitch(uint16_t newContextId);
    void checkTimedWaits(uint32_t currentTimeMs);
    uint16_t selectRoundRobin();
    uint16_t selectPriority();
    uint16_t selectRoundRobinPriority();
};

} // namespace pmachine

// Made with Bob

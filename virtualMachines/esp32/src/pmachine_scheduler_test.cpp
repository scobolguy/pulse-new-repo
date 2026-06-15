#include "pmachine_scheduler.h"
#include <iostream>
#include <cassert>

using namespace pmachine;

/**
 * Test Suite for PMachine Scheduler
 */

void testBasicContextCreation() {
    std::cout << "Test: Basic Context Creation\n";
    
    PMachineScheduler scheduler;
    
    // Create contexts
    uint16_t ctx1 = scheduler.createContext(0, 128, "context1");
    uint16_t ctx2 = scheduler.createContext(100, 128, "context2");
    uint16_t ctx3 = scheduler.createContext(200, 128, "context3");
    
    assert(ctx1 != 0xFFFF);
    assert(ctx2 != 0xFFFF);
    assert(ctx3 != 0xFFFF);
    assert(scheduler.getContextCount() == 3);
    
    // Verify contexts
    ExecutionContext* c1 = scheduler.getContext(ctx1);
    assert(c1 != nullptr);
    assert(c1->pc == 0);
    assert(c1->name == "context1");
    assert(c1->state == ContextState::READY);
    
    std::cout << "  ✓ Context creation successful\n";
}

void testScheduling() {
    std::cout << "Test: Basic Scheduling\n";
    
    PMachineScheduler scheduler;
    SchedulerConfig config;
    config.algorithm = SchedulerConfig::Algorithm::ROUND_ROBIN;
    config.quantum = 10;
    scheduler.setConfig(config);
    
    uint16_t ctx1 = scheduler.createContext(0, 128, "task1");
    uint16_t ctx2 = scheduler.createContext(0, 128, "task2");
    
    // Schedule first context
    bool scheduled = scheduler.schedule();
    assert(scheduled);
    
    uint16_t currentId = scheduler.getCurrentContextId();
    assert(currentId == ctx1 || currentId == ctx2);
    
    ExecutionContext* current = scheduler.getCurrentContext();
    assert(current != nullptr);
    assert(current->state == ContextState::RUNNING);
    
    std::cout << "  ✓ Scheduling successful\n";
}

void testSemaphores() {
    std::cout << "Test: Semaphore Operations\n";
    
    PMachineScheduler scheduler;
    
    uint16_t ctx1 = scheduler.createContext(0, 128, "producer");
    uint16_t ctx2 = scheduler.createContext(0, 128, "consumer");
    
    // Create semaphore with initial value 1 (mutex)
    uint16_t mutex = scheduler.createSemaphore(1, "mutex");
    assert(mutex != 0xFFFF);
    
    Semaphore* sem = scheduler.getSemaphore(mutex);
    assert(sem != nullptr);
    assert(sem->value == 1);
    
    // First wait should succeed
    bool waited = scheduler.semaphoreWait(mutex, ctx1);
    assert(waited == true);
    assert(sem->value == 0);
    
    // Second wait should block
    waited = scheduler.semaphoreWait(mutex, ctx2);
    assert(waited == false);
    
    ExecutionContext* c2 = scheduler.getContext(ctx2);
    assert(c2->state == ContextState::BLOCKED);
    assert(c2->blockedOnSemaphore == mutex);
    
    // Signal should unblock ctx2
    bool signaled = scheduler.semaphoreSignal(mutex);
    assert(signaled == true);
    assert(c2->state == ContextState::READY);
    
    std::cout << "  ✓ Semaphore operations successful\n";
}

void testPriorityScheduling() {
    std::cout << "Test: Priority Scheduling\n";
    
    PMachineScheduler scheduler;
    SchedulerConfig config;
    config.algorithm = SchedulerConfig::Algorithm::PRIORITY;
    scheduler.setConfig(config);
    
    uint16_t lowPrio = scheduler.createContext(0, 50, "low");
    uint16_t medPrio = scheduler.createContext(0, 128, "medium");
    uint16_t highPrio = scheduler.createContext(0, 200, "high");
    
    // Schedule should select highest priority
    scheduler.schedule();
    uint16_t currentId = scheduler.getCurrentContextId();
    
    ExecutionContext* current = scheduler.getCurrentContext();
    assert(current != nullptr);
    assert(current->priority == 200);
    assert(current->contextId == highPrio);
    
    std::cout << "  ✓ Priority scheduling successful\n";
}

void testContextDestruction() {
    std::cout << "Test: Context Destruction\n";
    
    PMachineScheduler scheduler;
    
    uint16_t ctx1 = scheduler.createContext(0, 128, "temp");
    assert(scheduler.getContextCount() == 1);
    
    bool destroyed = scheduler.destroyContext(ctx1);
    assert(destroyed == true);
    assert(scheduler.getContextCount() == 0);
    
    ExecutionContext* ctx = scheduler.getContext(ctx1);
    assert(ctx == nullptr);
    
    std::cout << "  ✓ Context destruction successful\n";
}

void testYield() {
    std::cout << "Test: Voluntary Yield\n";
    
    PMachineScheduler scheduler;
    
    uint16_t ctx1 = scheduler.createContext(0, 128, "yielder");
    uint16_t ctx2 = scheduler.createContext(0, 128, "waiter");
    
    scheduler.schedule();
    uint16_t firstId = scheduler.getCurrentContextId();
    
    // Yield should switch to other context
    scheduler.yield();
    uint16_t secondId = scheduler.getCurrentContextId();
    
    assert(firstId != secondId);
    
    SchedulerStats stats = scheduler.getStats();
    assert(stats.yields == 1);
    assert(stats.contextSwitches >= 1);
    
    std::cout << "  ✓ Yield successful\n";
}

void testTimedWait() {
    std::cout << "Test: Timed Wait\n";
    
    PMachineScheduler scheduler;
    
    uint16_t ctx1 = scheduler.createContext(0, 128, "sleeper");
    
    // Block with timeout
    scheduler.blockContext(ctx1, 0xFFFF, 1000); // 1 second timeout
    
    ExecutionContext* ctx = scheduler.getContext(ctx1);
    assert(ctx->state == ContextState::BLOCKED);
    assert(ctx->blockedUntilMs == 1000);
    
    // Simulate time passing
    scheduler.tick(500); // 500ms - still blocked
    assert(ctx->state == ContextState::BLOCKED);
    
    scheduler.tick(1001); // 1001ms - should unblock
    assert(ctx->state == ContextState::READY);
    
    std::cout << "  ✓ Timed wait successful\n";
}

void testSchedulerStatus() {
    std::cout << "Test: Scheduler Status\n";
    
    PMachineScheduler scheduler;
    
    scheduler.createContext(0, 128, "task1");
    scheduler.createContext(100, 200, "task2");
    scheduler.createSemaphore(1, "mutex");
    
    scheduler.schedule();
    
    std::string status = scheduler.getSchedulerStatus();
    assert(!status.empty());
    assert(status.find("Scheduler Status") != std::string::npos);
    assert(status.find("task1") != std::string::npos);
    assert(status.find("task2") != std::string::npos);
    
    std::cout << "  ✓ Status reporting successful\n";
    std::cout << "\nScheduler Status:\n" << status << "\n";
}

void testMaxContexts() {
    std::cout << "Test: Max Contexts Limit\n";
    
    PMachineScheduler scheduler;
    SchedulerConfig config;
    config.maxContexts = 4;
    scheduler.setConfig(config);
    
    uint16_t ctx1 = scheduler.createContext(0);
    uint16_t ctx2 = scheduler.createContext(0);
    uint16_t ctx3 = scheduler.createContext(0);
    uint16_t ctx4 = scheduler.createContext(0);
    uint16_t ctx5 = scheduler.createContext(0); // Should fail
    
    assert(ctx1 != 0xFFFF);
    assert(ctx2 != 0xFFFF);
    assert(ctx3 != 0xFFFF);
    assert(ctx4 != 0xFFFF);
    assert(ctx5 == 0xFFFF); // Max reached
    
    std::cout << "  ✓ Max contexts limit enforced\n";
}

void testStatistics() {
    std::cout << "Test: Statistics Tracking\n";
    
    PMachineScheduler scheduler;
    
    uint16_t ctx1 = scheduler.createContext(0);
    uint16_t sem1 = scheduler.createSemaphore(1);
    
    scheduler.schedule();
    scheduler.semaphoreWait(sem1, ctx1);
    scheduler.semaphoreSignal(sem1);
    scheduler.yield();
    
    SchedulerStats stats = scheduler.getStats();
    assert(stats.contextSwitches > 0);
    assert(stats.semaphoreWaits == 1);
    assert(stats.semaphoreSignals == 1);
    assert(stats.yields == 1);
    
    // Reset stats
    scheduler.resetStats();
    stats = scheduler.getStats();
    assert(stats.contextSwitches == 0);
    assert(stats.semaphoreWaits == 0);
    
    std::cout << "  ✓ Statistics tracking successful\n";
}

int main() {
    std::cout << "=== PMachine Scheduler Test Suite ===\n\n";
    
    try {
        testBasicContextCreation();
        testScheduling();
        testSemaphores();
        testPriorityScheduling();
        testContextDestruction();
        testYield();
        testTimedWait();
        testSchedulerStatus();
        testMaxContexts();
        testStatistics();
        
        std::cout << "\n=== All Tests Passed ✓ ===\n";
        return 0;
    } catch (const std::exception& e) {
        std::cerr << "\n✗ Test failed with exception: " << e.what() << "\n";
        return 1;
    } catch (...) {
        std::cerr << "\n✗ Test failed with unknown exception\n";
        return 1;
    }
}

// Made with Bob

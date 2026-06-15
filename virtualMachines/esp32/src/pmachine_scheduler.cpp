#include "pmachine_scheduler.h"
#include <algorithm>
#include <sstream>

namespace pmachine {

PMachineScheduler::PMachineScheduler()
    : currentContextId_(0xFFFF), nextContextId_(1), nextSemaphoreId_(1),
      running_(false), currentTimeMs_(0) {
    // Initialize with default configuration
    config_ = SchedulerConfig();
}

PMachineScheduler::~PMachineScheduler() {
    // Cleanup
    contexts_.clear();
    semaphores_.clear();
    while (!readyQueue_.empty()) {
        readyQueue_.pop();
    }
}

void PMachineScheduler::setConfig(const SchedulerConfig& config) {
    config_ = config;
}

uint16_t PMachineScheduler::createContext(uint16_t startPC, uint8_t priority, const std::string& name) {
    if (contexts_.size() >= config_.maxContexts) {
        return 0xFFFF; // Max contexts reached
    }
    
    uint16_t contextId = nextContextId_++;
    ExecutionContext ctx;
    ctx.contextId = contextId;
    ctx.pc = startPC;
    ctx.sp = 0;
    ctx.bp = 0;
    ctx.priority = priority;
    ctx.state = ContextState::READY;
    ctx.blockedUntilMs = 0;
    ctx.blockedOnSemaphore = 0xFFFF;
    ctx.quantumRemaining = config_.quantum;
    ctx.totalInstructions = 0;
    ctx.name = name.empty() ? ("ctx_" + std::to_string(contextId)) : name;
    
    contexts_[contextId] = ctx;
    addToReadyQueue(contextId);
    
    return contextId;
}

bool PMachineScheduler::destroyContext(uint16_t contextId) {
    auto it = contexts_.find(contextId);
    if (it == contexts_.end()) {
        return false;
    }
    
    // Mark as terminated
    it->second.state = ContextState::TERMINATED;
    
    // If it's the current context, schedule next
    if (currentContextId_ == contextId) {
        currentContextId_ = 0xFFFF;
        schedule();
    }
    
    // Remove from contexts (will be cleaned up)
    contexts_.erase(it);
    
    return true;
}

ExecutionContext* PMachineScheduler::getContext(uint16_t contextId) {
    auto it = contexts_.find(contextId);
    if (it == contexts_.end()) {
        return nullptr;
    }
    return &(it->second);
}

const ExecutionContext* PMachineScheduler::getContext(uint16_t contextId) const {
    auto it = contexts_.find(contextId);
    if (it == contexts_.end()) {
        return nullptr;
    }
    return &(it->second);
}

ExecutionContext* PMachineScheduler::getCurrentContext() {
    if (currentContextId_ == 0xFFFF) {
        return nullptr;
    }
    return getContext(currentContextId_);
}

std::vector<uint16_t> PMachineScheduler::getAllContextIds() const {
    std::vector<uint16_t> ids;
    ids.reserve(contexts_.size());
    for (const auto& pair : contexts_) {
        ids.push_back(pair.first);
    }
    return ids;
}

uint16_t PMachineScheduler::createSemaphore(int initialValue, const std::string& name) {
    uint16_t semId = nextSemaphoreId_++;
    Semaphore sem(semId, initialValue, name.empty() ? ("sem_" + std::to_string(semId)) : name);
    semaphores_[semId] = sem;
    return semId;
}

bool PMachineScheduler::destroySemaphore(uint16_t semaphoreId) {
    auto it = semaphores_.find(semaphoreId);
    if (it == semaphores_.end()) {
        return false;
    }
    
    // Unblock all waiting contexts
    while (!it->second.waitQueue.empty()) {
        uint16_t contextId = it->second.waitQueue.front();
        it->second.waitQueue.pop();
        unblockContext(contextId);
    }
    
    semaphores_.erase(it);
    return true;
}

bool PMachineScheduler::semaphoreWait(uint16_t semaphoreId, uint16_t contextId) {
    auto semIt = semaphores_.find(semaphoreId);
    if (semIt == semaphores_.end()) {
        return false;
    }
    
    auto ctxIt = contexts_.find(contextId);
    if (ctxIt == contexts_.end()) {
        return false;
    }
    
    Semaphore& sem = semIt->second;
    ExecutionContext& ctx = ctxIt->second;
    
    stats_.semaphoreWaits++;
    
    if (sem.value > 0) {
        // Semaphore available, decrement and continue
        sem.value--;
        return true;
    } else {
        // Block context
        sem.waitQueue.push(contextId);
        blockContext(contextId, semaphoreId);
        return false; // Context blocked
    }
}

bool PMachineScheduler::semaphoreSignal(uint16_t semaphoreId) {
    auto semIt = semaphores_.find(semaphoreId);
    if (semIt == semaphores_.end()) {
        return false;
    }
    
    Semaphore& sem = semIt->second;
    stats_.semaphoreSignals++;
    
    if (sem.waitQueue.empty()) {
        // No waiting contexts, increment value
        sem.value++;
    } else {
        // Wake up first waiting context
        uint16_t contextId = sem.waitQueue.front();
        sem.waitQueue.pop();
        unblockContext(contextId);
    }
    
    return true;
}

Semaphore* PMachineScheduler::getSemaphore(uint16_t semaphoreId) {
    auto it = semaphores_.find(semaphoreId);
    if (it == semaphores_.end()) {
        return nullptr;
    }
    return &(it->second);
}

bool PMachineScheduler::schedule() {
    // Select next context to run
    uint16_t nextId = selectNextContext();
    
    if (nextId == 0xFFFF) {
        // No ready contexts
        running_ = false;
        currentContextId_ = 0xFFFF;
        return false;
    }
    
    if (nextId != currentContextId_) {
        contextSwitch(nextId);
    }
    
    running_ = true;
    return true;
}

void PMachineScheduler::yield() {
    ExecutionContext* ctx = getCurrentContext();
    if (ctx) {
        ctx->state = ContextState::READY;
        addToReadyQueue(ctx->contextId);
        stats_.yields++;
    }
    
    schedule();
}

void PMachineScheduler::blockContext(uint16_t contextId, uint16_t semaphoreId, uint32_t timeoutMs) {
    auto it = contexts_.find(contextId);
    if (it == contexts_.end()) {
        return;
    }
    
    ExecutionContext& ctx = it->second;
    ctx.state = ContextState::BLOCKED;
    ctx.blockedOnSemaphore = semaphoreId;
    ctx.blockedUntilMs = (timeoutMs > 0) ? (currentTimeMs_ + timeoutMs) : 0;
    
    // If blocking current context, schedule next
    if (currentContextId_ == contextId) {
        currentContextId_ = 0xFFFF;
        schedule();
    }
}

void PMachineScheduler::unblockContext(uint16_t contextId) {
    auto it = contexts_.find(contextId);
    if (it == contexts_.end()) {
        return;
    }
    
    ExecutionContext& ctx = it->second;
    if (ctx.state == ContextState::BLOCKED) {
        ctx.state = ContextState::READY;
        ctx.blockedOnSemaphore = 0xFFFF;
        ctx.blockedUntilMs = 0;
        addToReadyQueue(contextId);
    }
}

void PMachineScheduler::executeQuantum(const std::vector<PInstruction>& instructions) {
    ExecutionContext* ctx = getCurrentContext();
    if (!ctx || ctx->state != ContextState::RUNNING) {
        return;
    }
    
    uint32_t instructionsExecuted = 0;
    
    while (instructionsExecuted < config_.quantum && ctx->state == ContextState::RUNNING) {
        // Check if PC is valid
        if (ctx->pc >= instructions.size()) {
            // End of program
            ctx->state = ContextState::TERMINATED;
            break;
        }
        
        // Execute instruction (this would be handled by PMachine::run)
        // For now, just increment PC and counters
        ctx->pc++;
        ctx->totalInstructions++;
        stats_.totalInstructions++;
        instructionsExecuted++;
        ctx->quantumRemaining--;
        
        // Check for quantum expiration
        if (config_.preemptionEnabled && ctx->quantumRemaining == 0) {
            ctx->quantumRemaining = config_.quantum;
            stats_.preemptions++;
            yield();
            break;
        }
    }
}

void PMachineScheduler::tick(uint32_t currentTimeMs) {
    currentTimeMs_ = currentTimeMs;
    checkTimedWaits(currentTimeMs);
}

void PMachineScheduler::addToReadyQueue(uint16_t contextId) {
    auto it = contexts_.find(contextId);
    if (it != contexts_.end() && it->second.state == ContextState::READY) {
        readyQueue_.push(contextId);
    }
}

uint16_t PMachineScheduler::selectNextContext() {
    switch (config_.algorithm) {
        case SchedulerConfig::Algorithm::ROUND_ROBIN:
            return selectRoundRobin();
        case SchedulerConfig::Algorithm::PRIORITY:
            return selectPriority();
        case SchedulerConfig::Algorithm::ROUND_ROBIN_PRIORITY:
            return selectRoundRobinPriority();
        default:
            return selectRoundRobin();
    }
}

void PMachineScheduler::contextSwitch(uint16_t newContextId) {
    // Save current context state
    if (currentContextId_ != 0xFFFF) {
        ExecutionContext* oldCtx = getContext(currentContextId_);
        if (oldCtx && oldCtx->state == ContextState::RUNNING) {
            oldCtx->state = ContextState::READY;
            addToReadyQueue(currentContextId_);
        }
    }
    
    // Load new context
    ExecutionContext* newCtx = getContext(newContextId);
    if (newCtx) {
        newCtx->state = ContextState::RUNNING;
        newCtx->quantumRemaining = config_.quantum;
        currentContextId_ = newContextId;
        stats_.contextSwitches++;
    }
}

void PMachineScheduler::checkTimedWaits(uint32_t currentTimeMs) {
    for (auto& pair : contexts_) {
        ExecutionContext& ctx = pair.second;
        if (ctx.state == ContextState::BLOCKED && 
            ctx.blockedUntilMs > 0 && 
            currentTimeMs >= ctx.blockedUntilMs) {
            // Timeout expired, unblock context
            unblockContext(ctx.contextId);
        }
    }
}

uint16_t PMachineScheduler::selectRoundRobin() {
    // Simple round-robin: take from ready queue
    while (!readyQueue_.empty()) {
        uint16_t contextId = readyQueue_.front();
        readyQueue_.pop();
        
        auto it = contexts_.find(contextId);
        if (it != contexts_.end() && it->second.state == ContextState::READY) {
            return contextId;
        }
    }
    
    return 0xFFFF; // No ready contexts
}

uint16_t PMachineScheduler::selectPriority() {
    // Priority-based: select highest priority ready context
    uint16_t bestId = 0xFFFF;
    uint8_t bestPriority = 0;
    
    for (const auto& pair : contexts_) {
        if (pair.second.state == ContextState::READY && 
            pair.second.priority > bestPriority) {
            bestId = pair.first;
            bestPriority = pair.second.priority;
        }
    }
    
    return bestId;
}

uint16_t PMachineScheduler::selectRoundRobinPriority() {
    // Round-robin within priority levels
    // Group contexts by priority and round-robin within each level
    std::map<uint8_t, std::vector<uint16_t>> priorityGroups;
    
    for (const auto& pair : contexts_) {
        if (pair.second.state == ContextState::READY) {
            priorityGroups[pair.second.priority].push_back(pair.first);
        }
    }
    
    if (priorityGroups.empty()) {
        return 0xFFFF;
    }
    
    // Select highest priority group
    auto highestPriorityGroup = priorityGroups.rbegin();
    
    // Round-robin within that group
    if (!highestPriorityGroup->second.empty()) {
        // Simple approach: return first in group
        // (In production, would maintain per-priority queues)
        return highestPriorityGroup->second[0];
    }
    
    return 0xFFFF;
}

std::string PMachineScheduler::getContextStateString(uint16_t contextId) const {
    const ExecutionContext* ctx = getContext(contextId);
    if (!ctx) {
        return "INVALID";
    }
    
    switch (ctx->state) {
        case ContextState::READY: return "READY";
        case ContextState::RUNNING: return "RUNNING";
        case ContextState::BLOCKED: return "BLOCKED";
        case ContextState::TERMINATED: return "TERMINATED";
        default: return "UNKNOWN";
    }
}

std::string PMachineScheduler::getSchedulerStatus() const {
    std::ostringstream oss;
    oss << "Scheduler Status:\n";
    oss << "  Running: " << (running_ ? "YES" : "NO") << "\n";
    oss << "  Current Context: " << currentContextId_ << "\n";
    oss << "  Total Contexts: " << contexts_.size() << "\n";
    oss << "  Ready Queue Size: " << readyQueue_.size() << "\n";
    oss << "  Semaphores: " << semaphores_.size() << "\n";
    oss << "\nStatistics:\n";
    oss << "  Context Switches: " << stats_.contextSwitches << "\n";
    oss << "  Total Instructions: " << stats_.totalInstructions << "\n";
    oss << "  Semaphore Waits: " << stats_.semaphoreWaits << "\n";
    oss << "  Semaphore Signals: " << stats_.semaphoreSignals << "\n";
    oss << "  Preemptions: " << stats_.preemptions << "\n";
    oss << "  Yields: " << stats_.yields << "\n";
    oss << "\nContexts:\n";
    
    for (const auto& pair : contexts_) {
        const ExecutionContext& ctx = pair.second;
        oss << "  [" << ctx.contextId << "] " << ctx.name 
            << " - State: " << getContextStateString(ctx.contextId)
            << ", PC: " << ctx.pc
            << ", Priority: " << (int)ctx.priority
            << ", Instructions: " << ctx.totalInstructions << "\n";
    }
    
    return oss.str();
}

} // namespace pmachine

// Made with Bob

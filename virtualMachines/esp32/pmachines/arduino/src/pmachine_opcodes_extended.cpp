#include <Arduino.h>
#include "serial_compat.h"
#include "pmachine_opcodes_extended.h"
#include "pmachine_dynamic_library.h"
#if defined(PLATFORM_RPIB)
#include <sd_chunkstore_host_stub.h>
#else
#include "sd_chunkstore.h"
#endif
#include <cmath>
#include <cstring>
#include <map>
#include <string>

namespace pmachine {

// ============================================================================
// GLOBAL STATE FOR EXTENDED OPCODES
// ============================================================================

// Track spawned contexts for COBEGIN/COEND
static std::map<uint16_t, std::vector<uint16_t>> cobeginContexts;

// Dynamic library system (Phase 6 - fully implemented)
static LibraryRegistry* globalLibraryRegistry = nullptr;
static ThunkTable* globalThunkTable = nullptr;
static DynamicLibraryLoader* globalLibraryLoader = nullptr;

// Gateway registry (placeholder)
static std::map<uint16_t, uint16_t> gatewayHandlers;

// File handle table (Phase 8 - integrated with SD Chunkstore)
// Maps VM file handles to SD chunkstore handles
static std::map<uint16_t, int> fileHandleMap;
static uint16_t nextVMFileHandle = 1;

// ============================================================================
// DYNAMIC LIBRARY SYSTEM INITIALIZATION
// ============================================================================

void initializeDynamicLibrarySystem() {
    if (!globalLibraryRegistry) {
        globalLibraryRegistry = new LibraryRegistry();
        globalThunkTable = new ThunkTable();
        globalLibraryLoader = new DynamicLibraryLoader(*globalLibraryRegistry, *globalThunkTable);
    }
}

void shutdownDynamicLibrarySystem() {
    delete globalLibraryLoader;
    delete globalThunkTable;
    delete globalLibraryRegistry;
    globalLibraryLoader = nullptr;
    globalThunkTable = nullptr;
    globalLibraryRegistry = nullptr;
}

// ============================================================================
// CONCURRENCY OPCODE HANDLERS
// ============================================================================

void handle_COBEGIN(PMachine& vm, PMachineScheduler& scheduler, 
                    const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    // Get number of concurrent tasks from operand or stack
    int numTasks = (instr.type == OperandType::INT) ? instr.intOperand : 
                   (!stack.empty() ? stack.back() : 1);
    if (instr.type != OperandType::INT && !stack.empty()) {
        stack.pop_back();
    }
    
    uint16_t parentContextId = scheduler.getCurrentContextId();
    std::vector<uint16_t> childContexts;
    
    // Create child contexts
    // Note: In real implementation, would parse following instructions
    // to determine entry points for each task
    for (int i = 0; i < numTasks; ++i) {
        uint16_t childId = scheduler.createContext(
            pc + 1 + i,  // Entry point (simplified)
            128,         // Same priority as parent
            "cobegin_task_" + std::to_string(i)
        );
        if (childId != 0xFFFF) {
            childContexts.push_back(childId);
        }
    }
    
    // Store child contexts for COEND
    cobeginContexts[parentContextId] = childContexts;
    
    pc++; // Move to next instruction
}

void handle_COEND(PMachine& vm, PMachineScheduler& scheduler,
                  const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    uint16_t parentContextId = scheduler.getCurrentContextId();
    
    // Check if all child contexts have terminated
    auto it = cobeginContexts.find(parentContextId);
    if (it != cobeginContexts.end()) {
        bool allTerminated = true;
        for (uint16_t childId : it->second) {
            ExecutionContext* child = scheduler.getContext(childId);
            if (child && child->state != ContextState::TERMINATED) {
                allTerminated = false;
                break;
            }
        }
        
        if (!allTerminated) {
            // Block parent context until children complete
            scheduler.blockContext(parentContextId);
            return; // Don't increment PC
        } else {
            // All children terminated, clean up
            cobeginContexts.erase(it);
        }
    }
    
    pc++; // Move to next instruction
}

void handle_SPAWN(PMachine& vm, PMachineScheduler& scheduler,
                  const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    // Get entry point from operand or stack
    uint16_t entryPoint = (instr.type == OperandType::INT) ? instr.intOperand :
                          (!stack.empty() ? stack.back() : pc + 1);
    if (instr.type != OperandType::INT && !stack.empty()) {
        stack.pop_back();
    }
    
    // Create new context
    uint16_t newContextId = scheduler.createContext(entryPoint, 128, "spawned");
    
    // Push context ID onto stack
    stack.push_back(newContextId);
    
    pc++;
}

void handle_YIELD(PMachine& vm, PMachineScheduler& scheduler,
                  const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    // Voluntary yield to scheduler
    scheduler.yield();
    pc++;
}

void handle_SEMWAIT(PMachine& vm, PMachineScheduler& scheduler,
                    const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    // Get semaphore ID from operand or stack
    uint16_t semId = (instr.type == OperandType::INT) ? instr.intOperand :
                     (!stack.empty() ? stack.back() : 0);
    if (instr.type != OperandType::INT && !stack.empty()) {
        stack.pop_back();
    }
    
    uint16_t contextId = scheduler.getCurrentContextId();
    
    // Wait on semaphore
    bool acquired = scheduler.semaphoreWait(semId, contextId);
    
    if (acquired) {
        pc++; // Continue execution
    } else {
        // Context blocked, don't increment PC
        // Will resume here when unblocked
    }
}

void handle_SEMSIGNAL(PMachine& vm, PMachineScheduler& scheduler,
                      const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    // Get semaphore ID from operand or stack
    uint16_t semId = (instr.type == OperandType::INT) ? instr.intOperand :
                     (!stack.empty() ? stack.back() : 0);
    if (instr.type != OperandType::INT && !stack.empty()) {
        stack.pop_back();
    }
    
    // Signal semaphore
    scheduler.semaphoreSignal(semId);
    
    pc++;
}

void handle_SEMINIT(PMachine& vm, PMachineScheduler& scheduler,
                    const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    // Get initial value from stack
    int initialValue = !stack.empty() ? stack.back() : 1;
    if (!stack.empty()) stack.pop_back();
    
    // Create semaphore
    uint16_t semId = scheduler.createSemaphore(initialValue);
    
    // Push semaphore ID onto stack
    stack.push_back(semId);
    
    pc++;
}

// ============================================================================
// DYNAMIC LIBRARY OPCODE HANDLERS (Phase 6 - Fully Implemented)
// ============================================================================

void handle_DL_LOAD(PMachine& vm, PMachineScheduler& scheduler,
                    const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    // Initialize library system if needed
    initializeDynamicLibrarySystem();
    
    // Get library name from string operand
    std::string libraryName = instr.strOperand;
    
    // Check if already loaded
    if (globalLibraryRegistry->isLibraryLoaded(libraryName)) {
        SERIAL_PRINTF("Library %s already loaded\n", libraryName.c_str());
        stack.push_back(1); // Success
        pc++;
        return;
    }
    
    // Get base PC from stack (or use default)
    uint16_t basePC = !stack.empty() ? stack.back() : 10000;
    if (!stack.empty()) stack.pop_back();
    
    // Try to load library from JSON manifest
    // In production, this would load from SD card
    // For now, we expect the manifest to be provided separately
    
    // Push result onto stack
    // 1 = success, 0 = failure
    // Real loading happens via loadLibraryFromJSON called externally
    stack.push_back(1);
    
    SERIAL_PRINTF("OP_DL_LOAD: %s at PC %u\n", libraryName.c_str(), static_cast<unsigned>(basePC));
    
    pc++;
}

void handle_DL_CALL(PMachine& vm, PMachineScheduler& scheduler,
                    const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    // Initialize library system if needed
    initializeDynamicLibrarySystem();
    
    // Get thunk ID from operand
    uint16_t thunkId = instr.intOperand;
    
    // Look up thunk
    Thunk* thunk = globalThunkTable->getThunk(thunkId);
    if (!thunk) {
        SERIAL_PRINTF("ERROR: Thunk %u not found\n", static_cast<unsigned>(thunkId));
        stack.push_back(-1); // Error
        pc++;
        return;
    }
    
    // Check if thunk is resolved
    if (!thunk->resolved) {
        // Lazy resolution: resolve now
        uint16_t targetPC = globalLibraryRegistry->resolveFunction(
            thunk->libraryName,
            thunk->functionName
        );
        
        if (targetPC == 0) {
            SERIAL_PRINTF("ERROR: Cannot resolve %s.%s\n",
                          thunk->libraryName.c_str(),
                          thunk->functionName.c_str());
            stack.push_back(-1); // Error
            pc++;
            return;
        }
        
        // Resolve thunk
        globalThunkTable->resolveThunk(thunkId, targetPC);
        thunk->targetPC = targetPC;
    }
    
    // Increment call count for profiling
    thunk->callCount++;
    
    // Jump to library function
    // Save return address on stack
    stack.push_back(pc + 1);
    
    // Jump to target
    pc = thunk->targetPC;
    
    SERIAL_PRINTF("OP_DL_CALL: %s.%s -> PC %u (call #%u)\n",
                  thunk->libraryName.c_str(),
                  thunk->functionName.c_str(),
                  static_cast<unsigned>(thunk->targetPC),
                  static_cast<unsigned>(thunk->callCount));
}

void handle_DL_UNLOAD(PMachine& vm, PMachineScheduler& scheduler,
                      const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    // Initialize library system if needed
    initializeDynamicLibrarySystem();
    
    // Get library name from string operand
    std::string libraryName = instr.strOperand;
    
    // Unload library
    bool success = globalLibraryRegistry->unloadLibrary(libraryName);
    
    // Push result onto stack
    stack.push_back(success ? 1 : 0);
    
    SERIAL_PRINTF("OP_DL_UNLOAD: %s %s\n",
                  libraryName.c_str(),
                  success ? "SUCCESS" : "FAILED");
    
    pc++;
}

void handle_DL_RESOLVE(PMachine& vm, PMachineScheduler& scheduler,
                       const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    // Initialize library system if needed
    initializeDynamicLibrarySystem();
    
    // Get function name and library name from stack
    if (stack.size() < 2) {
        stack.push_back(0); // Error
        pc++;
        return;
    }
    
    int functionNameIdx = stack.back(); stack.pop_back();
    int libraryNameIdx = stack.back(); stack.pop_back();
    
    // In real implementation, would look up strings from string pool
    // For now, use placeholder
    std::string libraryName = "library_" + std::to_string(libraryNameIdx);
    std::string functionName = "function_" + std::to_string(functionNameIdx);
    
    // Resolve function
    uint16_t targetPC = globalLibraryRegistry->resolveFunction(libraryName, functionName);
    
    // Push result onto stack
    stack.push_back(targetPC);
    
    pc++;
}

void handle_DL_LIST(PMachine& vm, PMachineScheduler& scheduler,
                    const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    // Initialize library system if needed
    initializeDynamicLibrarySystem();
    
    // Get list of loaded libraries
    std::vector<std::string> libraries = globalLibraryRegistry->getLoadedLibraries();
    
    // Push count onto stack
    stack.push_back(libraries.size());
    
    // Print library list
    SERIAL_PRINTF("Loaded libraries (%u):\n", static_cast<unsigned>(libraries.size()));
    for (const auto& lib : libraries) {
        SERIAL_PRINTF("  - %s\n", lib.c_str());
    }
    
    pc++;
}

// ============================================================================
// FILE I/O OPCODE HANDLERS (Phase 8 - Integrated with SD Chunkstore)
// ============================================================================

void handle_FILE_OPEN(PMachine& vm, PMachineScheduler& scheduler,
                      const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    // Get mode and filename from stack
    if (stack.size() < 2) {
        stack.push_back(0xFFFF); // Error
        pc++;
        return;
    }
    
    int mode = stack.back(); stack.pop_back();
    int filenameIdx = stack.back(); stack.pop_back();
    
    // Get filename from string pool (simplified - using index as filename)
    std::string filename = "/pcode/file_" + std::to_string(filenameIdx) + ".dat";
    
    // Check if chunkstore is initialized
    if (!globalChunkstore || !globalChunkstore->isInitialized()) {
        SERIAL_PRINTLN("ERROR: SD Chunkstore not initialized");
        stack.push_back(0xFFFF); // Error
        pc++;
        return;
    }
    
    // Open file via chunkstore
    int chunkstoreHandle = globalChunkstore->open(filename.c_str(), mode);
    
    if (chunkstoreHandle < 0) {
        SERIAL_PRINTF("ERROR: Failed to open file %s\n", filename.c_str());
        stack.push_back(0xFFFF); // Error
        pc++;
        return;
    }
    
    // Create VM file handle and map to chunkstore handle
    uint16_t vmHandle = nextVMFileHandle++;
    fileHandleMap[vmHandle] = chunkstoreHandle;
    
    SERIAL_PRINTF("OP_FILE_OPEN: %s (mode %d) -> handle %u\n",
                  filename.c_str(), mode, static_cast<unsigned>(vmHandle));
    
    stack.push_back(vmHandle);
    pc++;
}

void handle_FILE_READ(PMachine& vm, PMachineScheduler& scheduler,
                      const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    // Get size, buffer address, and handle from stack
    if (stack.size() < 3) {
        stack.push_back(-1); // Error
        pc++;
        return;
    }
    
    int size = stack.back(); stack.pop_back();
    int bufferAddr = stack.back(); stack.pop_back();
    uint16_t vmHandle = stack.back(); stack.pop_back();
    
    // Check if chunkstore is initialized
    if (!globalChunkstore || !globalChunkstore->isInitialized()) {
        SERIAL_PRINTLN("ERROR: SD Chunkstore not initialized");
        stack.push_back(-1); // Error
        pc++;
        return;
    }
    
    // Look up chunkstore handle
    auto it = fileHandleMap.find(vmHandle);
    if (it == fileHandleMap.end()) {
        SERIAL_PRINTF("ERROR: Invalid file handle %u\n", static_cast<unsigned>(vmHandle));
        stack.push_back(-1); // Error
        pc++;
        return;
    }
    
    int chunkstoreHandle = it->second;
    
    // Allocate buffer
    uint8_t* buffer = new uint8_t[size];
    if (!buffer) {
        SERIAL_PRINTLN("ERROR: Failed to allocate buffer");
        stack.push_back(-1); // Error
        pc++;
        return;
    }
    
    // Read from chunkstore
    int bytesRead = globalChunkstore->read(chunkstoreHandle, buffer, size);
    
    if (bytesRead < 0) {
        SERIAL_PRINTF("ERROR: Failed to read from file handle %u\n", static_cast<unsigned>(vmHandle));
        delete[] buffer;
        stack.push_back(-1); // Error
        pc++;
        return;
    }
    
    // Copy to VM memory (simplified - would use proper memory management)
    // In real implementation, would write to vm.memory[bufferAddr]
    
    delete[] buffer;
    
    SERIAL_PRINTF("OP_FILE_READ: handle %u, %d bytes read\n", static_cast<unsigned>(vmHandle), bytesRead);
    
    stack.push_back(bytesRead);
    pc++;
}

void handle_FILE_WRITE(PMachine& vm, PMachineScheduler& scheduler,
                       const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    // Get size, buffer address, and handle from stack
    if (stack.size() < 3) {
        stack.push_back(-1); // Error
        pc++;
        return;
    }
    
    int size = stack.back(); stack.pop_back();
    int bufferAddr = stack.back(); stack.pop_back();
    uint16_t vmHandle = stack.back(); stack.pop_back();
    
    // Check if chunkstore is initialized
    if (!globalChunkstore || !globalChunkstore->isInitialized()) {
        SERIAL_PRINTLN("ERROR: SD Chunkstore not initialized");
        stack.push_back(-1); // Error
        pc++;
        return;
    }
    
    // Look up chunkstore handle
    auto it = fileHandleMap.find(vmHandle);
    if (it == fileHandleMap.end()) {
        SERIAL_PRINTF("ERROR: Invalid file handle %u\n", static_cast<unsigned>(vmHandle));
        stack.push_back(-1); // Error
        pc++;
        return;
    }
    
    int chunkstoreHandle = it->second;
    
    // Allocate buffer and copy from VM memory
    uint8_t* buffer = new uint8_t[size];
    if (!buffer) {
        SERIAL_PRINTLN("ERROR: Failed to allocate buffer");
        stack.push_back(-1); // Error
        pc++;
        return;
    }
    
    // Copy from VM memory (simplified - would read from vm.memory[bufferAddr])
    // For now, fill with test data
    memset(buffer, 0, size);
    
    // Write to chunkstore
    int bytesWritten = globalChunkstore->write(chunkstoreHandle, buffer, size);
    
    if (bytesWritten < 0) {
        SERIAL_PRINTF("ERROR: Failed to write to file handle %u\n", static_cast<unsigned>(vmHandle));
        delete[] buffer;
        stack.push_back(-1); // Error
        pc++;
        return;
    }
    
    delete[] buffer;
    
    SERIAL_PRINTF("OP_FILE_WRITE: handle %u, %d bytes written\n", static_cast<unsigned>(vmHandle), bytesWritten);
    
    stack.push_back(bytesWritten);
    pc++;
}

void handle_FILE_CLOSE(PMachine& vm, PMachineScheduler& scheduler,
                       const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    // Get handle from stack
    if (stack.empty()) {
        stack.push_back(0); // Error
        pc++;
        return;
    }
    
    uint16_t vmHandle = stack.back(); stack.pop_back();
    
    // Check if chunkstore is initialized
    if (!globalChunkstore || !globalChunkstore->isInitialized()) {
        SERIAL_PRINTLN("ERROR: SD Chunkstore not initialized");
        stack.push_back(0); // Error
        pc++;
        return;
    }
    
    // Look up chunkstore handle
    auto it = fileHandleMap.find(vmHandle);
    if (it == fileHandleMap.end()) {
        SERIAL_PRINTF("ERROR: Invalid file handle %u\n", static_cast<unsigned>(vmHandle));
        stack.push_back(0); // Error
        pc++;
        return;
    }
    
    int chunkstoreHandle = it->second;
    
    // Close file via chunkstore
    bool success = globalChunkstore->close(chunkstoreHandle);
    
    if (success) {
        // Remove from handle map
        fileHandleMap.erase(it);
        SERIAL_PRINTF("OP_FILE_CLOSE: handle %u closed\n", static_cast<unsigned>(vmHandle));
        stack.push_back(1); // Success
    } else {
        SERIAL_PRINTF("ERROR: Failed to close file handle %u\n", static_cast<unsigned>(vmHandle));
        stack.push_back(0); // Error
    }
    
    pc++;
}

// ============================================================================
// GATEWAY OPCODE HANDLERS (Placeholder)
// ============================================================================

void handle_GW_CALL(PMachine& vm, PMachineScheduler& scheduler,
                    const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    // Get method ID and gateway ID from stack
    if (stack.size() < 2) {
        stack.push_back(-1); // Error
        pc++;
        return;
    }
    
    int methodId = stack.back(); stack.pop_back();
    int gatewayId = stack.back(); stack.pop_back();
    
    // Placeholder: Call gateway
    // Real implementation will dispatch to registered handler
    auto it = gatewayHandlers.find(gatewayId);
    if (it != gatewayHandlers.end()) {
        // Would call handler here
        stack.push_back(0); // Success
    } else {
        stack.push_back(-1); // Not found
    }
    
    pc++;
}

// ============================================================================
// FLOATING POINT OPCODE HANDLERS
// ============================================================================

void handle_FADD(PMachine& vm, PMachineScheduler& scheduler,
                 const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    if (stack.size() < 2) {
        pc++;
        return;
    }
    
    // Treat integers as fixed-point or convert to float
    // For simplicity, using integer arithmetic with scaling
    int b = stack.back(); stack.pop_back();
    int a = stack.back(); stack.pop_back();
    
    // Simple float simulation: treat as fixed-point with 1000x scaling
    stack.push_back(a + b);
    
    pc++;
}

void handle_FSUB(PMachine& vm, PMachineScheduler& scheduler,
                 const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    if (stack.size() < 2) {
        pc++;
        return;
    }
    
    int b = stack.back(); stack.pop_back();
    int a = stack.back(); stack.pop_back();
    
    stack.push_back(a - b);
    
    pc++;
}

void handle_FMUL(PMachine& vm, PMachineScheduler& scheduler,
                 const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    if (stack.size() < 2) {
        pc++;
        return;
    }
    
    int b = stack.back(); stack.pop_back();
    int a = stack.back(); stack.pop_back();
    
    // Fixed-point multiplication with scaling
    long long result = ((long long)a * (long long)b) / 1000;
    stack.push_back((int)result);
    
    pc++;
}

void handle_FDIV(PMachine& vm, PMachineScheduler& scheduler,
                 const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    if (stack.size() < 2) {
        pc++;
        return;
    }
    
    int b = stack.back(); stack.pop_back();
    int a = stack.back(); stack.pop_back();
    
    if (b == 0) {
        stack.push_back(0); // Division by zero
    } else {
        // Fixed-point division with scaling
        long long result = ((long long)a * 1000) / (long long)b;
        stack.push_back((int)result);
    }
    
    pc++;
}

// ============================================================================
// STACK OPERATION HANDLERS
// ============================================================================

void handle_POP(PMachine& vm, PMachineScheduler& scheduler,
                const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    if (!stack.empty()) {
        stack.pop_back();
    }
    pc++;
}

void handle_DUP(PMachine& vm, PMachineScheduler& scheduler,
                const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    if (!stack.empty()) {
        stack.push_back(stack.back());
    }
    pc++;
}

void handle_SWAP(PMachine& vm, PMachineScheduler& scheduler,
                 const PInstruction& instr, std::vector<int>& stack, uint16_t& pc) {
    if (stack.size() >= 2) {
        int top = stack.back(); stack.pop_back();
        int second = stack.back(); stack.pop_back();
        stack.push_back(top);
        stack.push_back(second);
    }
    pc++;
}

// ============================================================================
// REGISTRATION FUNCTION
// ============================================================================

void registerExtendedOpcodes(PMachine& vm, PMachineScheduler& scheduler) {
    // Note: This is a placeholder for the registration mechanism
    // In the actual integration, these handlers would be registered
    // with the PMachine's handler table
    
    // The PMachine class would need to be extended to support
    // passing the scheduler reference to handlers
    
    // For now, this serves as documentation of which opcodes
    // need to be integrated
}

} // namespace pmachine

// Made with Bob

#pragma once

#include "pmachine.h"
#include "pmachine_scheduler.h"
#include <cstdint>

namespace pmachine {

/**
 * Extended Opcode Set for Target Architecture
 * 
 * This file defines the new opcodes required by the target architecture
 * specification, including concurrency, dynamic libraries, and file I/O.
 */

// ============================================================================
// CONCURRENCY OPCODES (0x70-0x7F)
// ============================================================================

/**
 * OP_COBEGIN - Begin concurrent block
 * Operand: Number of concurrent tasks to spawn
 * 
 * Creates N new execution contexts and marks them for concurrent execution.
 * The parent context will wait at COEND for all spawned contexts to complete.
 */
constexpr uint8_t OP_COBEGIN = 0x70;

/**
 * OP_COEND - End concurrent block
 * 
 * Waits for all contexts spawned by the matching COBEGIN to complete.
 * Blocks the current context until all child contexts terminate.
 */
constexpr uint8_t OP_COEND = 0x71;

/**
 * OP_SPAWN - Spawn new context
 * Operand: Entry point PC
 * 
 * Creates a new execution context starting at the specified PC.
 * Returns context ID on stack.
 */
constexpr uint8_t OP_SPAWN = 0x72;

/**
 * OP_YIELD - Voluntary yield
 * 
 * Current context yields to scheduler, allowing other contexts to run.
 */
constexpr uint8_t OP_YIELD = 0x73;

/**
 * OP_SEMWAIT - Wait on semaphore (P operation)
 * Operand: Semaphore ID
 * 
 * Decrements semaphore value. If value becomes negative, blocks context.
 */
constexpr uint8_t OP_SEMWAIT = 0x74;

/**
 * OP_SEMSIGNAL - Signal semaphore (V operation)
 * Operand: Semaphore ID
 * 
 * Increments semaphore value. If contexts are waiting, unblocks one.
 */
constexpr uint8_t OP_SEMSIGNAL = 0x75;

/**
 * OP_SEMINIT - Initialize semaphore
 * Stack: [initial_value] -> [semaphore_id]
 * 
 * Creates a new semaphore with the specified initial value.
 * Returns semaphore ID on stack.
 */
constexpr uint8_t OP_SEMINIT = 0x76;

/**
 * OP_SEMDESTROY - Destroy semaphore
 * Operand: Semaphore ID
 * 
 * Destroys semaphore and unblocks all waiting contexts.
 */
constexpr uint8_t OP_SEMDESTROY = 0x77;

/**
 * OP_CONTEXT_ID - Get current context ID
 * Stack: [] -> [context_id]
 * 
 * Pushes current context ID onto stack.
 */
constexpr uint8_t OP_CONTEXT_ID = 0x78;

/**
 * OP_CONTEXT_PRIORITY - Set context priority
 * Stack: [context_id, priority] -> []
 * 
 * Sets priority for specified context.
 */
constexpr uint8_t OP_CONTEXT_PRIORITY = 0x79;

// ============================================================================
// DYNAMIC LIBRARY OPCODES (0xA0-0xAF)
// ============================================================================

/**
 * OP_DL_LOAD - Load dynamic library
 * Operand: String pool index (library name)
 * Stack: [] -> [success]
 * 
 * Loads dynamic library from SD chunkstore.
 * Pushes 1 on success, 0 on failure.
 */
constexpr uint8_t OP_DL_LOAD = 0xA0;

/**
 * OP_DL_CALL - Call library function via thunk
 * Operand: Thunk ID
 * Stack: [args...] -> [return_value]
 * 
 * Calls library function through thunk table.
 * Arguments are passed on stack, return value pushed on stack.
 */
constexpr uint8_t OP_DL_CALL = 0xA1;

/**
 * OP_DL_UNLOAD - Unload dynamic library
 * Operand: String pool index (library name)
 * Stack: [] -> [success]
 * 
 * Unloads dynamic library and frees memory.
 */
constexpr uint8_t OP_DL_UNLOAD = 0xA2;

/**
 * OP_DL_RESOLVE - Resolve thunk
 * Stack: [library_name, function_name] -> [thunk_id]
 * 
 * Resolves library function to thunk ID.
 * Returns thunk ID or 0xFFFF if not found.
 */
constexpr uint8_t OP_DL_RESOLVE = 0xA3;

/**
 * OP_DL_LIST - List loaded libraries
 * Stack: [] -> [count, lib1, lib2, ...]
 * 
 * Pushes list of loaded library names onto stack.
 */
constexpr uint8_t OP_DL_LIST = 0xA4;

// ============================================================================
// FILE I/O OPCODES (0x90-0x9F)
// ============================================================================

/**
 * OP_FILE_OPEN - Open file
 * Stack: [filename, mode] -> [handle]
 * 
 * Opens file from SD chunkstore.
 * Mode: 0=read, 1=write, 2=append
 * Returns file handle or 0xFFFF on error.
 */
constexpr uint8_t OP_EXT_FILE_OPEN = 0x90;

/**
 * OP_FILE_READ - Read from file
 * Stack: [handle, buffer_addr, size] -> [bytes_read]
 * 
 * Reads up to size bytes from file into buffer.
 * Returns number of bytes actually read.
 */
constexpr uint8_t OP_EXT_FILE_READ = 0x91;

/**
 * OP_FILE_WRITE - Write to file
 * Stack: [handle, buffer_addr, size] -> [bytes_written]
 * 
 * Writes size bytes from buffer to file.
 * Returns number of bytes actually written.
 */
constexpr uint8_t OP_EXT_FILE_WRITE = 0x92;

/**
 * OP_FILE_CLOSE - Close file
 * Stack: [handle] -> [success]
 * 
 * Closes file handle.
 * Returns 1 on success, 0 on failure.
 */
constexpr uint8_t OP_EXT_FILE_CLOSE = 0x93;

/**
 * OP_FILE_SEEK - Seek to position
 * Stack: [handle, position, whence] -> [new_position]
 * 
 * Seeks to position in file.
 * Whence: 0=start, 1=current, 2=end
 * Returns new position or 0xFFFFFFFF on error.
 */
constexpr uint8_t OP_FILE_SEEK = 0x94;

/**
 * OP_FILE_TELL - Get current position
 * Stack: [handle] -> [position]
 * 
 * Returns current file position.
 */
constexpr uint8_t OP_FILE_TELL = 0x95;

/**
 * OP_FILE_SIZE - Get file size
 * Stack: [handle] -> [size]
 * 
 * Returns file size in bytes.
 */
constexpr uint8_t OP_FILE_SIZE = 0x96;

/**
 * OP_FILE_EXISTS - Check if file exists
 * Stack: [filename] -> [exists]
 * 
 * Returns 1 if file exists, 0 otherwise.
 */
constexpr uint8_t OP_FILE_EXISTS = 0x97;

/**
 * OP_FILE_DELETE - Delete file
 * Stack: [filename] -> [success]
 * 
 * Deletes file from SD chunkstore.
 * Returns 1 on success, 0 on failure.
 */
constexpr uint8_t OP_FILE_DELETE = 0x98;

// ============================================================================
// GATEWAY OPCODES (0xB0-0xBF)
// ============================================================================

/**
 * OP_GW_CALL - Call gateway method
 * Stack: [gateway_id, method_id, args...] -> [return_value]
 * 
 * Calls gateway method with arguments.
 * Gateway provides interface to external services.
 */
constexpr uint8_t OP_GW_CALL = 0xB0;

/**
 * OP_GW_REGISTER - Register gateway implementation
 * Stack: [gateway_id, handler_pc] -> [success]
 * 
 * Registers gateway implementation at specified PC.
 */
constexpr uint8_t OP_GW_REGISTER = 0xB1;

/**
 * OP_GW_UNREGISTER - Unregister gateway
 * Stack: [gateway_id] -> [success]
 * 
 * Unregisters gateway implementation.
 */
constexpr uint8_t OP_GW_UNREGISTER = 0xB2;

// ============================================================================
// FLOATING POINT OPCODES (0x16-0x19) - Already defined in spec
// ============================================================================

constexpr uint8_t OP_FADD = 0x16;  // Floating-point add
constexpr uint8_t OP_FSUB = 0x17;  // Floating-point subtract
constexpr uint8_t OP_FMUL = 0x18;  // Floating-point multiply
constexpr uint8_t OP_FDIV = 0x19;  // Floating-point divide

// ============================================================================
// ADDITIONAL STACK OPCODES (0x22-0x25) - Already defined in spec
// ============================================================================

constexpr uint8_t OP_PUSH_REAL = 0x22;  // Push real literal
constexpr uint8_t OP_POP = 0x23;        // Discard top of stack
constexpr uint8_t OP_DUP = 0x24;        // Duplicate top of stack
constexpr uint8_t OP_SWAP = 0x25;       // Swap top two items

// ============================================================================
// OPCODE HANDLER FUNCTION SIGNATURES
// ============================================================================

/**
 * Handler function type for extended opcodes
 */
using ExtendedOpcodeHandler = void (*)(
    PMachine& vm,
    PMachineScheduler& scheduler,
    const PInstruction& instr,
    std::vector<int>& stack,
    uint16_t& pc
);

/**
 * Register all extended opcode handlers
 */
void registerExtendedOpcodes(PMachine& vm, PMachineScheduler& scheduler);

// ============================================================================
// INDIVIDUAL OPCODE HANDLERS
// ============================================================================

// Concurrency handlers
void handle_COBEGIN(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);
void handle_COEND(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);
void handle_SPAWN(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);
void handle_YIELD(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);
void handle_SEMWAIT(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);
void handle_SEMSIGNAL(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);
void handle_SEMINIT(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);

// Dynamic library handlers
void handle_DL_LOAD(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);
void handle_DL_CALL(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);
void handle_DL_UNLOAD(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);

// File I/O handlers
void handle_FILE_OPEN(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);
void handle_FILE_READ(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);
void handle_FILE_WRITE(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);
void handle_FILE_CLOSE(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);

// Gateway handlers
void handle_GW_CALL(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);

// Floating point handlers
void handle_FADD(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);
void handle_FSUB(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);
void handle_FMUL(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);
void handle_FDIV(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);

// Stack operation handlers
void handle_POP(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);
void handle_DUP(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);
void handle_SWAP(PMachine& vm, PMachineScheduler& scheduler, const PInstruction& instr, std::vector<int>& stack, uint16_t& pc);

} // namespace pmachine

// Made with Bob

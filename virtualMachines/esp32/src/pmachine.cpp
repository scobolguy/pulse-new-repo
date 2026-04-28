#include "ffs/FederatedFileSystem.h"

// pmachine.cpp
// ESPVM Portable P Machine - Implementation
#include "pmachine.h"
#include <algorithm>

namespace pmachine {
// StringPool implementation
uint16_t StringPool::add(const std::string& str) {
    for (uint16_t i = 0; i < pool.size(); ++i) {
        if (pool[i] == str) return i;
    }
    pool.push_back(str);
    return pool.size() - 1;
}

const std::string& StringPool::get(uint16_t idx) const {
    return pool.at(idx);
}

std::vector<std::string> StringPool::getAll() const {
    return pool;
}

// PMachine implementation
PMachine::PMachine() {
    // ffs pointer must be set externally after construction
    // Example: populate enumTypes
    enumTypes["TYPE_INT"] = static_cast<int>(GlobalType::TYPE_INT);
    enumTypes["TYPE_FLOAT"] = static_cast<int>(GlobalType::TYPE_FLOAT);
    enumTypes["TYPE_STRING"] = static_cast<int>(GlobalType::TYPE_STRING);
    enumTypes["TYPE_BOOL"] = static_cast<int>(GlobalType::TYPE_BOOL);
    // Example: populate string pool
    stringPool.add("example");
    // Example: populate pcode and memory map
    pcodeMap[0] = 0x01;
    memoryMap[0] = 0xDEADBEEF;
    // Example: status fields
    numPages = 1;
    backingFile = "/pmachine.bin";
    maxSpace = 4096;
    dynamicLibs = {"libmath", "libio"};
    running = false;
    pc = 0;
    breakpoints.clear();
}

int PMachine::openFile(const String &logicalName, const String &mode) {
    if (!ffs) return 0;
    return ffs->openFile(logicalName, mode);
}

bool PMachine::closeFile(int handle) {
    if (!ffs) return false;
    return ffs->closeFile(handle);
}

bool PMachine::readLine(int handle, String &outLine) {
    if (!ffs) return false;
    return ffs->readLine(handle, outLine);
}

bool PMachine::writeLine(int handle, const String &line) {
    if (!ffs) return false;
    return ffs->writeLine(handle, line);
}
pmachine::Status PMachine::getStatus() const {
    Status s;
    s.numPages = numPages;
    s.backingFile = backingFile;
    s.maxSpace = maxSpace;
    s.dynamicLibs = dynamicLibs;
    s.running = running;
    s.pc = pc;
    s.breakpoints = breakpoints;
    return s;
}

bool PMachine::loadProgram(const std::vector<uint8_t>& pcode, const std::string& backingFile_, size_t maxSpace_) {
    pcodeMap.clear();
    for (size_t i = 0; i < pcode.size(); ++i) {
        pcodeMap[(uint16_t)i] = pcode[i];
    }
    backingFile = backingFile_;
    maxSpace = maxSpace_;
    numPages = (maxSpace_ + 255) / 256;
    pc = 0;
    running = false;
    return true;
}

void PMachine::run() {
    running = true;
    // Simulate execution (stub)
    while (pc < pcodeMap.size() &&
           std::find(breakpoints.begin(), breakpoints.end(), pc) == breakpoints.end()) {
        // ... execute instruction ...
        ++pc;
    }
    running = false;
}

void PMachine::singleStep() {
    running = true;
    if (pc < pcodeMap.size()) {
        // ... execute instruction ...
        ++pc;
    }
    running = false;
}

void PMachine::setBreakpoint(uint16_t pc_) {
    if (std::find(breakpoints.begin(), breakpoints.end(), pc_) == breakpoints.end())
        breakpoints.push_back(pc_);
}

void PMachine::clearBreakpoint(uint16_t pc_) {
    breakpoints.erase(std::remove(breakpoints.begin(), breakpoints.end(), pc_), breakpoints.end());
}

void PMachine::clearAllBreakpoints() {
    breakpoints.clear();
}

const PCodeMap& PMachine::getPCodeMap() const {
    return pcodeMap;
}

const MemoryMap& PMachine::getMemoryMap() const {
    return memoryMap;
}

const std::vector<std::string> PMachine::getStringPool() const {
    return stringPool.getAll();
}

std::map<std::string, int> PMachine::getEnumTypes() const {
    return enumTypes;
}

} // namespace pmachine

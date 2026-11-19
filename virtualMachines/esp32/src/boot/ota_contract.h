#pragma once

#include <stddef.h>
#include <stdint.h>
#include <string.h>

namespace pulse {
namespace ota {
namespace contract {

constexpr size_t kEnvelopeHeaderSize = 100;
constexpr size_t kEnvelopeSignatureSize = 256;
constexpr uint8_t kEnvelopeVersion = 1;
constexpr uint8_t kSignatureRsaSha256 = 1;
constexpr uint8_t kFirmwareImage = 1;
constexpr uint8_t kBootFilesystemImage = 2;
constexpr size_t kIdentitySize = 16;
constexpr size_t kDigestSize = 32;

struct EnvelopeHeader {
    uint8_t kind;
    char board[kIdentitySize];
    char runtimeAbi[kIdentitySize];
    char pairId[kIdentitySize];
    uint32_t version;
    uint32_t payloadSize;
    uint8_t digest[kDigestSize];
    uint16_t signatureSize;
};

struct SlotState {
    uint8_t activeBoot;
    uint8_t activeFirmware;
    uint8_t pendingBoot;
    uint8_t pendingFirmware;
    bool pendingTrial;
    bool stagedBoot;
    bool stagedFirmware;
    uint8_t stagedBootSlot;
    uint8_t stagedFirmwareSlot;
    char activePair[kIdentitySize];
    char pendingPair[kIdentitySize];
    char stagedBootPair[kIdentitySize];
    char stagedFirmwarePair[kIdentitySize];
};

inline uint16_t readU16(const uint8_t* bytes) {
    return static_cast<uint16_t>((static_cast<uint16_t>(bytes[0]) << 8) | bytes[1]);
}

inline uint32_t readU32(const uint8_t* bytes) {
    return (static_cast<uint32_t>(bytes[0]) << 24) |
           (static_cast<uint32_t>(bytes[1]) << 16) |
           (static_cast<uint32_t>(bytes[2]) << 8) |
           static_cast<uint32_t>(bytes[3]);
}

inline bool identityEquals(const char* lhs, const char* rhs) {
    return memcmp(lhs, rhs, kIdentitySize) == 0;
}

inline bool identityIsEmpty(const char* identity) {
    for (size_t i = 0; i < kIdentitySize; ++i) {
        if (identity[i] != '\0') return false;
    }
    return true;
}

inline bool seedOrValidateFactoryPair(char activePair[kIdentitySize],
                                      const char* marker, size_t length) {
    if (marker == nullptr || length == 0 || length >= kIdentitySize) return false;
    char pair[kIdentitySize] = {};
    for (size_t i = 0; i < length; ++i) {
        const char ch = marker[i];
        const bool alphanumeric = (ch >= 'A' && ch <= 'Z') ||
                                  (ch >= 'a' && ch <= 'z') ||
                                  (ch >= '0' && ch <= '9');
        if (!alphanumeric && (i == 0 || (ch != '.' && ch != '_' && ch != '-'))) {
            return false;
        }
        pair[i] = ch;
    }
    if (!identityIsEmpty(activePair)) return identityEquals(activePair, pair);
    memcpy(activePair, pair, kIdentitySize);
    return true;
}

template <typename State, typename Persist>
bool persistOrRestore(State& working, State& durable, Persist persist) {
    if (!persist(working)) {
        working = durable;
        return false;
    }
    durable = working;
    return true;
}

template <typename TryLock, typename Unlock>
class ScopedTryLock {
public:
    ScopedTryLock(TryLock tryLock, Unlock unlock)
        : unlock_(unlock), acquired_(tryLock()) {}
    ~ScopedTryLock() { if (acquired_) unlock_(); }
    explicit operator bool() const { return acquired_; }
    ScopedTryLock(const ScopedTryLock&) = delete;
    ScopedTryLock& operator=(const ScopedTryLock&) = delete;
private:
    Unlock unlock_;
    bool acquired_;
};

inline bool parseEnvelopeHeader(const uint8_t* bytes, size_t size, EnvelopeHeader& out) {
    if (bytes == nullptr || size < kEnvelopeHeaderSize ||
        memcmp(bytes, "POTA", 4) != 0 ||
        bytes[4] != kEnvelopeVersion ||
        (bytes[5] != kFirmwareImage && bytes[5] != kBootFilesystemImage) ||
        bytes[6] != kSignatureRsaSha256 ||
        bytes[7] != 0 ||
        readU16(bytes + 96) != kEnvelopeSignatureSize ||
        readU16(bytes + 98) != 0) {
        return false;
    }

    out.kind = bytes[5];
    memcpy(out.board, bytes + 8, kIdentitySize);
    memcpy(out.runtimeAbi, bytes + 24, kIdentitySize);
    memcpy(out.pairId, bytes + 40, kIdentitySize);
    out.version = readU32(bytes + 56);
    out.payloadSize = readU32(bytes + 60);
    memcpy(out.digest, bytes + 64, kDigestSize);
    out.signatureSize = readU16(bytes + 96);
    return out.version != 0 && out.payloadSize != 0 && !identityIsEmpty(out.pairId);
}

inline bool envelopeSizeMatches(const EnvelopeHeader& header, size_t requestSize) {
    const uint64_t expected = static_cast<uint64_t>(kEnvelopeHeaderSize) +
                              header.signatureSize + header.payloadSize;
    return expected == requestSize;
}

inline bool targetIdentityMatches(const EnvelopeHeader& header,
                                  const char* board,
                                  const char* runtimeAbi) {
    char expectedBoard[kIdentitySize] = {};
    char expectedAbi[kIdentitySize] = {};
    const size_t boardLength = strlen(board);
    const size_t abiLength = strlen(runtimeAbi);
    if (boardLength > kIdentitySize || abiLength > kIdentitySize) return false;
    memcpy(expectedBoard, board, boardLength);
    memcpy(expectedAbi, runtimeAbi, abiLength);
    return memcmp(header.board, expectedBoard, kIdentitySize) == 0 &&
           memcmp(header.runtimeAbi, expectedAbi, kIdentitySize) == 0;
}

inline bool pairMatches(const char* lhs, const char* rhs) {
    return !identityIsEmpty(lhs) && !identityIsEmpty(rhs) && identityEquals(lhs, rhs);
}

inline bool digestMatches(const uint8_t expected[kDigestSize],
                          const uint8_t actual[kDigestSize]) {
    uint8_t difference = 0;
    for (size_t i = 0; i < kDigestSize; ++i) difference |= expected[i] ^ actual[i];
    return difference == 0;
}

inline bool canCommit(const SlotState& state, bool firmwareAvailable, bool bootAvailable) {
    if (state.pendingTrial) return false;
    if (!firmwareAvailable && !bootAvailable) return false;
    if (firmwareAvailable && !state.stagedFirmware) return false;
    if (bootAvailable && !state.stagedBoot) return false;
    if (firmwareAvailable &&
        (state.stagedFirmwareSlot >= 2 ||
         state.stagedFirmwareSlot == state.activeFirmware)) return false;
    if (bootAvailable &&
        (state.stagedBootSlot >= 2 || state.stagedBootSlot == state.activeBoot)) return false;

    const char* firmwarePair = firmwareAvailable ? state.stagedFirmwarePair : state.activePair;
    const char* bootPair = bootAvailable ? state.stagedBootPair : state.activePair;
    if (identityIsEmpty(firmwarePair) || identityIsEmpty(bootPair)) return false;
    if (identityEquals(firmwarePair, bootPair)) return true;

    return false;
}

inline bool prepareTrial(SlotState& state, bool firmwareAvailable, bool bootAvailable) {
    if (!canCommit(state, firmwareAvailable, bootAvailable)) return false;
    const char* pair = firmwareAvailable ? state.stagedFirmwarePair : state.stagedBootPair;
    state.pendingBoot = bootAvailable ? state.stagedBootSlot : state.activeBoot;
    state.pendingFirmware = firmwareAvailable ? state.stagedFirmwareSlot : state.activeFirmware;
    memcpy(state.pendingPair, pair, kIdentitySize);
    state.pendingTrial = true;
    return true;
}

inline void rejectTrial(SlotState& state) {
    state.pendingTrial = false;
    state.pendingBoot = 0xff;
    state.pendingFirmware = 0xff;
    state.stagedBoot = false;
    state.stagedFirmware = false;
    state.stagedBootSlot = 0xff;
    state.stagedFirmwareSlot = 0xff;
    memset(state.pendingPair, 0, sizeof(state.pendingPair));
    memset(state.stagedBootPair, 0, sizeof(state.stagedBootPair));
    memset(state.stagedFirmwarePair, 0, sizeof(state.stagedFirmwarePair));
}

inline bool confirmTrial(SlotState& state) {
    if (!state.pendingTrial) return false;
    state.activeBoot = state.pendingBoot;
    state.activeFirmware = state.pendingFirmware;
    memcpy(state.activePair, state.pendingPair, kIdentitySize);
    rejectTrial(state);
    return true;
}

inline bool trialSelectedByStartup(const SlotState& state, bool startupSelectedTrial,
                                   uint8_t mountedBootSlot, uint8_t runningFirmwareSlot) {
    return startupSelectedTrial && state.pendingTrial &&
           mountedBootSlot < 2 && runningFirmwareSlot < 2 &&
           mountedBootSlot == state.pendingBoot &&
           runningFirmwareSlot == state.pendingFirmware;
}

inline bool mustRestoreDurableFirmware(bool pendingTrial, uint8_t activeFirmware,
                                       uint8_t runningFirmware) {
    return !pendingTrial && activeFirmware < 2 && activeFirmware != runningFirmware;
}

inline bool isSecondUnconfirmedTrialBoot(uint8_t priorAttempts) {
    return priorAttempts >= 1;
}

inline bool canWriteBootSlot(uint8_t targetSlot, uint8_t activeSlot) {
    return targetSlot < 2 && activeSlot < 2 && targetSlot != activeSlot;
}

}  // namespace contract
}  // namespace ota
}  // namespace pulse

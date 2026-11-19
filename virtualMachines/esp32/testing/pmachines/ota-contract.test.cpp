#include "../../src/boot/ota_contract.h"

#include <cassert>
#include <cstdint>
#include <cstring>

namespace {

using pulse::ota::contract::EnvelopeHeader;
using pulse::ota::contract::SlotState;

void putU16(uint8_t* output, uint16_t value) {
    output[0] = static_cast<uint8_t>(value >> 8);
    output[1] = static_cast<uint8_t>(value);
}

void putU32(uint8_t* output, uint32_t value) {
    output[0] = static_cast<uint8_t>(value >> 24);
    output[1] = static_cast<uint8_t>(value >> 16);
    output[2] = static_cast<uint8_t>(value >> 8);
    output[3] = static_cast<uint8_t>(value);
}

void putIdentity(uint8_t* output, const char* text) {
    memset(output, 0, pulse::ota::contract::kIdentitySize);
    memcpy(output, text, strlen(text));
}

bool identityIs(const char identity[pulse::ota::contract::kIdentitySize],
                const char* text) {
    char expected[pulse::ota::contract::kIdentitySize] = {};
    if (strlen(text) > sizeof(expected)) return false;
    memcpy(expected, text, strlen(text));
    return pulse::ota::contract::identityEquals(identity, expected);
}

void makeHeader(uint8_t* header) {
    memset(header, 0, pulse::ota::contract::kEnvelopeHeaderSize);
    memcpy(header, "POTA", 4);
    header[4] = pulse::ota::contract::kEnvelopeVersion;
    header[5] = pulse::ota::contract::kFirmwareImage;
    header[6] = pulse::ota::contract::kSignatureRsaSha256;
    putIdentity(header + 8, "esp32s3-pulse");
    putIdentity(header + 24, "pmachine-v1");
    putIdentity(header + 40, "release-42");
    putU32(header + 56, 42);
    putU32(header + 60, 900);
    putU16(header + 96, pulse::ota::contract::kEnvelopeSignatureSize);
}

void testEnvelopeValidation() {
    uint8_t bytes[pulse::ota::contract::kEnvelopeHeaderSize] = {};
    makeHeader(bytes);
    EnvelopeHeader header = {};
    assert(pulse::ota::contract::parseEnvelopeHeader(bytes, sizeof(bytes), header));
    assert(header.kind == pulse::ota::contract::kFirmwareImage);
    assert(header.version == 42);
    assert(header.payloadSize == 900);
    assert(pulse::ota::contract::targetIdentityMatches(
        header, "esp32s3-pulse", "pmachine-v1"));
    assert(!pulse::ota::contract::targetIdentityMatches(
        header, "other-board", "pmachine-v1"));
    assert(pulse::ota::contract::envelopeSizeMatches(header, 100 + 256 + 900));
    assert(!pulse::ota::contract::envelopeSizeMatches(header, 100 + 256 + 899));

    bytes[0] = 'X';
    assert(!pulse::ota::contract::parseEnvelopeHeader(bytes, sizeof(bytes), header));
    makeHeader(bytes);
    bytes[4] = 2;
    assert(!pulse::ota::contract::parseEnvelopeHeader(bytes, sizeof(bytes), header));
    makeHeader(bytes);
    bytes[6] = 0;
    assert(!pulse::ota::contract::parseEnvelopeHeader(bytes, sizeof(bytes), header));
    makeHeader(bytes);
    putU16(bytes + 96, 255);
    assert(!pulse::ota::contract::parseEnvelopeHeader(bytes, sizeof(bytes), header));
    makeHeader(bytes);
    putU32(bytes + 56, 0);
    assert(!pulse::ota::contract::parseEnvelopeHeader(bytes, sizeof(bytes), header));

    uint8_t expected[pulse::ota::contract::kDigestSize] = {};
    uint8_t actual[pulse::ota::contract::kDigestSize] = {};
    assert(pulse::ota::contract::digestMatches(expected, actual));
    actual[17] = 1;
    assert(!pulse::ota::contract::digestMatches(expected, actual));
}

void testInterruptedAndAbortedUpdatesDoNotPublish() {
    SlotState state = {};
    state.activeBoot = 0;
    state.activeFirmware = 0;
    putIdentity(reinterpret_cast<uint8_t*>(state.activePair), "release-old");
    state.stagedBootSlot = 1;
    state.stagedFirmwareSlot = 1;
    putIdentity(reinterpret_cast<uint8_t*>(state.stagedBootPair), "release-new");
    putIdentity(reinterpret_cast<uint8_t*>(state.stagedFirmwarePair), "release-new");

    // Neither half is durably staged after an interrupted transfer.
    assert(!pulse::ota::contract::prepareTrial(state, false, false));
    assert(state.activeBoot == 0 && state.activeFirmware == 0);
    assert(!state.pendingTrial);

    // Aborting a staged bundle clears it without publishing either slot.
    state.stagedBoot = true;
    state.stagedFirmware = true;
    assert(pulse::ota::contract::prepareTrial(state, true, true));
    pulse::ota::contract::rejectTrial(state);
    assert(state.activeBoot == 0 && state.activeFirmware == 0);
    assert(!state.pendingTrial && !state.stagedBoot && !state.stagedFirmware);
    assert(identityIs(state.activePair, "release-old"));
}

void testPairTrialRollbackAndConfirmation() {
    SlotState state = {};
    state.activeBoot = 0;
    state.activeFirmware = 0;
    putIdentity(reinterpret_cast<uint8_t*>(state.activePair), "release-old");
    state.stagedBoot = true;
    state.stagedFirmware = true;
    state.stagedBootSlot = 1;
    state.stagedFirmwareSlot = 1;
    putIdentity(reinterpret_cast<uint8_t*>(state.stagedBootPair), "release-new");
    putIdentity(reinterpret_cast<uint8_t*>(state.stagedFirmwarePair), "release-new");

    assert(pulse::ota::contract::prepareTrial(state, true, true));
    assert(state.pendingTrial && state.pendingBoot == 1 && state.pendingFirmware == 1);
    pulse::ota::contract::rejectTrial(state);
    assert(state.activeBoot == 0 && state.activeFirmware == 0);
    assert(identityIs(state.activePair, "release-old"));

    state.stagedBoot = true;
    state.stagedFirmware = true;
    state.stagedBootSlot = 1;
    state.stagedFirmwareSlot = 1;
    putIdentity(reinterpret_cast<uint8_t*>(state.stagedBootPair), "release-new");
    putIdentity(reinterpret_cast<uint8_t*>(state.stagedFirmwarePair), "release-new");
    assert(pulse::ota::contract::prepareTrial(state, true, true));
    assert(pulse::ota::contract::confirmTrial(state));
    assert(state.activeBoot == 1 && state.activeFirmware == 1);
    assert(identityIs(state.activePair, "release-new"));
    assert(!state.pendingTrial);
}

void testSlotAndRetryGuards() {
    assert(pulse::ota::contract::canWriteBootSlot(1, 0));
    assert(!pulse::ota::contract::canWriteBootSlot(0, 0));
    assert(!pulse::ota::contract::canWriteBootSlot(2, 0));
    assert(!pulse::ota::contract::isSecondUnconfirmedTrialBoot(0));
    assert(pulse::ota::contract::isSecondUnconfirmedTrialBoot(1));

    SlotState state = {};
    state.activeBoot = 0;
    state.activeFirmware = 0;
    state.stagedFirmware = true;
    state.stagedFirmwareSlot = 1;
    putIdentity(reinterpret_cast<uint8_t*>(state.activePair), "release-old");
    putIdentity(reinterpret_cast<uint8_t*>(state.stagedFirmwarePair), "release-new");
    assert(!pulse::ota::contract::prepareTrial(state, true, false));

    state.activePair[0] = '\0';
    putIdentity(reinterpret_cast<uint8_t*>(state.stagedFirmwarePair), "release-old");
    state.stagedFirmwareSlot = 0;
    assert(!pulse::ota::contract::prepareTrial(state, true, false));
}

void testFactoryPairAllowsFirstBootFsOnlyTrial() {
    SlotState state = {};
    state.activeBoot = 0;
    state.activeFirmware = 0;
    state.stagedBoot = true;
    state.stagedBootSlot = 1;
    putIdentity(reinterpret_cast<uint8_t*>(state.stagedBootPair), "factory-abi1");
    assert(!pulse::ota::contract::canCommit(state, false, true));
    assert(!pulse::ota::contract::seedOrValidateFactoryPair(state.activePair, "", 0));
    assert(!pulse::ota::contract::seedOrValidateFactoryPair(state.activePair, "../bad", 6));
    assert(pulse::ota::contract::identityIsEmpty(state.activePair));
    assert(pulse::ota::contract::seedOrValidateFactoryPair(
        state.activePair, "factory-abi1", 12));
    assert(pulse::ota::contract::canCommit(state, false, true));
    assert(!pulse::ota::contract::seedOrValidateFactoryPair(
        state.activePair, "different", 9));
    assert(identityIs(state.activePair, "factory-abi1"));
    putIdentity(reinterpret_cast<uint8_t*>(state.stagedBootPair), "different");
    assert(!pulse::ota::contract::canCommit(state, false, true));
    putIdentity(reinterpret_cast<uint8_t*>(state.stagedBootPair), "factory-abi1");
    assert(pulse::ota::contract::prepareTrial(state, false, true));
    assert(state.pendingBoot == 1 && state.pendingFirmware == 0);
}

void testFailedPersistenceRetainsTrialAndLastGoodSlotUntilDurableRetry() {
    SlotState working = {};
    working.activeBoot = 0;
    working.activeFirmware = 0;
    working.stagedBoot = true;
    working.stagedBootSlot = 1;
    putIdentity(reinterpret_cast<uint8_t*>(working.activePair), "factory");
    putIdentity(reinterpret_cast<uint8_t*>(working.stagedBootPair), "factory");
    assert(pulse::ota::contract::prepareTrial(working, false, true));
    SlotState durable = working;
    SlotState storage = durable;
    int attempts = 0;
    auto failingStore = [&](const SlotState& candidate) {
        ++attempts;
        // The confirmation candidate would expose the old slot for reuse.
        assert(candidate.activeBoot == 1 && !candidate.pendingTrial);
        return false;
    };
    for (int failure = 0; failure < 2; ++failure) {
        assert(pulse::ota::contract::confirmTrial(working));
        assert(!pulse::ota::contract::persistOrRestore(working, durable, failingStore));
        assert(working.pendingTrial && working.activeBoot == 0);
        assert(working.pendingBoot == 1 && durable.pendingTrial);
        assert(!pulse::ota::contract::canCommit(working, false, true));
        assert(!pulse::ota::contract::canWriteBootSlot(0, working.activeBoot));
        assert(storage.pendingTrial && storage.activeBoot == 0);
    }
    assert(attempts == 2);
    assert(pulse::ota::contract::confirmTrial(working));
    assert(pulse::ota::contract::persistOrRestore(working, durable,
        [&](const SlotState& candidate) { storage = candidate; return true; }));
    assert(!working.pendingTrial && working.activeBoot == 1);
    assert(!durable.pendingTrial && storage.activeBoot == 1);
    assert(pulse::ota::contract::canWriteBootSlot(0, working.activeBoot));
}

void testBusyGuardDoesNotMutateMetadataAndReleasesForRetry() {
    bool held = true;
    int unlocks = 0;
    auto tryLock = [&]() {
        if (held) return false;
        held = true;
        return true;
    };
    auto unlock = [&]() { held = false; ++unlocks; };
    {
        pulse::ota::contract::ScopedTryLock guard(tryLock, unlock);
        assert(!guard);
    }
    assert(held && unlocks == 0);
    held = false;
    {
        pulse::ota::contract::ScopedTryLock guard(tryLock, unlock);
        assert(guard);
        pulse::ota::contract::ScopedTryLock concurrent(tryLock, unlock);
        assert(!concurrent);
    }
    assert(!held && unlocks == 1);
}

void testOldHealthyBootCannotConfirmFreshCommit() {
    SlotState state = {};
    state.activeBoot = 0;
    state.activeFirmware = 0;
    state.stagedBoot = true;
    state.stagedBootSlot = 1;
    putIdentity(reinterpret_cast<uint8_t*>(state.activePair), "factory");
    putIdentity(reinterpret_cast<uint8_t*>(state.stagedBootPair), "factory");
    assert(pulse::ota::contract::prepareTrial(state, false, true));

    // The existing healthy process must not confirm or reject a just-committed trial.
    assert(!pulse::ota::contract::trialSelectedByStartup(state, false, 0, 0));
    assert(!pulse::ota::contract::trialSelectedByStartup(state, false, 1, 0));
    assert(!pulse::ota::contract::trialSelectedByStartup(state, true, 0, 0));
    assert(!pulse::ota::contract::trialSelectedByStartup(state, true, 1, 1));

    // Only the startup that actually mounted the pending pair may confirm it.
    assert(pulse::ota::contract::trialSelectedByStartup(state, true, 1, 0));
    assert(pulse::ota::contract::confirmTrial(state));
    assert(!pulse::ota::contract::trialSelectedByStartup(state, true, 1, 0));
}

void testPowerCutAfterRollbackMetadataRestoresDurableFirmware() {
    SlotState working = {};
    working.activeBoot = 0;
    working.activeFirmware = 0;
    working.pendingBoot = 1;
    working.pendingFirmware = 1;
    working.pendingTrial = true;
    putIdentity(reinterpret_cast<uint8_t*>(working.activePair), "previous");
    putIdentity(reinterpret_cast<uint8_t*>(working.pendingPair), "candidate");
    SlotState durable = working;
    pulse::ota::contract::rejectTrial(working);
    assert(pulse::ota::contract::persistOrRestore(working, durable,
        [](const SlotState&) { return true; }));

    // Power fails before selecting the old app; bootloader still runs candidate app 1.
    const uint8_t runningFirmware = 1;
    assert(!durable.pendingTrial && durable.activeFirmware == 0);
    assert(pulse::ota::contract::mustRestoreDurableFirmware(
        durable.pendingTrial, durable.activeFirmware, runningFirmware));
    assert(durable.activeBoot == 0 && identityIs(durable.activePair, "previous"));
    // After selecting and restarting the durable app, mounting its BootFS is safe.
    assert(!pulse::ota::contract::mustRestoreDurableFirmware(
        durable.pendingTrial, durable.activeFirmware, 0));
    assert(!pulse::ota::contract::mustRestoreDurableFirmware(true, 0, 1));
}

}  // namespace

int main() {
    testEnvelopeValidation();
    testInterruptedAndAbortedUpdatesDoNotPublish();
    testPairTrialRollbackAndConfirmation();
    testSlotAndRetryGuards();
    testFactoryPairAllowsFirstBootFsOnlyTrial();
    testFailedPersistenceRetainsTrialAndLastGoodSlotUntilDurableRetry();
    testBusyGuardDoesNotMutateMetadataAndReleasesForRetry();
    testOldHealthyBootCannotConfirmFreshCommit();
    testPowerCutAfterRollbackMetadataRestoresDurableFirmware();
    return 0;
}

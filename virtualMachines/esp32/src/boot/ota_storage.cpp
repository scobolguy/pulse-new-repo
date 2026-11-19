#include "ota_storage.h"

#if defined(ARDUINO_ARCH_ESP32) && defined(PULSE_OTA_AB_BOOT)

#include "ota_contract.h"

#include <LittleFS.h>
#include <Preferences.h>
#include <esp_partition.h>
#include <esp_ota_ops.h>
#include <esp_system.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <mbedtls/md.h>
#include <mbedtls/pk.h>
#include <mbedtls/sha256.h>
#include <mbedtls/version.h>
#if defined(__has_include)
#if __has_include(<sdkconfig.h>)
#include <sdkconfig.h>
#endif
#endif

#include <algorithm>
#include <cstddef>
#include <cstdio>
#include <cstring>

#if defined(__has_include)
#if __has_include("ota_trust_anchor.h")
#include "ota_trust_anchor.h"
#endif
#endif

#ifndef PULSE_OTA_TRUST_ANCHOR_PEM
#define PULSE_OTA_TRUST_ANCHOR_PEM ""
#endif
#ifndef PULSE_OTA_UPLOAD_TOKEN
#define PULSE_OTA_UPLOAD_TOKEN ""
#endif
#ifndef PULSE_OTA_BOARD_ID
#define PULSE_OTA_BOARD_ID ""
#endif
#ifndef PULSE_OTA_RUNTIME_ABI
#define PULSE_OTA_RUNTIME_ABI ""
#endif

namespace pulse {
namespace ota {
namespace {

using contract::EnvelopeHeader;
using contract::SlotState;

constexpr uint32_t kStateMagic = 0x504F5441;
constexpr uint8_t kStateVersion = 1;
constexpr uint8_t kNoSlot = 0xff;
constexpr uint8_t kPendingTrial = 1 << 0;
constexpr uint8_t kStagedBoot = 1 << 1;
constexpr uint8_t kStagedFirmware = 1 << 2;
constexpr char kNamespace[] = "pulseota";
constexpr char kStateKey[] = "state";
constexpr char kSignatureDomain[] = "PULSE-OTA-ENVELOPE-v1";
constexpr char kBootLabels[2][8] = {"boot_a", "boot_b"};

struct PersistedState {
    uint32_t magic;
    uint8_t version;
    uint8_t flags;
    uint8_t activeBoot;
    uint8_t activeFirmware;
    uint8_t pendingBoot;
    uint8_t pendingFirmware;
    uint8_t stagedBootSlot;
    uint8_t stagedFirmwareSlot;
    uint8_t attempts;
    uint32_t activeBootVersion;
    uint32_t activeFirmwareVersion;
    uint32_t pendingFirmwareVersion;
    uint32_t pendingBootVersion;
    uint32_t stagedFirmwareVersion;
    uint32_t stagedBootVersion;
    char activePair[contract::kIdentitySize];
    char pendingPair[contract::kIdentitySize];
    char stagedBootPair[contract::kIdentitySize];
    char stagedFirmwarePair[contract::kIdentitySize];
    uint32_t crc;
};

struct UploadContext {
    AsyncWebServerRequest* request;
    bool active;
    bool complete;
    bool verified;
    bool failed;
    bool lockHeld;
#if !defined(PULSE_OTA_BOOTFS_ONLY)
    bool otaStarted;
    bool isFirmware;
#endif
    String error;
    size_t bodySize;
    uint32_t lastActivityMs;
    size_t headerReceived;
    size_t signatureReceived;
    uint32_t payloadReceived;
    uint32_t flashOffset;
    alignas(4) uint8_t tail[4];
    uint8_t tailSize;
    uint8_t headerBytes[contract::kEnvelopeHeaderSize];
    uint8_t signature[contract::kEnvelopeSignatureSize];
    EnvelopeHeader envelope;
    const esp_partition_t* targetPartition;
#if !defined(PULSE_OTA_BOOTFS_ONLY)
    esp_ota_handle_t otaHandle;
#endif
    mbedtls_sha256_context sha256;
    bool shaStarted;
};

fs::LittleFSFS gBootFs;
bool gBootFsMounted = false;
bool gInitialized = false;
bool gStartupSelectedTrial = false;
uint8_t gMountedBootSlot = kNoSlot;
bool gEnabled = false;
bool gFirmwareRollbackConfigured = false;
uint8_t gActiveBoot = 0;
uint8_t gActiveFirmware = kNoSlot;
uint8_t gPendingBoot = kNoSlot;
uint8_t gPendingFirmware = kNoSlot;
bool gPendingTrial = false;
char gError[128] = "not initialized";
PersistedState gState = {};
PersistedState gDurableState = {};
UploadContext gUpload = {};
SemaphoreHandle_t gOtaMutex = nullptr;
alignas(4) uint8_t gAlignedFlashBuffer[1024];

const char* errorText() {
    return gError;
}

void setError(const char* message) {
    if (message == nullptr) message = "unknown OTA error";
    snprintf(gError, sizeof(gError), "%s", message);
}

uint32_t crc32(const uint8_t* bytes, size_t size) {
    uint32_t crc = 0xffffffffu;
    for (size_t i = 0; i < size; ++i) {
        crc ^= bytes[i];
        for (uint8_t bit = 0; bit < 8; ++bit) {
            const uint32_t mask = 0u - (crc & 1u);
            crc = (crc >> 1) ^ (0xedb88320u & mask);
        }
    }
    return ~crc;
}

uint32_t stateCrc(const PersistedState& state) {
    return crc32(reinterpret_cast<const uint8_t*>(&state), offsetof(PersistedState, crc));
}

bool stateValid(const PersistedState& state) {
    return state.magic == kStateMagic &&
           state.version == kStateVersion &&
           state.activeBoot < 2 &&
           state.activeFirmware < 2 &&
           stateCrc(state) == state.crc;
}

bool saveState() {
    gState.magic = kStateMagic;
    gState.version = kStateVersion;
    gState.crc = stateCrc(gState);
    const bool saved = contract::persistOrRestore(gState, gDurableState,
        [](const PersistedState& candidate) {
            Preferences prefs;
            if (!prefs.begin(kNamespace, false)) {
                setError("OTA metadata storage unavailable");
                return false;
            }
            const size_t written = prefs.putBytes(kStateKey, &candidate, sizeof(candidate));
            prefs.end();
            if (written != sizeof(candidate)) {
                setError("OTA metadata transaction failed");
                return false;
            }
            return true;
        });
    gActiveBoot = gState.activeBoot;
    gActiveFirmware = gState.activeFirmware;
    gPendingBoot = (gState.flags & kPendingTrial) ? gState.pendingBoot : kNoSlot;
    gPendingFirmware = (gState.flags & kPendingTrial) ? gState.pendingFirmware : kNoSlot;
    gPendingTrial = (gState.flags & kPendingTrial) != 0;
    return saved;
}

bool loadState(uint8_t runningFirmwareSlot) {
    Preferences prefs;
    if (!prefs.begin(kNamespace, false)) {
        setError("OTA metadata storage unavailable");
        return false;
    }

    PersistedState loaded = {};
    const size_t storedSize = prefs.getBytesLength(kStateKey);
    const bool found = storedSize == sizeof(loaded) &&
                       prefs.getBytes(kStateKey, &loaded, sizeof(loaded)) == sizeof(loaded);
    prefs.end();

    if (storedSize != 0 && (!found || !stateValid(loaded))) {
        setError("OTA metadata is invalid; refusing to guess an active slot");
        return false;
    }

    if (storedSize == 0) {
        memset(&gState, 0, sizeof(gState));
        gState.activeBoot = 0;
        gState.activeFirmware = runningFirmwareSlot;
        gState.pendingBoot = kNoSlot;
        gState.pendingFirmware = kNoSlot;
        gState.stagedBootSlot = kNoSlot;
        gState.stagedFirmwareSlot = kNoSlot;
        gState.flags = 0;
        gState.attempts = 0;
        return saveState();
    }

    gState = loaded;
    gDurableState = loaded;
    return saveState();
}

const esp_partition_t* bootPartition(uint8_t slot) {
    if (slot > 1) return nullptr;
    return esp_partition_find_first(ESP_PARTITION_TYPE_DATA,
                                    ESP_PARTITION_SUBTYPE_DATA_SPIFFS,
                                    kBootLabels[slot]);
}

const esp_partition_t* firmwarePartition(uint8_t slot) {
    if (slot > 1) return nullptr;
    const esp_partition_subtype_t subtype = slot == 0 ? ESP_PARTITION_SUBTYPE_APP_OTA_0
                                                       : ESP_PARTITION_SUBTYPE_APP_OTA_1;
    return esp_partition_find_first(ESP_PARTITION_TYPE_APP, subtype, nullptr);
}

uint8_t firmwareSlot(const esp_partition_t* partition) {
    if (partition == nullptr || partition->type != ESP_PARTITION_TYPE_APP) return kNoSlot;
    if (partition->subtype == ESP_PARTITION_SUBTYPE_APP_OTA_0) return 0;
    if (partition->subtype == ESP_PARTITION_SUBTYPE_APP_OTA_1) return 1;
    return kNoSlot;
}

bool hasTrustAnchor() {
    if (PULSE_OTA_TRUST_ANCHOR_PEM[0] == '\0' ||
        PULSE_OTA_UPLOAD_TOKEN[0] == '\0' ||
        PULSE_OTA_BOARD_ID[0] == '\0' ||
        PULSE_OTA_RUNTIME_ABI[0] == '\0') return false;

    mbedtls_pk_context key;
    mbedtls_pk_init(&key);
    const unsigned char* publicKey =
        reinterpret_cast<const unsigned char*>(PULSE_OTA_TRUST_ANCHOR_PEM);
    const int parsed = mbedtls_pk_parse_public_key(
        &key, publicKey, strlen(PULSE_OTA_TRUST_ANCHOR_PEM) + 1);
    const bool valid = parsed == 0 && mbedtls_pk_can_do(&key, MBEDTLS_PK_RSA) &&
                       mbedtls_pk_get_bitlen(&key) == 2048;
    mbedtls_pk_free(&key);
    return valid;
}

void clearStaged(PersistedState& state) {
    state.flags &= static_cast<uint8_t>(~(kStagedBoot | kStagedFirmware));
    state.stagedBootSlot = kNoSlot;
    state.stagedFirmwareSlot = kNoSlot;
    state.stagedBootVersion = 0;
    state.stagedFirmwareVersion = 0;
    memset(state.stagedBootPair, 0, sizeof(state.stagedBootPair));
    memset(state.stagedFirmwarePair, 0, sizeof(state.stagedFirmwarePair));
}

bool constantTimeEquals(const char* a, const char* b, size_t length) {
    uint8_t diff = 0;
    for (size_t i = 0; i < length; ++i) {
        diff |= static_cast<uint8_t>(a[i] ^ b[i]);
    }
    return diff == 0;
}

bool authenticated(AsyncWebServerRequest* request) {
    if (!gEnabled || request == nullptr || !request->hasHeader("X-Pulse-OTA-Token")) return false;
    const String supplied = request->getHeader("X-Pulse-OTA-Token")->value();
    const size_t expectedLength = strlen(PULSE_OTA_UPLOAD_TOKEN);
    return supplied.length() == expectedLength &&
           constantTimeEquals(supplied.c_str(), PULSE_OTA_UPLOAD_TOKEN, expectedLength);
}

bool verifySignature(const uint8_t* header, const uint8_t* signature, size_t signatureSize) {
    if (signatureSize != contract::kEnvelopeSignatureSize) return false;
    const unsigned char* publicKey =
        reinterpret_cast<const unsigned char*>(PULSE_OTA_TRUST_ANCHOR_PEM);
    const size_t publicKeySize = strlen(PULSE_OTA_TRUST_ANCHOR_PEM) + 1;
    mbedtls_pk_context key;
    mbedtls_pk_init(&key);
    const int parsed = mbedtls_pk_parse_public_key(&key, publicKey, publicKeySize);
    if (parsed != 0 || !mbedtls_pk_can_do(&key, MBEDTLS_PK_RSA) ||
        mbedtls_pk_get_bitlen(&key) != 2048) {
        mbedtls_pk_free(&key);
        setError("OTA trust anchor must be an RSA-2048 public key");
        return false;
    }

    uint8_t digest[32];
    const mbedtls_md_info_t* md = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    mbedtls_md_context_t context;
    mbedtls_md_init(&context);
    int result = md == nullptr ? -1 : mbedtls_md_setup(&context, md, 0);
    if (result == 0) result = mbedtls_md_starts(&context);
    if (result == 0) {
        result = mbedtls_md_update(&context,
                                   reinterpret_cast<const unsigned char*>(kSignatureDomain),
                                   sizeof(kSignatureDomain));
    }
    if (result == 0) result = mbedtls_md_update(&context, header, 96);
    if (result == 0) result = mbedtls_md_finish(&context, digest);
    mbedtls_md_free(&context);
    if (result == 0) {
        result = mbedtls_pk_verify(&key, MBEDTLS_MD_SHA256, digest, sizeof(digest),
                                   signature, signatureSize);
    }
    mbedtls_pk_free(&key);
    return result == 0;
}

bool identityFits(const char* input) {
    const size_t length = strlen(input);
    return length > 0 && length < contract::kIdentitySize;
}

void fillIdentity(char target[contract::kIdentitySize], const char* value) {
    memset(target, 0, contract::kIdentitySize);
    const size_t length = std::min(strlen(value), contract::kIdentitySize);
    memcpy(target, value, length);
}

SlotState contractState() {
    SlotState result = {};
    result.activeBoot = gState.activeBoot;
    result.activeFirmware = gState.activeFirmware;
    result.pendingBoot = gState.pendingBoot;
    result.pendingFirmware = gState.pendingFirmware;
    result.pendingTrial = (gState.flags & kPendingTrial) != 0;
    result.stagedBoot = (gState.flags & kStagedBoot) != 0;
    result.stagedFirmware = (gState.flags & kStagedFirmware) != 0;
    result.stagedBootSlot = gState.stagedBootSlot;
    result.stagedFirmwareSlot = gState.stagedFirmwareSlot;
    memcpy(result.activePair, gState.activePair, sizeof(result.activePair));
    memcpy(result.pendingPair, gState.pendingPair, sizeof(result.pendingPair));
    memcpy(result.stagedBootPair, gState.stagedBootPair, sizeof(result.stagedBootPair));
    memcpy(result.stagedFirmwarePair, gState.stagedFirmwarePair, sizeof(result.stagedFirmwarePair));
    return result;
}

void resetUpload(AsyncWebServerRequest* request) {
    if (gUpload.shaStarted) mbedtls_sha256_free(&gUpload.sha256);
    gUpload = UploadContext{};
    gUpload.request = request;
    gUpload.active = true;
    setError("");
}

void failUpload(const char* message) {
    if (gUpload.failed) return;
    gUpload.failed = true;
    gUpload.error = message == nullptr ? "OTA upload failed" : message;
#if !defined(PULSE_OTA_BOOTFS_ONLY)
    if (gUpload.otaStarted) {
        esp_ota_abort(gUpload.otaHandle);
        gUpload.otaStarted = false;
    }
#endif
    if (gUpload.shaStarted) {
        mbedtls_sha256_free(&gUpload.sha256);
        gUpload.shaStarted = false;
    }
    if (gUpload.lockHeld && gOtaMutex != nullptr) {
        xSemaphoreGive(gOtaMutex);
        gUpload.lockHeld = false;
    }
    setError(gUpload.error.c_str());
}

bool startPayloadWrite() {
#if !defined(PULSE_OTA_BOOTFS_ONLY)
    const uint8_t expectedKind = gUpload.envelope.kind;
    if (expectedKind == contract::kFirmwareImage) {
        gUpload.isFirmware = true;
        const esp_partition_t* running = esp_ota_get_running_partition();
        gActiveFirmware = firmwareSlot(running);
        if (gActiveFirmware > 1) {
            setError("running firmware is not in an OTA slot");
            return false;
        }
        gUpload.targetPartition = esp_ota_get_next_update_partition(running);
        if (gUpload.targetPartition == nullptr ||
            gUpload.targetPartition == running ||
            gUpload.envelope.payloadSize > gUpload.targetPartition->size) {
            setError("signed firmware image exceeds inactive app slot");
            return false;
        }
        if (esp_ota_begin(gUpload.targetPartition, gUpload.envelope.payloadSize,
                          &gUpload.otaHandle) != ESP_OK) {
            setError("could not begin inactive firmware write");
            return false;
        }
        gUpload.otaStarted = true;
    } else
#endif
    {
        const uint8_t target = static_cast<uint8_t>(1 - gState.activeBoot);
        if (!contract::canWriteBootSlot(target, gState.activeBoot)) {
            setError("refusing to write active boot filesystem");
            return false;
        }
        gUpload.targetPartition = bootPartition(target);
        if (gUpload.targetPartition == nullptr ||
            gUpload.envelope.payloadSize != gUpload.targetPartition->size) {
            setError("boot filesystem image must exactly match inactive slot size");
            return false;
        }
        if (gBootFsMounted && target == gState.activeBoot) {
            setError("refusing to unmount active boot filesystem for update");
            return false;
        }
        if (esp_partition_erase_range(gUpload.targetPartition, 0,
                                      gUpload.targetPartition->size) != ESP_OK) {
            setError("could not erase inactive boot filesystem slot");
            return false;
        }
    }

    mbedtls_sha256_init(&gUpload.sha256);
    int hashResult;
#if defined(MBEDTLS_VERSION_MAJOR) && MBEDTLS_VERSION_MAJOR >= 3
    hashResult = mbedtls_sha256_starts(&gUpload.sha256, 0);
#else
    hashResult = mbedtls_sha256_starts_ret(&gUpload.sha256, 0);
#endif
    if (hashResult != 0) {
        setError("could not initialize OTA image digest");
        return false;
    }
    gUpload.shaStarted = true;
    return true;
}

bool writePayload(const uint8_t* bytes, size_t length) {
    if (length == 0) return true;
#if !defined(PULSE_OTA_BOOTFS_ONLY)
    if (gUpload.isFirmware) {
        if (esp_ota_write(gUpload.otaHandle, bytes, length) != ESP_OK) {
            setError("firmware flash write failed");
            return false;
        }
    } else
#endif
    {
        size_t cursor = 0;
        if (gUpload.tailSize != 0) {
            const size_t count = std::min(length, static_cast<size_t>(4 - gUpload.tailSize));
            memcpy(gUpload.tail + gUpload.tailSize, bytes, count);
            gUpload.tailSize += static_cast<uint8_t>(count);
            cursor += count;
            if (gUpload.tailSize == 4) {
                if (esp_partition_write(gUpload.targetPartition, gUpload.flashOffset,
                                        gUpload.tail, sizeof(gUpload.tail)) != ESP_OK) {
                    setError("boot filesystem flash write failed");
                    return false;
                }
                gUpload.flashOffset += sizeof(gUpload.tail);
                gUpload.tailSize = 0;
            }
        }

        const size_t alignedLength = (length - cursor) & ~static_cast<size_t>(3);
        if (alignedLength != 0) {
            if ((gUpload.flashOffset & 3u) != 0) {
                setError("boot filesystem flash write failed");
                return false;
            }
            size_t written = 0;
            while (written < alignedLength) {
                size_t block = std::min(alignedLength - written,
                                        sizeof(gAlignedFlashBuffer));
                block &= ~static_cast<size_t>(3);
                memcpy(gAlignedFlashBuffer, bytes + cursor + written, block);
                if (esp_partition_write(gUpload.targetPartition,
                                        gUpload.flashOffset,
                                        gAlignedFlashBuffer, block) != ESP_OK) {
                    setError("boot filesystem flash write failed");
                    return false;
                }
                gUpload.flashOffset += static_cast<uint32_t>(block);
                written += block;
            }
            cursor += alignedLength;
        }
        const size_t tailCount = length - cursor;
        if (tailCount != 0) {
            memcpy(gUpload.tail, bytes + cursor, tailCount);
            gUpload.tailSize = static_cast<uint8_t>(tailCount);
        }
    }

    int hashResult;
#if defined(MBEDTLS_VERSION_MAJOR) && MBEDTLS_VERSION_MAJOR >= 3
    hashResult = mbedtls_sha256_update(&gUpload.sha256, bytes, length);
#else
    hashResult = mbedtls_sha256_update_ret(&gUpload.sha256, bytes, length);
#endif
    if (hashResult != 0) {
        setError("OTA image digest update failed");
        return false;
    }
    gUpload.payloadReceived += static_cast<uint32_t>(length);
    return true;
}

bool validateBootFilesystemImage() {
    if (gUpload.targetPartition == nullptr) return false;
    const uint8_t slot = static_cast<uint8_t>(1 - gState.activeBoot);
    fs::LittleFSFS check;
    if (!check.begin(false, "/pulseboot-check", 6, kBootLabels[slot])) {
        setError("signed boot filesystem image is not mountable");
        return false;
    }
    File program = check.open("/boot/pmachine-boot", "r");
    File provisioning = check.open("/web/provisioning.html", "r");
    File pair = check.open("/boot/ota-pair-id", "r");
    String imagePair = pair ? pair.readString() : String();
    String expectedPair;
    for (size_t i = 0; i < sizeof(gUpload.envelope.pairId) &&
                        gUpload.envelope.pairId[i] != '\0'; ++i) {
        expectedPair += gUpload.envelope.pairId[i];
    }
    const bool valid = program && program.size() > 0 &&
                       provisioning && provisioning.size() > 0 &&
                       pair && imagePair == expectedPair;
    if (program) program.close();
    if (provisioning) provisioning.close();
    if (pair) pair.close();
    check.end();
    if (!valid) setError("boot filesystem image is missing required local boot files");
    return valid;
}

bool finishPayload() {
    uint8_t digest[32];
    int hashResult;
#if defined(MBEDTLS_VERSION_MAJOR) && MBEDTLS_VERSION_MAJOR >= 3
    hashResult = mbedtls_sha256_finish(&gUpload.sha256, digest);
#else
    hashResult = mbedtls_sha256_finish_ret(&gUpload.sha256, digest);
#endif
    if (hashResult != 0 ||
        !contract::digestMatches(gUpload.envelope.digest, digest)) {
        setError("OTA image SHA-256 mismatch");
        return false;
    }

#if !defined(PULSE_OTA_BOOTFS_ONLY)
    if (gUpload.isFirmware) {
        if (esp_ota_end(gUpload.otaHandle) != ESP_OK) {
            gUpload.otaStarted = false;
            setError("firmware image validation failed");
            return false;
        }
        gUpload.otaStarted = false;
    } else
#endif
    if (gUpload.tailSize != 0 ||
               gUpload.flashOffset != gUpload.envelope.payloadSize ||
               !validateBootFilesystemImage()) {
        if (gError[0] == '\0') setError("boot filesystem image is incomplete");
        return false;
    }

#if !defined(PULSE_OTA_BOOTFS_ONLY)
    if (gUpload.isFirmware) {
        const uint8_t slot = firmwareSlot(gUpload.targetPartition);
        if (slot > 1 || slot == gState.activeFirmware) {
            setError("firmware target was not the inactive slot");
            return false;
        }
        gState.flags |= kStagedFirmware;
        gState.stagedFirmwareSlot = slot;
        gState.stagedFirmwareVersion = gUpload.envelope.version;
        memcpy(gState.stagedFirmwarePair, gUpload.envelope.pairId,
               sizeof(gState.stagedFirmwarePair));
    } else
#endif
    {
        const uint8_t slot = static_cast<uint8_t>(1 - gState.activeBoot);
        gState.flags |= kStagedBoot;
        gState.stagedBootSlot = slot;
        gState.stagedBootVersion = gUpload.envelope.version;
        memcpy(gState.stagedBootPair, gUpload.envelope.pairId,
               sizeof(gState.stagedBootPair));
    }
    return saveState();
}

bool parseAndVerifyHeader() {
    if (!contract::parseEnvelopeHeader(gUpload.headerBytes,
                                       sizeof(gUpload.headerBytes),
                                       gUpload.envelope)) {
        setError("malformed OTA envelope header");
        return false;
    }
    if (!contract::targetIdentityMatches(gUpload.envelope,
                                         PULSE_OTA_BOARD_ID,
                                         PULSE_OTA_RUNTIME_ABI)) {
        setError("OTA image targets a different board or runtime ABI");
        return false;
    }
    if (gUpload.envelope.kind == contract::kFirmwareImage) {
#if defined(PULSE_OTA_BOOTFS_ONLY)
        setError("native firmware OTA is disabled; only BootFS images are accepted");
        return false;
#else
        if (!gFirmwareRollbackConfigured) {
            setError("firmware OTA disabled: bootloader rollback support is not configured");
            return false;
        }
        const uint32_t newest = (gState.flags & kStagedFirmware)
                                    ? std::max(gState.activeFirmwareVersion,
                                               gState.stagedFirmwareVersion)
                                    : gState.activeFirmwareVersion;
        if (gUpload.envelope.version <= newest) {
            setError("firmware version is not newer than the committed or staged version");
            return false;
        }
#endif
    } else {
        const uint32_t newest = (gState.flags & kStagedBoot)
                                    ? std::max(gState.activeBootVersion,
                                               gState.stagedBootVersion)
                                    : gState.activeBootVersion;
        if (gUpload.envelope.version <= newest) {
            setError("boot filesystem version is not newer than the committed or staged version");
            return false;
        }
    }
    if (!contract::envelopeSizeMatches(gUpload.envelope, gUpload.bodySize)) {
        setError("OTA envelope length does not match request body");
        return false;
    }
    if (gUpload.envelope.kind == contract::kBootFilesystemImage &&
        (gUpload.envelope.payloadSize & 3u) != 0) {
        setError("boot filesystem image size is not flash-word aligned");
        return false;
    }
    return true;
}

void processUpload(AsyncWebServerRequest* request, uint8_t* data,
                   size_t length, size_t index, size_t total) {
    if (index == 0) {
        if (gUpload.active) {
            if (static_cast<uint32_t>(millis() - gUpload.lastActivityMs) <= 60000) {
                request->send(409, "application/json", "{\"error\":\"another OTA upload is active\"}");
                return;
            }
            failUpload("stale OTA upload abandoned");
            gUpload.active = false;
        }
        resetUpload(request);
        if (!authenticated(request)) {
            gUpload.failed = true;
            gUpload.error = "OTA authorization failed";
            return;
        }
        if (gOtaMutex == nullptr || xSemaphoreTake(gOtaMutex, 0) != pdTRUE) {
            gUpload.failed = true;
            gUpload.error = "another OTA transaction is active";
            return;
        }
        gUpload.lockHeld = true;
        gUpload.bodySize = total;
        if ((gState.flags & kPendingTrial) != 0) {
            failUpload("cannot stage an update during an unconfirmed trial");
            return;
        }
    }

    if (!gUpload.active || gUpload.request != request || gUpload.failed) return;
    gUpload.lastActivityMs = millis();
    if (index + length > total || total != gUpload.bodySize) {
        failUpload("inconsistent OTA request body offsets");
        return;
    }

    size_t cursor = 0;
    if (gUpload.headerReceived < contract::kEnvelopeHeaderSize) {
        const size_t count = std::min(length,
            contract::kEnvelopeHeaderSize - gUpload.headerReceived);
        memcpy(gUpload.headerBytes + gUpload.headerReceived, data, count);
        gUpload.headerReceived += count;
        cursor += count;
        if (gUpload.headerReceived == contract::kEnvelopeHeaderSize &&
            !parseAndVerifyHeader()) {
            failUpload(errorText());
            return;
        }
    }

    if (gUpload.headerReceived == contract::kEnvelopeHeaderSize &&
        gUpload.signatureReceived < contract::kEnvelopeSignatureSize) {
        const size_t count = std::min(length - cursor,
            contract::kEnvelopeSignatureSize - gUpload.signatureReceived);
        memcpy(gUpload.signature + gUpload.signatureReceived, data + cursor, count);
        gUpload.signatureReceived += count;
        cursor += count;
        if (gUpload.signatureReceived == contract::kEnvelopeSignatureSize) {
            if (!verifySignature(gUpload.headerBytes, gUpload.signature,
                                 gUpload.signatureReceived)) {
                if (gError[0] == '\0') setError("OTA signature verification failed");
                failUpload(errorText());
                return;
            }
            gUpload.verified = true;
            if (!startPayloadWrite()) {
                failUpload(errorText());
                return;
            }
        }
    }

    if (cursor < length) {
        if (!gUpload.verified) {
            failUpload("OTA payload arrived before signature verification");
            return;
        }
        const size_t payloadLength = length - cursor;
        if (gUpload.payloadReceived > gUpload.envelope.payloadSize ||
            payloadLength > gUpload.envelope.payloadSize - gUpload.payloadReceived ||
            !writePayload(data + cursor, payloadLength)) {
            failUpload(errorText());
            return;
        }
    }

    if (index + length == total) {
        if (gUpload.headerReceived != contract::kEnvelopeHeaderSize ||
            gUpload.signatureReceived != contract::kEnvelopeSignatureSize ||
            !gUpload.verified ||
            gUpload.payloadReceived != gUpload.envelope.payloadSize ||
            !finishPayload()) {
            if (!gUpload.failed) failUpload(errorText());
        } else {
            gUpload.complete = true;
            setError("");
        }
        if (gUpload.lockHeld && gOtaMutex != nullptr) {
            xSemaphoreGive(gOtaMutex);
            gUpload.lockHeld = false;
        }
    }
}

void handleUploadComplete(AsyncWebServerRequest* request) {
    if (!gUpload.active || gUpload.request != request) {
        request->send(400, "application/json", "{\"error\":\"missing OTA upload body\"}");
        return;
    }
    if (gUpload.complete && !gUpload.failed) {
        request->send(201, "application/json", "{\"staged\":true}");
    } else {
        const int statusCode = gUpload.error == "OTA authorization failed" ? 401 : 400;
        String response = "{\"error\":\"";
        for (size_t i = 0; i < gUpload.error.length(); ++i) {
            const char ch = gUpload.error[i];
            if (ch == '"' || ch == '\\') response += '\\';
            if (ch >= 0x20) response += ch;
        }
        response += "\"}";
        request->send(statusCode, "application/json", response);
    }
    if (gUpload.shaStarted) {
        mbedtls_sha256_free(&gUpload.sha256);
        gUpload.shaStarted = false;
    }
    gUpload.active = false;
}

bool commitStaged() {
    const bool firmwareStaged = (gState.flags & kStagedFirmware) != 0;
#if defined(PULSE_OTA_BOOTFS_ONLY)
    if (firmwareStaged) {
        setError("native firmware OTA is disabled; abort the previously staged upload");
        return false;
    }
#endif
    const bool bootStaged = (gState.flags & kStagedBoot) != 0;
    SlotState transaction = contractState();
    if (!contract::prepareTrial(transaction, firmwareStaged, bootStaged)) {
        setError("staged images do not form a compatible signed pair");
        return false;
    }

    gState.pendingBoot = transaction.pendingBoot;
    gState.pendingFirmware = transaction.pendingFirmware;
    memcpy(gState.pendingPair, transaction.pendingPair, sizeof(gState.pendingPair));
    gState.pendingFirmwareVersion = firmwareStaged ? gState.stagedFirmwareVersion
                                                   : gState.activeFirmwareVersion;
    gState.pendingBootVersion = bootStaged ? gState.stagedBootVersion
                                           : gState.activeBootVersion;
    gState.attempts = 0;
    gState.flags |= kPendingTrial;
    if (!saveState()) return false;

#if !defined(PULSE_OTA_BOOTFS_ONLY)
    if (firmwareStaged) {
        const esp_partition_t* next = firmwarePartition(gState.pendingFirmware);
        if (next == nullptr || esp_ota_set_boot_partition(next) != ESP_OK) {
            gState.flags &= static_cast<uint8_t>(~kPendingTrial);
            gState.pendingBoot = kNoSlot;
            gState.pendingFirmware = kNoSlot;
            saveState();
            setError("bootloader rejected firmware slot selection");
            return false;
        }
    }
#endif
    return true;
}

void sendStatus(AsyncWebServerRequest* request) {
    Status current = status();
    String json = "{\"enabled\":";
    json += current.enabled ? "true" : "false";
    json += ",\"bootMounted\":";
    json += current.bootFilesystemMounted ? "true" : "false";
    json += ",\"pendingTrial\":";
    json += current.pendingTrial ? "true" : "false";
    json += ",\"firmwareRollbackConfigured\":";
    json += current.firmwareRollbackConfigured ? "true" : "false";
    json += ",\"firmwareUpdatesEnabled\":";
    json += current.firmwareUpdatesEnabled ? "true" : "false";
    json += ",\"activeBootSlot\":";
    json += String(current.activeBootSlot);
    json += ",\"pendingBootSlot\":";
    json += String(current.pendingBootSlot);
    json += ",\"activeFirmwareSlot\":";
    json += String(current.activeFirmwareSlot);
    json += ",\"pendingFirmwareSlot\":";
    json += String(current.pendingFirmwareSlot);
    json += ",\"error\":\"";
    for (const char* p = current.error; p != nullptr && *p; ++p) {
        if (*p == '"' || *p == '\\') json += '\\';
        if (static_cast<uint8_t>(*p) >= 0x20) json += *p;
    }
    json += "\"}";
    request->send(200, "application/json", json);
}

void handleCommit(AsyncWebServerRequest* request) {
    if (!authenticated(request)) {
        request->send(401, "application/json", "{\"error\":\"unauthorized\"}");
        return;
    }
    if (gOtaMutex == nullptr || xSemaphoreTake(gOtaMutex, 0) != pdTRUE) {
        request->send(409, "application/json", "{\"error\":\"OTA transaction is busy\"}");
        return;
    }
    if (!commitStaged()) {
        xSemaphoreGive(gOtaMutex);
        request->send(409, "application/json", "{\"error\":\"staged pair rejected\"}");
        return;
    }
    xSemaphoreGive(gOtaMutex);
    request->send(202, "application/json", "{\"trial\":true,\"restarting\":true}");
    delay(250);
    ESP.restart();
}

void handleAbort(AsyncWebServerRequest* request) {
    if (!authenticated(request)) {
        request->send(401, "application/json", "{\"error\":\"unauthorized\"}");
        return;
    }
    if (gOtaMutex == nullptr || xSemaphoreTake(gOtaMutex, 0) != pdTRUE) {
        request->send(409, "application/json", "{\"error\":\"OTA transaction is busy\"}");
        return;
    }
    clearStaged(gState);
    if (!saveState()) {
        xSemaphoreGive(gOtaMutex);
        request->send(500, "application/json", "{\"error\":\"metadata write failed\"}");
        return;
    }
    xSemaphoreGive(gOtaMutex);
    request->send(200, "application/json", "{\"aborted\":true}");
}

bool mountBootSlot(uint8_t slot) {
    const esp_partition_t* partition = bootPartition(slot);
    if (partition == nullptr) {
        setError("boot filesystem partition is missing");
        return false;
    }
    if (gBootFsMounted) {
        gBootFs.end();
        gBootFsMounted = false;
        gMountedBootSlot = kNoSlot;
    }
    if (!gBootFs.begin(false, "/pulseboot", 10, kBootLabels[slot])) {
        setError("boot filesystem mount failed; auto-format is disabled");
        return false;
    }
    gBootFsMounted = true;
    gMountedBootSlot = slot;
    return true;
}

bool rollbackPendingTrial() {
    SlotState transaction = contractState();
    contract::rejectTrial(transaction);
    gState.pendingBoot = transaction.pendingBoot;
    gState.pendingFirmware = transaction.pendingFirmware;
    memcpy(gState.pendingPair, transaction.pendingPair, sizeof(gState.pendingPair));
    gState.flags &= static_cast<uint8_t>(~kPendingTrial);
    gState.attempts = 0;
    clearStaged(gState);
    return saveState();
}

bool validateMountedPair() {
    File marker = gBootFs.open("/boot/ota-pair-id", "r");
    if (!marker || marker.size() == 0 || marker.size() >= contract::kIdentitySize) {
        if (marker) marker.close();
        setError("installed boot filesystem has an invalid factory pair marker");
        return false;
    }
    char pair[contract::kIdentitySize] = {};
    const size_t length = marker.size();
    const size_t read = marker.readBytes(pair, length);
    marker.close();
    char expected[contract::kIdentitySize] = {};
    const bool pending = (gState.flags & kPendingTrial) != 0;
    memcpy(expected, pending ? gState.pendingPair : gState.activePair, sizeof(expected));
    if (read != length ||
        !contract::seedOrValidateFactoryPair(expected, pair, length)) {
        setError("installed boot filesystem pair does not match firmware metadata");
        return false;
    }
    if (!pending && contract::identityIsEmpty(gState.activePair)) {
        memcpy(gState.activePair, expected, sizeof(gState.activePair));
        return saveState();
    }
    return true;
}

}  // namespace

bool begin() {
    gStartupSelectedTrial = false;
    const bool trustConfigured = hasTrustAnchor() && identityFits(PULSE_OTA_BOARD_ID) &&
                                 identityFits(PULSE_OTA_RUNTIME_ABI);
    gEnabled = false;
    gFirmwareRollbackConfigured = false;
#if defined(CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE) && CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE
    gFirmwareRollbackConfigured = true;
#endif
    if (gOtaMutex == nullptr) gOtaMutex = xSemaphoreCreateMutex();
    if (gOtaMutex == nullptr) {
        setError("OTA transaction mutex allocation failed");
        return false;
    }

    const uint8_t currentFirmware = firmwareSlot(esp_ota_get_running_partition());
    if (currentFirmware > 1) {
        setError("running application is not in an OTA slot");
        return false;
    }
    if (!loadState(currentFirmware)) return false;
    if (contract::mustRestoreDurableFirmware((gState.flags & kPendingTrial) != 0,
                                             gState.activeFirmware, currentFirmware)) {
        const esp_partition_t* previous = firmwarePartition(gState.activeFirmware);
        if (previous == nullptr || esp_ota_set_boot_partition(previous) != ESP_OK) {
            setError("running firmware differs from durable OTA selection; restore failed");
            return false;
        }
        setError("restoring durable firmware selection before mounting boot filesystem");
        delay(100);
        ESP.restart();
        return false;
    }

    if ((gState.flags & kPendingTrial) != 0) {
        if (currentFirmware != gState.pendingFirmware) {
            if (!rollbackPendingTrial()) return false;
        } else if (contract::isSecondUnconfirmedTrialBoot(gState.attempts)) {
            const uint8_t previousFirmware = gState.activeFirmware;
            if (!rollbackPendingTrial()) return false;
            if (previousFirmware < 2 && previousFirmware != currentFirmware) {
                const esp_partition_t* previous = firmwarePartition(previousFirmware);
                if (previous == nullptr || esp_ota_set_boot_partition(previous) != ESP_OK) {
                    setError("unconfirmed trial failed and prior firmware selection failed");
                    return false;
                }
                setError("unconfirmed trial rejected; rebooting previous firmware slot");
                delay(100);
                ESP.restart();
                return false;
            }
            setError("unconfirmed trial rejected; previous boot filesystem selected");
        } else {
            gState.attempts = 1;
            if (!saveState()) return false;
        }
    }

    const uint8_t selectedBoot = (gState.flags & kPendingTrial)
                                     ? gState.pendingBoot
                                     : gState.activeBoot;
    if (!mountBootSlot(selectedBoot)) {
        if ((gState.flags & kPendingTrial) != 0) {
            const uint8_t previousFirmware = gState.activeFirmware;
            if (!rollbackPendingTrial()) return false;
            if (previousFirmware < 2 && previousFirmware != currentFirmware) {
                const esp_partition_t* previous = firmwarePartition(previousFirmware);
                if (previous == nullptr || esp_ota_set_boot_partition(previous) != ESP_OK) {
                    setError("trial boot filesystem failed and prior firmware selection failed");
                    return false;
                }
                delay(100);
                ESP.restart();
                return false;
            }
            if (mountBootSlot(gState.activeBoot)) {
                if (!validateMountedPair()) return false;
                gEnabled = trustConfigured;
                setError("trial boot filesystem rejected; prior slot restored");
                gInitialized = true;
                return true;
            }
        }
        return false;
    }

    if (!validateMountedPair()) return false;
    gStartupSelectedTrial = (gState.flags & kPendingTrial) != 0;
    gInitialized = true;
    gEnabled = trustConfigured;
    setError(gEnabled ? "" : "OTA disabled: operator trust anchor, token, board ID, or ABI missing");
    return true;
}

fs::FS& bootFileSystem() {
    return gBootFs;
}

bool confirmBoot() {
    auto tryLock = []() {
        return gOtaMutex != nullptr && xSemaphoreTake(gOtaMutex, 0) == pdTRUE;
    };
    auto unlock = []() { xSemaphoreGive(gOtaMutex); };
    contract::ScopedTryLock lock(tryLock, unlock);
    if (!lock) {
        setError("OTA transaction is busy; retry");
        return false;
    }
    if (!gInitialized || !gBootFsMounted) {
        setError("cannot confirm before local boot filesystem is mounted");
        return false;
    }
    if ((gState.flags & kPendingTrial) == 0) return true;
    if (!contract::trialSelectedByStartup(contractState(), gStartupSelectedTrial,
                                          gMountedBootSlot,
                                          firmwareSlot(esp_ota_get_running_partition()))) {
        setError("pending OTA trial was not selected by this startup");
        return false;
    }

    if (gFirmwareRollbackConfigured &&
        gState.pendingFirmware != gState.activeFirmware) {
        esp_ota_img_states_t imageState;
        if (esp_ota_get_state_partition(esp_ota_get_running_partition(), &imageState) != ESP_OK ||
            (imageState != ESP_OTA_IMG_VALID &&
             esp_ota_mark_app_valid_cancel_rollback() != ESP_OK)) {
            setError("bootloader could not confirm application trial");
            return false;
        }
    }

    SlotState transaction = contractState();
    if (!contract::confirmTrial(transaction)) {
        setError("no pending OTA trial to confirm");
        return false;
    }
    gState.activeBoot = transaction.activeBoot;
    gState.activeFirmware = firmwareSlot(esp_ota_get_running_partition());
    gState.activeBootVersion = gState.pendingBootVersion;
    gState.activeFirmwareVersion = gState.pendingFirmwareVersion;
    memcpy(gState.activePair, transaction.activePair, sizeof(gState.activePair));
    gState.pendingBoot = transaction.pendingBoot;
    gState.pendingFirmware = transaction.pendingFirmware;
    memcpy(gState.pendingPair, transaction.pendingPair, sizeof(gState.pendingPair));
    gState.flags &= static_cast<uint8_t>(~kPendingTrial);
    gState.attempts = 0;
    clearStaged(gState);
    if (!saveState()) return false;

    gStartupSelectedTrial = false;
    setError("");
    return true;
}

bool rejectBoot(const char* reason) {
    auto tryLock = []() {
        return gOtaMutex != nullptr && xSemaphoreTake(gOtaMutex, 0) == pdTRUE;
    };
    auto unlock = []() { xSemaphoreGive(gOtaMutex); };
    contract::ScopedTryLock lock(tryLock, unlock);
    if (!lock) {
        setError("OTA transaction is busy; retry");
        return false;
    }
    setError(reason == nullptr ? "local boot runtime rejected trial" : reason);
    if (!gInitialized || (gState.flags & kPendingTrial) == 0) return false;
    if (!contract::trialSelectedByStartup(contractState(), gStartupSelectedTrial,
                                          gMountedBootSlot,
                                          firmwareSlot(esp_ota_get_running_partition()))) {
        setError("pending OTA trial was not selected by this startup");
        return false;
    }

    const uint8_t previousFirmware = gState.activeFirmware;
    if (!rollbackPendingTrial()) return false;
    gStartupSelectedTrial = false;
    if (previousFirmware < 2 && previousFirmware != firmwareSlot(esp_ota_get_running_partition())) {
        const esp_partition_t* previous = firmwarePartition(previousFirmware);
        if (previous == nullptr || esp_ota_set_boot_partition(previous) != ESP_OK) {
            setError("local boot rejection could not select previous firmware");
            return false;
        }
    }
    delay(100);
    ESP.restart();
    return true;
}

void registerRoutes(AsyncWebServer& server) {
    server.on("/api/ota/status", HTTP_GET, [](AsyncWebServerRequest* request) {
        sendStatus(request);
    });
    server.on("/api/ota/upload", HTTP_POST,
              [](AsyncWebServerRequest* request) { handleUploadComplete(request); },
              nullptr, [](AsyncWebServerRequest* request, uint8_t* data,
                          size_t length, size_t index, size_t total) {
                  processUpload(request, data, length, index, total);
              });
    server.on("/api/ota/commit", HTTP_POST, [](AsyncWebServerRequest* request) {
        handleCommit(request);
    });
    server.on("/api/ota/abort", HTTP_POST, [](AsyncWebServerRequest* request) {
        handleAbort(request);
    });
}

bool enabled() {
    return gEnabled;
}

Status status() {
    Status result = {};
    result.enabled = gEnabled;
    result.bootFilesystemMounted = gBootFsMounted;
    result.pendingTrial = gPendingTrial;
    result.firmwareRollbackConfigured = gFirmwareRollbackConfigured;
#if !defined(PULSE_OTA_BOOTFS_ONLY)
    result.firmwareUpdatesEnabled = gEnabled && gFirmwareRollbackConfigured;
#endif
    result.activeBootSlot = gActiveBoot;
    result.pendingBootSlot = gPendingBoot;
    result.activeFirmwareSlot = gActiveFirmware;
    result.pendingFirmwareSlot = gPendingFirmware;
    result.error = errorText();
    return result;
}

const char* lastError() {
    return errorText();
}

}  // namespace ota
}  // namespace pulse

#elif defined(ARDUINO_ARCH_ESP32)

#include <LittleFS.h>

namespace pulse {
namespace ota {

bool begin() { return false; }
fs::FS& bootFileSystem() { return LittleFS; }
bool confirmBoot() { return false; }
bool rejectBoot(const char*) { return false; }
void registerRoutes(AsyncWebServer&) {}
bool enabled() { return false; }
Status status() { return {}; }
const char* lastError() { return "OTA A/B profile is not enabled"; }

}  // namespace ota
}  // namespace pulse

#endif

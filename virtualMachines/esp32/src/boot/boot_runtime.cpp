#include "boot_runtime.h"
#include "policy_runtime.h"

#if defined(ENABLE_PMACHINE)
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <limits>
#include "main_globals.h"

namespace pulse { namespace boot {

#if defined(ESP32)
namespace {
class SemaphoreLease {
public:
    explicit SemaphoreLease(SemaphoreHandle_t semaphore) : semaphore_(semaphore) {}
    ~SemaphoreLease() { xSemaphoreGive(semaphore_); }
    SemaphoreLease(const SemaphoreLease&) = delete;
    SemaphoreLease& operator=(const SemaphoreLease&) = delete;
private:
    SemaphoreHandle_t semaphore_;
};
}
#endif

Runtime& runtime() {
    static Runtime instance;
    return instance;
}

bool executePolicy(const std::vector<pmachine::PInstruction>& instructions,
        const std::map<std::string, std::vector<std::string>>& signatures,
        pmachine::HostCallHook hook, void* context, std::string& error) {
    return runtime().executePolicy(instructions, signatures, hook, context, error);
}

bool invokeJson(const std::string& name, const std::vector<pmachine::HostValue>& args,
                pmachine::HostValue& result, std::string& error) {
    return runtime().invokeJson(name, args, result, error);
}

bool Runtime::begin(fs::FS& filesystem, WiFiProvisioning& provisioning, const Hardware& hardware) {
    loaded_ = false;
    healthy_ = false;
    profilesLoaded_ = false;
    error_.clear();
    state_.fill(0);
    if (!hardware.apStart || !hardware.apStop || !hardware.apActive || !hardware.ffsReady
        || !hardware.ffsStart || !hardware.remoteConfigured || !hardware.remoteAvailable) {
        error_ = "incomplete boot hardware bindings";
        return false;
    }
    File page = filesystem.open("/web/provisioning.html", "r");
    if (!page || page.isDirectory() || !page.size()) {
        error_ = "LittleFS provisioning page is missing or empty";
        return false;
    }
    page.close();
    File file = filesystem.open("/boot/pmachine-boot", "r");
    if (!file || file.isDirectory() || !file.size() || file.size() > 65536) {
        error_ = "LittleFS boot program missing, empty or larger than 65536 bytes";
        return false;
    }
    std::string source(file.size(), '\0');
    const size_t read = file.read(reinterpret_cast<uint8_t*>(&source[0]), source.size());
    file.close();
    if (read != source.size()) {
        error_ = "unable to read complete LittleFS boot program";
        return false;
    }
    try {
        auto instructions = pmachine::loadTextPCode(source);
        if (instructions.empty() || instructions.size() > std::numeric_limits<uint16_t>::max()) {
            error_ = "invalid boot instruction count";
            return false;
        }
        instructions_ = std::move(instructions);
    } catch (const std::exception& exception) {
        error_ = std::string("invalid boot P-code: ") + exception.what();
        return false;
    }
    File provisioningFile = filesystem.open("/boot/pmachine-provisioning", "r");
    if (!provisioningFile || provisioningFile.isDirectory() || !provisioningFile.size()
        || provisioningFile.size() > 65536) {
        error_ = "LittleFS provisioning program missing, empty or larger than 65536 bytes";
        return false;
    }
    std::string provisioningSource(provisioningFile.size(), '\0');
    const size_t provisioningRead = provisioningFile.read(
        reinterpret_cast<uint8_t*>(&provisioningSource[0]), provisioningSource.size());
    provisioningFile.close();
    if (provisioningRead != provisioningSource.size()) {
        error_ = "unable to read complete LittleFS provisioning program";
        return false;
    }
    try {
        auto instructions = pmachine::loadTextPCode(provisioningSource);
        if (instructions.empty() || instructions.size() > std::numeric_limits<uint16_t>::max()) {
            error_ = "invalid provisioning instruction count";
            return false;
        }
        provisioningInstructions_ = std::move(instructions);
    } catch (const std::exception& exception) {
        error_ = std::string("invalid provisioning P-code: ") + exception.what();
        return false;
    }
    if (!storage_.prepare(8192)) {
        error_ = "unable to reserve boot VM execution storage";
        return false;
    }
#if defined(ESP32)
    if (!executionMutex_) executionMutex_ = xSemaphoreCreateMutex();
    if (!executionMutex_) {
        error_ = "unable to allocate boot VM execution lock";
        return false;
    }
#endif
    provisioning_ = &provisioning;
    hardware_ = hardware;
    machine_.setHostCallHook(call, this);
    lastTick_ = millis() - 100;
    loaded_ = true;
    provisioningLoaded_ = true;
#if defined(ESP32)
    Serial.printf("[BOOT] Supervisor loaded: instructions=%u heap=%u largest=%u psram=%u\n",
        static_cast<unsigned>(instructions_.size()), ESP.getFreeHeap(),
        ESP.getMaxAllocHeap(), ESP.getFreePsram());
#endif
    return true;
}

bool Runtime::poll() {
    if (!loaded_) return false;
#if defined(ESP32)
    if (!executionMutex_ || xSemaphoreTake(executionMutex_, 0) != pdTRUE) return healthy_;
    SemaphoreLease execution(executionMutex_);
#endif
    const uint32_t now = millis();
    if (static_cast<uint32_t>(now - lastTick_) < 100) return healthy_;
    lastTick_ = now;
    machine_.runImage(instructions_.size(), [this](size_t index) {
        return instructions_[index];
    }, &storage_);
    const auto& flow = machine_.getFlowState();
    const auto failure = flow.find("__runtime_error");
    const char* storageError = machine_.getHostedStorageError();
    if (failure != flow.end()) error_ = failure->second;
    else if (storageError && storageError[0]) error_ = storageError;
    else if (machine_.didLastRunHitStepLimit()) error_ = "boot supervisor exceeded instruction budget";
    if (!error_.empty()) {
        Serial.printf("[BOOT] Supervisor stopped: %s\n", error_.c_str());
        loaded_ = false;
        healthy_ = false;
        return false;
    }
    healthy_ = state_[31] == 1;
    return healthy_;
}

bool Runtime::handleProvisioningRequest(AsyncWebServerRequest* request) {
    if (!request) return false;
    if (!loaded_ || !provisioningLoaded_) {
        request->send(503, "application/json", "{\"error\":\"provisioning runtime unavailable\"}");
        return true;
    }

    std::string method;
    switch (request->method()) {
        case HTTP_GET: method = "GET"; break;
        case HTTP_POST: method = "POST"; break;
        case HTTP_DELETE: method = "DELETE"; break;
        default: method = "OTHER"; break;
    }
    const String url = request->url();
    const std::string path(url.c_str());
    std::array<std::pair<std::string, std::string>, 16> params;
    static const char* const parameterNames[] = {
        "ssid", "password", "authMode", "eapMethod", "identity", "username",
        "enterprisePassword", "hostname", "nodeName", "reboot", "dhcp",
        "staticIP", "gateway", "subnet", "dns1", "dns2"
    };
    size_t totalParameterBytes = 0;
    for (size_t index = 0; index < params.size(); ++index) {
        auto& parameter = params[index];
        parameter.first = parameterNames[index];
        parameter.second.clear();
        const char* name = parameterNames[index];
        const AsyncWebParameter* value = request->hasParam(name, true) ? request->getParam(name, true)
            : request->hasParam(name) ? request->getParam(name) : nullptr;
        if (!value) continue;
        const String text = value->value();
        if (text.length() > 256 || totalParameterBytes + text.length() > 4096) {
            request->send(413, "application/json", "{\"error\":\"provisioning parameters exceed capacity\"}");
            return true;
        }
        parameter.second.assign(text.c_str());
        totalParameterBytes += text.length();
    }

    int status = 500;
    int reboot = 0;
    std::string body;
    {
#if defined(ESP32)
        if (!executionMutex_ || xSemaphoreTake(executionMutex_, pdMS_TO_TICKS(5000)) != pdTRUE) {
            request->send(503, "application/json", "{\"error\":\"provisioning runtime busy\"}");
            return true;
        }
        SemaphoreLease execution(executionMutex_);
#endif
        requestMethod_ = method;
        requestPath_ = path;
        requestParams_ = std::move(params);
        responseStatus_ = 500;
        responseReboot_ = 0;
        responseBody_.clear();
        scanCount_ = -1;
        machine_.runImage(provisioningInstructions_.size(), [this](size_t index) {
            return provisioningInstructions_[index];
        }, &storage_);
        const auto& flow = machine_.getFlowState();
        const auto failure = flow.find("__runtime_error");
        const char* storageError = machine_.getHostedStorageError();
        if (failure != flow.end() || (storageError && storageError[0])
            || machine_.didLastRunHitStepLimit() || responseBody_.empty()) {
            responseStatus_ = 500;
            responseReboot_ = 0;
            responseBody_ = "{\"error\":\"provisioning handler failed\"}";
            Serial.println("[BOOT] Provisioning P-code dispatch failed");
        }
        status = responseStatus_;
        reboot = responseReboot_;
        body = responseBody_;
        if (requestPath_ == "/api/wifi/scan" && scanCount_ >= 0) {
            WiFi.scanDelete();
            scanCount_ = -1;
        }
    }
    request->send(status, "application/json", String(body.c_str()));
    if (reboot == 1) {
        delay(150);
        ESP.restart();
    }
    return true;
}

bool Runtime::executePolicy(const std::vector<pmachine::PInstruction>& instructions,
        const std::map<std::string, std::vector<std::string>>& signatures,
        pmachine::HostCallHook hook, void* context, std::string& error) {
    if (!loaded_) { error = "boot execution storage is unavailable"; return false; }
#if defined(ESP32)
    if (!executionMutex_ || xSemaphoreTake(executionMutex_, pdMS_TO_TICKS(5000)) != pdTRUE) {
        error = "boot execution storage is busy"; return false;
    }
    SemaphoreLease execution(executionMutex_);
#endif
    if (!storage_.prepare(pmachine::ManagedStringHeap::MAX_ARENA)) {
        error = "unable to reserve scheduler string arena"; return false;
    }
    struct HookReset {
        Runtime& runtime;
        ~HookReset() {
            runtime.machine_.setHostCallHook(Runtime::call, &runtime);
            runtime.machine_.setProcedureSignatures({});
        }
    } reset{*this};
    machine_.setProcedureSignatures(signatures);
    machine_.setHostCallHook(hook, context);
    machine_.runImage(instructions.size(), [&instructions](size_t index) {
        return instructions[index];
    }, &storage_);
    const auto& flow = machine_.getFlowState();
    const auto failure = flow.find("__runtime_error");
    const char* storageError = machine_.getHostedStorageError();
    if (failure != flow.end()) error = failure->second;
    else if (storageError && storageError[0]) error = storageError;
    else if (machine_.didLastRunHitStepLimit()) error = "policy exceeded instruction budget";
    return error.empty();
}

bool Runtime::invokeJson(const std::string& name, const std::vector<pmachine::HostValue>& args,
                        pmachine::HostValue& result, std::string& error) {
    const bool set = name == "host.json_set" || name == "host.json_embed";
    const bool array = name == "host.json_array_get" || name == "host.json_array_count"
        || name == "host.json_array_append";
    const size_t arity = set ? 3 : name == "host.json_kind" || name == "host.json_array_count" ? 1 : 2;
    if (args.size() != arity || !args[0].isString
        || (arity > 1 && (name == "host.json_array_get" ? args[1].isString : !args[1].isString))
        || (arity == 3 && name == "host.json_embed" && !args[2].isString)) {
        error = "invalid JSON primitive arguments"; return false;
    }
    for (const auto& arg : args) {
        if (arg.isString && arg.text.size() > 32768) {
            error = "JSON primitive input exceeds capacity"; return false;
        }
    }
    JsonDocument document;
    if (deserializeJson(document, args[0].text.c_str())) {
        error = "invalid JSON"; return false;
    }
    result.isString = true;
    result.text.clear();
    result.integer = 0;
    if (name == "host.json_kind") {
        const auto value = document.as<JsonVariantConst>();
        result.text = value.isNull() ? "null" : value.is<JsonObjectConst>() ? "object"
            : value.is<JsonArrayConst>() ? "array" : value.is<const char*>() ? "string"
            : value.is<bool>() ? "boolean" : "number";
        return true;
    }
    JsonVariantConst value;
    bool valueResult = false;
    if (array) {
        if (!document.is<JsonArray>()) { error = "expected JSON array"; return false; }
        auto entries = document.as<JsonArray>();
        if (name == "host.json_array_count") {
            result.isString = false; result.integer = entries.size(); return true;
        }
        if (name == "host.json_array_get") {
            if (args[1].integer < 0 || static_cast<size_t>(args[1].integer) >= entries.size()) {
                error = "JSON array index out of bounds"; return false;
            }
            value = entries[args[1].integer];
            valueResult = true;
        } else {
            JsonDocument embedded;
            if (deserializeJson(embedded, args[1].text.c_str()) || !entries.add(embedded.as<JsonVariantConst>())) {
                error = "invalid JSON array value or allocation failed"; return false;
            }
        }
    } else {
        if (!document.is<JsonObject>() || args[1].text.empty() || args[1].text.size() > 256) {
            error = "expected JSON object and key"; return false;
        }
        const char* key = args[1].text.c_str();
        const bool present = document.as<JsonObjectConst>().containsKey(key);
        if (name == "host.json_has") {
            result.isString = false; result.integer = present; return true;
        }
        if (name == "host.json_set") {
            if (args[2].isString) document[key] = args[2].text;
            else document[key] = args[2].integer;
        } else if (name == "host.json_embed") {
            JsonDocument embedded;
            if (deserializeJson(embedded, args[2].text.c_str())) {
                error = "invalid embedded JSON"; return false;
            }
            document[key].set(embedded.as<JsonVariantConst>());
        } else {
            if (!present) { error = "missing JSON field"; return false; }
            value = document[key];
            if (name == "host.json_integer") {
                if (!value.is<int32_t>()) { error = "expected integer field"; return false; }
                result.isString = false; result.integer = value.as<int32_t>(); return true;
            }
            if (name == "host.json_text") {
                if (!value.is<const char*>()) { error = "expected string field"; return false; }
                result.text = value.as<const char*>(); return true;
            }
            if (name != "host.json_value") { error = "unknown JSON primitive"; return false; }
            valueResult = true;
        }
    }
    const size_t expected = valueResult ? measureJson(value) : measureJson(document);
    if (document.overflowed() || expected > 32768) {
        error = "JSON serialization exceeded capacity"; return false;
    }
    const size_t written = valueResult ? serializeJson(value, result.text) : serializeJson(document, result.text);
    if (written != expected) { error = "incomplete JSON serialization"; return false; }
    return true;
}

bool Runtime::call(const std::string& name, const std::vector<pmachine::HostValue>& args,
                   pmachine::HostValue& result, std::string& error, void* context) {
    return static_cast<Runtime*>(context)->invoke(name, args, result, error);
}

bool Runtime::invoke(const std::string& name, const std::vector<pmachine::HostValue>& args,
                     pmachine::HostValue& result, std::string& error) {
    if (name.rfind("host.json_", 0) == 0) return invokeJson(name, args, result, error);
    const bool slotGet = name == "host.boot_state_get";
    const bool slotSet = name == "host.boot_state_set";
    const bool profileStart = name == "host.boot_profile_start";
    const bool ffsStart = name == "host.boot_ffs_start";
    const bool log = name == "host.boot_log";
    const bool raise = name == "host.raise_error";
    auto expect = [&](std::initializer_list<bool> types) {
        if (args.size() != types.size()) { error = "invalid boot primitive arity: " + name; return false; }
        size_t index = 0;
        for (bool isString : types) {
            if (args[index++].isString != isString) {
                error = "invalid boot primitive argument: " + name;
                return false;
            }
        }
        return true;
    };
    result.isString = false;
    result.integer = 0;
    result.text.clear();
    if (slotGet || slotSet) {
        if (!expect(slotSet ? std::initializer_list<bool>{false, false}
                            : std::initializer_list<bool>{false})) return false;
        if (args[0].integer < 0 || static_cast<size_t>(args[0].integer) >= state_.size()) {
            error = "boot state slot out of range"; return false;
        }
        if (slotSet) state_[args[0].integer] = args[1].integer;
        else result.integer = state_[args[0].integer];
    } else if (name == "host.boot_millis") {
        if (!expect({})) return false;
        result.integer = millis() & 0x7fffffffU;
    } else if (name == "host.boot_wifi_connected") {
        if (!expect({})) return false;
        result.integer = WiFi.status() == WL_CONNECTED;
    }
    else if (name == "host.boot_profile_count") {
        if (!expect({})) return false;
        const uint32_t revision = provisioning_->credentialRevision();
        if (!profilesLoaded_ || profileRevision_ != revision) {
            profiles_.clear();
            if (!provisioning_->loadCredentialsList(profiles_) && provisioning_->hasStoredCredentials()) {
                if (!profileReadErrorLogged_) Serial.println("[BOOT] Stored profiles unreadable; provisioning is required");
                profileReadErrorLogged_ = true;
            } else profileReadErrorLogged_ = false;
            profileRevision_ = revision;
            profilesLoaded_ = true;
        }
        result.integer = static_cast<int>(profiles_.size());
    } else if (profileStart) {
        if (!expect({false})) return false;
        if (args[0].integer < 0 || static_cast<size_t>(args[0].integer) >= profiles_.size()) {
            error = "boot Wi-Fi profile index out of range"; return false;
        }
        result.integer = provisioning_->beginConnection(profiles_[args[0].integer]);
    } else if (name == "host.boot_ap_start" || name == "host.boot_ap_stop"
               || name == "host.boot_ap_active" || name == "host.boot_ffs_ready"
               || name == "host.boot_remote_configured" || name == "host.boot_remote_available") {
        if (!expect({})) return false;
        if (name == "host.boot_ap_start") result.integer = hardware_.apStart();
        else if (name == "host.boot_ap_stop") result.integer = hardware_.apStop();
        else if (name == "host.boot_ap_active") result.integer = hardware_.apActive();
        else if (name == "host.boot_ffs_ready") result.integer = hardware_.ffsReady();
        else if (name == "host.boot_remote_configured") result.integer = hardware_.remoteConfigured();
        else result.integer = hardware_.remoteAvailable();
    }
    else if (ffsStart) {
        if (!expect({false})) return false;
        if (args[0].integer < 0 || args[0].integer > 2) { error = "invalid boot FFS backend"; return false; }
        result.integer = hardware_.ffsStart(args[0].integer);
    } else if (log) {
        if (!expect({true})) return false;
        Serial.printf("[BOOT] %s\n", args[0].text.c_str());
    } else if (raise) {
        if (!expect({true})) return false;
        error = args[0].text;
        return false;
    } else if (name == "host.boot_text_trim" || name == "host.boot_text_lower") {
        if (!expect({true})) return false;
        String text(args[0].text.c_str());
        if (name == "host.boot_text_trim") text.trim();
        else text.toLowerCase();
        result.isString = true;
        result.text.assign(text.c_str());
    } else if (name == "host.boot_provision_method" || name == "host.boot_provision_path"
               || name == "host.boot_current_node_name") {
        if (!expect({})) return false;
        result.isString = true;
        if (name == "host.boot_provision_method") result.text = requestMethod_;
        else if (name == "host.boot_provision_path") result.text = requestPath_;
        else result.text.assign(nodeName.c_str());
    } else if (name == "host.boot_provision_param") {
        if (!expect({true})) return false;
        result.isString = true;
        for (const auto& parameter : requestParams_) {
            if (parameter.first == args[0].text) {
                result.text = parameter.second;
                break;
            }
        }
    } else if (name == "host.boot_provision_respond") {
        if (!expect({false, true, false})) return false;
        if (args[0].integer < 100 || args[0].integer > 599
            || args[1].text.size() > 16384 || (args[2].integer != 0 && args[2].integer != 1)) {
            error = "invalid provisioning response";
            return false;
        }
        responseStatus_ = args[0].integer;
        responseBody_ = args[1].text;
        responseReboot_ = args[2].integer;
        result.integer = 1;
    } else if (name == "host.boot_wifi_scan_count") {
        if (!expect({})) return false;
        scanCount_ = -1;
        if (provisioning_->startWiFiScanner()) {
            scanCount_ = WiFi.scanComplete();
            if (scanCount_ < 0) scanCount_ = WiFi.scanNetworks();
        }
        if (scanCount_ < 0) scanCount_ = -1;
        result.integer = scanCount_;
    } else if (name == "host.boot_wifi_scan_ssid" || name == "host.boot_wifi_scan_rssi"
               || name == "host.boot_wifi_scan_channel" || name == "host.boot_wifi_scan_secure") {
        if (!expect({false})) return false;
        const int index = args[0].integer;
        if (index < 0 || index >= scanCount_) { error = "Wi-Fi scan index out of range"; return false; }
        if (name == "host.boot_wifi_scan_ssid") {
            result.isString = true;
            result.text.assign(WiFi.SSID(index).c_str());
        } else if (name == "host.boot_wifi_scan_rssi") result.integer = WiFi.RSSI(index);
        else if (name == "host.boot_wifi_scan_channel") result.integer = WiFi.channel(index);
        else {
#if defined(ARDUINO_ARCH_ESP8266)
            result.integer = WiFi.encryptionType(index) != ENC_TYPE_NONE;
#else
            result.integer = WiFi.encryptionType(index) != WIFI_AUTH_OPEN;
#endif
        }
    } else if (name == "host.boot_wifi_profile_field") {
        if (!expect({false, true})) return false;
        const int index = args[0].integer;
        if (index < 0 || static_cast<size_t>(index) >= profiles_.size()) {
            error = "Wi-Fi profile index out of range";
            return false;
        }
        const auto& profile = profiles_[index];
        const std::string& field = args[1].text;
        result.isString = true;
        if (field == "ssid") result.text.assign(profile.ssid.c_str());
        else if (field == "hostname") result.text.assign(profile.hostname.c_str());
        else if (field == "authMode") result.text.assign(profile.authMode.c_str());
        else if (field == "eapMethod") result.text.assign(profile.eapMethod.c_str());
        else if (field == "identity") result.text.assign(profile.identity.c_str());
        else if (field == "username") result.text.assign(profile.username.c_str());
        else if (field == "dhcp") result.text = profile.dhcp ? "1" : "0";
        else if (field == "staticIP") result.text.assign(profile.staticIP.c_str());
        else { error = "unsupported Wi-Fi profile field"; return false; }
    } else if (name == "host.boot_wifi_profile_has_password") {
        if (!expect({false, false})) return false;
        const int index = args[0].integer;
        if (index < 0 || static_cast<size_t>(index) >= profiles_.size()
            || (args[1].integer != 0 && args[1].integer != 1)) {
            error = "Wi-Fi profile secret index out of range";
            return false;
        }
        const auto& profile = profiles_[index];
        result.integer = args[1].integer == 0 ? !profile.password.isEmpty()
            : !profile.enterprisePassword.isEmpty() || !profile.password.isEmpty();
    } else if (name == "host.boot_save_wifi_profile") {
        if (!expect({true, true, true, true, true, true, true, true, false,
                     true, true, true, true, true})) return false;
        WiFiCredentials profile;
        profile.ssid = args[0].text.c_str();
        profile.password = args[1].text.c_str();
        profile.authMode = args[2].text.c_str();
        profile.eapMethod = args[3].text.c_str();
        profile.identity = args[4].text.c_str();
        profile.username = args[5].text.c_str();
        profile.enterprisePassword = args[6].text.c_str();
        profile.hostname = args[7].text.c_str();
        profile.dhcp = args[8].integer == 1;
        profile.staticIP = args[9].text.c_str();
        profile.gateway = args[10].text.c_str();
        profile.subnet = args[11].text.c_str();
        profile.dns1 = args[12].text.c_str();
        profile.dns2 = args[13].text.c_str();
        result.integer = provisioning_->addOrUpdateCredential(profile, 5);
        if (result.integer == 1) {
            provisioning_->eraseLegacyCredentialStores();
            profilesLoaded_ = false;
        }
    } else if (name == "host.boot_clear_wifi_profiles") {
        if (!expect({})) return false;
        result.integer = provisioning_->clearCredentials();
        WiFi.disconnect(true, true);
        profilesLoaded_ = false;
    } else if (name == "host.boot_save_node_name") {
        if (!expect({true})) return false;
        String applied;
        const bool saved = provisioning_->saveNodeName(String(args[0].text.c_str()), applied);
        result.isString = true;
        if (saved) result.text.assign(applied.c_str());
    } else { error = "unavailable boot primitive: " + name; return false; }
    return true;
}

}}
#endif

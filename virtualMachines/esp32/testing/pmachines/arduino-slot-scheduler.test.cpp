#include "pmachine.h"
#include "../../pmachines/shared/slot-scheduler/slot_scheduler_pcode.h"
#include <ArduinoJson.h>
#include <cassert>
#include <iostream>

struct Hardware {
    std::map<int, std::string> slots;
    std::string operation, request, saved = "{\"version\":1,\"slots\":[]}", response;
    int status = 0, executions = 0;
};

static bool call(const std::string& name, const std::vector<pmachine::HostValue>& args,
                 pmachine::HostValue& result, std::string& error, void* context) {
    auto& hardware = *static_cast<Hardware*>(context);
    result.isString = false;
    result.integer = 0;
    if (name == "host.scheduler_operation") { result.isString = true; result.text = hardware.operation; }
    else if (name == "host.scheduler_request") { result.isString = true; result.text = hardware.request; }
    else if (name == "host.scheduler_error") { result.isString = true; result.text = "test failure"; }
    else if (name == "host.scheduler_saved_state") { result.isString = true; result.text = hardware.saved; }
    else if (name == "host.scheduler_commit") { hardware.saved = args.at(0).text; result.integer = 1; }
    else if (name == "host.scheduler_slot") {
        const auto found = hardware.slots.find(args.at(0).integer);
        result.isString = true;
        result.text = found == hardware.slots.end() ? "{}" : found->second;
    } else if (name == "host.scheduler_read") {
        JsonDocument manifest;
        manifest["type"] = args.at(0).text.find("transient") != std::string::npos ? "transient" : "service";
        manifest["storagePath"] = "/pmachine/programs/example/versions/test-v1";
        manifest["entry"] = "program.pcode";
        manifest["programMap"] = "program.map.json";
        manifest["sha256"] = std::string(64, 'a');
        result.isString = true;
        serializeJson(manifest, result.text);
    } else if (name == "host.scheduler_stage") {
        const int slot = args.at(0).integer;
        assert(slot >= 1 && slot <= 16 && !hardware.slots.count(slot));
        hardware.slots[slot] = args.at(1).text;
        result.integer = 200;
    } else if (name == "host.scheduler_activate") { ++hardware.executions; result.integer = 200; }
    else if (name == "host.scheduler_remove") { hardware.slots.erase(args.at(0).integer); result.integer = 200; }
    else if (name == "host.scheduler_respond") {
        hardware.status = args.at(0).integer; hardware.response = args.at(1).text; result.integer = 1;
    } else if (name.rfind("host.json_", 0) == 0) {
        JsonDocument doc;
        if (deserializeJson(doc, args.at(0).text)) { error = "invalid JSON"; return false; }
        result.isString = true;
        if (name == "host.json_kind") {
            result.text = doc.is<JsonObject>() ? "object" : doc.is<JsonArray>() ? "array"
                : doc.is<const char*>() ? "string" : doc.isNull() ? "null" : "number";
        } else if (name == "host.json_has") {
            result.isString = false;
            result.integer = doc.as<JsonObjectConst>().containsKey(args.at(1).text.c_str());
        } else if (name == "host.json_text") {
            assert(doc[args.at(1).text].is<const char*>());
            result.text = doc[args.at(1).text].as<const char*>();
        } else if (name == "host.json_integer") {
            assert(doc[args.at(1).text].is<int>());
            result.isString = false; result.integer = doc[args.at(1).text].as<int>();
        } else if (name == "host.json_value") serializeJson(doc[args.at(1).text], result.text);
        else if (name == "host.json_array_count") {
            result.isString = false; result.integer = doc.size();
        } else if (name == "host.json_array_get") serializeJson(doc[args.at(1).integer], result.text);
        else {
            if (name == "host.json_set") {
                if (args.at(2).isString) doc[args.at(1).text] = args.at(2).text;
                else doc[args.at(1).text] = args.at(2).integer;
            } else {
                JsonDocument value;
                const bool append = name == "host.json_array_append";
                if (!append && name != "host.json_embed") { error = name; return false; }
                assert(!deserializeJson(value, args.at(append ? 1 : 2).text));
                if (append) assert(doc.as<JsonArray>().add(value.as<JsonVariantConst>()));
                else doc[args.at(1).text].set(value.as<JsonVariantConst>());
            }
            serializeJson(doc, result.text);
        }
    } else { error = "Unexpected scheduler call: " + name; return false; }
    return true;
}

int main() {
    const auto instructions = pmachine::loadTextPCode(pmachine::SLOT_SCHEDULER_PCODE);
    JsonDocument metadata;
    assert(!deserializeJson(metadata, pmachine::SLOT_SCHEDULER_MAP));
    std::map<std::string, std::vector<std::string>> signatures;
    for (JsonPair procedure : metadata["procedures"].as<JsonObject>()) {
        for (const char* param : procedure.value()["params"].as<JsonArray>())
            signatures[procedure.key().c_str()].push_back(param);
        for (const char* local : procedure.value()["locals"].as<JsonArray>())
            signatures[std::string("@locals:") + procedure.key().c_str()].push_back(local);
    }
    Hardware hardware;
    pmachine::PMachine machine;
    pmachine::HostExecutionStorage storage;
    assert(storage.prepare(pmachine::ManagedStringHeap::MAX_ARENA));
    machine.setProcedureSignatures(signatures);
    machine.setHostCallHook(call, &hardware);
    const auto run = [&](const std::string& operation, const std::string& request) {
        hardware.operation = operation; hardware.request = request; hardware.response.clear();
        machine.runImage(instructions.size(), [&](size_t index) { return instructions[index]; }, &storage);
        const auto& flow = machine.getFlowState();
        const auto error = flow.find("__runtime_error");
        if (error != flow.end()) { std::cerr << error->second << '\n'; std::abort(); }
        if (machine.getHostedStorageError() && machine.getHostedStorageError()[0]) {
            std::cerr << machine.getHostedStorageError() << '\n'; std::abort();
        }
        assert(!machine.didLastRunHitStepLimit() && !hardware.response.empty());
        return hardware.status;
    };
    assert(run("status", "{}") == 200);
    assert(run("load", "{\"slot\":0}") == 403);
    for (int index = 1; index <= 16; ++index) {
        const std::string request = "{\"manifestPath\":\"/pmachine/programs/probe-"
            + std::to_string(index) + "/manifest.json\"}";
        assert(run("load", request) == 201);
        assert(hardware.slots.count(index));
    }
    assert(hardware.executions == 16);
    assert(run("load", "{\"manifestPath\":\"/pmachine/programs/overflow/manifest.json\"}") == 409);
    hardware.slots.clear();
    assert(run("restore", "{}") == 200);
    assert(hardware.slots.size() == 16 && hardware.executions == 32);
    assert(run("restore", "{}") == 200 && hardware.executions == 32);
    assert(run("unload", "{\"slot\":16}") == 200);
    assert(run("load", "{\"slot\":16,\"manifestPath\":\"/pmachine/programs/transient/manifest.json\"}") == 201);
    assert(hardware.slots.size() == 15 && hardware.executions == 33);
    std::cout << "Arduino interpreter executed sixteen-slot Kotlin scheduler and recovery\n";
}

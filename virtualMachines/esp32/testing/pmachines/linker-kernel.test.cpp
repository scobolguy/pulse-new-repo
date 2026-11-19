#include "../../pmachines/native/src/native_service.hpp"
#include "../../pmachines/arduino/src/pmachine_dynamic_library.h"

#include <cassert>
#include <functional>
#include <iostream>
#include <iterator>
#include <type_traits>

namespace image = pulse::image;
namespace native = pulse::native;

template<class Action> void fails(Action action) {
    bool failed = false;
    try { action(); } catch (const std::exception&) { failed = true; }
    assert(failed);
}

image::Image readFixture(const std::string& bytes, const std::string& hash) {
    assert(bytes.substr(0, 4) == "PMI1");
    size_t cursor = 4;
    const auto text = [&]() {
        const auto colon = bytes.find(':', cursor);
        assert(colon != std::string::npos);
        const auto size = std::stoul(bytes.substr(cursor, colon - cursor));
        cursor = colon + 1;
        assert(size <= bytes.size() - cursor);
        const auto value = bytes.substr(cursor, size);
        cursor += size;
        return value;
    };
    const auto number = [&]() { return static_cast<uint32_t>(std::stoul(text())); };
    image::Image result;
    result.formatVersion = number();
    result.abi = text();
    result.moduleId = text();
    result.contentHash = hash;
    const auto instructions = number();
    for (uint32_t n = 0; n < instructions; ++n) {
        image::Instruction i;
        i.op = text(); i.operand = text(); i.target = number(); i.argCount = number();
        result.instructions.push_back(i);
    }
    const auto entries = number();
    for (uint32_t n = 0; n < entries; ++n) {
        image::Entry e;
        e.entry = number(); e.returnsValue = number() != 0;
        const auto params = number();
        for (uint32_t p = 0; p < params; ++p) e.params.push_back(text());
        result.entries.push_back(e);
    }
    const auto globals = number();
    for (uint32_t n = 0; n < globals; ++n) result.globals.push_back(text());
    assert(cursor == bytes.size());
    return result;
}

image::Image signedImage(image::Image value, const std::string& id) {
    value.moduleId = id;
    value.contentHash = native::imageContentHash(value);
    return value;
}

int main(int argc, char** argv) {
    assert(argc == 2);
    const std::string bytes{std::istreambuf_iterator<char>(std::cin), std::istreambuf_iterator<char>()};
    auto fixture = readFixture(bytes, argv[1]);
    assert(native::imageContentHash(fixture) == fixture.contentHash);
    static_assert(std::is_same<pmachine::ImageKernelContext, image::Context>::value, "One C++ kernel");
    auto task = native::createImageContext();
    auto handle = task->stage(fixture);
    task->bind(handle, 7, 0, 1);
    fails([&] { native::callImage(*task, 7, {int64_t{20}}); });
    fails([&] { task->stage(fixture); });
    task->commit(handle);
    fails([&] { task->commit(handle); });
    fixture.instructions[1].operand = "99"; // The installed copy must be immutable.
    const auto first = std::get<int64_t>(native::callImage(*task, 7, {int64_t{20}}));
    const auto second = std::get<int64_t>(native::callImage(*task, 7, {int64_t{20}}));
    assert(first == 41 && second == 42);
    fails([&] { native::callImage(*task, 7); });
    fails([&] { native::callImage(*task, 7, {int64_t{INT64_MAX}}); });
    fails([&] { task->stage(fixture); });
    auto original = readFixture(bytes, argv[1]);
    auto other = native::createImageContext();
    auto otherHandle = other->stage(original);
    fails([&] { task->bind(otherHandle, 8, 0, 1); });
    other->bind(otherHandle, 7, 0, 1);
    other->commit(otherHandle);
    const auto isolated = std::get<int64_t>(native::callImage(*other, 7, {int64_t{20}}));
    assert(isolated == 41);
    {
        auto reference = task->acquire(7, 1);
        fails([&] { task->release(); });
        fails([&] { task->acquire(7, 1); });
    }
    auto conflict = signedImage(original, original.moduleId);
    conflict.instructions[1].operand = "3";
    conflict.contentHash = native::imageContentHash(conflict);
    fails([&] { task->stage(conflict); });

    auto pending1 = task->stage(signedImage(original, "pending1"));
    auto pending2 = task->stage(signedImage(original, "pending2"));
    task->bind(pending1, 8, 0, 1);
    task->bind(pending2, 8, 0, 1);
    task->bind(pending2, 9, 0, 1);
    task->commit(pending1);
    fails([&] { task->commit(pending2); });
    fails([&] { native::callImage(*task, 9, {int64_t{20}}); });
    task->abort(pending2);
    fails([&] { task->abort(pending2); });
    auto bad = signedImage(original, "bad");
    bad.instructions[5].target = UINT32_MAX;
    bad.contentHash = native::imageContentHash(bad);
    fails([&] { task->stage(bad); });
    bad = signedImage(original, "bad");
    bad.instructions[5].argCount = 2;
    bad.contentHash = native::imageContentHash(bad);
    fails([&] { task->stage(bad); });
    bad = signedImage(original, "bad");
    bad.instructions[0].op = "CALL_EXT";
    bad.contentHash = native::imageContentHash(bad);
    fails([&] { task->stage(bad); });
    bad = signedImage(original, "bad");
    bad.instructions[1].operand = "2147483648";
    bad.contentHash = native::imageContentHash(bad);
    fails([&] { task->stage(bad); });

    image::Image broken;
    broken.moduleId = "failed-initialization";
    broken.instructions = {{"ADD", "", 0, 0}, {"RET", "", 0, 0}};
    broken.entries = {{0, {}, true}};
    broken.contentHash = native::imageContentHash(broken);
    auto stagedInit = task->stage(broken);
    task->bind(stagedInit, 10, 0, 0);
    fails([&] { native::callStagedImage(*task, stagedInit, 0); });
    task->abort(stagedInit);
    fails([&] { native::callImage(*task, 10); });

    image::Limits limited;
    limited.maxInstructions = 1;
    auto constrained = native::createImageContext(limited);
    fails([&] { constrained->stage(original); });
    limited = {}; limited.maxImageBytes = 10;
    constrained = native::createImageContext(limited);
    fails([&] { constrained->stage(original); });
    limited = {}; limited.maxGlobals = 0;
    constrained = native::createImageContext(limited);
    fails([&] { constrained->stage(original); });
    limited = {}; limited.maxModules = 0;
    constrained = native::createImageContext(limited);
    fails([&] { constrained->stage(original); });
    limited = {}; limited.maxArity = 0;
    constrained = native::createImageContext(limited);
    fails([&] { constrained->stage(original); });
    limited = {}; limited.maxSlots = 1;
    constrained = native::createImageContext(limited);
    auto limitedStage = constrained->stage(original);
    fails([&] { constrained->bind(limitedStage, 1, 0, 1); });
    fails([&] { constrained->bind(limitedStage, 0, 0, 0); });
    constrained->abort(limitedStage);
    limited = {}; limited.maxInstructions = static_cast<uint32_t>(original.instructions.size());
    constrained = native::createImageContext(limited);
    limitedStage = constrained->stage(original);
    fails([&] { constrained->stage(signedImage(original, "too-many-reserved")); });
    constrained->abort(limitedStage);
    limitedStage = constrained->stage(original);
    constrained->abort(limitedStage);

    image::Image wide;
    wide.moduleId = "wide-entry";
    wide.instructions.resize(65536, image::Instruction{"NOP", "", 0, 0});
    wide.instructions.push_back({"PUSH_INT", "17", 0, 0});
    wide.instructions.push_back({"RET", "", 0, 0});
    wide.entries = {{65536, {}, true}};
    wide.contentHash = native::imageContentHash(wide);
    auto wideTask = native::createImageContext();
    auto wideHandle = wideTask->stage(wide);
    wideTask->bind(wideHandle, 0, 65536, 0);
    wideTask->commit(wideHandle);
    assert(std::get<int64_t>(native::callImage(*wideTask, 0)) == 17);
    image::Image text;
    text.moduleId = "utf8";
    const std::string utf8 = std::string("\xc3\xa9\xf0\x9f\xa7\xaa") + std::string("\0\1", 2);
    text.instructions = {{"PUSH_STR", utf8, 0, 0}, {"RET", "", 0, 0}};
    text.entries = {{0, {}, true}};
    text.contentHash = native::imageContentHash(text);
    auto textHandle = wideTask->stage(text);
    wideTask->bind(textHandle, 1, 0, 0);
    wideTask->commit(textHandle);
    assert(std::get<std::string>(native::callImage(*wideTask, 1)) == utf8);
    task->release();
    fails([&] { native::callImage(*task, 7, {int64_t{20}}); });
    fails([&] { task->stage(original); });
    std::cout << first << "," << second << "," << isolated << "\n" << text.contentHash << "\n";
}

#include "../../pmachines/arduino/src/managed_references.h"
#include "../../pmachines/arduino/src/hosted_frame_storage.h"
#include "../../pmachines/arduino/src/checkpoint_scalar.h"
#include <cassert>
#include <type_traits>

int main() {
    using namespace pmachine;
    static_assert(std::is_trivially_copyable<Value>::value, "Values must remain compact copyable handles");
    static_assert(sizeof(Value) <= 16, "New kinds must not increase stack value storage");
    HostedFrameStorage frames;
    assert(!frames.store("A", 42));
    const uint64_t globalIdentity = frames.identity(0);
    assert(!frames.push(10));
    assert(!frames.store("A", 99));
    const uint64_t localIdentity = frames.identity(1);
    assert(frames.findInFrame(0, "A")->i == 42);
    assert(frames.findInFrame(1, "A")->i == 99);
    ManagedReferences references;
    VariableReference target;
    target.frame = 1;
    target.identity = localIdentity;
    target.name = "A";
    Value reference;
    assert(references.store(target, reference));
    assert(reference.isReference());
    assert(references.get(reference)->identity == localIdentity);
    Value duplicate;
    assert(references.store(target, duplicate));
    assert(reference.handle == duplicate.handle);
    int returnPc = 0;
    assert(frames.pop(returnPc) && returnPc == 10);
    assert(frames.identity(1) == 0);
    assert(!frames.push(20));
    assert(frames.identity(1) != localIdentity);
    assert(frames.identity(0) == globalIdentity);
    references.sweep([](uint16_t) { return false; });
    assert(!references.get(reference));
    for (size_t index = 0; index < ManagedReferences::CAPACITY; ++index) {
        target.name = std::to_string(index);
        assert(references.store(target, reference));
    }
    target.name = "overflow";
    assert(!references.store(target, reference));
    references.sweep([](uint16_t) { return false; });
    target.name.assign(ManagedReferences::NAME_BYTES, 'x');
    assert(!references.store(target, reference));
    std::string encoded;
    assert(!encodeCheckpointScalar(Value::makeDecimal(1), encoded));
    assert(!encodeCheckpointScalar(Value::makeReference(1), encoded));
    assert(!decodeCheckpointScalar(ValueKind::Reference, "00000001", reference));
    assert(!decodeCheckpointScalar(ValueKind::DecimalRef, "00000001", reference));
}

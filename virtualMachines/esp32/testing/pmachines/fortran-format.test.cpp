#include "../../pmachines/arduino/src/fortran_format.h"
#include <cassert>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <sstream>

using namespace pmachine;
static FortranScalar i(int value) { return FortranScalar(Value(value)); }
static FortranScalar r(double value) { return FortranScalar(Value::makeReal(value)); }
static FortranScalar s(const std::string& value) { return FortranScalar(value); }
static std::string hex(const std::string& text) {
    std::ostringstream result;
    for (unsigned char c : text) result << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(c);
    return result.str();
}
static std::string unhex(const std::string& text) {
    std::string result;
    for (size_t index = 0; index + 1 < text.size(); index += 2)
        result += static_cast<char>(std::stoi(text.substr(index, 2), nullptr, 16));
    return result;
}

int main(int argc, char**) {
    if (argc > 1) {
        std::string format;
        while (std::getline(std::cin, format)) {
            std::string count;
            std::getline(std::cin, count);
            std::vector<FortranFormatItem> items;
            for (int index = 0; index < std::stoi(count); ++index) {
                std::string line;
                std::getline(std::cin, line);
                const char tag = line[0];
                const std::string data = line.substr(2);
                FortranFormatItem item;
                item.tag = tag;
                if (tag == 'C') item.value = s(unhex(data));
                else if (tag == 'I' || tag == 'L') item.value = i(std::stoi(data));
                else if (tag == 'Z') {
                    std::istringstream pair(data);
                    double re, im;
                    pair >> re >> im;
                    item.value = r(re); item.imaginary = r(im);
                } else item.value = FortranScalar(tag == 'D' ? Value::makeDouble(std::stod(data)) : Value::makeReal(std::stod(data)));
                items.push_back(item);
            }
            std::vector<std::string> rows;
            std::string error;
            if (!renderFortranFormat(unhex(format), items, rows, error)) std::cout << "ERR " << hex(error) << '\n';
            else for (const auto& row : rows) std::cout << "ROW " << hex(row) << '\n';
            std::cout << "END\n";
        }
        return 0;
    }
    std::vector<std::string> rows;
    std::string error;
    assert(renderFortranFormat("(I3,2F5.1)", {{'I', i(42), {}}, {'Z', r(1), r(2)}}, rows, error));
    assert(rows == std::vector<std::string>{" 42  1.0  2.0"});
    assert(renderFortranFormat("('HEAD',2(I2),'/')", {{'I', i(1), {}}, {'I', i(2), {}}, {'I', i(3), {}}}, rows, error));
    assert((rows == std::vector<std::string>{"HEAD 1 2/", " 3"}));
    for (const auto& format : {"(I0)", "(I2.3)", "(F4)", "(Q3)", "(0I3)", "(2('x')", "('unterminated)",
                              "(8192(8192I1))", "(T0)", "(E8.2E0)"}) {
        FortranFormatProgram program;
        assert(!parseFortranFormat(format, program, error) && !error.empty());
    }
    assert(!renderFortranFormat("(2X)", {{'I', i(1), {}}}, rows, error) && rows.empty());
    assert(!renderFortranFormat("(A)", {{'I', i(1), {}}}, rows, error));
    assert(!renderFortranFormat("(8192X,A)", {{'C', s("x"), {}}}, rows, error));
    assert(!renderFortranFormat("(1024/)", {}, rows, error));
    assert(!renderFortranFormat("(I1)", std::vector<FortranFormatItem>(1025), rows, error));
    assert(!renderFortranFormat("(2P,E10.0)", {{'R', r(1), {}}}, rows, error));
    assert(!renderFortranFormat("(16(16(16(16(I1)))))", {}, rows, error));

    FortranFormatReader reader;
    FortranScalar value;
    assert(reader.begin("(I3,F5.2,D10.3,L2,A4)", {" 42" " 1234" " 1.234D+01" " T" "TEXT"}, false, error));
    assert(reader.read('I', 0, value, error) && value.value.i == 42);
    assert(reader.read('R', 0, value, error) && value.value.asReal() == Value::makeReal(12.34).asReal());
    assert(reader.read('D', 0, value, error) && value.value.isDouble() && value.value.asReal() == 12.34);
    assert(reader.read('L', 0, value, error) && value.value.i == 1);
    assert(reader.read('C', 2, value, error) && value.text == "XT");
    assert(!reader.read('I', 0, value, error) && reader.status() == -1);
    assert(reader.begin("(BZ,I4,BN,I4)", {"1 2 1 2 "}, false, error));
    assert(reader.read('I', 0, value, error) && value.value.i == 102);
    assert(reader.read('I', 0, value, error) && value.value.i == 12);
    assert(reader.begin("(2P,F4.1)", {"1234"}, false, error));
    assert(reader.read('D', 0, value, error) && value.value.asReal() == 1.234);
    assert(reader.begin("(I2,/,I2)", {"12", "34"}, false, error));
    assert(reader.read('I', 0, value, error) && value.value.i == 12);
    assert(reader.read('I', 0, value, error) && value.value.i == 34);
    assert(reader.begin("(T3,I2,TL4,I2)", {"1234"}, false, error));
    assert(reader.read('I', 0, value, error) && value.value.i == 34);
    assert(reader.read('I', 0, value, error) && value.value.i == 12);
    assert(reader.begin("(F8.2)", {"12.3-02"}, false, error));
    assert(reader.read('D', 0, value, error) && value.value.asReal() == .123);
    assert(reader.begin("(I4)", {"nope"}, false, error));
    assert(!reader.read('I', 0, value, error) && reader.status() == 1);
    assert(reader.begin("(I4)", {"0x12"}, false, error));
    assert(!reader.read('I', 0, value, error));
    assert(reader.begin("(I4)", {"0x12"}, false, error));
    assert(!reader.read('R', 0, value, error));
    assert(!reader.begin("(*)", {"1"}, false, error));
    assert(reader.begin("*", {"2*3,,/ 99"}, false, error));
    assert(reader.read('I', 0, value, error) && value.value.i == 3);
    assert(reader.read('I', 0, value, error) && value.value.i == 3);
    assert(reader.read('I', 0, value, error) && !reader.present());
    assert(reader.read('I', 0, value, error) && !reader.present());

    FortranFormatRuntime runtime;
    std::vector<FortranScalar> results;
    const auto call = [&](const std::string& op, const std::vector<FortranScalar>& args) {
        return runtime.execute("fortran." + op, args, results, rows, error);
    };
    assert(call("iobegin", {}) && call("iocontrol", {s("UNIT"), i(6)}));
    assert(call("iocontrol", {s("FMT"), s("('VALUE=',I3)")}));
    assert(call("begin", {}) && call("item", {i(42), s("I")}));
    assert(call("write", {}) && rows == std::vector<std::string>{"VALUE= 42"});
    assert(call("iobegin", {}) && call("iocontrol", {s("INTERNAL"), s("    ")}));
    assert(call("iocontrol", {s("FMT"), s("(I3)")}) && call("iocontrol", {s("RECL"), i(4)}));
    assert(call("begin", {}) && call("item", {i(73), s("I")}) && call("write", {}));
    assert(call("internalrecord", {i(0)}) && results[0].text == " 73");
    assert(call("iobegin", {}) && call("iocontrol", {s("INTERNAL"), s(" 73")}));
    assert(call("iocontrol", {s("FMT"), s("(I3)")}) && call("readbegin", {}));
    assert(call("readvalue", {s("I"), i(0)}) && results[0].value.i == 73);
    assert(call("readpresent", {}) && results[0].value.i == 1);
    assert(call("readend", {}));
    assert(!call("item", {i(1), s("I")}));
    assert(!call("begin", {i(1)}));
    assert(call("iobegin", {}) && call("iocontrol", {s("UNIT"), i(12)}));
    assert(call("iocontrol", {s("FMT"), s("(I3)")}) && call("iocontrol", {s("IOSTAT"), i(1)}));
    assert(call("begin", {}) && call("item", {i(1), s("I")}) && call("write", {}) && rows.empty());
    assert(call("iostatus", {}) && results[0].value.i == 1);
    assert(call("iobegin", {}) && call("iocontrol", {s("INTERNAL"), s("bad")}));
    assert(call("iocontrol", {s("FMT"), s("(I3)")}) && call("iocontrol", {s("ERR"), i(1)}));
    assert(call("readbegin", {}) && call("readvalue", {s("I"), i(0)}));
    assert(call("readpresent", {}) && results[0].value.i == 0);
    assert(call("iostatus", {}) && results[0].value.i == 1);
    assert(call("iobegin", {}) && call("iocontrol", {s("INTERNAL"), s("")}));
    assert(call("iocontrol", {s("FMT"), s("(I3)")}) && call("iocontrol", {s("END"), i(1)}));
    assert(call("readbegin", {}) && call("readvalue", {s("I"), i(0)}));
    assert(call("iostatus", {}) && results[0].value.i == -1);
    assert(call("iobegin", {}) && call("iocontrol", {s("INTERNAL"), s(" 1.0 2.0\n 3.0 4.0")}));
    assert(call("iocontrol", {s("FMT"), s("(2F4.1)")}) && call("readbegin", {}));
    assert(call("readvalue", {s("Z"), i(0)}) && results.size() == 2);
    assert(results[0].value.asReal() == 1 && results[1].value.asReal() == 2);
    assert(call("readvalue", {s("Z"), i(0)}) && results.size() == 2);
    assert(results[0].value.asReal() == 3 && results[1].value.asReal() == 4);
    assert(call("iobegin", {}) && call("iocontrol", {s("INTERNAL"), s("abcd")}));
    assert(call("iocontrol", {s("FMT"), s("(A)")}) && call("iocontrol", {s("RECL"), i(2)}));
    assert(call("iocontrol", {s("IOSTAT"), i(1)}));
    assert(call("begin", {}) && call("item", {s("too long"), s("C")}) && call("write", {}));
    assert(call("iostatus", {}) && results[0].value.i == 1);
    assert(call("internalrecord", {i(0)}) && results[0].text.empty());
    assert(call("iobegin", {}) && call("begin", {}) && call("complexitem", {r(1), r(2)}));
    assert(call("format", {s("(2F4.1)")}) && results[0].text == " 1.0 2.0");
    assert(call("iobegin", {}) && call("begin", {}) && call("item", {i(1), s("I")}));
    assert(!call("format", {s("(I1,/)")}));
    assert(!call("readvalue", {s("C"), i(-1)}));
    assert(!call("iocontrol", {s("INTERNAL"), s(std::string(FORTRAN_TRANSFER_LIMIT, 'x'))}));
    assert(call("iobegin", {}) && call("begin", {}));
    for (size_t index = 0; index < FORTRAN_ITEM_LIMIT; ++index) assert(call("item", {i(1), s("I")}));
    assert(!call("item", {i(1), s("I")}));
    assert(call("iobegin", {}) && !call("item", {i(1), s("I")}));

    static uint8_t arena[256];
    static ManagedHeap<256> heap;
    heap.attach(arena, sizeof(arena));
    FortranFormatRuntime managed(&heap);
    const auto managedCall = [&](const std::string& op, const std::vector<FortranScalar>& args) {
        return managed.execute("fortran." + op, args, results, rows, error);
    };
    const auto collect = [&]() {
        bool live[256] = {};
        managed.forEachRoot([&](Value value) { live[value.handle] = true; });
        heap.sweep([&](uint16_t handle) { return live[handle]; });
        heap.compact();
    };
    assert(heap.store("garbage", 7) != ManagedHeap<256>::INVALID);
    const std::string format = "('MANAGED=',I3)";
    const uint16_t handle = heap.store(format.data(), format.size());
    assert(handle != ManagedHeap<256>::INVALID);
    const auto allocations = heap.getStats().allocations;
    assert(managedCall("iobegin", {}) && managedCall("iocontrol", {s("UNIT"), i(6)}));
    assert(managedCall("iocontrol", {s("FMT"), FortranScalar::fromManagedString(Value::makeString(handle), format)}));
    assert(heap.getStats().allocations == allocations);
    for (size_t iteration = 0; iteration < 128; ++iteration) {
        collect();
        assert(heap.valid(handle));
        assert(heap.store("discard", 7) != ManagedHeap<256>::INVALID);
        assert(managedCall("begin", {}) && managedCall("item", {i(42), s("I")}));
        assert(managedCall("write", {}) && rows == std::vector<std::string>{"MANAGED= 42"});
    }
    assert(managedCall("iobegin", {}));
    collect();
    assert(heap.getStats().liveHandles == 0);
    assert(managedCall("iocontrol", {s("FMT"), s("(I3)")}));
    collect();
    assert(heap.getStats().liveHandles == 1);
    assert(managedCall("iocontrol", {s("INTERNAL"), s(" 73")}));
    assert(managedCall("readbegin", {}) && managedCall("readvalue", {s("I"), i(0)}));
    assert(results[0].value.i == 73);
    assert(managedCall("iocontrol", {s("FMT"), s("(I4)")}));
    collect();
    assert(heap.getStats().liveHandles == 1);
    heap.reset();
    assert(managedCall("begin", {}) && managedCall("item", {i(1), s("I")}));
    assert(!managedCall("write", {}) && error.find("managed FORMAT") != std::string::npos);
    assert(managedCall("iobegin", {}));
    const uint16_t full = heap.store(std::string(256, 'x').data(), 256);
    assert(full != ManagedHeap<256>::INVALID);
    assert(!managedCall("iocontrol", {s("FMT"), s("(I3)")}) && !error.empty());
    assert(managedCall("iobegin", {}));
    collect();
    assert(heap.getStats().liveHandles == 0);
    {
        BlockSwapBacking<256> backing(std::malloc, std::free, 1024, "test");
        heap.setBacking(&backing);
        assert(managedCall("iocontrol", {s("UNIT"), i(6)}));
        assert(managedCall("iocontrol", {s("FMT"), s(format)}));
        uint16_t formatHandle = ManagedHeap<256>::INVALID;
        managed.forEachRoot([&](Value value) { formatHandle = value.handle; });
        assert(formatHandle != ManagedHeap<256>::INVALID);
        assert(heap.store(std::string(256, 'x').data(), 256) != ManagedHeap<256>::INVALID);
        assert(heap.swapped(formatHandle));
        assert(managedCall("begin", {}) && managedCall("item", {i(42), s("I")}));
        assert(managedCall("write", {}) && rows == std::vector<std::string>{"MANAGED= 42"});
        assert(heap.getStats().swapIns > 0);
        assert(managedCall("iobegin", {}));
        collect();
        assert(heap.getStats().liveHandles == 0);
        heap.reset();
        heap.setBacking(nullptr);
    }
    std::cout << "FORTRAN FORMAT parser, output, input, capacities and VM RTL ABI passed\n";
}

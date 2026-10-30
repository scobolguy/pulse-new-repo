#include "../../pmachines/arduino/src/fortran_format.h"
#include "../../src/SerialConsoleLease.h"
#include <cassert>
#include <iostream>

using namespace pmachine;
static FortranScalar i(int n) { return FortranScalar(Value(n)); }
static FortranScalar s(const std::string& text) { return FortranScalar(text); }

int main() {
    SerialConsoleLease contender;
    {
        SerialConsoleLease owner;
        assert(owner.acquire() && owner.acquire());
        assert(!contender.acquire());
    }
    assert(contender.acquire());
    std::map<std::string, std::string> disk;
    bool denyWrite = false;
    FortranFileHost host;
    host.read = [&](const std::string& name, std::string& text, bool& exists, std::string&) {
        const auto found = disk.find(name);
        exists = found != disk.end();
        text = exists ? found->second : "";
        return true;
    };
    host.write = [&](const std::string& name, const std::string& text, std::string& error) {
        if (denyWrite) { error = "disk full"; return false; }
        disk[name] = text; return true;
    };
    host.remove = [&](const std::string& name, std::string& error) {
        if (!disk.erase(name)) { error = "file not found"; return false; }
        return true;
    };
    FortranFormatRuntime rtl(nullptr, host, " 42\r\n2*3,,/99\nBAD\n73\n");
    std::vector<FortranScalar> results;
    std::vector<std::string> emitted;
    std::string error;
    auto call = [&](const std::string& op, const std::vector<FortranScalar>& args) {
        return rtl.execute("fortran." + op, args, results, emitted, error);
    };
    auto start = [&](int unit, const std::string& format = "") {
        assert(call("iobegin", {}) && call("iocontrol", {s("UNIT"), i(unit)}));
        if (!format.empty()) assert(call("iocontrol", {s("FMT"), s(format)}));
    };
    auto open = [&](int unit, const std::string& name, const std::string& status) {
        start(unit);
        assert(call("iocontrol", {s("FILE"), s(name)}));
        assert(call("iocontrol", {s("STATUS"), s(status)}));
        return call("open", {});
    };
    auto write = [&](int unit, const std::string& format, int value) {
        start(unit, format);
        assert(call("begin", {}) && call("item", {i(value), s("I")}));
        return call("write", {});
    };
    auto read = [&](int unit, const std::string& format) {
        start(unit, format);
        assert(call("readbegin", {}) && call("readvalue", {s("I"), i(0)}));
        const int value = results[0].value.i;
        assert(call("readend", {}));
        return value;
    };
    assert(read(5, "(I3)") == 42);
    start(5, "*"); assert(call("readbegin", {}));
    assert(call("readvalue", {s("I"), i(0)}) && results[0].value.i == 3);
    assert(call("readvalue", {s("I"), i(0)}) && results[0].value.i == 3);
    assert(call("readvalue", {s("I"), i(0)}) && call("readpresent", {}) && results[0].value.i == 0);
    assert(call("readvalue", {s("I"), i(0)}) && call("readpresent", {}) && results[0].value.i == 0);
    assert(call("readend", {}));
    start(5, "*"); assert(call("iocontrol", {s("IOSTAT"), i(1)}));
    assert(call("readbegin", {}) && call("readvalue", {s("I"), i(0)}));
    assert(call("iostatus", {}) && results[0].value.i == 1);
    assert(read(5, "*") == 73);
    start(5, "*"); assert(call("iocontrol", {s("END"), i(1)}));
    assert(call("readbegin", {}) && call("iostatus", {}) && results[0].value.i == -1);
    start(5); assert(call("rewind", {}));
    assert(read(5, "(I3)") == 42);
    assert(!disk.count("fort.5"));
    assert(open(12, "seq", "NEW"));
    assert(write(12, "(I3)", 42) && write(12, "(I3)", 73));
    assert(disk["seq"] == " 42\n 73\n");
    start(12); assert(call("rewind", {}));
    assert(read(12, "(I3)") == 42 && read(12, "(I3)") == 73);
    start(12); assert(call("backspace", {}));
    assert(read(12, "(I3)") == 73);
    start(12, "(I3)"); assert(call("iocontrol", {s("END"), i(1)}));
    assert(call("readbegin", {}) && call("iostatus", {}) && results[0].value.i == -1);
    start(12); assert(call("rewind", {})); assert(read(12, "(I3)") == 42);
    start(12); assert(call("endfile", {})); assert(disk["seq"] == " 42\n");
    start(12); assert(call("close", {}));
    assert(open(12, "seq", "OLD"));
    assert(read(12, "(I3)") == 42);
    start(12); assert(call("inquire", {}));
    assert(call("inquiry", {s("OPENED")}) && results[0].value.i == 1);
    assert(call("inquiry", {s("NAME")}) && results[0].text == "seq");
    start(12); assert(call("close", {}));
    assert(!open(12, "seq", "NEW"));
    assert(!open(12, "missing", "OLD"));
    assert(!open(12, "../escape", "UNKNOWN"));
    assert(!open(12, "   ../escape", "UNKNOWN"));
    assert(!open(12, "   .hidden", "UNKNOWN"));
    assert(!open(12, "   ", "UNKNOWN"));
    assert(open(12, "     leading   ", "NEW"));
    assert(disk.count("     leading") && !disk.count("leading"));
    start(12);
    assert(call("iocontrol", {s("FILE"), s("     leading ")}));
    assert(call("inquire", {}));
    assert(call("inquiry", {s("OPENED")}) && results[0].value.i == 1);
    assert(call("inquiry", {s("NAME")}) && results[0].text == "     leading");
    start(12); assert(call("iocontrol", {s("STATUS"), s("DELETE")}) && call("close", {}));
    assert(!disk.count("     leading"));

    assert(open(12, "end-position", "NEW"));
    assert(write(12, "(I3)", 42));
    start(12); assert(call("endfile", {}));
    start(12); assert(call("backspace", {}));
    assert(write(12, "(I3)", 73));
    assert(disk["end-position"] == " 42\n 73\n");
    start(12); assert(call("rewind", {}));
    assert(read(12, "(I3)") == 42 && read(12, "(I3)") == 73);
    start(12); assert(call("close", {}));

    assert(open(13, "scratch", "SCRATCH"));
    assert(write(13, "*", 9));
    assert(!disk.count("scratch"));
    start(13); assert(call("iocontrol", {s("STATUS"), s("KEEP")}) && !call("close", {}));
    start(13); assert(call("close", {}));
    assert(open(14, "direct", "NEW"));
    start(14); assert(call("close", {}));
    start(14); assert(call("iocontrol", {s("FILE"), s("direct")}));
    assert(call("iocontrol", {s("ACCESS"), s("DIRECT")}) && call("iocontrol", {s("RECL"), i(128)}));
    assert(call("open", {}));
    start(14); assert(call("iocontrol", {s("REC"), i(2)}));
    assert(call("begin", {}) && call("item", {i(99), s("I")}));
    assert(call("item", {s("a\nb"), s("C")}));
    assert(call("complexitem", {FortranScalar(Value::makeReal(1)), FortranScalar(Value::makeReal(2))}));
    assert(call("write", {}));
    const std::string originalDirect = disk["direct"];
    denyWrite = true;
    start(14); assert(call("iocontrol", {s("REC"), i(2)}));
    assert(call("begin", {}) && call("item", {i(73), s("I")}));
    assert(!call("write", {}) && disk["direct"] == originalDirect);
    start(14); assert(call("iocontrol", {s("REC"), i(3)}));
    assert(call("begin", {}) && call("item", {i(73), s("I")}));
    assert(!call("write", {}) && disk["direct"] == originalDirect);
    denyWrite = false;
    start(14); assert(call("iocontrol", {s("REC"), i(2)}));
    assert(call("readbegin", {}) && call("readvalue", {s("I"), i(0)}) && results[0].value.i == 99);
    assert(call("readend", {}));
    start(14); assert(call("close", {}));
    FortranFormatRuntime reopened(nullptr, host);
    assert(reopened.execute("fortran.iobegin", {}, results, emitted, error));
    const auto ctl = [&](const std::string& key, const FortranScalar& value) {
        assert(reopened.execute("fortran.iocontrol", {s(key), value}, results, emitted, error));
    };
    ctl("UNIT", i(14)); ctl("FILE", s("direct")); ctl("ACCESS", s("DIRECT")); ctl("RECL", i(128)); ctl("STATUS", s("OLD"));
    assert(reopened.execute("fortran.open", {}, results, emitted, error));
    assert(reopened.execute("fortran.iobegin", {}, results, emitted, error)); ctl("UNIT", i(14)); ctl("REC", i(2));
    assert(reopened.execute("fortran.readbegin", {}, results, emitted, error));
    assert(reopened.execute("fortran.readvalue", {s("I"), i(0)}, results, emitted, error) && results[0].value.i == 99);
    assert(reopened.execute("fortran.readvalue", {s("C"), i(3)}, results, emitted, error) && results[0].text == "a\nb");
    assert(reopened.execute("fortran.readvalue", {s("Z"), i(0)}, results, emitted, error) && results.size() == 2);
    assert(results[0].value.asReal() == 1 && results[1].value.asReal() == 2);

    disk["list"] = "2*3,,(1.,\n2.),'hello world',/ 99\n";
    assert(open(15, "list", "OLD"));
    start(15, "*"); assert(call("readbegin", {}));
    assert(call("readvalue", {s("I"), i(0)}) && results[0].value.i == 3);
    assert(call("readvalue", {s("I"), i(0)}) && results[0].value.i == 3);
    assert(call("readvalue", {s("I"), i(0)}) && call("readpresent", {}) && results[0].value.i == 0);
    assert(call("readvalue", {s("Z"), i(0)}) && results[0].value.asReal() == 1 && results[1].value.asReal() == 2);
    assert(call("readvalue", {s("C"), i(11)}) && results[0].text == "hello world");
    assert(call("readvalue", {s("I"), i(0)}) && call("readpresent", {}) && results[0].value.i == 0);
    assert(call("readend", {}));
    assert(open(16, "failure", "NEW"));
    denyWrite = true;
    assert(!write(16, "(I3)", 42) && !error.empty() && disk["failure"].empty());
    denyWrite = false;
    assert(write(16, "(I3)", 73) && disk["failure"] == " 73\n");
    start(16); assert(call("iocontrol", {s("STATUS"), s("DELETE")}) && call("close", {}));
    assert(!disk.count("failure"));
    FortranFiles bounded(host);
    std::map<std::string, FortranScalar> controls = {{"UNIT", i(20)}, {"FILE", s("bounded")}};
    assert(bounded.auxiliary("open", controls, error));
    auto* unit = bounded.connect(controls, true, error);
    assert(unit);
    const std::string large(8192, 'x');
    assert(bounded.write(*unit, {large, large, large}, error));
    const std::string saved = disk["bounded"];
    assert(!bounded.write(*unit, {large}, error) && error.find("resident capacity") != std::string::npos);
    assert(unit->cursor == 3 && disk["bounded"] == saved);
    controls = {{"UNIT", i(21)}, {"FILE", s("too-wide")}, {"ACCESS", s("DIRECT")}, {"RECL", i(3)}};
    assert(bounded.auxiliary("open", controls, error));
    unit = bounded.connect({{"UNIT", i(21)}, {"REC", i(1)}}, true, error);
    assert(unit && !bounded.write(*unit, {"I:42;"}, error) && error.find("RECL") != std::string::npos);
    FortranFiles empty;
    unit = empty.connect({{"UNIT", i(5)}, {"FMT", s("*")}}, true, error);
    assert(unit && unit->rows.empty() && unit->preconnected);
    FortranFiles oversized({}, std::string(FortranFiles::RESIDENT_LIMIT + 1, ' '));
    assert(!oversized.connect({{"UNIT", i(5)}}, true, error) && error.find("capacity") != std::string::npos);
    FortranFiles longRecord({}, std::string(FORTRAN_RECORD_LIMIT + 1, ' '));
    assert(!longRecord.connect({{"UNIT", i(5)}}, true, error) && error.find("capacity") != std::string::npos);
    std::vector<std::string> liveRows = {"(1.,", "2.),'hello world'", "73"};
    size_t prompts = 0;
    FortranFileHost liveHost;
    liveHost.consoleRead = [&](std::string& row, std::string& failure) {
        if (prompts == liveRows.size()) { ++prompts; failure = "UART timeout"; return 1; }
        row = liveRows.at(prompts++);
        return 0;
    };
    FortranFormatRuntime live(nullptr, liveHost, " 42\n");
    const auto liveCall = [&](const std::string& op, const std::vector<FortranScalar>& args) {
        return live.execute("fortran." + op, args, results, emitted, error);
    };
    const auto liveStart = [&](const std::string& format) {
        assert(liveCall("iobegin", {}) && liveCall("iocontrol", {s("UNIT"), i(5)}));
        assert(liveCall("iocontrol", {s("FMT"), s(format)}));
    };
    liveStart("(I3)");
    assert(liveCall("readbegin", {}) && liveCall("readvalue", {s("I"), i(0)}));
    assert(results[0].value.i == 42 && prompts == 0);
    liveStart("*");
    assert(liveCall("readbegin", {}) && liveCall("readvalue", {s("Z"), i(0)}));
    assert(results[0].value.asReal() == 1 && results[1].value.asReal() == 2 && prompts == 2);
    assert(liveCall("readvalue", {s("C"), i(11)}) && results[0].text == "hello world");
    liveStart("(I3)");
    assert(liveCall("readbegin", {}) && liveCall("readvalue", {s("I"), i(0)}) && results[0].value.i == 73);
    liveStart("*");
    assert(liveCall("iocontrol", {s("IOSTAT"), i(1)}) && liveCall("readbegin", {}));
    assert(liveCall("iostatus", {}) && results[0].value.i == 1);
    assert(prompts == 4);
    FortranFiles eofFiles({{}, {}, {}, [](std::string&, std::string& failure) {
        failure = "End of file"; return -1;
    }});
    unit = eofFiles.connect({{"UNIT", i(5)}}, true, error);
    std::string row;
    assert(unit && eofFiles.inputRecord(*unit, 0, row, error) == -1 && unit->end == 0);
    std::cout << "FORTRAN external files, direct unformatted persistence, list input and error recovery passed\n";
}

#pragma once

#include "fortran_runtime.h"
#include "managed_heap.h"
#include "fortran_files.h"
#include <map>
#include <algorithm>

namespace pmachine {

struct FortranFormatItem {
    char tag = 'I';
    FortranScalar value;
    FortranScalar imaginary;

    FortranFormatItem() = default;
    FortranFormatItem(char tag, const FortranScalar& value, const FortranScalar& imaginary = {})
        : tag(tag), value(value), imaginary(imaginary) {}
};

struct FortranFormatEdit {
    std::string kind;
    std::string literal;
    int width = -1;
    int digits = -1;
    int exponent = 0;
    int amount = 0;
};

struct FortranFormatProgram {
    std::vector<FortranFormatEdit> edits;
    size_t reversion = 0;
};

constexpr size_t FORTRAN_RECORD_LIMIT = 8192;
constexpr size_t FORTRAN_TRANSFER_LIMIT = 65536;
constexpr size_t FORTRAN_ITEM_LIMIT = 1024;

bool parseFortranFormat(const std::string& text, FortranFormatProgram& program, std::string& error);
bool renderFortranFormat(const std::string& format, const std::vector<FortranFormatItem>& items,
                        std::vector<std::string>& records, std::string& error);

class FortranFormatReader {
public:
    using RecordSource = std::function<int(std::string&, std::string&)>;
    bool begin(const std::string& format, const std::vector<std::string>& records, bool blankZero, std::string& error,
               RecordSource source = {});
    bool read(char tag, size_t length, FortranScalar& result, std::string& error);
    int status() const { return eof ? -1 : 1; }
    size_t consumed() const { return records.empty() ? 0 : std::min(record + 1, records.size()); }
    bool present() const { return !nullValue; }
    bool listDirected() const { return list; }
    bool readComplex(FortranScalar& real, FortranScalar& imaginary, std::string& error);
private:
    FortranFormatProgram program;
    std::vector<std::string> records;
    size_t record = 0;
    size_t position = 0;
    size_t edit = 0;
    int scale = 0;
    bool blankZero = false;
    bool eof = false;
    bool list = false;
    bool nullValue = false;
    bool terminated = false;
    size_t repeats = 0;
    std::string repeated;
    RecordSource source;
    bool supply(std::string& error);
    bool token(std::string& text, std::string& error);
    bool advance(std::string& error);
};

class FortranFormatRuntime {
public:
    explicit FortranFormatRuntime(ManagedHeap<256>* strings = nullptr, FortranFileHost host = {}, std::string input = {})
        : strings(strings), files(std::move(host), std::move(input)) {}
    template <typename Visitor>
    void forEachRoot(Visitor visitor) const {
        const auto format = controls.find("FMT");
        if (format != controls.end() && format->second.managedString) visitor(format->second.value);
    }
    bool execute(const std::string& symbol, const std::vector<FortranScalar>& args,
                 std::vector<FortranScalar>& results, std::vector<std::string>& emitted, std::string& error);
private:
    ManagedHeap<256>* strings;
    FortranFiles files;
    FortranUnit* inputUnit = nullptr;
    size_t inputStart = 0;
    std::vector<FortranFormatItem> inputItems;
    size_t inputItem = 0;
    bool unformattedRead = false;
    bool nullRead = false;
    std::vector<FortranFormatItem> items;
    std::map<std::string, FortranScalar> controls;
    std::vector<std::string> outputRecords;
    FortranFormatReader reader;
    size_t itemBytes = 0;
    int ioStatus = 0;
    bool reading = false;
    bool collecting = false;
};

}

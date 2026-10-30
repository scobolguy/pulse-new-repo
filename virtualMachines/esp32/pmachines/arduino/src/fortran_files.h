#pragma once

#include "fortran_runtime.h"
#include <functional>
#include <map>

namespace pmachine {

struct FortranFileHost {
    // Missing files succeed with exists=false. Other failures must populate error.
    std::function<bool(const std::string&, std::string&, bool&, std::string&)> read;
    std::function<bool(const std::string&, const std::string&, std::string&)> write;
    std::function<bool(const std::string&, std::string&)> remove;
    // Returns 0 for a record, -1 for EOF, or 1 for an error.
    std::function<int(std::string&, std::string&)> consoleRead;
};

struct FortranUnit {
    std::string name;
    std::vector<std::string> rows;
    size_t cursor = 0;
    size_t end = static_cast<size_t>(-1);
    int recl = 0;
    bool direct = false;
    bool formatted = true;
    bool scratch = false;
    bool preconnected = false;
    bool blankZero = false;
};

class FortranFiles {
public:
    static constexpr size_t RESIDENT_LIMIT = 32768;
    explicit FortranFiles(FortranFileHost host = {}, std::string input = {})
        : host(std::move(host)), input(std::move(input)) {}
    bool auxiliary(const std::string& op, const std::map<std::string, FortranScalar>& controls, std::string& error);
    FortranUnit* connect(const std::map<std::string, FortranScalar>& controls, bool position, std::string& error);
    bool write(FortranUnit& file, const std::vector<std::string>& rows, std::string& error);
    bool persist(const FortranUnit& file, std::string& error);
    int inputRecord(FortranUnit& file, size_t index, std::string& row, std::string& error);
    const std::map<std::string, FortranScalar>& inquiry() const { return lastInquiry; }
    static bool validName(const std::string& name);
private:
    FortranFileHost host;
    std::map<int, FortranUnit> units;
    std::map<std::string, FortranScalar> lastInquiry;
    std::string input;
    bool initialized = false;
    bool initialize(std::string& error);
    bool fits(const FortranUnit& candidate, const FortranUnit* replaced, std::string& error) const;
};

}

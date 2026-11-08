#include "fortran_files.h"
#include "fortran_format.h"
#include <algorithm>
#include <cctype>

namespace pmachine {
namespace {
    bool fail(std::string& error, const std::string& message) { error = "FORTRAN runtime error: " + message; return false; }
    std::string trim(std::string text) {
        while (!text.empty() && text.back() == ' ') text.pop_back();
        return text;
    }
    std::string option(const std::map<std::string, FortranScalar>& controls, const std::string& key, const std::string& fallback) {
        const auto found = controls.find(key);
        std::string value = found == controls.end() ? fallback : trim(found->second.text);
        if (key != "FILE") for (char& c : value) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
        return value;
    }
    int number(const std::map<std::string, FortranScalar>& controls, const std::string& key, int fallback) {
        const auto found = controls.find(key);
        return found == controls.end() || found->second.isString() ? fallback : found->second.value.i;
    }
    const std::string MAGIC = "PULSE-FORTRAN-ESP32-1\n";
    bool recordFits(const std::string& row, const FortranUnit& file, std::string& error) {
        if (!file.recl) return true;
        size_t bytes = row.size();
        if (!file.formatted) {
            bytes = 0;
            size_t start = 0;
            while (start < row.size()) {
                const auto end = row.find(';', start);
                if (end == std::string::npos || end < start + 2 || row[start + 1] != ':')
                    return fail(error, "Invalid unformatted record");
                switch (row[start]) {
                    case 'C': bytes += (end - start - 2) / 2; break;
                    case 'D': case 'Z': bytes += 8; break;
                    case 'I': case 'R': case 'L': bytes += 4; break;
                    default: return fail(error, "Invalid unformatted record type");
                }
                start = end + 1;
            }
        }
        return bytes <= static_cast<size_t>(file.recl) || fail(error, "Record exceeds RECL");
    }
    bool decode(const std::string& data, FortranUnit& file, std::string& error) {
        if (data.size() > FORTRAN_TRANSFER_LIMIT) return fail(error, "External file capacity exceeded");
        size_t start = 0;
        if (!file.formatted && !data.empty()) {
            if (data.compare(0, MAGIC.size(), MAGIC) != 0) return fail(error, "Invalid Pulse unformatted file");
            start = MAGIC.size();
        }
        while (start < data.size()) {
            const auto next = data.find('\n', start);
            std::string row = data.substr(start, next == std::string::npos ? next : next - start);
            if (file.formatted && !row.empty() && row.back() == '\r') row.pop_back();
            if (row.size() > FORTRAN_RECORD_LIMIT || file.rows.size() >= 1024) return fail(error, "External record capacity exceeded");
            if (!recordFits(row, file, error)) return false;
            file.rows.push_back(std::move(row));
            if (next == std::string::npos) break;
            start = next + 1;
        }
        return true;
    }
}

bool FortranFiles::fits(const FortranUnit& candidate, const FortranUnit* replaced, std::string& error) const {
    size_t bytes = 0;
    const auto add = [&](const FortranUnit& file) {
        const size_t overhead = sizeof(FortranUnit) + file.name.size() + file.rows.size() * sizeof(std::string);
        if (overhead > RESIDENT_LIMIT - bytes) return false;
        bytes += overhead;
        for (const auto& row : file.rows) {
            if (row.size() + 1 > RESIDENT_LIMIT - bytes) return false;
            bytes += row.size() + 1;
        }
        return true;
    };
    for (const auto& entry : units) if (&entry.second != replaced && !add(entry.second))
        return fail(error, "External file resident capacity exceeded");
    return add(candidate) || fail(error, "External file resident capacity exceeded");
}

bool FortranFiles::validName(const std::string& name) {
    const size_t first = name.find_first_not_of(' ');
    if (first == std::string::npos || name.size() > 96 || name[first] == '.' || name.find("..") != std::string::npos) return false;
    for (size_t index = first; index < name.size(); ++index) {
        const unsigned char c = name[index];
        if (!std::isalnum(c) && c != '_' && c != '-' && c != '.') return false;
    }
    return true;
}

bool FortranFiles::initialize(std::string& error) {
    if (initialized) return true;
    FortranUnit console;
    console.name = "fort.5";
    console.preconnected = true;
    if (input.size() > RESIDENT_LIMIT) return fail(error, "Console input capacity exceeded");
    if (!decode(input, console, error) || !fits(console, nullptr, error)) return false;
    units.emplace(5, std::move(console));
    FortranUnit output;
    output.name = "fort.6";
    output.preconnected = true;
    units.emplace(6, std::move(output));
    std::string().swap(input);
    initialized = true;
    return true;
}

int FortranFiles::inputRecord(FortranUnit& file, size_t index, std::string& row, std::string& error) {
    if (index >= file.end) { fail(error, "End of file"); return -1; }
    if (index >= file.rows.size()) {
        if (!file.preconnected || file.name != "fort.5" || !host.consoleRead) {
            fail(error, "End of file"); return -1;
        }
        std::string next;
        const int status = host.consoleRead(next, error);
        if (status < 0) file.end = file.rows.size();
        if (status) return status;
        if (next.size() > FORTRAN_RECORD_LIMIT || file.rows.size() >= 1024) {
            fail(error, "Console input record capacity exceeded"); return 1;
        }
        file.rows.push_back(std::move(next));
        if (!fits(file, &file, error)) { file.rows.pop_back(); return 1; }
    }
    row = file.rows[index];
    return 0;
}

bool FortranFiles::persist(const FortranUnit& file, std::string& error) {
    if (file.scratch || file.preconnected) return true;
    if (!host.write) return fail(error, "External file store is unavailable");
    std::string data = file.formatted ? "" : MAGIC;
    for (const auto& row : file.rows) {
        if (row.size() + 1 > FORTRAN_TRANSFER_LIMIT - data.size()) return fail(error, "External file capacity exceeded");
        data += row;
        data += '\n';
    }
    return host.write(file.name, data, error);
}

FortranUnit* FortranFiles::connect(const std::map<std::string, FortranScalar>& controls, bool position, std::string& error) {
    if (!initialize(error)) return nullptr;
    const int unit = number(controls, "UNIT", -1);
    if (unit < 0 || unit > 9999) { fail(error, "Invalid external unit"); return nullptr; }
    if (!units.count(unit) && (unit == 5 || unit == 6)) {
        FortranUnit console;
        console.name = "fort." + std::to_string(unit);
        console.preconnected = true;
        units.emplace(unit, std::move(console));
    }
    if (!units.count(unit)) {
        auto implicit = controls;
        implicit["FILE"] = FortranScalar("fort." + std::to_string(unit));
        implicit["FORM"] = FortranScalar(controls.count("FMT") ? "FORMATTED" : "UNFORMATTED");
        if (!auxiliary("open", implicit, error)) return nullptr;
    }
    auto& file = units.at(unit);
    if (position) {
        if (file.direct) {
            const int record = number(controls, "REC", 0);
            if (record < 1 || record > 1024) { fail(error, "DIRECT I/O requires REC in 1:1024"); return nullptr; }
            file.cursor = static_cast<size_t>(record - 1);
        } else if (controls.count("REC")) { fail(error, "REC requires DIRECT access"); return nullptr; }
    }
    return &file;
}

bool FortranFiles::write(FortranUnit& file, const std::vector<std::string>& rows, std::string& error) {
    if (file.preconnected) return fail(error, "Cannot write to preconnected input unit");
    if (file.direct && rows.size() != 1) return fail(error, "DIRECT transfer requires exactly one record");
    if (file.direct) {
        std::string replacement = rows.front();
        if (replacement.size() > FORTRAN_RECORD_LIMIT || file.cursor >= 1024)
            return fail(error, "External record capacity exceeded");
        if (!recordFits(replacement, file, error)) return false;
        if (file.recl && file.formatted) replacement.resize(static_cast<size_t>(file.recl), ' ');
        const size_t oldSize = file.rows.size(), oldCursor = file.cursor, oldEnd = file.end;
        if (file.rows.size() <= file.cursor) file.rows.resize(file.cursor + 1);
        file.rows[file.cursor++].swap(replacement);
        file.end = static_cast<size_t>(-1);
        if (fits(file, &file, error) && persist(file, error)) return true;
        file.rows[oldCursor].swap(replacement);
        file.rows.resize(oldSize);
        file.cursor = oldCursor;
        file.end = oldEnd;
        return false;
    }
    FortranUnit candidate = file;
    for (auto row : rows) {
        if (row.size() > FORTRAN_RECORD_LIMIT || candidate.cursor >= 1024) return fail(error, "External record capacity exceeded");
        if (!recordFits(row, candidate, error)) return false;
        if (candidate.recl && candidate.formatted) {
            row.resize(static_cast<size_t>(candidate.recl), ' ');
        }
        if (candidate.rows.size() <= candidate.cursor) candidate.rows.resize(candidate.cursor + 1);
        candidate.rows[candidate.cursor++] = std::move(row);
        if (!candidate.direct) candidate.rows.resize(candidate.cursor);
    }
    candidate.end = static_cast<size_t>(-1);
    if (!fits(candidate, &file, error) || !persist(candidate, error)) return false;
    file = std::move(candidate);
    return true;
}

bool FortranFiles::auxiliary(const std::string& op, const std::map<std::string, FortranScalar>& controls, std::string& error) {
    error.clear();
    if (!initialize(error)) return false;
    const int unit = number(controls, "UNIT", -1);
    if (op == "open") {
        if (unit < 0 || unit > 9999) return fail(error, "OPEN requires a nonnegative INTEGER unit");
        const std::string name = option(controls, "FILE", "fort." + std::to_string(unit));
        if (!validName(name)) return fail(error, "External filename must be a confined basename");
        const auto previous = units.find(unit);
        if (previous != units.end() && (!controls.count("FILE") || previous->second.name == name)) {
            const auto blank = option(controls, "BLANK", previous->second.blankZero ? "ZERO" : "NULL");
            if (blank != "ZERO" && blank != "NULL") return fail(error, "Invalid OPEN BLANK");
            previous->second.blankZero = blank == "ZERO";
            return true;
        }
        if (units.size() >= 16 && previous == units.end()) return fail(error, "Open unit capacity exceeded");
        const auto status = option(controls, "STATUS", "UNKNOWN");
        const auto access = option(controls, "ACCESS", "SEQUENTIAL");
        const auto form = option(controls, "FORM", access == "DIRECT" ? "UNFORMATTED" : "FORMATTED");
        const auto blank = option(controls, "BLANK", "NULL");
        const int recl = number(controls, "RECL", 0);
        if ((status != "OLD" && status != "NEW" && status != "UNKNOWN" && status != "SCRATCH")
            || (access != "SEQUENTIAL" && access != "DIRECT") || (form != "FORMATTED" && form != "UNFORMATTED")
            || (blank != "NULL" && blank != "ZERO") || recl < 0 || recl > static_cast<int>(FORTRAN_RECORD_LIMIT)
            || (access == "DIRECT" && recl == 0)) return fail(error, "Invalid OPEN controls");
        FortranUnit file;
        file.name = name;
        file.direct = access == "DIRECT";
        file.formatted = form == "FORMATTED";
        file.scratch = status == "SCRATCH";
        file.blankZero = blank == "ZERO";
        file.recl = recl;
        std::string data;
        bool exists = false;
        if (!file.scratch && (!host.read || !host.read(name, data, exists, error))) {
            if (error.empty()) fail(error, "External file store is unavailable");
            return false;
        }
        if (status == "OLD" && !exists) return fail(error, "OPEN OLD file does not exist: " + name);
        if (status == "NEW" && exists) return fail(error, "OPEN NEW file already exists: " + name);
        if (data.size() > RESIDENT_LIMIT) return fail(error, "External file resident capacity exceeded");
        if (!decode(data, file, error) || !fits(file, previous == units.end() ? nullptr : &previous->second, error)) return false;
        for (const auto& entry : units) if (entry.first != unit && !file.scratch && entry.second.name == name)
            return fail(error, "File is already connected to another unit");
        if (!exists && !persist(file, error)) return false;
        units[unit] = std::move(file);
        return true;
    }
    if (op == "inquire") {
        const bool byName = controls.count("FILE");
        const std::string name = byName ? option(controls, "FILE", "") : "";
        if (byName && !validName(name)) return fail(error, "Invalid INQUIRE filename");
        FortranUnit* file = nullptr;
        int connectedUnit = -1;
        for (auto& entry : units) if (byName ? entry.second.name == name : entry.first == unit) {
            file = &entry.second; connectedUnit = entry.first; break;
        }
        bool exists = unit >= 0;
        if (byName) {
            exists = file != nullptr;
            std::string data;
            if (!exists && (!host.read || !host.read(name, data, exists, error))) {
                if (error.empty()) fail(error, "External file store is unavailable");
                return false;
            }
        }
        lastInquiry.clear();
        const auto integer = [&](const std::string& key, int value) { lastInquiry[key] = FortranScalar(Value(value)); };
        const auto text = [&](const std::string& key, const std::string& value) { lastInquiry[key] = FortranScalar(value); };
        integer("EXIST", exists ? 1 : 0); integer("OPENED", file ? 1 : 0);
        integer("NUMBER", connectedUnit); integer("NAMED", file && !file->scratch && !file->preconnected ? 1 : 0);
        integer("RECL", file ? file->recl : 0); integer("NEXTREC", file ? static_cast<int>(file->cursor + 1) : 0);
        text("NAME", file ? file->name : name);
        text("ACCESS", file ? file->direct ? "DIRECT" : "SEQUENTIAL" : "UNDEFINED");
        text("FORM", file ? file->formatted ? "FORMATTED" : "UNFORMATTED" : "UNDEFINED");
        text("BLANK", file && file->blankZero ? "ZERO" : "NULL");
        text("SEQUENTIAL", file && file->direct ? "NO" : "YES"); text("DIRECT", file && file->direct ? "YES" : "NO");
        text("FORMATTED", file && !file->formatted ? "NO" : "YES"); text("UNFORMATTED", file && !file->formatted ? "YES" : "NO");
        return true;
    }
    if (op == "close") {
        const auto found = units.find(unit);
        if (found == units.end()) return true;
        const auto status = option(controls, "STATUS", found->second.scratch ? "DELETE" : "KEEP");
        if (status != "KEEP" && status != "DELETE") return fail(error, "Invalid CLOSE STATUS");
        if (status == "KEEP" && found->second.scratch) return fail(error, "Cannot KEEP a SCRATCH file");
        if (status == "DELETE" && found->second.preconnected) return fail(error, "Cannot DELETE a preconnected unit");
        if (status == "DELETE" && !found->second.scratch) {
            if (!host.remove || !host.remove(found->second.name, error)) {
                if (error.empty()) fail(error, "External file deletion is unavailable");
                return false;
            }
        }
        units.erase(found);
        return true;
    }
    auto* file = connect(controls, false, error);
    if (!file) return false;
    if (file->direct) return fail(error, "Positioning requires a sequential file");
    if (op == "rewind") file->cursor = 0;
    else if (op == "backspace") { if (file->cursor) --file->cursor; }
    else if (op == "endfile") {
        if (file->preconnected) return fail(error, "Cannot ENDFILE a preconnected input unit");
        FortranUnit candidate = *file;
        candidate.rows.resize(std::min(candidate.cursor, candidate.rows.size()));
        candidate.end = candidate.cursor;
        ++candidate.cursor;
        if (!persist(candidate, error)) return false;
        *file = std::move(candidate);
    } else return fail(error, "Unknown file operation " + op);
    return true;
}
}

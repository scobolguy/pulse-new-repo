// C++ port of libraries/isam/isam.pas together with the policy checks in pcode-isam.mjs.
#include "cobol_vm_internal.h"

#include <algorithm>
#include <cmath>
#include <cstdlib>

namespace cobolvm {

bool MemoryIsamStorage::exists(const std::string& root, const std::string& path) {
    return files.count(root + '\0' + path) > 0;
}

bool MemoryIsamStorage::readText(const std::string& root, const std::string& path, std::string& out, std::string& error) {
    const auto found = files.find(root + '\0' + path);
    if (found == files.end()) {
        error = "ISAM file not found: " + path;
        return false;
    }
    out = found->second;
    return true;
}

bool MemoryIsamStorage::writeText(const std::string& root, const std::string& path, const std::string& text, std::string&) {
    files[root + '\0' + path] = text;
    return true;
}

namespace detail {

namespace {
const size_t MAX_KEY_BYTES = 256;
const size_t MAX_RECORD_BYTES = 200000;
const size_t MAX_IMAGE_BYTES = 240000;
const size_t MAX_RECORDS = 1024;
const size_t MAX_HANDLES = 64;
const char* const COBOL_FILE_METADATA_PREFIX = "__COBOL_FILE_V1__:";

bool startsWith(const std::string& text, const std::string& prefix) {
    return text.compare(0, prefix.size(), prefix) == 0;
}

bool endsWith(const std::string& text, const std::string& suffix) {
    return text.size() >= suffix.size() && text.compare(text.size() - suffix.size(), suffix.size(), suffix) == 0;
}

bool isReservedComponent(const std::string& part) {
    std::string lower;
    for (unsigned char c : part) lower.push_back(static_cast<char>(c >= 'A' && c <= 'Z' ? c + 32 : c));
    auto boundaryAt = [&](size_t length) { return lower.size() == length || lower[length] == '.'; };
    for (const char* name : {"con", "prn", "aux", "nul", "conin$", "conout$"}) {
        const std::string candidate(name);
        if (startsWith(lower, candidate) && boundaryAt(candidate.size())) return true;
    }
    for (const char* name : {"com", "lpt"}) {
        if (!startsWith(lower, name) || lower.size() < 4) continue;
        const unsigned char digit = static_cast<unsigned char>(lower[3]);
        const bool numbered = (digit >= '1' && digit <= '9') || digit == 0xB9 || digit == 0xB2 || digit == 0xB3;
        if (numbered && boundaryAt(4)) return true;
    }
    return false;
}

void validateOpen(const std::string& root, const std::string& path, const std::string& keyName) {
    bool rootValid = !root.empty() && root.size() <= 64 && root[0] >= 'a' && root[0] <= 'z';
    for (char c : root) {
        if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_' || c == '-')) rootValid = false;
    }
    if (!rootValid) fail("ISAM root must name a granted filesystem alias");
    bool pathValid = !path.empty() && path.size() <= 4096 && path.find(':') == std::string::npos
        && path[0] != '/' && path[0] != '\\';
    for (unsigned char c : path) if (c < 0x20) pathValid = false;
    if (!pathValid) fail("ISAM path must be a relative path");
    size_t start = 0;
    while (true) {
        const size_t end = path.find_first_of("/\\", start);
        const std::string part = path.substr(start, end == std::string::npos ? std::string::npos : end - start);
        if (part.empty() || part == "." || part == ".." || part.back() == ' ' || part.back() == '.'
            || part.find_first_of("<>?\"*|") != std::string::npos || isReservedComponent(part)) {
            fail("ISAM path contains an invalid or reserved component");
        }
        if (end == std::string::npos) break;
        start = end + 1;
    }
    if (jsTrim(keyName).empty() || utf8ByteLength(keyName) > MAX_KEY_BYTES) {
        fail("ISAM key name must be non-empty and bounded");
    }
}

void validateText(const std::string& value, const std::string& label, size_t maximum) {
    if (utf8ByteLength(value) > maximum) fail("ISAM " + label + " must be valid UTF-8 and within its size limit");
}

// host.string_slice as bound for the ISAM library: the end may not pass the text.
std::string isamSlice(const std::string& value, int start, int end) {
    validateText(value, "slice source", MAX_RECORD_BYTES);
    if (start < 0 || end < start || static_cast<size_t>(end) > value.size()) {
        fail("ISAM string slice bounds are invalid");
    }
    return value.substr(static_cast<size_t>(start), static_cast<size_t>(end - start));
}

int byteCompare(const std::string& left, const std::string& right) {
    const int result = left.compare(right);
    return result < 0 ? -1 : (result > 0 ? 1 : 0);
}
}  // namespace

std::string IsamFiles::identity(const std::string& root, const std::string& path) const {
    std::string canonical = path;
    std::replace(canonical.begin(), canonical.end(), '\\', '/');
#if defined(_WIN32)
    canonical = lowerLatin1(canonical);
#endif
    return root + '\0' + canonical;
}

IsamFiles::Handle* IsamFiles::find(int handle) {
    for (auto& item : handles) {
        if (item.id == handle) return &item;
    }
    return nullptr;
}

void IsamFiles::loadImage(Handle& file, std::vector<Row>& rows) {
    std::string text;
    std::string error;
    if (!storage.readText(file.root, file.path, text, error)) fail(error);
    Json image;
    if (!parseJson(utf8ToLatin1(text), image) || image.type != Json::Object) fail("Invalid ISAM index file JSON");
    const Json* version = image.get("version");
    const Json* keyName = image.get("keyName");
    if (!version || version->type != Json::Number || version->number != 1
        || !keyName || keyName->type != Json::String || keyName->text != file.keyName) {
        fail("ISAM index file has an unsupported or mismatched format");
    }
    const Json* records = image.get("records");
    if (!records || records->type != Json::Array) fail("Invalid ISAM index file records");
    if (records->items.size() > MAX_RECORDS) fail("ISAM record capacity exceeded");
    rows.clear();
    rows.reserve(records->items.size());
    for (const Json& item : records->items) {
        if (item.type != Json::Array || item.items.size() != 2) fail("Invalid ISAM record");
        if (item.items[0].type != Json::String || item.items[1].type != Json::String) {
            fail("ISAM key and record must be strings");
        }
        if (!rows.empty() && byteCompare(rows.back().first, item.items[0].text) >= 0) {
            fail("Duplicate or unordered key in ISAM image");
        }
        rows.emplace_back(item.items[0].text, item.items[1].text);
    }
    file.records = rows;
}

// A failed image write ends the run, as the adapter rethrows after P-code records status 30.
bool IsamFiles::persist(Handle& file, const std::vector<Row>& rows, std::string&) {
    std::string image = "{\"version\":1,\"keyName\":" + jsonQuote(file.keyName) + ",\"records\":[";
    for (size_t i = 0; i < rows.size(); ++i) {
        if (i) image.push_back(',');
        image += "[" + jsonQuote(rows[i].first) + "," + jsonQuote(rows[i].second) + "]";
    }
    image += "]}";
    if (utf8ByteLength(image) > MAX_IMAGE_BYTES) fail("ISAM image exceeds 240000 bytes");
    std::string error;
    if (!storage.writeText(file.root, file.path, latin1ToUtf8(image), error)) {
        fail(error.empty() ? std::string("ISAM image write failed") : error);
    }
    file.records = rows;
    file.isVirtual = false;
    return true;
}

int IsamFiles::open(const std::string& root, const std::string& path, const std::string& requestKeyName,
                    const std::string& requestMode) {
    validateOpen(root, path, requestKeyName);
    std::string keyName = requestKeyName;
    std::string organization = "INDEXED";
    std::string access = "DYNAMIC";
    std::vector<AlternateKey> alternateKeys;
    if (startsWith(requestKeyName, COBOL_FILE_METADATA_PREFIX)) {
        Json metadata;
        if (!parseJson(requestKeyName.substr(std::string(COBOL_FILE_METADATA_PREFIX).size()), metadata)) {
            fail("Invalid COBOL ISAM file metadata");
        }
        const Json* org = metadata.get("organization");
        const Json* acc = metadata.get("access");
        const Json* key = metadata.get("keyName");
        const Json* alternates = metadata.get("alternateKeys");
        if (metadata.type != Json::Object || !org || org->type != Json::String || org->text != "INDEXED"
            || !acc || acc->type != Json::String
            || (acc->text != "SEQUENTIAL" && acc->text != "RANDOM" && acc->text != "DYNAMIC")
            || !key || key->type != Json::String || !alternates || alternates->type != Json::Array) {
            fail("Invalid COBOL ISAM file metadata");
        }
        validateOpen("data", "metadata", key->text);
        for (const Json& alternate : alternates->items) {
            const Json* name = alternate.get("name");
            const Json* offset = alternate.get("offset");
            const Json* length = alternate.get("length");
            const Json* duplicates = alternate.get("duplicates");
            if (alternate.type != Json::Object || !name || name->type != Json::String || name->text.empty()
                || !offset || offset->type != Json::Number || !isSafeInteger(offset->number) || offset->number < 0
                || !length || length->type != Json::Number || !isSafeInteger(length->number) || length->number < 1
                || !duplicates || duplicates->type != Json::Bool) {
                fail("Invalid COBOL ISAM alternate-key metadata");
            }
            AlternateKey entry;
            entry.name = name->text;
            entry.offset = static_cast<int>(std::min(offset->number, 2147483647.0));
            entry.length = static_cast<int>(std::min(length->number, 2147483647.0));
            entry.duplicates = duplicates->boolean;
            alternateKeys.push_back(entry);
        }
        validateOpen(root, path, key->text);
        keyName = key->text;
        organization = org->text;
        access = acc->text;
    } else if (requestKeyName == "__SEQUENTIAL__") {
        organization = "SEQUENTIAL";
    } else if (startsWith(requestKeyName, "__RELATIVE__:")) {
        organization = "RELATIVE";
    }
    const std::string fileIdentity = identity(root, path);
    const bool optional = endsWith(requestMode, "-OPTIONAL");
    const std::string mode = optional ? requestMode.substr(0, requestMode.size() - 9) : requestMode;

    if (mode != "INPUT" && mode != "OUTPUT" && mode != "I-O" && mode != "EXTEND") fail("Unsupported ISAM open mode");
    if (handles.size() >= MAX_HANDLES) fail("ISAM open-handle capacity exceeded");
    bool duplicate = openFiles.count(fileIdentity) > 0;
    for (const auto& other : handles) {
        if (other.root == root && other.path == path && other.available) duplicate = true;
    }
    Handle file;
    file.id = next++;
    file.root = root;
    file.path = path;
    file.keyName = keyName;
    file.mode = mode;
    file.organization = organization;
    file.access = access;
    file.alternateKeys = alternateKeys;
    std::string status = "00";
    std::vector<Row> rows;
    if (lockedFiles.count(fileIdentity)) {
        status = "38";
    } else if (duplicate) {
        status = "41";
    } else if (mode == "OUTPUT") {
        if (persist(file, rows, status)) file.available = true;
    } else if (!storage.exists(root, path)) {
        if (mode == "EXTEND") {
            if (persist(file, rows, status)) file.available = true;
        } else if (optional) {
            file.records.clear();
            file.available = true;
            file.isVirtual = true;
            status = "05";
        } else {
            status = "35";
        }
    } else {
        loadImage(file, rows);
        file.available = true;
        if (file.organization == "INDEXED" && file.access == "SEQUENTIAL" && !rows.empty()) {
            file.lastWriteKey = rows.back().first;
        }
    }
    file.status = status;
    const int handleId = file.id;
    handles.push_back(std::move(file));
    if (status == "00") openFiles.insert(fileIdentity);
    statuses[handleId] = status;
    return handleId;
}

void IsamFiles::operateOn(Handle& file, const std::string& operation, const std::string& key,
                          const std::string& record, const std::string& extra, Outcome& outcome) {
    std::string& status = outcome.status;
    const std::string& mode = file.mode;
    if (!file.available) {
        status = file.status;
        return;
    }
    std::vector<Row> rows = file.records;
    auto findKey = [&](const std::string& value) -> int {
        for (size_t at = 0; at < rows.size(); ++at) {
            if (rows[at].first == value) return static_cast<int>(at);
        }
        return -1;
    };
    if (operation == "read" || operation == "read_next" || operation == "read_alt" || operation == "start") {
        if (mode == "OUTPUT" || mode == "EXTEND") {
            status = "47";
            return;
        }
        if (!file.isVirtual) loadImage(file, rows);
        if (operation == "read_next") {
            if (file.eof) {
                status = "46";
                return;
            }
            int selectedIndex = -1;
            for (size_t index = 0; index < rows.size(); ++index) {
                const std::string& candidate = rows[index].first;
                const bool matched = !file.positioned || byteCompare(candidate, file.cursor) > 0;
                if (matched && (selectedIndex < 0 || byteCompare(candidate, rows[selectedIndex].first) < 0)) {
                    selectedIndex = static_cast<int>(index);
                }
            }
            if (file.pending) {
                selectedIndex = findKey(file.cursor);
                file.pending = false;
            }
            if (selectedIndex < 0) {
                status = "10";
                file.eof = true;
                file.positioned = false;
            } else {
                outcome.record = rows[selectedIndex].second;
                file.cursor = rows[selectedIndex].first;
                file.positioned = true;
                file.eof = false;
            }
        } else if (operation == "start") {
            file.eof = false;
            const std::string& relation = extra;
            if (relation != "=" && relation != ">" && relation != ">=" && relation != "<" && relation != "<=") {
                fail("Invalid ISAM START comparison");
            }
            int selectedIndex = -1;
            for (size_t index = 0; index < rows.size(); ++index) {
                const int comparison = byteCompare(rows[index].first, key);
                const bool matched = (relation == "=" && comparison == 0) || (relation == ">" && comparison > 0)
                    || (relation == ">=" && comparison >= 0) || (relation == "<" && comparison < 0)
                    || (relation == "<=" && comparison <= 0);
                if (matched && (selectedIndex < 0 || byteCompare(rows[index].first, rows[selectedIndex].first) < 0)) {
                    selectedIndex = static_cast<int>(index);
                }
            }
            if (selectedIndex < 0) {
                status = "23";
                file.pending = false;
                file.positioned = false;
            } else {
                file.cursor = rows[selectedIndex].first;
                file.pending = true;
                file.positioned = true;
            }
        } else if (operation == "read_alt") {
            for (const AlternateKey& alternate : file.alternateKeys) {
                if (alternate.name != extra) continue;
                int selectedIndex = -1;
                int matchCount = 0;
                for (size_t index = 0; index < rows.size(); ++index) {
                    if (isamSlice(rows[index].second, alternate.offset, alternate.offset + alternate.length) == key) {
                        if (selectedIndex < 0) selectedIndex = static_cast<int>(index);
                        ++matchCount;
                    }
                }
                if (selectedIndex < 0) {
                    status = "23";
                } else {
                    outcome.record = rows[selectedIndex].second;
                    file.cursor = rows[selectedIndex].first;
                    file.positioned = true;
                    file.pending = false;
                    file.eof = false;
                    if (matchCount > 1 && alternate.duplicates) status = "02";
                }
                break;
            }
        } else {
            const int found = findKey(key);
            if (found < 0) {
                status = "23";
            } else {
                outcome.record = rows[found].second;
                file.cursor = key;
                file.positioned = true;
                file.pending = false;
                file.eof = false;
            }
        }
        return;
    }
    if (operation == "write" || operation == "rewrite" || operation == "delete") {
        if (operation == "write" && mode == "INPUT") {
            status = "48";
            return;
        }
        if (operation != "write" && mode != "I-O") {
            status = "49";
            return;
        }
        if (operation == "rewrite" && file.organization == "SEQUENTIAL" && !file.positioned) {
            status = "43";
            return;
        }
        if (!file.isVirtual) loadImage(file, rows);
        const int found = findKey(key);
        bool alternateDuplicate = false;
        bool duplicate = false;
        if (operation == "write") {
            for (const AlternateKey& alternate : file.alternateKeys) {
                const int end = alternate.offset + alternate.length;
                const std::string alternateValue = isamSlice(record, alternate.offset, end);
                for (const Row& existing : rows) {
                    if (isamSlice(existing.second, alternate.offset, end) == alternateValue) {
                        if (alternate.duplicates) alternateDuplicate = true;
                        else duplicate = true;
                    }
                }
            }
        }
        const bool sequentialIndexed = file.organization == "INDEXED" && file.access == "SEQUENTIAL";
        if (operation == "write" && found >= 0) {
            status = "22";
        } else if (operation == "write" && sequentialIndexed && !file.lastWriteKey.empty()
                   && byteCompare(key, file.lastWriteKey) <= 0) {
            status = "21";
        } else if (operation == "write" && duplicate) {
            status = "22";
        } else if (operation != "write" && found < 0) {
            status = "23";
        } else {
            if (operation == "delete") {
                rows.erase(rows.begin() + found);
            } else if (operation == "rewrite") {
                rows[found] = Row(key, record);
            } else {
                if (rows.size() >= MAX_RECORDS) fail("ISAM record capacity exceeded");
                size_t at = 0;
                while (at < rows.size() && byteCompare(key, rows[at].first) >= 0) ++at;
                rows.insert(rows.begin() + at, Row(key, record));
            }
            if (operation == "write" && alternateDuplicate) status = "02";
            persist(file, rows, status);
            if (operation == "write" && (status == "00" || status == "02") && sequentialIndexed) {
                file.lastWriteKey = key;
            }
        }
        return;
    }
    fail("Unknown ISAM operation");
}

IsamFiles::Outcome IsamFiles::operate(const std::string& operation, int handleId, const std::string& key,
                                      const std::string& record, const std::string& extra) {
    Handle* file = find(handleId);
    const std::string fileIdentity = file ? identity(file->root, file->path) : std::string();
    if (operation == "read" || operation == "read_alt" || operation == "start" || operation == "delete") {
        validateText(key, "key", MAX_KEY_BYTES);
    }
    if (operation == "write" || operation == "rewrite") {
        validateText(key, "key", MAX_KEY_BYTES);
        validateText(record, "record", MAX_RECORD_BYTES);
    }
    Outcome outcome;
    const bool closing = operation == "close" || operation == "close_lock";
    if (!file) {
        if (!closing) fail("Invalid ISAM file handle");
        outcome.status = "42";
    } else if (closing) {
        if (!file->available) outcome.status = "42";
        handles.erase(handles.begin() + (file - handles.data()));
    } else {
        operateOn(*file, operation, key, record, extra, outcome);
        file->status = outcome.status;
    }
    if (closing) {
        statuses.erase(handleId);
        if (outcome.status == "00" && !fileIdentity.empty()) {
            openFiles.erase(fileIdentity);
            if (operation == "close_lock") lockedFiles.insert(fileIdentity);
        }
    } else {
        statuses[handleId] = outcome.status;
    }
    return outcome;
}

std::string IsamFiles::read(int handle, const std::string& key) { return operate("read", handle, key, "", "").record; }

std::string IsamFiles::readAlternate(int handle, const std::string& alternateName, const std::string& key) {
    return operate("read_alt", handle, key, "", alternateName).record;
}

std::string IsamFiles::readNext(int handle) { return operate("read_next", handle, "", "", "").record; }

std::string IsamFiles::currentKey(int handle) {
    Handle* file = find(handle);
    if (!file) fail("Invalid ISAM file handle");
    return file->cursor;
}

int IsamFiles::count(int handle) {
    Handle* file = find(handle);
    if (!file) fail("Invalid ISAM file handle");
    return file->available ? static_cast<int>(file->records.size()) : 0;
}

int IsamFiles::start(int handle, const std::string& key, const std::string& comparison) {
    return std::atoi(operate("start", handle, key, "", comparison).status.c_str());
}

int IsamFiles::write(int handle, const std::string& key, const std::string& record) {
    return std::atoi(operate("write", handle, key, record, "").status.c_str());
}

int IsamFiles::rewrite(int handle, const std::string& key, const std::string& record) {
    return std::atoi(operate("rewrite", handle, key, record, "").status.c_str());
}

int IsamFiles::remove(int handle, const std::string& key) {
    return std::atoi(operate("delete", handle, key, "", "").status.c_str());
}

int IsamFiles::close(int handle, bool lock) {
    return std::atoi(operate(lock ? "close_lock" : "close", handle, "", "", "").status.c_str());
}

std::string IsamFiles::status(int handle) {
    const auto found = statuses.find(handle);
    if (found == statuses.end()) fail("Invalid ISAM file handle");
    return found->second;
}

}  // namespace detail
}  // namespace cobolvm

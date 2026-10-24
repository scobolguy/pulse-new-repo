#include "RemoteFileSystem.h"
#include <FSImpl.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <algorithm>
#include <vector>

namespace {
constexpr size_t kIoBytes = 1024;

String encode(const String& value) {
    const char* hex = "0123456789ABCDEF";
    String out;
    for (size_t i = 0; i < value.length(); ++i) {
        const uint8_t c = static_cast<uint8_t>(value[i]);
        if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
            || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.') out += char(c);
        else { out += '%'; out += hex[c >> 4]; out += hex[c & 15]; }
    }
    return out;
}

bool start(HTTPClient& http, const String& url) {
    http.setConnectTimeout(1500);
    http.setTimeout(5000);
    return http.begin(url);
}

bool jsonRequest(const String& url, JsonDocument& doc, const char* body = nullptr) {
    HTTPClient http;
    if (!start(http, url)) return false;
    int code;
    if (body) {
        http.addHeader("Content-Type", "application/json");
        code = http.POST(String(body));
    } else code = http.GET();
    bool ok = code == 200 && http.getSize() >= 0 && http.getSize() <= 8192;
    if (ok) ok = !deserializeJson(doc, http.getString());
    if (!ok) Serial.printf("[FFS] Remote metadata request failed: HTTP %d (%s)\n", code, url.c_str());
    http.end();
    return ok;
}

class RemoteFile : public fs::FileImpl {
public:
    RemoteFile(String base, String root, String path, size_t bytes, bool directory, bool writable)
        : base(base), root(root), filePath(path), bytes(bytes), directory(directory), writable(writable) {}
    size_t write(const uint8_t* data, size_t count) override {
        if (!opened || !writable || directory) return 0;
        cacheBytes = 0;
        size_t done = 0;
        while (done < count) {
            const size_t chunk = std::min(kIoBytes, count - done);
            HTTPClient http;
            if (!start(http, url("/ffs/io") + "&offset=" + String(cursor))) return done;
            http.addHeader("Content-Type", "application/octet-stream");
            const int code = http.POST(const_cast<uint8_t*>(data + done), chunk);
            http.end();
            if (code != 200) {
                Serial.printf("[FFS] Remote write failed: HTTP %d\n", code);
                return done;
            }
            done += chunk;
            cursor += chunk;
            bytes = std::max(bytes, cursor);
        }
        return done;
    }
    size_t read(uint8_t* data, size_t count) override {
        if (!opened || directory) return 0;
        count = std::min(count, bytes - std::min(bytes, cursor));
        size_t done = 0;
        while (done < count) {
            const size_t chunk = std::min(kIoBytes, count - done);
            // Stream caches small reads: the VM parser often reads one byte at a time.
            if (cursor < cacheStart || cursor >= cacheStart + cacheBytes) {
                HTTPClient http;
                const size_t fetchBytes = std::min(kIoBytes, bytes - cursor);
                if (!start(http, url("/ffs/io") + "&offset=" + String(cursor) + "&length=" + String(fetchBytes))) break;
                const int code = http.GET();
                bool ok = code == 200 && http.getSize() == static_cast<int>(fetchBytes);
                if (ok) ok = http.getStreamPtr()->readBytes(cache, fetchBytes) == fetchBytes;
                http.end();
                if (!ok) {
                    Serial.printf("[FFS] Remote read failed: HTTP %d\n", code);
                    break;
                }
                cacheStart = cursor;
                cacheBytes = fetchBytes;
            }
            const size_t available = std::min(chunk, cacheStart + cacheBytes - cursor);
            memcpy(data + done, cache + cursor - cacheStart, available);
            cursor += available;
            done += available;
        }
        return done;
    }
    void flush() override {}
    bool seek(uint32_t position, SeekMode mode) override {
        if (!opened || directory) return false;
        const uint64_t next = uint64_t(mode == SeekSet ? 0 : mode == SeekCur ? cursor : bytes) + position;
        if (next > UINT32_MAX || (!writable && next > bytes)) return false;
        cursor = static_cast<size_t>(next);
        return true;
    }
    size_t position() const override { return cursor; }
    size_t size() const override { return bytes; }
    bool setBufferSize(size_t) override { return false; }
    void close() override { opened = false; }
    time_t getLastWrite() override { return updated; }
    const char* path() const override { return filePath.c_str(); }
    const char* name() const override { return strrchr(filePath.c_str(), '/') + 1; }
    boolean isDirectory() override { return directory; }
    fs::FileImplPtr openNextFile(const char* mode) override;
    boolean seekDir(long position) override {
        if (position < 0 || static_cast<size_t>(position) > children.size()) return false;
        child = static_cast<size_t>(position);
        return true;
    }
    String getNextFileName() override { return getNextFileName(nullptr); }
    String getNextFileName(bool* isDir) override;
    void rewindDirectory() override { child = 0; }
    operator bool() override { return opened; }
    bool loadChildren() {
        JsonDocument doc;
        if (!jsonRequest(url("/ffs/list"), doc)) return false;
        for (JsonObjectConst item : doc["files"].as<JsonArrayConst>()) {
            children.push_back({item["name"].as<String>(), item["type"] == "directory"});
        }
        return true;
    }
    time_t updated = 0;
private:
    String base, root, filePath;
    size_t bytes = 0, cursor = 0, cacheStart = 0, cacheBytes = 0, child = 0;
    uint8_t cache[kIoBytes];
    bool directory = false, writable = false, opened = true;
    struct Child { String name; bool directory; };
    std::vector<Child> children;
    String url(const char* endpoint) const { return base + endpoint + "?path=" + encode(root + filePath); }
};

fs::FileImplPtr openRemote(const String& base, const String& root, const char* path, const char* mode) {
    String absolute(path);
    if (!absolute.startsWith("/")) absolute = "/" + absolute;
    const bool writable = mode[0] != 'r' || strchr(mode, '+');
    if (mode[0] == 'w' || mode[0] == 'a') {
        HTTPClient http;
        if (!start(http, base + "/ffs/io?path=" + encode(root + absolute)
            + "&offset=0&truncate=" + String(mode[0] == 'w' ? "true" : "false"))) return {};
        http.addHeader("Content-Type", "application/octet-stream");
        const int code = http.POST(reinterpret_cast<uint8_t*>(const_cast<char*>("")), 0);
        http.end();
        if (code != 200) {
            Serial.printf("[FFS] Remote open failed: HTTP %d\n", code);
            return {};
        }
    }
    JsonDocument doc;
    if (!jsonRequest(base + "/ffs/stat?path=" + encode(root + absolute), doc)) return {};
    auto file = std::make_shared<RemoteFile>(base, root, absolute, doc["size"].as<size_t>(),
        doc["directory"].as<bool>(), writable);
    file->updated = doc["updatedAt"].as<time_t>();
    if (file->isDirectory() && !file->loadChildren()) return {};
    if (mode[0] == 'a') file->seek(0, SeekEnd);
    return file;
}

fs::FileImplPtr RemoteFile::openNextFile(const char* mode) {
    if (!opened || child >= children.size()) return {};
    String path = filePath + (filePath.endsWith("/") ? "" : "/") + children[child++].name;
    return openRemote(base, root, path.c_str(), mode);
}
String RemoteFile::getNextFileName(bool* isDir) {
    if (!opened || child >= children.size()) return String();
    if (isDir) *isDir = children[child].directory;
    return filePath + (filePath.endsWith("/") ? "" : "/") + children[child++].name;
}

class RemoteImpl : public fs::FSImpl {
public:
    RemoteImpl(String base, String root) : base(base), root(root) {}
    fs::FileImplPtr open(const char* path, const char* mode, bool) override {
        return openRemote(base, root, path, mode);
    }
    bool exists(const char* path) override {
        JsonDocument doc;
        return jsonRequest(base + "/ffs/stat?path=" + encode(root + path), doc);
    }
    bool rename(const char*, const char*) override {
        Serial.println("[FFS] Remote rename is unsupported");
        return false;
    }
    bool remove(const char* path) override {
        if (String(path) == "/") return false;
        return change("/ffs/delete", path);
    }
    bool mkdir(const char* path) override { return change("/ffs/create", path, "directory"); }
    bool rmdir(const char* path) override { return change("/ffs/rmdir", path); }
    bool begin() {
        JsonDocument doc;
        if (!jsonRequest(base + "/ffs/storage", doc) || doc["protocol"] != "ffs-seek-v1") return false;
        return mkdir("/");
    }
private:
    String base, root;
    bool change(const char* endpoint, const char* path, const char* type = nullptr) {
        JsonDocument body, response;
        body["path"] = root + path;
        if (type) body["type"] = type;
        String encoded;
        serializeJson(body, encoded);
        return jsonRequest(base + endpoint, response, encoded.c_str());
    }
};
} // namespace

RemoteFileSystem::RemoteFileSystem(const String& baseUrl, const String& root)
    : fs::FS(std::make_shared<RemoteImpl>(baseUrl, root)) {}

bool RemoteFileSystem::begin() {
    return static_cast<RemoteImpl*>(_impl.get())->begin();
}

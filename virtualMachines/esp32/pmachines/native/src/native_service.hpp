#pragma once

#include <cstdint>
#include <iosfwd>
#include <map>
#include <stdexcept>
#include <string>

namespace pulse::native {

struct HttpRequest {
    std::string method;
    std::string path;
    std::string body;
    std::string peer;
    int peerPort = 0;
};

struct HttpResponse {
    int status = 200;
    std::string jsonBody = "{}";
};

struct StorageRootGrant {
    std::string path;
    bool readOnly = true;
};

class HttpError : public std::runtime_error {
public:
    HttpError(int status, const std::string& message) : std::runtime_error(message), status_(status) {}
    int status() const noexcept { return status_; }

private:
    int status_;
};

class NativeService {
public:
    NativeService(std::string pcodeText, std::string programMapJson, uint64_t maxSteps,
        std::map<std::string, StorageRootGrant> storageRoots = {}, uint64_t maxFileBytes = 262144);
    HttpResponse dispatch(const HttpRequest& request) const;
    HttpResponse debugDispatch(std::istream& input, std::ostream& output) const;
    const std::string& serviceId() const;
    bool filesystemReadEnabled() const;
    bool filesystemWriteEnabled() const;

private:
    std::string pcodeText_;
    std::string programMapJson_;
    std::string serviceId_;
    uint64_t maxSteps_;
    std::map<std::string, StorageRootGrant> storageRoots_;
    uint64_t maxFileBytes_;
};

std::string readFile(const std::string& path);

} // namespace pulse::native

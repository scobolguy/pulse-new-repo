#pragma once

#include <cstdint>
#include <iosfwd>
#include <map>
#include <memory>
#include <stdexcept>
#include <string>
#include "../../../../../pcode/library/Linker/kernel/image_kernel.hpp"

namespace pulse::native {

struct HttpRequest {
    std::string method;
    std::string path;
    std::string body;
    std::string peer;
    int peerPort = 0;
    std::string query;
};

struct HttpResponse {
    int status = 200;
    std::string jsonBody = "{}";
    std::string contentType = "application/json; charset=utf-8";
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

struct SchedulerState;

class NativeService {
public:
    NativeService(std::string pcodeText, std::string programMapJson, uint64_t maxSteps,
        std::map<std::string, StorageRootGrant> storageRoots = {}, uint64_t maxFileBytes = 262144,
        std::string aggregatorUrl = {}, std::string librarianUrl = {}, std::string ffsRoot = {},
        std::string signingKey = {}, std::string signingKeyId = {});
    ~NativeService();
    HttpResponse dispatch(const HttpRequest& request) const;
    HttpResponse debugDispatch(std::istream& input, std::ostream& output) const;
    void restoreScheduler();
    void pollScheduler();
    const std::string& serviceId() const;
    bool filesystemReadEnabled() const;
    bool filesystemWriteEnabled() const;
    bool artifactReadEnabled() const;
    bool brokerPublishEnabled() const;

private:
    std::string pcodeText_;
    std::string programMapJson_;
    std::string serviceId_;
    uint64_t maxSteps_;
    std::map<std::string, StorageRootGrant> storageRoots_;
    uint64_t maxFileBytes_;
    std::string aggregatorUrl_;
    std::string librarianUrl_;
    mutable std::map<std::string, std::string> blobs_;
    std::string bootId_;
    std::shared_ptr<SchedulerState> scheduler_;
};

std::string readFile(const std::string& path);

// Explicit typed-image entry points; no text assembly or symbol lookup is performed.
std::string imageContentHash(const image::Image& image);
std::unique_ptr<image::Context> createImageContext(image::Limits limits = {});
image::Scalar callImage(image::Context& context, uint32_t slot,
    const std::vector<image::Scalar>& args = {}, uint64_t maxSteps = 200000);
image::Scalar callStagedImage(image::Context& context, image::Context::Handle handle,
    uint32_t entry, const std::vector<image::Scalar>& args = {}, uint64_t maxSteps = 200000);

} // namespace pulse::native

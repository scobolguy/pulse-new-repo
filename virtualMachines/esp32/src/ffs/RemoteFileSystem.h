#pragma once

#include <FS.h>

// Seekable, bounded HTTP access to the aggregator's FFS service.
class RemoteFileSystem : public fs::FS {
public:
    RemoteFileSystem(const String& baseUrl, const String& root);
    bool begin();
};

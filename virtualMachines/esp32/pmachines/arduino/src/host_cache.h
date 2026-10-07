#pragma once
#include <map>
#include <string>
#include <cstdint>
#include <vector>

namespace pmachine {

// Keep storage independent of bindings and JSON so a distributed adapter can
// replace it later. The caller validates declared item schemas and supplies time.
// Reads (get/next/count) take the invocation start time and never mutate entries,
// so one invocation sees a consistent snapshot and reads never refresh TTL or order.
class HostCacheStore {
public:
    struct SnapshotEntry { std::string key, json; uint64_t observedAt, sequence, remainingTtl; };
    struct Snapshot { uint64_t revision = 0; uint32_t total = 0; std::string nextCursor; std::vector<SnapshotEntry> records; };
    virtual ~HostCacheStore() = default;
    virtual bool get(const std::string&, const std::string&, uint64_t, std::string&, std::string&) = 0;
    virtual bool put(const std::string&, const std::string&, const std::string&, uint32_t, uint64_t, std::string&) = 0;
    virtual bool remove(const std::string&, const std::string&, uint64_t) = 0;
    // Smallest live key strictly greater than cursor (bytewise); empty key ends enumeration.
    virtual void next(const std::string&, const std::string&, uint64_t, std::string&) = 0;
    virtual uint32_t count(const std::string&, uint64_t) = 0;
    virtual size_t entries() const = 0;
    virtual size_t storageBytes() const = 0;
    virtual bool snapshot(const std::string&, const std::string&, const std::string&, uint64_t, Snapshot&, std::string&) = 0;
};

class LocalHostCacheStore final : public HostCacheStore {
    struct Entry { std::string json; uint64_t deadline, order, observedAt; };
    using Cache = std::map<std::string, Entry>;
    std::map<std::string, Cache> caches;
    uint64_t observation = 0;
    uint64_t revision = 0;
    size_t bytes = 0;
    void erase(Cache& cache, Cache::iterator entry) {
        bytes -= entry->first.size() + entry->second.json.size();
        cache.erase(entry);
        ++revision;
    }
    void expire(uint64_t time) {
        for (auto& cache : caches) for (auto entry = cache.second.begin(); entry != cache.second.end();) {
            if (entry->second.deadline <= time) { auto expired = entry++; erase(cache.second, expired); }
            else ++entry;
        }
    }
public:
    bool snapshot(const std::string& name, const std::string& cursor, const std::string& fence,
                  uint64_t time, Snapshot& page, std::string& error) override {
        if (cursor.size() > 256 || fence.size() > 16 || (!cursor.empty() && fence.empty())
            || fence.find_first_not_of("0123456789") != std::string::npos) {
            error = "Invalid snapshot cursor or revision"; return false;
        }
        expire(time);
        if (!fence.empty() && fence != std::to_string(revision)) {
            error = "Snapshot revision changed"; return false;
        }
        page.revision = revision;
        const auto found = caches.find(name);
        if (found == caches.end()) {
            if (!cursor.empty()) { error = "Invalid snapshot cursor"; return false; }
            return true;
        }
        const auto& cache = found->second;
        if (!cursor.empty() && cache.count(cursor) == 0) { error = "Invalid snapshot cursor"; return false; }
        page.total = cache.size();
        auto entry = cursor.empty() ? cache.begin() : cache.upper_bound(cursor);
        for (; entry != cache.end() && page.records.size() < 2; ++entry)
            page.records.push_back({entry->first, entry->second.json, entry->second.observedAt,
                entry->second.order, entry->second.deadline - time});
        if (entry != cache.end()) page.nextCursor = page.records.back().key;
        return true;
    }
    bool get(const std::string& name, const std::string& key, uint64_t time,
             std::string& value, std::string& error) override {
        const auto cache = caches.find(name);
        const auto entry = cache == caches.end() ? Cache::const_iterator() : cache->second.find(key);
        if (cache == caches.end() || entry == cache->second.end() || entry->second.deadline <= time) {
            error = "Cache key missing or expired"; return false;
        }
        value = entry->second.json;
        return true;
    }
    void next(const std::string& name, const std::string& cursor, uint64_t time, std::string& key) override {
        key.clear();
        const auto cache = caches.find(name);
        if (cache == caches.end()) return;
        auto entry = cursor.empty() ? cache->second.begin() : cache->second.upper_bound(cursor);
        while (entry != cache->second.end() && entry->second.deadline <= time) ++entry;
        if (entry != cache->second.end()) key = entry->first;
    }
    uint32_t count(const std::string& name, uint64_t time) override {
        const auto cache = caches.find(name);
        uint32_t live = 0;
        if (cache != caches.end()) for (const auto& entry : cache->second) if (entry.second.deadline > time) ++live;
        return live;
    }
    size_t entries() const override {
        size_t total = 0;
        for (const auto& cache : caches) total += cache.second.size();
        return total;
    }
    size_t storageBytes() const override { return bytes; }
    bool put(const std::string& name, const std::string& key, const std::string& json,
             uint32_t ttl, uint64_t time, std::string& error) override {
        if (ttl < 1 || ttl > 2147483647 || key.empty() || key.size() > 256
            || key.find_first_not_of(" \t\r\n") == std::string::npos || json.size() > 2048
            || (caches.count(name) == 0 && caches.size() >= 2)) {
            error = "Invalid cache key, item, TTL or cache capacity"; return false;
        }
        expire(time);
        auto& cache = caches[name];
        auto existing = cache.find(key), victim = cache.end();
        if (existing == cache.end() && cache.size() >= 50) {
            for (auto entry = cache.begin(); entry != cache.end(); ++entry)
                if (victim == cache.end() || entry->second.order < victim->second.order) victim = entry;
        }
        const auto entryBytes = [](Cache::iterator entry) { return entry->first.size() + entry->second.json.size(); };
        const size_t required = bytes + key.size() + json.size()
            - (existing == cache.end() ? 0 : entryBytes(existing))
            - (victim == cache.end() ? 0 : entryBytes(victim));
        if (required > 16384) { error = "Cache storage capacity exceeded"; return false; }
        if (victim != cache.end()) erase(cache, victim);
        if (existing != cache.end()) erase(cache, existing);
        cache[key] = {json, time + ttl, ++observation, time};
        ++revision;
        bytes += key.size() + json.size();
        return true;
    }
    bool remove(const std::string& name, const std::string& key, uint64_t time) override {
        expire(time);
        auto cache = caches.find(name);
        if (cache == caches.end()) return false;
        auto entry = cache->second.find(key);
        if (entry == cache->second.end()) return false;
        erase(cache->second, entry);
        return true;
    }
};

} // namespace pmachine

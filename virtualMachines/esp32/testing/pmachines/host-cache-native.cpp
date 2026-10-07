#include "../../pmachines/arduino/src/host_cache.h"
#include <cassert>

int main() {
    pmachine::LocalHostCacheStore store, isolated;
    std::string error, result;
    assert(store.put("a", "z-first", "first", 100, 0, error));
    for (int i = 0; i < 49; ++i) assert(store.put("a", "a-" + std::to_string(i), "value", 100, 0, error));
    assert(store.get("a", "z-first", 1, result, error));
    assert(store.put("a", "new", "value", 100, 1, error));
    assert(!store.get("a", "z-first", 1, result, error));
    assert(store.put("a", "a-0", "updated", 100, 1, error));
    assert(store.put("a", "newer", "value", 100, 1, error));
    assert(!store.get("a", "a-1", 1, result, error));
    assert(store.get("a", "a-0", 1, result, error) && result == "updated");
    assert(!isolated.get("a", "a-0", 1, result, error));
    assert(store.remove("a", "a-0", 1));
    assert(!store.remove("a", "a-0", 1));
    assert(store.put("b", "live-first", "value", 100, 1, error));
    assert(store.put("b", "expires", "value", 1, 1, error));
    for (int i = 0; i < 48; ++i) assert(store.put("b", "k" + std::to_string(i), "value", 100, 1, error));
    assert(store.put("b", "new", "value", 100, 2, error));
    assert(store.get("b", "live-first", 2, result, error));
    assert(!store.get("b", "expires", 2, result, error));
    assert(!store.put("b", "live-first", std::string(16384, 'x'), 100, 2, error));
    assert(store.get("b", "live-first", 2, result, error) && result == "value");
    assert(!store.get("b", "live-first", 101, result, error));
}

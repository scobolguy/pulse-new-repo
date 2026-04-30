#include "StringPool.h"
#include <string>

namespace stringpool {
uint16_t StringPool::add(const std::string&) { return 0; }
const std::string& StringPool::get(uint16_t) const { static std::string s; return s; }
}

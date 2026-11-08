#include "cobol_host_contract.h"

namespace pmachine::rtl {
namespace detail {

int findBinding(const std::string& lowerName) {
    for (int id = 0; id < B_COUNT; ++id) {
        if (lowerName == BINDINGS[id].name) return id;
    }
    return -1;
}

const BindingSpec& bindingSpec(int id) {
    if (id < 0 || id >= B_COUNT) fail("Invalid COBOL host binding id");
    return BINDINGS[id];
}

bool isDelegatedBinding(int id) {
#if PULSE_COBOL_HOST_LIBRARY
    return id >= B_ISAM_OPEN && id < B_COUNT;
#else
    return id >= 0 && id < B_COUNT;
#endif
}

BindingValue callBinding(int id, const std::vector<BindingValue>& args, BindingContext& context) {
    const BindingSpec& spec = bindingSpec(id);
    if (args.size() != spec.arity) fail("Invalid host binding arity: " + std::string(spec.name));
#if PULSE_COBOL_HOST_LIBRARY
    if (!isDelegatedBinding(id)) return callCobolHostLibrary(id, args, context);
#else
    (void)context;
#endif
    fail("Host binding unavailable: " + std::string(spec.name));
}

}  // namespace detail
}  // namespace pmachine::rtl

#include "pmachine_dynamic_library.h"

namespace pmachine {

const char* legacyDynamicLinkerError() {
    return "Unsupported legacy dynamic linking: install a checked prelinked image through the task image kernel";
}

}

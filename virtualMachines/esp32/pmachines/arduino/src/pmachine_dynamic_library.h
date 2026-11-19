#pragma once

#include "../../../../../pcode/library/Linker/kernel/image_kernel.hpp"

namespace pmachine {

// Task owners supply a real SHA-256 implementation and a VM instruction validator.
// The same checked stage/bind/commit/abort/acquire/release kernel is used by native.
using ImageKernelContext = pulse::image::Context;
using ModuleImage = pulse::image::Image;
using ImageKernelLimits = pulse::image::Limits;

const char* legacyDynamicLinkerError();

}

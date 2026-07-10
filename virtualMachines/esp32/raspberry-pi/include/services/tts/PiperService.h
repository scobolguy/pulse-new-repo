#pragma once

#include "core/Types.h"

#include <string>

namespace pulse::services::tts {

class PiperService {
public:
    explicit PiperService(const core::NodeConfig& config);
    void speak(const std::string& text) const;

private:
    core::NodeConfig config_;
};

} // namespace pulse::services::tts

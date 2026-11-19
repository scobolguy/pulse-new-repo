#pragma once

#include "pmachine.h"

namespace pulse { namespace boot {

bool executePolicy(const std::vector<pmachine::PInstruction>& instructions,
    const std::map<std::string, std::vector<std::string>>& signatures,
    pmachine::HostCallHook hook, void* context, std::string& error);
bool invokeJson(const std::string& name, const std::vector<pmachine::HostValue>& args,
    pmachine::HostValue& result, std::string& error);

}}

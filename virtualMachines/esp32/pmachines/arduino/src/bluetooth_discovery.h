#pragma once

#include <string>

namespace pmachine {
bool scanBluetoothDevices(int seconds, std::string& result, std::string& error);
}

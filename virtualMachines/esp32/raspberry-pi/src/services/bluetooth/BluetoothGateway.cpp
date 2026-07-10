#include "services/bluetooth/BluetoothGateway.h"

#include <algorithm>
#include <array>
#include <cctype>
#include <cstdlib>
#include <iostream>
#include <regex>
#include <sstream>
#include <unordered_map>
#include <vector>

namespace {

std::string trim(const std::string& value) {
    std::size_t begin = 0;
    while (begin < value.size() && std::isspace(static_cast<unsigned char>(value[begin]))) {
        ++begin;
    }
    std::size_t end = value.size();
    while (end > begin && std::isspace(static_cast<unsigned char>(value[end - 1]))) {
        --end;
    }
    return value.substr(begin, end - begin);
}

#if defined(__linux__)
std::vector<std::string> splitCsv(const std::string& csv) {
    std::vector<std::string> out;
    std::stringstream ss(csv);
    std::string token;
    while (std::getline(ss, token, ',')) {
        const std::string item = trim(token);
        if (!item.empty()) out.push_back(item);
    }
    return out;
}

int runCommand(const std::string& cmd) {
    return std::system(cmd.c_str());
}
#endif

std::string jsonEscape(const std::string& value) {
    std::string out;
    out.reserve(value.size() + 8);
    for (char c : value) {
        if (c == '\\') out += "\\\\";
        else if (c == '"') out += "\\\"";
        else if (c == '\n') out += "\\n";
        else if (c == '\r') out += "\\r";
        else if (c == '\t') out += "\\t";
        else out += c;
    }
    return out;
}

std::string captureCommand(const std::string& cmd, int* exitCode = nullptr) {
#if defined(_WIN32)
    FILE* pipe = _popen(cmd.c_str(), "r");
#else
    FILE* pipe = popen(cmd.c_str(), "r");
#endif
    if (!pipe) {
        if (exitCode) *exitCode = -1;
        return {};
    }

    std::string output;
    std::array<char, 512> buf{};
    while (std::fgets(buf.data(), static_cast<int>(buf.size()), pipe) != nullptr) {
        output += buf.data();
    }

#if defined(_WIN32)
    const int rc = _pclose(pipe);
#else
    const int rc = pclose(pipe);
#endif
    if (exitCode) *exitCode = rc;
    return output;
}

} // namespace

namespace pulse::services::bluetooth {

BluetoothGateway::BluetoothGateway(const core::NodeConfig& config) : config_(config) {}

bool BluetoothGateway::isEnabled() const {
    return config_.bluetoothEnabled;
}

void BluetoothGateway::start() {
    if (!config_.bluetoothEnabled) {
        std::cout << "[bluetooth] disabled in config\n";
        return;
    }

#if defined(__linux__)
    auto runCommand = [](const std::string& cmd) {
        return std::system(cmd.c_str());
    };

    std::cout << "[bluetooth] enabling adapter=" << config_.bluetoothAdapter
              << " ble=" << (config_.bluetoothBleEnabled ? "on" : "off")
              << " classic=" << (config_.bluetoothClassicEnabled ? "on" : "off")
              << " hid=" << (config_.bluetoothHidEnabled ? "on" : "off") << '\n';

    runCommand("bluetoothctl --timeout 5 power on > /dev/null 2>&1");
    runCommand("bluetoothctl --timeout 5 pairable on > /dev/null 2>&1");
    runCommand("bluetoothctl --timeout 5 discoverable on > /dev/null 2>&1");

    const auto macs = splitCsv(config_.bluetoothAutoConnectMacsCsv);
    for (const auto& mac : macs) {
        const std::string trustCmd = "bluetoothctl --timeout 8 trust " + mac + " > /dev/null 2>&1";
        const std::string connectCmd = "bluetoothctl --timeout 8 connect " + mac + " > /dev/null 2>&1";
        runCommand(trustCmd);
        runCommand(connectCmd);
        std::cout << "[bluetooth] auto-connect attempted mac=" << mac << '\n';
    }
#else
    std::cout << "[bluetooth] non-linux host; BlueZ control disabled\n";
#endif

    started_ = true;
    std::cout << "[bluetooth] gateway started\n";
}

void BluetoothGateway::stop() {
    if (!started_) return;

#if defined(__linux__)
    runCommand("bluetoothctl --timeout 5 discoverable off > /dev/null 2>&1");
#endif

    started_ = false;
    std::cout << "[bluetooth] gateway stopped\n";
}

void BluetoothGateway::publishAlert(const std::string& message) {
    std::cout << "[bluetooth] publish alert: " << message << '\n';

    if (config_.bluetoothHidEnabled && !config_.bluetoothHidCommand.empty()) {
        std::string cmd = config_.bluetoothHidCommand;
        const std::string marker = "{event}";
        std::size_t pos = cmd.find(marker);
        while (pos != std::string::npos) {
            cmd.replace(pos, marker.size(), message);
            pos = cmd.find(marker, pos + message.size());
        }

        const int rc = std::system((cmd + " > /dev/null 2>&1").c_str());
        std::cout << "[bluetooth] hid hook rc=" << rc << '\n';
    }
}

std::string BluetoothGateway::scanDevicesJson(bool ble, bool classic, int timeoutSec) const {
    if (!config_.bluetoothEnabled) {
        return "{\"status\":\"disabled\",\"devices\":[]}";
    }

    if (timeoutSec < 2) timeoutSec = 2;
    if (timeoutSec > 20) timeoutSec = 20;
    std::cout << "[bluetooth][scan] request ble=" << (ble ? "true" : "false")
              << " classic=" << (classic ? "true" : "false")
              << " timeoutSec=" << timeoutSec << '\n';

#if defined(__linux__)
    const bool wantBle = ble && config_.bluetoothBleEnabled;
    const bool wantClassic = classic && config_.bluetoothClassicEnabled;
    if (!wantBle && !wantClassic) {
        std::cout << "[bluetooth][scan][linux] no enabled transports after config filter\n";
        return "{\"status\":\"ok\",\"devices\":[],\"note\":\"no transports enabled\"}";
    }

    std::cout << "[bluetooth][scan][linux] starting scan ble=" << (wantBle ? "true" : "false")
              << " classic=" << (wantClassic ? "true" : "false")
              << " timeoutSec=" << timeoutSec << '\n';
    runCommand("bluetoothctl --timeout 2 scan off > /dev/null 2>&1");
    const std::string scanOut = captureCommand("bluetoothctl --timeout " + std::to_string(timeoutSec) + " scan on 2>&1");
    const std::string devicesOut = captureCommand("bluetoothctl devices 2>&1");
    std::cout << "[bluetooth][scan][linux] raw scan bytes=" << scanOut.size()
              << " devices bytes=" << devicesOut.size() << '\n';

    std::unordered_map<std::string, std::string> devices;
    const std::regex deviceRe("Device\\s+([0-9A-Fa-f:]{17})\\s+(.+)$");

    auto parseDevices = [&devices, &deviceRe](const std::string& input) {
        std::stringstream ss(input);
        std::string line;
        while (std::getline(ss, line)) {
            std::smatch match;
            if (std::regex_search(line, match, deviceRe) && match.size() > 2) {
                const std::string mac = match[1].str();
                const std::string name = trim(match[2].str());
                if (!mac.empty()) {
                    devices[mac] = name.empty() ? "Unknown device" : name;
                }
            }
        }
    };

    parseDevices(scanOut);
    parseDevices(devicesOut);
    std::cout << "[bluetooth][scan][linux] parsed devices=" << devices.size() << '\n';
    for (const auto& kv : devices) {
        std::cout << "[bluetooth][scan][linux] device mac=" << kv.first
                  << " name=" << kv.second << '\n';
    }

    std::ostringstream out;
    out << "{";
    out << "\"status\":\"ok\",";
    out << "\"scan\":{";
    out << "\"ble\":" << (wantBle ? "true" : "false") << ",";
    out << "\"classic\":" << (wantClassic ? "true" : "false") << ",";
    out << "\"timeoutSec\":" << timeoutSec;
    out << "},";
    out << "\"devices\":[";
    bool first = true;
    for (const auto& kv : devices) {
        if (!first) out << ',';
        first = false;
        out << "{";
        out << "\"address\":\"" << jsonEscape(kv.first) << "\",";
        out << "\"name\":\"" << jsonEscape(kv.second) << "\",";
        out << "\"transport\":\"" << (wantBle && wantClassic ? "dual" : (wantBle ? "ble" : "classic")) << "\"";
        out << "}";
    }
    out << "]";
    out << "}";
    return out.str();
#elif defined(_WIN32)
    const bool wantBle = ble;
    const bool wantClassic = classic;
    std::cout << "[bluetooth][scan][win] begin ble=" << (wantBle ? "true" : "false")
              << " classic=" << (wantClassic ? "true" : "false")
              << " timeoutSec=" << timeoutSec << '\n';

    std::ostringstream ps;
    ps << "$ErrorActionPreference='SilentlyContinue'; ";
    ps << "Add-Type -AssemblyName System.Runtime.WindowsRuntime; ";
    ps << "$deadline=(Get-Date).AddSeconds(" << timeoutSec << "); ";
    ps << "function AwaitWinRt($op,$label,$deadline){ Write-Output ('DBG|wait-begin|' + $label); while($op.Status -eq [Windows.Foundation.AsyncStatus]::Started){ if((Get-Date) -gt $deadline){ Write-Output ('ERR|timeout|' + $label); throw ($label + ' timeout') }; Start-Sleep -Milliseconds 100 }; Write-Output ('DBG|wait-status|' + $label + '|' + $op.Status); if($op.Status -ne [Windows.Foundation.AsyncStatus]::Completed){ Write-Output ('ERR|status|' + $label + '|' + $op.Status); throw ($label + ' failed') }; return $op.GetResults() }; ";
    ps << "function Emit($transport,$id,$name){ if([string]::IsNullOrWhiteSpace($name)){ $name=$id }; ";
    ps << "$addr=''; if($id -match 'DEV_([0-9A-F]{12})'){ $h=$Matches[1]; $addr=($h -replace '..(?!$)','$0:') }; ";
    ps << "if([string]::IsNullOrWhiteSpace($addr)){ $addr=$id }; ";
    ps << "Write-Output ('DBG|emit|' + $transport + '|' + $addr + '|' + $name); Write-Output ('DEVICE|' + $transport + '|' + $addr + '|' + $name) }; ";
    if (wantBle) {
        ps << "Write-Output 'DBG|ble|selector-start'; ";
        ps << "$sel=[Windows.Devices.Bluetooth.BluetoothLEDevice,Windows.Devices.Bluetooth,ContentType=WindowsRuntime]::GetDeviceSelector(); ";
        ps << "Write-Output ('DBG|ble|selector-len|' + $sel.Length); ";
        ps << "$op=[Windows.Devices.Enumeration.DeviceInformation,Windows.Devices.Enumeration,ContentType=WindowsRuntime]::FindAllAsync($sel); ";
        ps << "$list=AwaitWinRt $op 'BLE FindAllAsync' $deadline; ";
        ps << "Write-Output ('DBG|ble|count|' + $list.Count); ";
        ps << "foreach($d in $list){ Write-Output ('DBG|ble|item|' + $d.Id + '|' + $d.Name); Emit 'ble' $d.Id $d.Name }; ";
    }
    if (wantClassic) {
        ps << "Write-Output 'DBG|classic|selector-start'; ";
        ps << "$sel=[Windows.Devices.Bluetooth.BluetoothDevice,Windows.Devices.Bluetooth,ContentType=WindowsRuntime]::GetDeviceSelector(); ";
        ps << "Write-Output ('DBG|classic|selector-len|' + $sel.Length); ";
        ps << "$op=[Windows.Devices.Enumeration.DeviceInformation,Windows.Devices.Enumeration,ContentType=WindowsRuntime]::FindAllAsync($sel); ";
        ps << "$list=AwaitWinRt $op 'Classic FindAllAsync' $deadline; ";
        ps << "Write-Output ('DBG|classic|count|' + $list.Count); ";
        ps << "foreach($d in $list){ Write-Output ('DBG|classic|item|' + $d.Id + '|' + $d.Name); Emit 'classic' $d.Id $d.Name }; ";
    }

    const std::string cmd = "powershell -NoProfile -Command \"" + ps.str() + "\"";
    int scanRc = -1;
    const std::string scanOut = captureCommand(cmd, &scanRc);
    std::cout << "[bluetooth][scan][win] powershell rc=" << scanRc
              << " outputBytes=" << scanOut.size() << '\n';

    struct DeviceRow {
        std::string name;
        std::string transport;
    };
    std::unordered_map<std::string, DeviceRow> devices;
    std::vector<std::string> debugLines;
    std::size_t ignoredLines = 0;

    std::stringstream ss(scanOut);
    std::string line;
    while (std::getline(ss, line)) {
        const std::string trimmed = trim(line);
        if (trimmed.rfind("DBG|", 0) == 0 || trimmed.rfind("ERR|", 0) == 0) {
            debugLines.push_back(trimmed);
            continue;
        }
        if (trimmed.rfind("DEVICE|", 0) != 0) continue;
        const std::size_t p1 = trimmed.find('|', 7);
        if (p1 == std::string::npos) {
            ++ignoredLines;
            continue;
        }
        const std::size_t p2 = trimmed.find('|', p1 + 1);
        if (p2 == std::string::npos) {
            ++ignoredLines;
            continue;
        }

        const std::string transport = trimmed.substr(7, p1 - 7);
        const std::string address = trim(trimmed.substr(p1 + 1, p2 - p1 - 1));
        const std::string name = trim(trimmed.substr(p2 + 1));
        if (address.empty() || name.empty()) {
            ++ignoredLines;
            continue;
        }

        auto it = devices.find(address);
        if (it == devices.end()) {
            devices[address] = DeviceRow{name, transport};
        } else if (it->second.transport != transport) {
            it->second.transport = "dual";
        }
    }

    std::cout << "[bluetooth][scan][win] debugLines=" << debugLines.size()
              << " ignoredLines=" << ignoredLines
              << " parsedDevices=" << devices.size() << '\n';
    for (const auto& dbg : debugLines) {
        std::cout << "[bluetooth][scan][win] " << dbg << '\n';
    }
    for (const auto& kv : devices) {
        std::cout << "[bluetooth][scan][win] device addr=" << kv.first
                  << " transport=" << kv.second.transport
                  << " name=" << kv.second.name << '\n';
    }

    std::ostringstream out;
    out << "{";
    out << "\"status\":\"ok\",";
    out << "\"scan\":{";
    out << "\"ble\":" << (wantBle ? "true" : "false") << ",";
    out << "\"classic\":" << (wantClassic ? "true" : "false") << ",";
    out << "\"timeoutSec\":" << timeoutSec;
    out << "},";
    out << "\"debug\":{";
    out << "\"platform\":\"windows\",";
    out << "\"commandRc\":" << scanRc << ",";
    out << "\"rawOutputBytes\":" << scanOut.size() << ",";
    out << "\"debugLineCount\":" << debugLines.size() << ",";
    out << "\"ignoredLineCount\":" << ignoredLines << ",";
    out << "\"transports\":{";
    out << "\"ble\":" << (wantBle ? "true" : "false") << ",";
    out << "\"classic\":" << (wantClassic ? "true" : "false");
    out << "},";
    out << "\"messages\":[";
    bool firstDbg = true;
    for (const auto& dbg : debugLines) {
        if (!firstDbg) out << ',';
        firstDbg = false;
        out << "\"" << jsonEscape(dbg) << "\"";
    }
    out << "]";
    out << "},";
    out << "\"devices\":[";
    bool first = true;
    for (const auto& kv : devices) {
        if (!first) out << ',';
        first = false;
        out << "{";
        out << "\"address\":\"" << jsonEscape(kv.first) << "\",";
        out << "\"name\":\"" << jsonEscape(kv.second.name) << "\",";
        out << "\"transport\":\"" << jsonEscape(kv.second.transport) << "\"";
        out << "}";
    }
    out << "]";
    out << "}";
    return out.str();
#else
    std::ostringstream out;
    out << "{";
    out << "\"status\":\"simulated\",";
    out << "\"scan\":{";
    out << "\"ble\":" << (ble ? "true" : "false") << ",";
    out << "\"classic\":" << (classic ? "true" : "false") << ",";
    out << "\"timeoutSec\":" << timeoutSec;
    out << "},";
    out << "\"devices\":[";
    out << "{\"address\":\"00:11:22:33:44:55\",\"name\":\"Simulated Speaker\",\"transport\":\"dual\"}";
    out << "]";
    out << "}";
    return out.str();
#endif
}

bool BluetoothGateway::connectDevice(const std::string& address, std::string* detail) const {
    if (!config_.bluetoothEnabled || address.empty()) {
        if (detail) *detail = "bluetooth disabled or invalid address";
        return false;
    }

#if defined(__linux__)
    int rcTrust = 0;
    int rcConnect = 0;
    captureCommand("bluetoothctl --timeout 8 trust " + address + " 2>&1", &rcTrust);
    const std::string connectOut = captureCommand("bluetoothctl --timeout 12 connect " + address + " 2>&1", &rcConnect);
    const bool ok = (rcConnect == 0) || (connectOut.find("Connection successful") != std::string::npos);
    if (detail) {
        *detail = connectOut.empty() ? (ok ? "connected" : "connect failed") : connectOut;
    }
    return ok;
#elif defined(_WIN32)
    std::cout << "[bluetooth][connect][win] request address=" << address << '\n';
    std::string normalized;
    for (char c : address) {
        if (std::isxdigit(static_cast<unsigned char>(c)) || c == ':') {
            normalized.push_back(c);
        }
    }
    std::cout << "[bluetooth][connect][win] normalized=" << normalized << '\n';
    if (normalized.size() != 17) {
        std::cout << "[bluetooth][connect][win] invalid normalized address length=" << normalized.size() << '\n';
        if (detail) *detail = "invalid bluetooth address format";
        return false;
    }

    std::ostringstream ps;
    ps << "$ErrorActionPreference='Stop'; ";
    ps << "Add-Type -AssemblyName System.Runtime.WindowsRuntime; ";
    ps << "$deadline=(Get-Date).AddSeconds(15); ";
    ps << "function AwaitWinRt($op,$label,$deadline){ while($op.Status -eq [Windows.Foundation.AsyncStatus]::Started){ if((Get-Date) -gt $deadline){ throw ($label + ' timeout') }; Start-Sleep -Milliseconds 100 }; if($op.Status -ne [Windows.Foundation.AsyncStatus]::Completed){ throw ($label + ' failed') }; return $op.GetResults() }; ";
    ps << "$mac='" << normalized << "'; ";
    ps << "$hex=($mac -replace ':',''); ";
    ps << "$addr=[UInt64]::Parse($hex,[System.Globalization.NumberStyles]::HexNumber); ";
    ps << "Write-Output ('DBG|connect|addr-hex|' + $hex); ";
    ps << "$op=[Windows.Devices.Bluetooth.BluetoothDevice,Windows.Devices.Bluetooth,ContentType=WindowsRuntime]::FromBluetoothAddressAsync($addr); ";
    ps << "$dev=AwaitWinRt $op 'FromBluetoothAddressAsync' $deadline; ";
    ps << "if(-not $dev){ throw 'Device not found by address' }; ";
    ps << "Write-Output ('DBG|connect|device-id|' + $dev.DeviceId); ";
    ps << "$pair=$dev.DeviceInformation.Pairing; ";
    ps << "Write-Output ('DBG|connect|is-paired|' + $pair.IsPaired); ";
    ps << "if(-not $pair.IsPaired){ ";
    ps << "$pairOp=$pair.PairAsync(); $pairRes=AwaitWinRt $pairOp 'PairAsync' $deadline; ";
    ps << "Write-Output ('PairStatus=' + $pairRes.Status) ";
    ps << "} else { Write-Output 'PairStatus=AlreadyPaired' }; ";
    ps << "Write-Output ('Name=' + $dev.Name);";

    int rc = -1;
    const std::string cmd = "powershell -NoProfile -Command \"" + ps.str() + "\"";
    const std::string output = captureCommand(cmd, &rc);
    std::cout << "[bluetooth][connect][win] powershell rc=" << rc
              << " outputBytes=" << output.size() << '\n';
    std::stringstream outStream(output);
    std::string outLine;
    while (std::getline(outStream, outLine)) {
        const std::string trimmed = trim(outLine);
        if (!trimmed.empty()) {
            std::cout << "[bluetooth][connect][win] " << trimmed << '\n';
        }
    }
    const bool ok = (rc == 0);
    if (detail) {
        *detail = output.empty() ? (ok ? "connected" : "connect failed") : output;
    }
    return ok;
#else
    if (detail) *detail = "simulated connect on non-linux host";
    return true;
#endif
}

} // namespace pulse::services::bluetooth

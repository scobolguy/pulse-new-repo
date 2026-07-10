#include "services/tts/PiperService.h"

#include <cstdio>
#include <iostream>
#include <sstream>
#include <string>

namespace {

#if defined(__linux__)
std::string shellEscape(const std::string& value) {
    std::string out;
    out.reserve(value.size() + 2);
    out.push_back('\'');
    for (char c : value) {
        if (c == '\'') {
            out += "'\\''";
        } else {
            out.push_back(c);
        }
    }
    out.push_back('\'');
    return out;
}
#elif defined(_WIN32)
std::string escapePowerShellSingleQuoted(const std::string& value) {
    std::string out;
    out.reserve(value.size() + 8);
    for (char c : value) {
        if (c == '\'') {
            out += "''";
        } else {
            out.push_back(c);
        }
    }
    return out;
}
#endif

} // namespace

namespace pulse::services::tts {

PiperService::PiperService(const core::NodeConfig& config) : config_(config) {}

void PiperService::speak(const std::string& text) const {
    if (!config_.piperEnabled) {
        std::cout << "[tts] disabled, skipping: " << text << '\n';
        return;
    }

#if defined(__linux__)
    const std::string outputWav = "/tmp/pulse_tts_output.wav";

    std::ostringstream synthCmd;
    synthCmd << "printf %s " << shellEscape(text)
             << " | " << shellEscape(config_.piperBinaryPath)
             << " --model " << shellEscape(config_.piperModelPath)
             << " --output_file " << shellEscape(outputWav)
             << " > /dev/null 2>&1";

    const int synthRc = std::system(synthCmd.str().c_str());
    if (synthRc != 0) {
        std::cout << "[tts] synthesis failed rc=" << synthRc << " text=" << text << '\n';
        return;
    }

    if (!config_.piperOutputDevice.empty() && config_.piperOutputDevice != "default") {
        std::ostringstream sinkCmd;
        sinkCmd << "pactl set-default-sink " << shellEscape(config_.piperOutputDevice) << " > /dev/null 2>&1";
        std::system(sinkCmd.str().c_str());
    }

    std::ostringstream playCmd;
    playCmd << "aplay " << shellEscape(outputWav) << " > /dev/null 2>&1";
    const int playRc = std::system(playCmd.str().c_str());
    if (playRc != 0) {
        std::cout << "[tts] playback failed rc=" << playRc << " wav=" << outputWav << '\n';
        return;
    }

    std::cout << "[tts] spoke: " << text << '\n';
#elif defined(_WIN32)
    const std::string escaped = escapePowerShellSingleQuoted(text);
    std::ostringstream speakCmd;
    speakCmd << "powershell -NoProfile -Command \""
             << "Add-Type -AssemblyName System.Speech;"
             << "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;"
             << "$s.Speak('" << escaped << "');"
             << "\"";

    const int speakRc = std::system(speakCmd.str().c_str());
    if (speakRc != 0) {
        std::cout << "[tts] windows speech failed rc=" << speakRc << " text=" << text << '\n';
        return;
    }

    std::cout << "[tts] windows spoke: " << text << '\n';
#else
    std::cout << "[tts] non-linux host; simulated speech: " << text << '\n';
#endif
}

} // namespace pulse::services::tts

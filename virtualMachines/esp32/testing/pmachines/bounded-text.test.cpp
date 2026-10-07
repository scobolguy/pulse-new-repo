#include "../../pmachines/arduino/src/bounded_text.h"
#include <cassert>
int main() {
    std::string output, error;
    const std::string frame = "NOTIFY * HTTP/1.1\r\nhOsT: 239.255.255.250:1900\r\nUSN: uuid:test\r\n\r\n";
    assert(pmachine::headerText(frame, "", output, error) && output == "NOTIFY * HTTP/1.1");
    assert(pmachine::headerText(frame, "HOST", output, error) && output == "239.255.255.250:1900");
    assert(pmachine::headerText(frame, "missing", output, error) && output.empty());
    for (const auto& invalid : {
        std::string("NOTIFY * HTTP/1.1\nHOST: x\n\n"),
        std::string("NOTIFY * HTTP/1.1\r\n HOST: x\r\n\r\n"),
        std::string("NOTIFY * HTTP/1.1\r\nHOST: x\r\nhost: y\r\n\r\n"),
        std::string("NOTIFY * HTTP/1.1\r\nHOST: x\r\n\r\nbody"),
        std::string("NOTIFY * HTTP/1.1\r\nHOST: ") + std::string(257, 'x') + "\r\n\r\n"
    }) assert(!pmachine::headerText(invalid, "host", output, error));
}

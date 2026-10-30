#include "../../pmachines/arduino/src/assemblerish_trigger.h"
#include <cassert>
#include <limits>

int main() {
    pmachine::AssemblerishTrigger trigger;
    trigger.reset(0, true);
    assert(!trigger.edge(10, true, false, 50));
    assert(!trigger.edge(20, true, true, 50));
    assert(!trigger.edge(30, true, false, 50));
    assert(!trigger.edge(79, false, false, 50));
    assert(trigger.edge(80, false, false, 50));
    assert(!trigger.edge(81, false, false, 50));
    assert(!trigger.edge(90, true, false, 50));
    assert(!trigger.edge(140, false, false, 50));
    assert(!trigger.edge(150, true, true, 50));
    assert(trigger.edge(200, false, true, 50));

    trigger.reset(0, true);
    assert(!trigger.edge(10, true, false, 50));
    assert(!trigger.edge(40, false, true, 50));
    assert(!trigger.edge(90, false, true, 50));
    assert(!trigger.edge(100, true, false, 50));
    assert(trigger.edge(150, false, false, 50));

    const uint32_t nearWrap = std::numeric_limits<uint32_t>::max() - 10;
    trigger.reset(nearWrap, true);
    assert(!trigger.edge(nearWrap, true, false, 50));
    assert(!trigger.edge(38, false, false, 50));
    assert(trigger.edge(39, false, false, 50));

    trigger.reset(nearWrap, false);
    assert(!trigger.timer(38, 50));
    assert(trigger.timer(39, 50));
    assert(!trigger.timer(39, 50));
    assert(trigger.timer(1000, 50));
    assert(!trigger.timer(1000, 50));
    assert(!trigger.timer(1049, 50));
    assert(trigger.timer(1050, 50));
}

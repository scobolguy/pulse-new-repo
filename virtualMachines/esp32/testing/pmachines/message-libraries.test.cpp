#include "../../libraries/messages/native_mapping.h"
#include "../../libraries/formatting/native_presentation.h"
#include <cassert>

int main() {
    namespace native = pulse::swift::native;
    assert(native::normalizeMtAmount(" 1 234,50 ") == "1234.50");
    assert(native::mapOpYymmddToIso("700102") == "1970-01-02");
    assert(native::mapOpMtPartyName("/ACCOUNT\nAlice\nAddress") == "Alice\nAddress");
    assert(native::mapOpMtChargeToIso("OUR") == "OUR");
    assert(pulse::messages::native::execCompiledMappingOps({"SRC", "MT_AMOUNT_TO_DECIMAL"}, "123,50") == "123.50");
    const auto decimal = pmachine::rtl::detail::decimalFromUnscaled("12345", 2);
    assert(pulse::formatting::formatCobolDisplay(decimal, 7, 2, 1) == "+0012345");
    assert(pulse::formatting::formatCobolEdited(decimal, "ZZ9.99", false, false) == "123.45");
    assert(pulse::formatting::formatRealE6(1.25f) == "1.250000E+00");
}

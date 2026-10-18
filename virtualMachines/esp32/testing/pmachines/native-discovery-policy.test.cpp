#include "../../pmachines/native/src/native_service.hpp"
#include <cassert>
#include <iostream>

int main(int argc, char** argv) {
    assert(argc == 3);
    using pulse::native::NativeService;
    using pulse::native::HttpRequest;
    NativeService policy(pulse::native::readFile(argv[1]), pulse::native::readFile(argv[2]), 200000);
    auto dispatch = [&](const char* route, const std::string& body) {
        auto result = policy.dispatch(HttpRequest{"POST", route, body, "192.168.4.2", 4210});
        assert(result.status == 200);
        return result.jsonBody;
    };
    assert(dispatch("/settings", "{}").find("\"maxTargets\":16") != std::string::npos);
    assert(dispatch("/poll", R"({"nowMs":100,"nextAt":200})").find("\"send\":false") != std::string::npos);
    assert(dispatch("/request", R"({"nodeId":"native","bootId":"boot","requestId":"nonce","nowMs":100,"jitterMs":7})")
        .find("\"nextAt\":5107") != std::string::npos);
    assert(dispatch("/request", R"({"nodeId":"native","bootId":"boot","requestId":"nonce","nowMs":1073741800,"jitterMs":7})")
        .find("\"nextAt\":4983") != std::string::npos);
    assert(dispatch("/poll", R"({"nowMs":1073741804,"nextAt":4983})").find("\"send\":false") != std::string::npos);
    assert(dispatch("/poll", R"({"nowMs":4983,"nextAt":4983})").find("\"send\":true") != std::string::npos);
    assert(dispatch("/poll", R"({"nowMs":100,"nextAt":-1})").find("\"send\":true") != std::string::npos);
    const std::string reply = R"({"packet":{"kind":"pulseDiscoveryReply","version":1,"requestId":"nonce","aggregatorId":"owner-a","bootId":"boot-a","listeners":[{"protocol":"http","host":"192.168.4.2","port":7123}]},"requestId":"nonce","peer":"192.168.4.2","localAddress":"192.168.4.3","nowMs":100,"targets":[]})";
    const auto accepted = dispatch("/accept", reply);
    assert(accepted.find("\"ok\":true") != std::string::npos);
    assert(accepted.find("\"endpoint\":\"http://192.168.4.2:7123\"") != std::string::npos);
    assert(accepted.find("\"expiresAt\":30100") != std::string::npos);
    assert(dispatch("/targets", R"({"nowMs":101,"targets":[{"aggregatorId":"a","expiresAt":100},{"aggregatorId":"b","expiresAt":102}]})")
        .find("\"targets\":[{\"aggregatorId\":\"b\",\"expiresAt\":102}]") != std::string::npos);
    assert(dispatch("/owner-target", R"({"ownerAggregatorId":"owner-a","nowMs":100,"targets":[{"aggregatorId":"other","expiresAt":500}]})")
        .find("\"ok\":false") != std::string::npos);
    assert(dispatch("/targets", R"({"nowMs":1073741819,"targets":[{"aggregatorId":"fresh","expiresAt":10}]})")
        .find("\"aggregatorId\":\"fresh\"") != std::string::npos);
    assert(dispatch("/targets", R"({"nowMs":10,"targets":[{"aggregatorId":"expired","expiresAt":10}]})")
        .find("\"targets\":[]") != std::string::npos);
    assert(dispatch("/advertise", R"({"nodeId":"native","localAddress":"192.168.4.3","listeners":[{"protocol":"http","host":"0.0.0.0","port":8080}]})")
        .find("\"endpoint\":\"http://192.168.4.3:8080\"") != std::string::npos);
    std::string invalid = reply;
    invalid.replace(invalid.find("\"requestId\":\"nonce\""), 19, "\"requestId\":\"wrong\"");
    assert(dispatch("/accept", invalid).find("\"ok\":false") != std::string::npos);
    std::cout << "PASS native shared discovery routes, correlation, actual ports, expiry and explicit owner\n";
}

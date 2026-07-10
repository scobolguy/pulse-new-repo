cmake_minimum_required(VERSION 3.16)
project(pulse_pi_node VERSION 0.1.0 LANGUAGES CXX)

option(ENABLE_PMACHINE_NATIVE_PORT "Build native PMachine host-port smoke target" OFF)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(pulse_pi_node
    src/main.cpp
    src/core/Config.cpp
    src/core/EventRouter.cpp
    src/platform/pi/PiRuntime.cpp
    src/services/bluetooth/BluetoothGateway.cpp
    src/services/discovery/NetworkAnnouncer.cpp
    src/services/discovery/ServicePresencePublisher.cpp
    src/services/doorbell/DoorbellAlertService.cpp
    src/services/ffs/FederatedFileClient.cpp
    src/services/nodeapi/NodeApiServer.cpp
    src/services/pmachine/PmachineQueueBridge.cpp
    src/services/tts/PiperService.cpp
)

add_executable(pulse_discovery_listener
    tools/discovery_listener.cpp
)

if (ENABLE_PMACHINE_NATIVE_PORT)
    add_executable(pulse_pmachine_native_smoke
        ../src/pmachine.cpp
        ../src/pmachine_opcodes_extended.cpp
        ../src/pmachine_dynamic_library.cpp
        ../src/pmachine_scheduler.cpp
        ../src/StringPool.cpp
        tools/native_pmachine_smoke.cpp
    )
endif()

target_include_directories(pulse_pi_node PRIVATE
    include
    ${CMAKE_CURRENT_LIST_DIR}/../include
)

if (ENABLE_PMACHINE_NATIVE_PORT)
    target_include_directories(pulse_pmachine_native_smoke PRIVATE
        include
        ${CMAKE_CURRENT_LIST_DIR}/../src
        ${CMAKE_CURRENT_LIST_DIR}/../.pio/libdeps/esp32dev/ArduinoJson/src
    )
    target_compile_definitions(pulse_pmachine_native_smoke PRIVATE
        PLATFORM_RPIB=1
    )
endif()

target_compile_definitions(pulse_pi_node PRIVATE
    PLATFORM_RPIB=1
)

target_compile_options(pulse_pi_node PRIVATE
    -Wall
    -Wextra
    -Wpedantic
)

target_compile_options(pulse_discovery_listener PRIVATE
    -Wall
    -Wextra
    -Wpedantic
)

if (ENABLE_PMACHINE_NATIVE_PORT)
    target_compile_options(pulse_pmachine_native_smoke PRIVATE
        -Wall
        -Wextra
        -Wpedantic
    )
endif()

if (WIN32)
    target_link_libraries(pulse_pi_node PRIVATE ws2_32)
    target_link_libraries(pulse_discovery_listener PRIVATE ws2_32)
    if (ENABLE_PMACHINE_NATIVE_PORT)
        target_link_libraries(pulse_pmachine_native_smoke PRIVATE ws2_32)
    endif()
endif()

cmake_minimum_required(VERSION 3.16)
project(pulse_native_service_host LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(pulse_native_service_host
    src/main.cpp
    src/native_service.cpp
)
target_compile_options(pulse_native_service_host PRIVATE
    $<$<CXX_COMPILER_ID:GNU,Clang>:-Wall;-Wextra;-Wpedantic>
)
if (WIN32)
    target_link_libraries(pulse_native_service_host PRIVATE ws2_32)
endif()

include(CTest)
if (BUILD_TESTING)
    add_executable(pulse_native_discovery_probe
        ../../testing/pmachines/native-discovery-policy.test.cpp
        src/native_service.cpp
    )
    if (WIN32)
        target_link_libraries(pulse_native_discovery_probe PRIVATE ws2_32)
    endif()
    add_test(NAME native_service_host_usage COMMAND pulse_native_service_host --help)
endif()

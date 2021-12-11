cmake_minimum_required(VERSION 3.16)

project(sandbox VERSION 1.0.5)

find_package(Boost REQUIRED COMPONENTS program_options log_setup log)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_FLAGS "-g -Wall -Wextra -Werror")
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -pie -fPIC")

set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/bin)

aux_source_directory(${CMAKE_SOURCE_DIR}/src SOURCES)
add_executable(sandbox ${SOURCES})
target_link_libraries(sandbox ${Boost_LIBRARIES} seccomp pthread)

configure_file(${CMAKE_SOURCE_DIR}/config/config.h.in ${CMAKE_BINARY_DIR}/includes/config.h)
target_include_directories(sandbox PRIVATE ${CMAKE_BINARY_DIR}/includes)

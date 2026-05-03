cmake_minimum_required(VERSION 3.16)

project(ConstFoldStrengthReducePass LANGUAGES CXX)

find_package(LLVM REQUIRED CONFIG)

message(STATUS "Found LLVM ${LLVM_PACKAGE_VERSION}")
message(STATUS "Using LLVMConfig.cmake in: ${LLVM_DIR}")

list(APPEND CMAKE_MODULE_PATH "${LLVM_CMAKE_DIR}")
include(AddLLVM)

add_llvm_pass_plugin(ConstFoldStrengthReducePass
  src/ConstFoldStrengthReduce.cpp
)

target_compile_features(ConstFoldStrengthReducePass PRIVATE cxx_std_17)
target_include_directories(ConstFoldStrengthReducePass PRIVATE ${LLVM_INCLUDE_DIRS})
target_compile_definitions(ConstFoldStrengthReducePass PRIVATE ${LLVM_DEFINITIONS})

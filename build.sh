#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${BUILD_DIR:-$ROOT_DIR/build}"

if ! command -v cmake >/dev/null 2>&1; then
  echo "error: cmake was not found on PATH." >&2
  echo "Install CMake and LLVM development packages, then rerun ./build.sh." >&2
  exit 1
fi

CMAKE_ARGS=(-S "$ROOT_DIR" -B "$BUILD_DIR")

if [[ -n "${LLVM_DIR:-}" ]]; then
  CMAKE_ARGS+=("-DLLVM_DIR=$LLVM_DIR")
elif command -v llvm-config >/dev/null 2>&1; then
  LLVM_CMAKE_DIR="$(llvm-config --cmakedir)"
  CMAKE_ARGS+=("-DLLVM_DIR=$LLVM_CMAKE_DIR")
else
  echo "error: LLVM_DIR is not set and llvm-config was not found on PATH." >&2
  echo "Set LLVM_DIR to LLVM's CMake directory, for example:" >&2
  echo "  LLVM_DIR=/usr/lib/llvm-18/lib/cmake/llvm ./build.sh" >&2
  exit 1
fi

if [[ -n "${CMAKE_GENERATOR:-}" ]]; then
  CMAKE_ARGS+=("-G" "$CMAKE_GENERATOR")
elif command -v ninja >/dev/null 2>&1; then
  CMAKE_ARGS+=("-G" "Ninja")
fi

cmake "${CMAKE_ARGS[@]}"
cmake --build "$BUILD_DIR"

echo "Build complete: $BUILD_DIR"

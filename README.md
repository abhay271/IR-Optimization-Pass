# Constant Folding Pass with Strength Reduction

This project implements an LLVM function pass that performs two simple IR optimizations:

1. **Constant folding**: evaluates binary arithmetic instructions whose operands are compile-time constants.
2. **Strength reduction**: replaces multiplication or unsigned division by powers of two with cheaper shift instructions.
3. **Algebraic identities**: removes simple multiplication cases such as `x * 0` and `x * 1`.

Example transformations:

```llvm
%a = add i32 4, 5
```

becomes:

```llvm
i32 9
```

and:

```llvm
%b = mul i32 %x, 8
```

becomes:

```llvm
%b = shl i32 %x, 3
```

## Deliverables

- `src/ConstFoldStrengthReduce.cpp`: LLVM pass implementation in C++.
- `tests/*.ll`: sample LLVM IR input files.
- `tests/expected/*.ll`: expected transformed IR output.
- `tests/actual/*.ll`: output captured from a real `opt` run.
- `tests/opt-run-output.md`: command and verified `opt` output.
- `report/report.md`: brief project report covering the approach, `ConstantExpr`, `ConstantInt`, and `IRBuilder`.
- `frontend/` and `server.js`: optional local web UI that sends IR to `opt` and displays the real pass output.

## Requirements

Install LLVM with the development files and command-line tools:

- `clang`
- `opt`
- `llvm-config`
- `cmake`
- a C++17 compiler

On Linux or WSL, LLVM packages are usually the easiest path. On Windows, using WSL is often simpler for LLVM pass development than configuring native Visual Studio builds.

## Build

From the project root:

```bash
cmake -S . -B build -DLLVM_DIR=/path/to/llvm/lib/cmake/llvm
cmake --build build
```

The plugin will be created in the `build/` directory. Depending on your OS, it may be named:

- `ConstFoldStrengthReducePass.so` on Linux
- `ConstFoldStrengthReducePass.dylib` on macOS
- `ConstFoldStrengthReducePass.dll` on Windows

## Run with `opt`

Verified with LLVM 18 using the new pass manager:

```bash
opt -load-pass-plugin ./build/ConstFoldStrengthReducePass.so \
  -passes=const-fold-strength-reduce \
  -S tests/combined.ll -o tests/combined.out.ll
```

The pass also includes a legacy `FunctionPass` registration for compatibility with older course material. Some older handouts show this style:

```bash
opt -load ./build/ConstFoldStrengthReducePass.so \
  -const-fold-strength-reduce-legacy \
  -S tests/combined.ll -o tests/combined.out.ll
```

LLVM 18 was used for verification, and the modern `-load-pass-plugin` command above is the supported command there.

## Sample Output

Input:

```llvm
define i32 @combined(i32 %x) {
entry:
  %a = add i32 4, 5
  %b = mul i32 %x, 8
  %c = add i32 %b, %a
  ret i32 %c
}
```

Actual verified output:

```llvm
; ModuleID = 'tests/combined.ll'
source_filename = "tests/combined.ll"

define i32 @combined(i32 %x) {
entry:
  %b = shl i32 %x, 3
  %c = add i32 %b, 9
  ret i32 %c
}
```

## Verification Environment

The pass was built and tested in Ubuntu 24.04 on WSL:

```text
clang: Ubuntu clang version 18.1.3 (1ubuntu1)
llvm-config: 18.1.3
opt: Ubuntu LLVM version 18.1.3
cmake: 3.28.3
```

## Frontend Demo

Start the local UI server:

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

The browser sends the input IR to `server.js`, which runs the compiled LLVM pass through `opt` and returns the transformed IR. The UI is still optional for the assignment; the required compiler optimization is the C++ pass and `opt` output.

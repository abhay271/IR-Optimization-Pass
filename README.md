# Constant Folding Pass with Strength Reduction

This project implements an LLVM function pass that performs two simple IR optimizations:

1. **Constant folding**: evaluates binary arithmetic instructions whose operands are compile-time constants.
2. **Strength reduction**: replaces multiplication or unsigned division by powers of two with cheaper shift instructions.

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
- `tests/opt-run-output.md`: command and expected `opt` output.
- `report/report.md`: brief project report covering the approach, `ConstantExpr`, `ConstantInt`, and `IRBuilder`.
- `frontend/`: optional static demo UI for explaining the optimization visually.

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

For modern LLVM versions using the new pass manager:

```bash
opt -load-pass-plugin ./build/ConstFoldStrengthReducePass.so \
  -passes=const-fold-strength-reduce \
  -S tests/combined.ll -o tests/combined.out.ll
```

For older LLVM versions using the legacy pass manager:

```bash
opt -load ./build/ConstFoldStrengthReducePass.so \
  -const-fold-strength-reduce-legacy \
  -S tests/combined.ll -o tests/combined.out.ll
```

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

Expected output:

```llvm
define i32 @combined(i32 %x) {
entry:
  %b = shl i32 %x, 3
  %c = add i32 %b, 9
  ret i32 %c
}
```

## Frontend Demo

Open `frontend/index.html` in a browser. It demonstrates the same kinds of transformations for simple LLVM IR snippets. It is only a teaching/demo aid; the actual compiler work is done by the LLVM pass.

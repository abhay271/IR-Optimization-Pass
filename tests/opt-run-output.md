# Verified `opt` Run Output

The pass was built and tested in Ubuntu 24.04 on WSL using:

```text
clang: Ubuntu clang version 18.1.3 (1ubuntu1)
llvm-config: 18.1.3
opt: Ubuntu LLVM version 18.1.3
cmake: 3.28.3
```

Build commands:

```bash
cmake -S . -B build -G Ninja -DLLVM_DIR=/usr/lib/llvm-18/lib/cmake/llvm
cmake --build build
```

Build output:

```text
[1/2] Building CXX object CMakeFiles/ConstFoldStrengthReducePass.dir/src/ConstFoldStrengthReduce.cpp.o
[2/2] Linking CXX shared module ConstFoldStrengthReducePass.so
```

Run command:

```bash
opt -load-pass-plugin ./build/ConstFoldStrengthReducePass.so \
  -passes=const-fold-strength-reduce \
  -S tests/combined.ll -o tests/combined.out.ll
```

Actual `tests/combined.out.ll`:

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

Additional verified outputs are stored in `tests/actual/`.

The algebraic-identity test was also verified with:

```bash
opt -load-pass-plugin ./build/ConstFoldStrengthReducePass.so \
  -passes=const-fold-strength-reduce \
  -S tests/algebraic_identities.ll -o tests/algebraic_identities.out.ll
```

It simplifies cases such as `x * 0`, `x * 1`, and `x + 0`, producing the captured output in `tests/actual/algebraic_identities.ll`.

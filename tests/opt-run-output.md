# `opt` Run Output

The command below is the one to use after LLVM is installed and the pass is built:

```bash
opt -load-pass-plugin ./build/ConstFoldStrengthReducePass.so \
  -passes=const-fold-strength-reduce \
  -S tests/combined.ll -o tests/combined.out.ll
```

Expected `tests/combined.out.ll`:

```llvm
define i32 @combined(i32 %x) {
entry:
  %b = shl i32 %x, 3
  %c = add i32 %b, 9
  ret i32 %c
}
```

This workspace currently does not have `opt`, `clang`, or `llvm-config` available on `PATH`, so the pass could not be built and executed locally yet. Once LLVM is installed, rerun the command above and replace this note with the actual terminal output if your instructor requires a literal run log.

# Constant Folding Pass with Strength Reduction

## Objective

The objective of this assignment is to implement an LLVM function pass that optimizes arithmetic instructions in LLVM IR. The pass performs constant folding for binary operators with constant operands and strength reduction for multiplication or unsigned division by powers of two.

## LLVM IR and SSA

LLVM IR is a low-level intermediate representation used by LLVM-based compilers. It is written in static single assignment form, meaning each virtual register is assigned once. This makes data-flow transformations easier because every instruction result has clear uses.

For example:

```llvm
%a = add i32 4, 5
```

The result `%a` is defined once. If the pass proves that `%a` is always equal to `9`, it can replace all uses of `%a` with the constant `9` and erase the original instruction.

## Pass Design

The pass is implemented as a function pass. It visits every instruction in each basic block of a function and looks for `BinaryOperator` instructions such as `add`, `sub`, `mul`, and `udiv`.

The pass applies two transformations:

1. If both operands are LLVM constants, the operation is evaluated at compile time.
2. If the operation is multiplication or unsigned division by a positive power of two, it is replaced by a shift.
3. If one operand of a multiplication is an identity or absorbing constant, expressions such as `x * 0` and `x * 1` are simplified directly.

The pass records transformed instructions and erases them after replacement.

## Constant Folding

LLVM represents integer constants using `ConstantInt`. The pass first checks whether both operands are instances of `Constant`. It then uses `ConstantExpr::get(...)` to ask LLVM to build the constant expression for that opcode and operands.

For example:

```llvm
%a = add i32 4, 5
```

is folded into:

```llvm
i32 9
```

The pass then calls `replaceAllUsesWith(...)` so every user of the old instruction now uses the folded constant. Finally, the old instruction is removed from the function.

Division and remainder by zero are skipped to avoid creating invalid constant expressions.

## Strength Reduction

Strength reduction replaces expensive arithmetic with cheaper equivalent operations. Multiplication by a power of two can be replaced with a left shift:

```llvm
%b = mul i32 %x, 8
```

becomes:

```llvm
%b = shl i32 %x, 3
```

because `8` is `2^3`.

Unsigned division by a power of two can also be replaced with a logical right shift:

```llvm
%c = udiv i32 %x, 4
```

becomes:

```llvm
%c = lshr i32 %x, 2
```

Signed division is not rewritten because arithmetic right shift and signed division do not always have identical rounding behavior for negative values.

## Use of IRBuilder

`IRBuilder` is used to create new LLVM IR instructions at the location of the original instruction. For strength reduction, the pass creates either `shl` or `lshr` instructions with the correct shift amount.

For example, when the pass sees multiplication by `8`, it computes `log2(8) = 3` and creates:

```cpp
Builder.CreateShl(variable, shiftConstant)
```

After the new instruction is created, the original instruction's uses are replaced with the new value and the old instruction is erased.

## Example Run

Command used for the verified run:

```bash
opt -load-pass-plugin ./build/ConstFoldStrengthReducePass.so \
  -passes=const-fold-strength-reduce \
  -S tests/combined.ll -o tests/combined.out.ll
```

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

The same output was generated with LLVM 18.1.3 on Ubuntu 24.04 through WSL and saved under `tests/actual/`.

## Limitations

The pass focuses on integer binary operators. It does not optimize floating-point operations, vector constants, or every algebraic identity. It also avoids rewriting signed division because replacing it with shifts can be incorrect for negative values.

## Conclusion

The pass demonstrates a basic LLVM optimization workflow: inspect instructions, identify safe transformation opportunities, create replacement constants or instructions, update uses, and erase obsolete IR. Constant folding reduces runtime arithmetic by evaluating known expressions at compile time, while strength reduction replaces certain expensive arithmetic instructions with cheaper shifts.

# Implementation

## Main Source File

The LLVM pass is implemented in:

```text
src/ConstFoldStrengthReduce.cpp
```

The build configuration is in:

```text
CMakeLists.txt
```

The pass is compiled as an LLVM pass plugin named:

```text
ConstFoldStrengthReducePass
```

On Linux or WSL, the built plugin is normally:

```text
build/ConstFoldStrengthReducePass.so
```

## LLVM Pass Registration

The implementation supports the LLVM new pass manager. The pass is registered through `llvmGetPassPluginInfo`, and the pipeline name is:

```text
const-fold-strength-reduce
```

That is why `run.sh` invokes `opt` with:

```bash
opt -load-pass-plugin ./build/ConstFoldStrengthReducePass.so \
  -passes=const-fold-strength-reduce \
  -S input.ll -o output.ll
```

The code also includes a legacy `FunctionPass` registration:

```text
const-fold-strength-reduce-legacy
```

The legacy registration is included for compatibility with older LLVM course material, but the required script path uses the new pass manager.

## Build Process

The build script does this:

```mermaid
flowchart LR
    A["./build.sh"] --> B["Find CMake"]
    B --> C["Find LLVM_DIR<br/>or llvm-config --cmakedir"]
    C --> D["Configure build/"]
    D --> E["Compile C++17 source"]
    E --> F["Create LLVM pass plugin"]
```

Important CMake pieces:

```cmake
find_package(LLVM REQUIRED CONFIG)
include(AddLLVM)
add_llvm_pass_plugin(ConstFoldStrengthReducePass
  src/ConstFoldStrengthReduce.cpp
)
```

`add_llvm_pass_plugin` tells LLVM/CMake to build the source file as a loadable pass plugin.

## Runtime Process

The run script does this:

```mermaid
sequenceDiagram
    participant User
    participant Run as run.sh
    participant Build as build.sh
    participant Opt as opt
    participant Cases as testcases/

    User->>Run: ./run.sh
    Run->>Build: build pass plugin
    Build-->>Run: ConstFoldStrengthReducePass.so
    loop each *.ll file
        Run->>Opt: load plugin and run pass
        Opt-->>Cases: write testcases/actual/*.ll
        Run->>Cases: compare actual vs expected
    end
    Run-->>User: print PASS/FAIL and metrics
```

## Instruction Traversal

The optimization starts in `optimizeFunction(Function &F)`.

For every function:

1. visit each basic block,
2. visit each instruction,
3. keep only instructions that are `BinaryOperator`,
4. try constant folding,
5. try multiplication identity simplification,
6. try strength reduction,
7. replace uses of old instructions,
8. erase replaced instructions.

The traversal uses:

```cpp
llvm::make_early_inc_range(BB)
```

This makes it safer to walk the basic block while preparing instructions for later deletion.

## Constant Folding Details

The helper function is:

```cpp
static Constant *tryFoldConstants(BinaryOperator *BO)
```

It checks:

1. the left operand is a `Constant`,
2. the right operand is a `Constant`,
3. the result type is an integer type,
4. the operation is not division or remainder by zero.

Then it calls:

```cpp
ConstantExpr::get(BO->getOpcode(), LHS, RHS)
```

If folding succeeds, the pass calls:

```cpp
BO->replaceAllUsesWith(Folded);
```

and schedules the original instruction for deletion.

## Division-by-Zero Guard

The helper:

```cpp
static bool hasZeroDivisor(unsigned Opcode, Constant *RHS)
```

protects constant folding from creating invalid division or remainder expressions. It checks `udiv`, `sdiv`, `urem`, and `srem`.

## Algebraic Identity Details

The helper function is:

```cpp
static Value *trySimplifyMulIdentities(BinaryOperator *BO)
```

It uses LLVM PatternMatch:

```cpp
m_c_Mul(m_Value(X), m_Zero())
m_c_Mul(m_Value(X), m_One())
```

`m_c_Mul` means commutative multiplication, so both operand orders are handled:

```llvm
%a = mul i32 %x, 1
%b = mul i32 1, %x
```

Both simplify to `%x`.

## Strength Reduction Details

The helper function is:

```cpp
static Value *tryStrengthReduce(BinaryOperator *BO)
```

It checks for positive powers of two with:

```cpp
Value.isPowerOf2()
```

and computes the shift amount with:

```cpp
exactLogBase2()
```

The pass uses `IRBuilder` to create replacement instructions at the same location as the old instruction.

Multiplication by a power of two:

```cpp
Builder.CreateShl(Variable, ShiftConstant, BO->getName() + ".sr")
```

Unsigned division by a power of two:

```cpp
Builder.CreateLShr(BO->getOperand(0), ShiftConstant, BO->getName() + ".sr")
```

After creating a replacement instruction, the pass transfers the original instruction name where possible:

```cpp
ReducedInstruction->takeName(BO);
```

That keeps output IR stable enough for readable expected-output tests.

## Why Instructions Are Erased Later

The pass stores old instructions in:

```cpp
std::vector<Instruction *> ToErase;
```

Then, after the traversal finishes, it erases them:

```cpp
for (Instruction *I : ToErase) {
  I->eraseFromParent();
}
```

This avoids invalidating the current traversal and makes the transformation order easier to reason about.

## Test Output Comparison

`run.sh` compares optimized output with the files in `testcases/expected/`. It ignores LLVM's generated module header lines:

```llvm
; ModuleID = ...
source_filename = ...
```

Those lines can vary depending on the local path and LLVM version, so they are normalized before comparison.

## Important Files

| File | Purpose |
| --- | --- |
| `src/ConstFoldStrengthReduce.cpp` | LLVM optimization pass |
| `CMakeLists.txt` | CMake build file |
| `build.sh` | Configures and builds the pass |
| `run.sh` | Builds, runs tests, compares output, prints metrics |
| `testcases/*.ll` | Input LLVM IR |
| `testcases/expected/*.ll` | Expected optimized LLVM IR |
| `EVALUATION.md` | Explains the measured results |

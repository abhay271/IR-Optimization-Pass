#include "llvm/ADT/STLExtras.h"
#include "llvm/ADT/StringRef.h"
#include "llvm/Config/llvm-config.h"
#include "llvm/IR/Constants.h"
#include "llvm/IR/Function.h"
#include "llvm/IR/IRBuilder.h"
#include "llvm/IR/InstrTypes.h"
#include "llvm/IR/Instructions.h"
#include "llvm/IR/PassManager.h"
#include "llvm/Pass.h"
#include "llvm/Passes/PassBuilder.h"
#include "llvm/Support/raw_ostream.h"

#if __has_include("llvm/Passes/PassPlugin.h")
#include "llvm/Passes/PassPlugin.h"
#elif __has_include("llvm/Plugins/PassPlugin.h")
#include "llvm/Plugins/PassPlugin.h"
#else
#error "Could not find LLVM PassPlugin.h"
#endif

#include <vector>

using namespace llvm;

namespace {

static bool hasZeroDivisor(unsigned Opcode, Constant *RHS) {
  if (Opcode != Instruction::UDiv && Opcode != Instruction::SDiv &&
      Opcode != Instruction::URem && Opcode != Instruction::SRem) {
    return false;
  }

  if (auto *RHSInt = dyn_cast<ConstantInt>(RHS)) {
    return RHSInt->isZero();
  }

  return false;
}

static Constant *tryFoldConstants(BinaryOperator *BO) {
  auto *LHS = dyn_cast<Constant>(BO->getOperand(0));
  auto *RHS = dyn_cast<Constant>(BO->getOperand(1));

  if (!LHS || !RHS) {
    return nullptr;
  }

  if (!BO->getType()->isIntegerTy()) {
    return nullptr;
  }

  if (hasZeroDivisor(BO->getOpcode(), RHS)) {
    return nullptr;
  }

  return ConstantExpr::get(BO->getOpcode(), LHS, RHS);
}

static bool isPositivePowerOfTwoGreaterThanOne(ConstantInt *C) {
  const APInt &Value = C->getValue();
  return !Value.isNegative() && Value.isPowerOf2() && Value.ugt(1);
}

static Value *trySimplifyAlgebraicIdentities(BinaryOperator *BO) {
  auto *LHS = dyn_cast<ConstantInt>(BO->getOperand(0));
  auto *RHS = dyn_cast<ConstantInt>(BO->getOperand(1));

  switch (BO->getOpcode()) {
  case Instruction::Add:
    if (RHS && RHS->isZero()) {
      return BO->getOperand(0);
    }
    if (LHS && LHS->isZero()) {
      return BO->getOperand(1);
    }
    break;

  case Instruction::Sub:
    if (RHS && RHS->isZero()) {
      return BO->getOperand(0);
    }
    break;

  case Instruction::Mul:
    if ((LHS && LHS->isZero()) || (RHS && RHS->isZero())) {
      return ConstantInt::get(BO->getType(), 0);
    }
    if (RHS && RHS->isOne()) {
      return BO->getOperand(0);
    }
    if (LHS && LHS->isOne()) {
      return BO->getOperand(1);
    }
    break;

  case Instruction::UDiv:
    if (RHS && RHS->isOne()) {
      return BO->getOperand(0);
    }
    break;

  default:
    break;
  }

  return nullptr;
}

static Value *tryStrengthReduce(BinaryOperator *BO) {
  if (!BO->getType()->isIntegerTy()) {
    return nullptr;
  }

  IRBuilder<> Builder(BO);
  Builder.SetCurrentDebugLocation(BO->getDebugLoc());

  if (BO->getOpcode() == Instruction::Mul) {
    Value *Variable = nullptr;
    ConstantInt *PowerOfTwo = nullptr;

    if (auto *RHS = dyn_cast<ConstantInt>(BO->getOperand(1))) {
      Variable = BO->getOperand(0);
      PowerOfTwo = RHS;
    } else if (auto *LHS = dyn_cast<ConstantInt>(BO->getOperand(0))) {
      Variable = BO->getOperand(1);
      PowerOfTwo = LHS;
    }

    if (PowerOfTwo && isPositivePowerOfTwoGreaterThanOne(PowerOfTwo)) {
      unsigned ShiftAmount = PowerOfTwo->getValue().exactLogBase2();
      Value *ShiftConstant = ConstantInt::get(BO->getType(), ShiftAmount);
      return Builder.CreateShl(Variable, ShiftConstant, BO->getName() + ".sr");
    }
  }

  if (BO->getOpcode() == Instruction::UDiv) {
    auto *RHS = dyn_cast<ConstantInt>(BO->getOperand(1));

    if (RHS && isPositivePowerOfTwoGreaterThanOne(RHS)) {
      unsigned ShiftAmount = RHS->getValue().exactLogBase2();
      Value *ShiftConstant = ConstantInt::get(BO->getType(), ShiftAmount);
      return Builder.CreateLShr(BO->getOperand(0), ShiftConstant,
                                BO->getName() + ".sr");
    }
  }

  return nullptr;
}

static bool optimizeFunction(Function &F) {
  bool Changed = false;
  std::vector<Instruction *> ToErase;

  for (BasicBlock &BB : F) {
    for (Instruction &I : llvm::make_early_inc_range(BB)) {
      auto *BO = dyn_cast<BinaryOperator>(&I);
      if (!BO) {
        continue;
      }

      if (Constant *Folded = tryFoldConstants(BO)) {
        BO->replaceAllUsesWith(Folded);
        ToErase.push_back(BO);
        Changed = true;
        continue;
      }

      if (Value *Simplified = trySimplifyAlgebraicIdentities(BO)) {
        BO->replaceAllUsesWith(Simplified);
        ToErase.push_back(BO);
        Changed = true;
        continue;
      }

      if (Value *Reduced = tryStrengthReduce(BO)) {
        if (auto *ReducedInstruction = dyn_cast<Instruction>(Reduced)) {
          ReducedInstruction->takeName(BO);
        }

        BO->replaceAllUsesWith(Reduced);
        ToErase.push_back(BO);
        Changed = true;
      }
    }
  }

  for (Instruction *I : ToErase) {
    I->eraseFromParent();
  }

  return Changed;
}

class ConstFoldStrengthReducePass
    : public PassInfoMixin<ConstFoldStrengthReducePass> {
public:
  PreservedAnalyses run(Function &F, FunctionAnalysisManager &) {
    if (optimizeFunction(F)) {
      return PreservedAnalyses::none();
    }

    return PreservedAnalyses::all();
  }
};

struct LegacyConstFoldStrengthReducePass : public FunctionPass {
  static char ID;

  LegacyConstFoldStrengthReducePass() : FunctionPass(ID) {}

  bool runOnFunction(Function &F) override { return optimizeFunction(F); }
};

char LegacyConstFoldStrengthReducePass::ID = 0;

static RegisterPass<LegacyConstFoldStrengthReducePass>
    X("const-fold-strength-reduce-legacy",
      "Constant Folding with Strength Reduction Pass", false, false);

} // namespace

extern "C" LLVM_ATTRIBUTE_WEAK PassPluginLibraryInfo llvmGetPassPluginInfo() {
  return {LLVM_PLUGIN_API_VERSION, "ConstFoldStrengthReducePass",
          LLVM_VERSION_STRING, [](PassBuilder &PB) {
            PB.registerPipelineParsingCallback(
                [](StringRef Name, FunctionPassManager &FPM,
                   ArrayRef<PassBuilder::PipelineElement>) {
                  if (Name == "const-fold-strength-reduce") {
                    FPM.addPass(ConstFoldStrengthReducePass());
                    return true;
                  }

                  return false;
                });
          }};
}

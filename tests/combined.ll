; RUN: opt -load-pass-plugin ../build/ConstFoldStrengthReducePass.so -passes=const-fold-strength-reduce -S %s

define i32 @combined(i32 %x) {
entry:
  %a = add i32 4, 5
  %b = mul i32 %x, 8
  %c = add i32 %b, %a
  ret i32 %c
}

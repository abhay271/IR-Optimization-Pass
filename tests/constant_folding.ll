; RUN: opt -load-pass-plugin ../build/ConstFoldStrengthReducePass.so -passes=const-fold-strength-reduce -S %s

define i32 @constant_folding() {
entry:
  %a = add i32 4, 5
  %b = mul i32 3, 7
  %c = sub i32 %b, %a
  ret i32 %c
}

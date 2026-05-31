; Test case 1: constants-only arithmetic should fold to a single return value.

define i32 @constant_folding() {
entry:
  %a = add i32 4, 5
  %b = mul i32 3, 7
  %c = sub i32 %b, %a
  ret i32 %c
}

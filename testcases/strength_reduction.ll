; Test case 2: multiplication and unsigned division by powers of two become shifts.

define i32 @strength_reduction(i32 %x, i32 %y) {
entry:
  %a = mul i32 %x, 2
  %b = mul i32 8, %y
  %c = udiv i32 %a, 4
  %d = add i32 %b, %c
  ret i32 %d
}

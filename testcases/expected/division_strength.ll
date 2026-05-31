define i32 @division_strength(i32 %x, i32 %y) {
entry:
  %a = lshr i32 %x, 3
  %b = udiv i32 %y, 3
  %c = sdiv i32 %y, 4
  %d = add i32 %a, %b
  %e = add i32 %d, %c
  ret i32 %e
}

; Test case 4: multiplication identities combine with constant folding and shifts.

define i32 @tricky(i32 %x, i32 %y, i32 %z) {
entry:
  %a = mul i32 3, 4
  %b = mul i32 %a, 2
  %c = add i32 %b, 0
  %d = mul i32 %x, 0
  %e = mul i32 %y, 1
  %f = mul i32 %z, 32
  %g = udiv i32 %f, 4
  %h = add i32 %d, %e
  %i = add i32 %h, %g
  %j = add i32 %i, %b
  ret i32 %j
}

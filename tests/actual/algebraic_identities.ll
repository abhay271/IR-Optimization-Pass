; ModuleID = 'tests/algebraic_identities.ll'
source_filename = "tests/algebraic_identities.ll"

define i32 @tricky(i32 %x, i32 %y, i32 %z) {
entry:
  %f = shl i32 %z, 5
  %g = lshr i32 %f, 2
  %i = add i32 %y, %g
  %j = add i32 %i, 24
  ret i32 %j
}

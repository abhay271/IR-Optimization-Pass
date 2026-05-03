; ModuleID = 'tests/strength_reduction.ll'
source_filename = "tests/strength_reduction.ll"

define i32 @strength_reduction(i32 %x, i32 %y) {
entry:
  %a = shl i32 %x, 1
  %b = shl i32 %y, 3
  %c = lshr i32 %a, 2
  %d = add i32 %b, %c
  ret i32 %d
}

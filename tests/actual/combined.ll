; ModuleID = 'tests/combined.ll'
source_filename = "tests/combined.ll"

define i32 @combined(i32 %x) {
entry:
  %b = shl i32 %x, 3
  %c = add i32 %b, 9
  ret i32 %c
}

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${BUILD_DIR:-$ROOT_DIR/build}"
TESTCASE_DIR="$ROOT_DIR/testcases"
EXPECTED_DIR="$TESTCASE_DIR/expected"
ACTUAL_DIR="$TESTCASE_DIR/actual"

normalize_ir() {
  sed \
    -e '/^; ModuleID =/d' \
    -e '/^source_filename =/d' \
    -e '/^$/d' \
    "$1"
}

count_ops() {
  local file="$1"
  local ops="$2"
  { grep -E "^[[:space:]]*%[A-Za-z0-9_.]+[[:space:]]*=[[:space:]]*($ops)[[:space:]]" "$file" || true; } | wc -l | tr -d ' '
}

if ! command -v opt >/dev/null 2>&1; then
  echo "error: opt was not found on PATH." >&2
  echo "Install LLVM command-line tools, then rerun ./run.sh." >&2
  exit 1
fi

bash "$ROOT_DIR/build.sh"

PLUGIN=""
for ext in so dylib dll; do
  candidate="$BUILD_DIR/ConstFoldStrengthReducePass.$ext"
  if [[ -f "$candidate" ]]; then
    PLUGIN="$candidate"
    break
  fi
done

if [[ -z "$PLUGIN" ]]; then
  echo "error: built pass plugin was not found in $BUILD_DIR." >&2
  exit 1
fi

mkdir -p "$ACTUAL_DIR"

printf "%-28s %-6s %10s %10s %12s %12s %8s\n" \
  "testcase" "result" "base_ops" "opt_ops" "base_costly" "opt_costly" "shifts"
printf "%-28s %-6s %10s %10s %12s %12s %8s\n" \
  "--------" "------" "--------" "-------" "-----------" "----------" "------"

status=0
total_base_ops=0
total_opt_ops=0
total_base_costly=0
total_opt_costly=0
total_shifts=0

for input in "$TESTCASE_DIR"/*.ll; do
  name="$(basename "$input" .ll)"
  expected="$EXPECTED_DIR/$name.ll"
  actual="$ACTUAL_DIR/$name.ll"

  opt -load-pass-plugin "$PLUGIN" \
    -passes=const-fold-strength-reduce \
    -S "$input" -o "$actual"

  result="PASS"
  if [[ ! -f "$expected" ]]; then
    result="MISSING_EXPECTED"
    status=1
  elif ! diff -u <(normalize_ir "$expected") <(normalize_ir "$actual") > "$ACTUAL_DIR/$name.diff"; then
    result="FAIL"
    status=1
  else
    rm -f "$ACTUAL_DIR/$name.diff"
  fi

  base_ops="$(count_ops "$input" 'add|sub|mul|udiv|sdiv|shl|lshr|ashr')"
  opt_ops="$(count_ops "$actual" 'add|sub|mul|udiv|sdiv|shl|lshr|ashr')"
  base_costly="$(count_ops "$input" 'mul|udiv|sdiv')"
  opt_costly="$(count_ops "$actual" 'mul|udiv|sdiv')"
  shifts="$(count_ops "$actual" 'shl|lshr|ashr')"

  total_base_ops=$((total_base_ops + base_ops))
  total_opt_ops=$((total_opt_ops + opt_ops))
  total_base_costly=$((total_base_costly + base_costly))
  total_opt_costly=$((total_opt_costly + opt_costly))
  total_shifts=$((total_shifts + shifts))

  printf "%-28s %-6s %10d %10d %12d %12d %8d\n" \
    "$name" "$result" "$base_ops" "$opt_ops" "$base_costly" "$opt_costly" "$shifts"
done

printf "%-28s %-6s %10d %10d %12d %12d %8d\n" \
  "TOTAL" "-" "$total_base_ops" "$total_opt_ops" "$total_base_costly" "$total_opt_costly" "$total_shifts"

if [[ "$status" -eq 0 ]]; then
  echo "All testcases matched expected output."
else
  echo "One or more testcases failed. See $ACTUAL_DIR/*.diff for details." >&2
fi

exit "$status"

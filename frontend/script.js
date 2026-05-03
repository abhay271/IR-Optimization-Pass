const sampleIr = `define i32 @combined(i32 %x) {
entry:
  %a = add i32 4, 5
  %b = mul i32 %x, 8
  %c = udiv i32 %b, 4
  %d = add i32 %c, %a
  ret i32 %d
}`;

const inputIr = document.querySelector("#inputIr");
const outputIr = document.querySelector("#outputIr");
const runButton = document.querySelector("#runButton");
const resetButton = document.querySelector("#resetButton");
const changeCount = document.querySelector("#changeCount");
const changeList = document.querySelector("#changeList");
const summaryText = document.querySelector("#summaryText");

inputIr.value = sampleIr;
outputIr.textContent = sampleIr;

function isPowerOfTwo(value) {
  return value > 0 && (value & (value - 1)) === 0;
}

function log2(value) {
  return Math.log2(value);
}

function foldInteger(op, lhs, rhs) {
  switch (op) {
    case "add":
      return lhs + rhs;
    case "sub":
      return lhs - rhs;
    case "mul":
      return lhs * rhs;
    case "udiv":
      return rhs === 0 ? null : Math.trunc(lhs / rhs);
    default:
      return null;
  }
}

function optimizeLine(line, changes) {
  const constantPattern = /^(\s*)(%[\w.-]+)\s*=\s*(add|sub|mul|udiv)\s+i32\s+(-?\d+),\s*(-?\d+)\s*$/;
  const strengthPattern = /^(\s*)(%[\w.-]+)\s*=\s*(mul|udiv)\s+i32\s+([^,]+),\s*(-?\d+)\s*$/;
  const commutedMultiplyPattern = /^(\s*)(%[\w.-]+)\s*=\s*mul\s+i32\s+(-?\d+),\s*([^,]+)\s*$/;

  let match = line.match(constantPattern);
  if (match) {
    const [, indent, name, op, lhsText, rhsText] = match;
    const folded = foldInteger(op, Number(lhsText), Number(rhsText));

    if (folded !== null) {
      changes.push(`${name}: folded ${op} i32 ${lhsText}, ${rhsText} into ${folded}`);
      return `${indent}; ${name} folded to i32 ${folded}`;
    }
  }

  match = line.match(strengthPattern);
  if (match) {
    const [, indent, name, op, variable, rhsText] = match;
    const rhs = Number(rhsText);

    if (isPowerOfTwo(rhs)) {
      const shiftAmount = log2(rhs);
      const shiftOp = op === "mul" ? "shl" : "lshr";
      changes.push(`${name}: replaced ${op} by ${shiftOp} with shift amount ${shiftAmount}`);
      return `${indent}${name} = ${shiftOp} i32 ${variable.trim()}, ${shiftAmount}`;
    }
  }

  match = line.match(commutedMultiplyPattern);
  if (match) {
    const [, indent, name, lhsText, variable] = match;
    const lhs = Number(lhsText);

    if (isPowerOfTwo(lhs)) {
      const shiftAmount = log2(lhs);
      changes.push(`${name}: replaced commuted multiply by shl with shift amount ${shiftAmount}`);
      return `${indent}${name} = shl i32 ${variable.trim()}, ${shiftAmount}`;
    }
  }

  return line;
}

function runDemo() {
  const changes = [];
  const transformed = inputIr.value
    .split("\n")
    .map((line) => optimizeLine(line, changes))
    .join("\n");

  outputIr.textContent = transformed;
  changeCount.textContent = `${changes.length} ${changes.length === 1 ? "change" : "changes"}`;
  summaryText.textContent =
    changes.length === 0
      ? "No matching constant-folding or strength-reduction opportunities were found."
      : "The demo found simple integer arithmetic patterns that match the LLVM pass.";

  changeList.innerHTML = "";
  changes.forEach((change) => {
    const item = document.createElement("li");
    item.textContent = change;
    changeList.appendChild(item);
  });
}

runButton.addEventListener("click", runDemo);
resetButton.addEventListener("click", () => {
  inputIr.value = sampleIr;
  runDemo();
});

runDemo();

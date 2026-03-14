#!/usr/bin/env node
const { execSync } = require("child_process");
const fs = require("fs");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    let files;
    try {
      files = execSync("git diff --name-only HEAD", {
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      })
        .toString()
        .trim()
        .split("\n")
        .filter((f) => f && /\.(ts|tsx|py)$/.test(f));
    } catch {
      process.exit(0);
    }

    if (!files || files.length === 0) {
      process.exit(0);
    }

    const MAX_LINES = 50;
    const violations = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf8");
        const lines = content.split("\n");
        const isPython = file.endsWith(".py");

        if (isPython) {
          checkPythonFunctions(file, lines, violations);
        } else {
          checkTsFunctions(file, lines, violations);
        }
      } catch {
        // File might not exist
      }
    }

    if (violations.length > 0) {
      process.stdout.write(
        `Functions exceeding ${MAX_LINES}-line limit:\n${violations.join("\n")}\nConsider extracting helper functions.\n`
      );
    }
  } catch {
    // Skip on errors
  }
});

function checkPythonFunctions(file, lines, violations) {
  let funcName = null;
  let funcStart = 0;
  let funcIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\s*)(?:async\s+)?def\s+(\w+)/);

    if (match) {
      // Close previous function
      if (funcName) {
        const length = i - funcStart;
        if (length > 50) {
          violations.push(
            `  ${file}:${funcStart + 1}: ${funcName}() is ${length} lines`
          );
        }
      }
      funcIndent = match[1].length;
      funcName = match[2];
      funcStart = i;
    } else if (funcName && line.trim() !== "") {
      // Check if we've left the function (dedented to same or less level)
      const currentIndent = line.match(/^(\s*)/)[1].length;
      if (currentIndent <= funcIndent && !/^\s*#/.test(line) && !/^\s*$/.test(line)) {
        const length = i - funcStart;
        if (length > 50) {
          violations.push(
            `  ${file}:${funcStart + 1}: ${funcName}() is ${length} lines`
          );
        }
        funcName = null;
      }
    }
  }

  // Check last function
  if (funcName) {
    const length = lines.length - funcStart;
    if (length > 50) {
      violations.push(
        `  ${file}:${funcStart + 1}: ${funcName}() is ${length} lines`
      );
    }
  }
}

function checkTsFunctions(file, lines, violations) {
  let funcName = null;
  let funcStart = 0;
  let braceDepth = 0;
  let tracking = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!tracking) {
      // Look for function declarations
      const match = line.match(
        /(?:(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:async\s+)?\()/
      );
      if (match) {
        funcName = match[1] || match[2];
        funcStart = i;
        braceDepth = 0;
        tracking = true;
      }
    }

    if (tracking) {
      for (const ch of line) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
      }

      if (braceDepth <= 0 && i > funcStart) {
        const length = i - funcStart + 1;
        if (length > 50) {
          violations.push(
            `  ${file}:${funcStart + 1}: ${funcName}() is ${length} lines`
          );
        }
        tracking = false;
        funcName = null;
      }
    }
  }
}

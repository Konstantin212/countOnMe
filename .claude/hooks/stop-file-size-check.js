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

    const MAX_LINES = 800;
    const violations = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf8");
        const lineCount = content.split("\n").length;
        if (lineCount > MAX_LINES) {
          violations.push(`  ${file}: ${lineCount} lines (max ${MAX_LINES})`);
        }
      } catch {
        // File might not exist (deleted)
      }
    }

    if (violations.length > 0) {
      process.stdout.write(
        `Files exceeding ${MAX_LINES}-line limit:\n${violations.join("\n")}\nConsider extracting utilities or splitting into smaller modules.\n`
      );
    }
  } catch {
    // Skip on errors
  }
});

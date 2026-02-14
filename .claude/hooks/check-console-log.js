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
      files = execSync("git diff --name-only HEAD -- client/src/", {
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      })
        .toString()
        .trim()
        .split("\n")
        .filter((f) => f && /\.(ts|tsx)$/.test(f));
    } catch {
      process.exit(0);
    }

    if (!files || files.length === 0) {
      process.exit(0);
    }

    const violations = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf8");
        const lines = content.split("\n");
        lines.forEach((line, i) => {
          if (/console\.log\(/.test(line) && !/\/\/.*console\.log/.test(line)) {
            violations.push(`  ${file}:${i + 1}: ${line.trim()}`);
          }
        });
      } catch {
        // File might not exist (deleted)
      }
    }

    if (violations.length > 0) {
      process.stdout.write(
        `console.log found in modified files:\n${violations.join("\n")}\nRemove before committing.\n`
      );
    }
  } catch {
    // Skip on errors
  }
});

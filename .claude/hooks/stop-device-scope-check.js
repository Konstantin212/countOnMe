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
      files = execSync("git diff --name-only HEAD -- backend/app/services/", {
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      })
        .toString()
        .trim()
        .split("\n")
        .filter((f) => f && f.endsWith(".py"));
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

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Look for select() statements
          if (/\bselect\s*\(/.test(line)) {
            // Check the surrounding context (next 10 lines) for device_id filter
            const context = lines.slice(i, Math.min(i + 15, lines.length)).join("\n");
            if (!/device_id/.test(context)) {
              violations.push(
                `  ${file}:${i + 1}: select() without device_id scope — ${line.trim().substring(0, 60)}`
              );
            }
          }
        }
      } catch {
        // File might not exist
      }
    }

    if (violations.length > 0) {
      process.stdout.write(
        `Potential missing device scoping in services:\n${violations.join("\n")}\nAll queries must filter by device_id.\n`
      );
    }
  } catch {
    // Skip on errors
  }
});

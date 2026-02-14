#!/usr/bin/env node
const { execSync } = require("child_process");
const path = require("path");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const filePath = event.tool_input?.file_path || "";

    if (!/\.py$/.test(filePath) || !filePath.includes("backend")) {
      process.exit(0);
    }

    const relativePath = filePath.replace(/.*backend[/\\]/, "");

    try {
      execSync(`ruff check ${relativePath}`, {
        cwd: path.resolve("backend"),
        timeout: 30000,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });
    } catch (err) {
      const output =
        (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
      if (output.trim()) {
        process.stdout.write(`Ruff errors:\n${output.trim()}\n`);
      }
    }
  } catch {
    // Skip on parse errors
  }
});

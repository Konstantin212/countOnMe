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

    if (
      !/\.(ts|tsx|js|jsx)$/.test(filePath) ||
      !filePath.includes("client")
    ) {
      process.exit(0);
    }

    try {
      execSync(`npx prettier --write "${filePath}"`, {
        cwd: path.resolve("client"),
        timeout: 15000,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });
    } catch {
      // Prettier not installed or failed — skip silently
    }
  } catch {
    // Skip on parse errors
  }
});

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

    if (!/\.(ts|tsx)$/.test(filePath) || !filePath.includes("client")) {
      process.exit(0);
    }

    try {
      execSync("npx tsc --noEmit", {
        cwd: path.resolve("client"),
        timeout: 60000,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });
    } catch (err) {
      const output =
        (err.stdout?.toString() || "") + (err.stderr?.toString() || "");
      const fileName = path.basename(filePath);
      const relevantLines = output
        .split("\n")
        .filter((line) => line.includes(fileName))
        .join("\n");

      if (relevantLines) {
        process.stdout.write(
          `TypeScript errors in ${fileName}:\n${relevantLines}\n`
        );
      }
    }
  } catch {
    // Skip on parse errors
  }
});

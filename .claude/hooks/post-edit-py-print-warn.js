#!/usr/bin/env node

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const filePath = (event.tool_input?.file_path || "").replace(/\\/g, "/");

    if (!/\.py$/.test(filePath)) {
      process.exit(0);
    }

    // Only check backend code
    if (!filePath.includes("backend/")) {
      process.exit(0);
    }

    // Skip test files — print in tests is acceptable for debugging
    if (filePath.includes("/tests/")) {
      process.exit(0);
    }

    const newContent =
      event.tool_input?.new_string || event.tool_input?.content || "";

    const lines = newContent.split("\n");
    const matches = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comment lines
      if (/^\s*#/.test(line)) continue;

      if (/\bprint\s*\(/.test(line)) {
        matches.push(`  line ${i + 1}: ${line.trim()}`);
      }
    }

    if (matches.length > 0) {
      process.stdout.write(
        `print() detected in ${filePath}. Use logging module instead.\n${matches.join("\n")}\n`
      );
    }
  } catch {
    // Skip on parse errors
  }
});

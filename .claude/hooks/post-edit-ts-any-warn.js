#!/usr/bin/env node

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const filePath = event.tool_input?.file_path || "";

    if (!/\.(ts|tsx)$/.test(filePath)) {
      process.exit(0);
    }

    // Skip test files — as any is acceptable in test fixtures
    if (/\.test\.(ts|tsx)$/.test(filePath)) {
      process.exit(0);
    }

    const newContent =
      event.tool_input?.new_string || event.tool_input?.content || "";

    const lines = newContent.split("\n");
    const matches = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comment lines
      if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;

      if (
        /:\s*any\b/.test(line) ||
        /\bas\s+any\b/.test(line) ||
        /\bany\[\]/.test(line) ||
        /<any>/.test(line) ||
        /<any,/.test(line)
      ) {
        matches.push(`  line ${i + 1}: ${line.trim()}`);
      }
    }

    if (matches.length > 0) {
      process.stdout.write(
        `TypeScript 'any' detected in ${filePath}. Use explicit types or 'unknown' instead.\n${matches.join("\n")}\n`
      );
    }
  } catch {
    // Skip on parse errors
  }
});

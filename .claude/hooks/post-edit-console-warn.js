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

    const newContent =
      event.tool_input?.new_string || event.tool_input?.content || "";

    if (/console\.log\(/.test(newContent)) {
      process.stdout.write(
        `console.log detected in ${filePath}. Remove before committing.\n`
      );
    }
  } catch {
    // Skip on parse errors
  }
});

#!/usr/bin/env node

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const filePath = event.tool_input?.file_path || "";

    if (!/\.tsx$/.test(filePath)) {
      process.exit(0);
    }

    const newContent =
      event.tool_input?.new_string || event.tool_input?.content || "";

    const lines = newContent.split("\n");
    const matches = [];

    for (let i = 0; i < lines.length; i++) {
      if (/style=\{\{/.test(lines[i])) {
        matches.push(`  line ${i + 1}: ${lines[i].trim()}`);
      }
    }

    if (matches.length > 0) {
      process.stdout.write(
        `Inline styles detected in ${filePath}. Use StyleSheet.create instead.\n${matches.join("\n")}\n`
      );
    }
  } catch {
    // Skip on parse errors
  }
});

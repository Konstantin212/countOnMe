#!/usr/bin/env node

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const filePath = (event.tool_input?.file_path || "").replace(/\\/g, "/");

    if (!/\.(ts|tsx|py)$/.test(filePath)) {
      process.exit(0);
    }

    const newContent =
      event.tool_input?.new_string || event.tool_input?.content || "";

    const isPython = filePath.endsWith(".py");
    const indentSize = isPython ? 4 : 2;
    const maxDepth = 4;
    const maxIndent = maxDepth * indentSize;

    const lines = newContent.split("\n");
    const violations = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip empty lines, comments, and string-only lines
      if (!line.trim()) continue;
      if (/^\s*(\/\/|#|\*|\/\*)/.test(line)) continue;

      const leadingSpaces = line.match(/^( *)/)[1].length;

      if (leadingSpaces > maxIndent) {
        violations.push(
          `  line ${i + 1}: depth ${Math.floor(leadingSpaces / indentSize)} — ${line.trim().substring(0, 60)}`
        );
      }
    }

    if (violations.length > 0) {
      process.stdout.write(
        `Deep nesting (>${maxDepth} levels) in ${filePath}:\n${violations.slice(0, 5).join("\n")}${violations.length > 5 ? `\n  ...and ${violations.length - 5} more` : ""}\nConsider early returns or extracting helper functions.\n`
      );
    }
  } catch {
    // Skip on parse errors
  }
});

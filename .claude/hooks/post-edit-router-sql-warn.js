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

    // Only check router files
    if (!filePath.includes("/api/routers/")) {
      process.exit(0);
    }

    const newContent =
      event.tool_input?.new_string || event.tool_input?.content || "";

    const lines = newContent.split("\n");
    const matches = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments
      if (/^\s*#/.test(line)) continue;

      if (
        /session\.execute\s*\(/.test(line) ||
        /\bselect\s*\(/.test(line) ||
        /\bupdate\s*\(/.test(line) ||
        /\bdelete\s*\(/.test(line)
      ) {
        matches.push(`  line ${i + 1}: ${line.trim()}`);
      }
    }

    if (matches.length > 0) {
      process.stdout.write(
        `Direct SQL in router ${filePath}. Move queries to services layer.\n${matches.join("\n")}\n`
      );
    }
  } catch {
    // Skip on parse errors
  }
});

#!/usr/bin/env node

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const command = event.tool_input?.command || "";
    const upper = command.toUpperCase();

    // Block: DELETE FROM without WHERE (data loss risk)
    if (/DELETE\s+FROM\s+/i.test(command) && !/WHERE/i.test(command)) {
      process.stdout.write(
        JSON.stringify({
          decision: "block",
          reason: `DELETE FROM without WHERE clause is blocked. Add a WHERE clause or ask user for explicit permission.`,
        })
      );
      process.exit(2);
    }

    // Block: DROP DATABASE
    if (/DROP\s+DATABASE/i.test(command)) {
      process.stdout.write(
        JSON.stringify({
          decision: "block",
          reason: `DROP DATABASE is blocked. This is a destructive operation.`,
        })
      );
      process.exit(2);
    }

    // Escalate: other destructive SQL commands
    if (
      /DROP\s+TABLE/i.test(command) ||
      /TRUNCATE\s/i.test(command) ||
      /DROP\s+COLUMN/i.test(command)
    ) {
      process.stdout.write(
        JSON.stringify({
          decision: "ask",
          reason: `Destructive SQL operation detected: ${command.substring(0, 100)}`,
        })
      );
      process.exit(0);
    }

    // Escalate: git clean (removes untracked files)
    if (/git\s+clean/.test(command)) {
      process.stdout.write(
        JSON.stringify({
          decision: "ask",
          reason: `git clean removes untracked files. Command: ${command}`,
        })
      );
      process.exit(0);
    }
  } catch {
    // Skip on parse errors
  }
});

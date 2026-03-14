#!/usr/bin/env node

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const command = event.tool_input?.command || "";

    // Strip quoted strings and heredocs to avoid false positives
    // from commit messages, echo statements, etc.
    const stripped = stripQuotedContent(command);

    // Block: DELETE FROM without WHERE (data loss risk)
    if (/DELETE\s+FROM\s+/i.test(stripped) && !/WHERE/i.test(stripped)) {
      process.stdout.write(
        JSON.stringify({
          decision: "block",
          reason: `DELETE FROM without WHERE clause is blocked. Add a WHERE clause or ask user for explicit permission.`,
        })
      );
      process.exit(2);
    }

    // Block: DROP DATABASE
    if (/DROP\s+DATABASE/i.test(stripped)) {
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
      /DROP\s+TABLE/i.test(stripped) ||
      /TRUNCATE\s/i.test(stripped) ||
      /DROP\s+COLUMN/i.test(stripped)
    ) {
      process.stdout.write(
        JSON.stringify({
          decision: "ask",
          reason: `Destructive SQL operation detected: ${stripped.substring(0, 100)}`,
        })
      );
      process.exit(0);
    }

    // Escalate: git clean (removes untracked files)
    if (/git\s+clean/.test(stripped)) {
      process.stdout.write(
        JSON.stringify({
          decision: "ask",
          reason: `git clean removes untracked files. Command: ${stripped.trim().substring(0, 100)}`,
        })
      );
      process.exit(0);
    }
  } catch {
    // Skip on parse errors
  }
});

function stripQuotedContent(cmd) {
  // Remove heredoc content: $(cat <<'EOF' ... EOF) or $(cat <<EOF ... EOF)
  let result = cmd.replace(
    /\$\(cat\s+<<'?(\w+)'?[\s\S]*?\1\s*\)/g,
    ""
  );
  // Remove double-quoted strings (handling escaped quotes)
  result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  // Remove single-quoted strings
  result = result.replace(/'(?:[^'\\]|\\.)*'/g, "''");
  return result;
}

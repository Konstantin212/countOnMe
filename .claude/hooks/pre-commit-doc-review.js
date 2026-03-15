#!/usr/bin/env node

/**
 * PreToolUse hook for Bash (git commit).
 * When docs/ files are staged for commit, warns that doc-reviewer should
 * validate the documentation before committing.
 */

const { execSync } = require("child_process");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const event = JSON.parse(input);
    const command = event.tool_input?.command || "";

    // Only trigger on git commit commands
    if (!/git\s+commit/.test(command)) {
      process.exit(0);
    }

    // Check staged files for docs/ changes
    let staged;
    try {
      staged = execSync("git diff --cached --name-only", {
        encoding: "utf8",
        timeout: 5000,
      }).trim();
    } catch {
      process.exit(0);
    }

    if (!staged) {
      process.exit(0);
    }

    const stagedFiles = staged.split("\n").filter(Boolean);
    const docFiles = stagedFiles.filter((f) => f.startsWith("docs/"));

    // Ignore plan files — they are transient
    const nonPlanDocs = docFiles.filter((f) => !f.startsWith("docs/plans/"));

    if (nonPlanDocs.length === 0) {
      process.exit(0);
    }

    // Check if any leftover plan files are NOT staged for deletion
    const planFiles = stagedFiles.filter((f) => f.startsWith("docs/plans/"));

    let planWarning = "";
    try {
      const fs = require("fs");
      const existingPlans = fs
        .readdirSync("docs/plans", { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith(".md"))
        .map((e) => `docs/plans/${e.name}`);

      // Plans that exist on disk but are NOT being deleted in this commit
      const leftoverPlans = existingPlans.filter(
        (p) => !planFiles.includes(p)
      );
      if (leftoverPlans.length > 0) {
        planWarning = `\n\nLeftover plan files detected (should be deleted after implementation):\n${leftoverPlans.map((p) => `  - ${p}`).join("\n")}`;
      }
    } catch {
      // docs/plans/ may not exist
    }

    process.stdout.write(
      JSON.stringify({
        decision: "ask",
        reason: `Committing docs/ changes:\n${nonPlanDocs.map((f) => `  - ${f}`).join("\n")}\n\nHave these docs been validated by doc-reviewer? If not, run /doc-lint or launch the doc-reviewer agent first.${planWarning}`,
      })
    );
  } catch {
    // Skip on parse errors
  }
});

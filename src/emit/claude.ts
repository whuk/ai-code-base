// Claude Code emitter: 1:1 layout under <out>/.claude/. Native format, no transforms.

import type { PruneResult } from "../types.js";
import { resolveFiles } from "./resolve.js";
import { copy, write } from "./fsutil.js";

export function emitClaude(baseDir: string, outDir: string, result: PruneResult): void {
  for (const f of resolveFiles(result)) {
    let dest: string;
    switch (f.category) {
      case "context":
        dest = ".claude/CLAUDE.md";
        break;
      case "settings":
        dest = ".claude/settings.json";
        break;
      default:
        // agents/, commands/, rules/, misc files keep their subtree under .claude/
        dest = `.claude/${f.destRel}`;
    }
    copy(baseDir, f.srcRel, outDir, dest);
  }
  void write; // reserved for future generated files
}

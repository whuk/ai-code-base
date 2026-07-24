// Filesystem helpers kept separate from the pure prune logic.

import { readdirSync } from "node:fs";
import path from "node:path";

/** Recursively list files under `baseDir` as posix, base-relative paths, sorted. */
export function listTemplateFiles(baseDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else out.push(path.relative(baseDir, abs).split(path.sep).join("/"));
    }
  };
  walk(baseDir);
  return out.sort();
}

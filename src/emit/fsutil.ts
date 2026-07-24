import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

export function read(baseDir: string, rel: string): string {
  return readFileSync(path.join(baseDir, rel), "utf8");
}

/** Write `content` to `<outDir>/<rel>`, creating parent dirs. */
export function write(outDir: string, rel: string, content: string): void {
  const abs = path.join(outDir, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

/** Copy a template file verbatim to `<outDir>/<destRel>`. */
export function copy(baseDir: string, srcRel: string, outDir: string, destRel: string): void {
  write(outDir, destRel, read(baseDir, srcRel));
}

export function dirExists(p: string): boolean {
  return existsSync(p);
}

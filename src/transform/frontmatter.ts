// Frontmatter parsing/serialization shared by the emitters.

import matter from "gray-matter";

export interface Parsed {
  data: Record<string, unknown>;
  body: string;
}

export function parse(raw: string): Parsed {
  const { data, content } = matter(raw);
  return { data: data as Record<string, unknown>, body: content.trimStart() };
}

/** Serialize YAML frontmatter + body (used for Gemini agents / kept-as-is rules). */
export function stringify(data: Record<string, unknown>, body: string): string {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null) clean[k] = v;
  }
  if (Object.keys(clean).length === 0) return `${body}\n`;
  return matter.stringify(`\n${body}`, clean);
}

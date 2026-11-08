import fs from "node:fs";
import path from "node:path";
import { PROJECTS_DIR, ensureDirs, sanitizeId } from "./paths";
import type { Project } from "./types";

export function saveProject(project: Project): void {
  ensureDirs();
  const file = path.join(PROJECTS_DIR, `${sanitizeId(project.id)}.json`);
  fs.writeFileSync(file, JSON.stringify(project, null, 2), "utf8");
}

export function loadProject(id: string): Project | null {
  const file = path.join(PROJECTS_DIR, `${sanitizeId(id)}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Project;
  } catch {
    return null;
  }
}

export function listProjects(): Project[] {
  ensureDirs();
  const out: Project[] = [];
  for (const f of fs.readdirSync(PROJECTS_DIR)) {
    if (!f.endsWith(".json")) continue;
    try {
      const p = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), "utf8")) as Project;
      out.push(p);
    } catch {
      // skip corrupt file
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export function deleteProject(id: string): boolean {
  const file = path.join(PROJECTS_DIR, `${sanitizeId(id)}.json`);
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
}
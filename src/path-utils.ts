import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export function assetPath(...parts: string[]): string {
  const p1 = path.join(process.resourcesPath, 'app', ...parts);
  if (app.isPackaged && fs.existsSync(p1)) return p1;

  const p2 = path.join(app.getAppPath(), 'app', ...parts);
  if (fs.existsSync(p2)) return p2;

  const p3 = path.join(app.getAppPath(), '..', 'app', ...parts);
  if (fs.existsSync(p3)) return p3;

  throw new Error(`Asset not found: ${parts.join('/')}`);
}
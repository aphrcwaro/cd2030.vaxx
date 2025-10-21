import path from 'node:path';
import fs from 'node:fs';
import { assetPath } from './path-utils.js';

export function resolvePortableR() {
  const base = assetPath('r_lang');
  let bin: string;
  let rHome: string;

  if (process.platform === 'win32') {
    bin = path.join(base, 'bin', 'x64', 'RScript.exe');
    rHome = base;
  } else if (process.platform === 'darwin') {
    bin = path.join(base, 'bin', 'Rscript');
    rHome = base;
  } else { // Linux
    bin = path.join(base, 'bin', 'Rscript');
    rHome = base;
  }

  const lib = path.join(base, 'library');
  const env: Record<string, string> = {
    RHOME: rHome,
    R_HOME_DIR: rHome,
    PATH: `${path.dirname(bin)}${path.delimiter}${process.env.PATH || ''}`
  };
  if (fs.existsSync(lib)) {
    env.R_LIBS = lib;
    env.R_LIBS_USER = lib;
    env.R_LIBS_SITE = lib;
  }
  return { bin: must(bin, 'RScript executable missing'), env };
}

function must(p: string, why: string): string {
  if (fs.existsSync(p)) return p;
  throw new Error(`${why}: ${p}`);
}

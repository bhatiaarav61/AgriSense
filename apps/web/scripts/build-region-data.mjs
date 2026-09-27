// Converts the human-authored region configs in <repo>/regions/*.yaml into a
// single JSON module the web app bundles. Run with `npm run gen:regions`.
// The generated file (data/regions.generated.json) is committed so the app
// builds and deploys without needing the YAML sources at build time.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const regionsDir = resolve(webRoot, '..', '..', 'regions');
const outFile = join(webRoot, 'data', 'regions.generated.json');

function loadRegions() {
  let files = [];
  try {
    files = readdirSync(regionsDir).filter((f) => /\.ya?ml$/i.test(f));
  } catch {
    console.warn(`[gen:regions] regions dir not found at ${regionsDir}; keeping existing JSON.`);
    return null;
  }

  const regions = [];
  for (const file of files.sort()) {
    try {
      const doc = yaml.load(readFileSync(join(regionsDir, file), 'utf8'));
      if (doc && doc.id) regions.push(doc);
      else console.warn(`[gen:regions] skipped ${file} (no id).`);
    } catch (err) {
      console.warn(`[gen:regions] failed to parse ${file}: ${err.message}`);
    }
  }
  return regions;
}

const regions = loadRegions();
if (regions && regions.length) {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify({ regions }, null, 2) + '\n', 'utf8');
  console.log(`[gen:regions] wrote ${regions.length} regions → ${outFile}`);
} else if (regions && regions.length === 0) {
  console.warn('[gen:regions] no valid region files found; keeping existing JSON.');
}

import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import MCR from 'monocart-coverage-reports';

const combined = {};
for (const suite of ['server', 'browser']) {
  const data = JSON.parse(readFileSync(`coverage/${suite}/coverage-final.json`, 'utf8'));
  if (!Object.keys(data).length) throw new Error(`Empty ${suite} coverage.`);
  for (const [filename, coverage] of Object.entries(data)) {
    const relative = path.relative(process.cwd(), path.resolve(filename)).split(path.sep).join('/');
    if (combined[relative]) throw new Error(`Overlapping coverage source: ${filename}`);
    combined[relative] = { ...coverage, path: relative };
  }
}

rmSync('coverage/merged', { recursive: true, force: true });
const report = MCR({
  name: 'Little Goods merged coverage',
  outputDir: 'coverage/merged',
  reports: ['lcovonly', 'html', 'json', 'json-summary', 'text-summary'],
  sourceFinder: filename => readFileSync(path.resolve(filename), 'utf8')
});
await report.add(combined);
await report.generate();

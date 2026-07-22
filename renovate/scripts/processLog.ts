import execa from 'execa';
import { parseRenovateLogs } from './utils/renovateLogs.ts';
import type { RenovateLog } from './utils/types.ts';
import { updateAndFormat } from './utils/runBin.ts';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Missing path to Renovate log file');
  process.exit(1);
}
const open = process.argv[3] === '--open';

const logs = parseRenovateLogs(filePath).logs as Partial<RenovateLog>[];
for (const log of logs) {
  for (const prop of ['name', 'hostname', 'pid', 'logContext', 'v', 'time', 'repository']) {
    delete log[prop];
  }
}
const outPath = filePath.replace(/\.log$/, '') + '.json';
await updateAndFormat(outPath, JSON.stringify(logs));

console.log(`Wrote logs to "${outPath}"`);
open && execa.sync('code', [outPath]);

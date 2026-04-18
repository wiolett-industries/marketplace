import { execFileSync } from 'node:child_process';
import path from 'node:path';

export function runHarness(mode) {
  const output = execFileSync(
    process.execPath,
    [path.join('test', 'harness.mjs'), mode],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        OPENAI_API_KEY: '',
      },
    }
  );

  return JSON.parse(output);
}

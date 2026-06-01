import { execFileSync } from 'node:child_process';
import os from 'node:os';
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
        WIOLETT_AUTH_CONFIG_PATH: path.join(os.tmpdir(), 'agent-memory-missing-auth-config.json'),
        OPENAI_API_KEY: '',
      },
    }
  );

  return JSON.parse(output);
}

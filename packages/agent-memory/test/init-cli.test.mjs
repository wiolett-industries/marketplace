import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from '@jest/globals';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(packageDir, 'dist', 'index.js');

function runCli(args, options = {}) {
  const env = {
    ...process.env,
    OPENAI_API_KEY: '',
    WIOLETT_AUTH_CONFIG_PATH: options.configPath ?? tempConfigPath(),
  };

  return execFileSync(process.execPath, [cliPath, ...args], {
    cwd: packageDir,
    encoding: 'utf8',
    env,
  });
}

function tempConfigPath() {
  return path.join(mkdtempSync(path.join(tmpdir(), 'agent-memory-init-')), 'auth-config.json');
}

describe('agent-memory-mcp init', () => {
  test('prints the resolved config path', () => {
    const configPath = tempConfigPath();
    const output = runCli(['init', '--print-path'], { configPath });
    expect(output.trim()).toBe(configPath);
  });

  test('check exits non-zero when auth is not configured', () => {
    expect(() => runCli(['init', '--check'])).toThrow(
      expect.objectContaining({
        status: 1,
        stdout: expect.stringContaining('Agent Memory auth is not configured'),
      })
    );
  });

  test('writes non-interactive API key config without text model fields', () => {
    const configPath = tempConfigPath();
    const output = runCli(
      [
        'init',
        '--key',
        'sk-test',
        '--endpoint',
        'https://provider.test/v1',
        '--embedding-model',
        'embed-test',
        '--force',
      ],
      { configPath }
    );

    expect(output).toContain(`Saved ${configPath}`);
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    expect(config).toEqual({
      openAIKey: 'sk-test',
      endpoint: 'https://provider.test/v1',
      embeddingModel: 'embed-test',
    });
    expect(config).not.toHaveProperty('model');
    expect(config).not.toHaveProperty('defaultModel');
    expect(statSync(configPath).mode & 0o777).toBe(0o600);

    const checkOutput = runCli(['init', '--check'], { configPath });
    expect(checkOutput).toContain(`Agent Memory auth is configured via ${configPath}`);
    expect(checkOutput).toContain('Endpoint: https://provider.test/v1');
    expect(checkOutput).toContain('Embedding model: embed-test');
  });
});

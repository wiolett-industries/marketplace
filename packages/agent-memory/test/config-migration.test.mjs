import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureConfigAndStorageMigrated } from '../dist/migration.js';

async function createLegacyHome() {
  const agentsHome = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-memory-migration-'));
  const legacyConfig = path.join(agentsHome, '.wiolett', 'auth-config.json');
  const legacyMemory = path.join(agentsHome, 'agent-memory');
  await fs.mkdir(path.dirname(legacyConfig), { recursive: true });
  await fs.mkdir(path.join(legacyMemory, 'memories'), { recursive: true });
  await fs.writeFile(legacyConfig, JSON.stringify({
    openAIKey: 'sk-legacy',
    endpoint: 'https://provider.test/v1',
    responseModel: 'legacy-text',
    embeddingModel: 'legacy-embedding',
  }), 'utf8');
  await fs.writeFile(path.join(legacyMemory, 'memories', 'legacy.md'), '# Legacy memory\n', 'utf8');
  return agentsHome;
}

test('bootstrap migrates legacy config and global memory exactly once', async () => {
  const agentsHome = await createLegacyHome();
  const env = { PROJECT_MEMORY_AGENTS_HOME: agentsHome, OPENAI_API_KEY: '' };
  const first = await ensureConfigAndStorageMigrated({ trigger: 'mcp-startup', env });

  const providersPath = path.join(agentsHome, '.wiolett', 'config', 'ai-providers.yml');
  const mcpPath = path.join(agentsHome, '.wiolett', 'config', 'mcp-config.yml');
  const destination = path.join(agentsHome, '.wiolett', 'global-memory');
  assert.equal(first.legacyConfigMigrated, true);
  assert.equal(first.memoryMigration, 'completed');
  assert.equal(readFileSync(providersPath, 'utf8').includes('api_key: sk-legacy'), true);
  assert.equal(readFileSync(providersPath, 'utf8').includes('text: legacy-text'), true);
  assert.equal(/[А-Яа-яЁё]/u.test(readFileSync(providersPath, 'utf8')), false);
  assert.equal(/[А-Яа-яЁё]/u.test(readFileSync(mcpPath, 'utf8')), false);
  assert.equal(statSync(providersPath).mode & 0o777, 0o600);
  assert.equal(readFileSync(path.join(destination, 'memories', 'legacy.md'), 'utf8'), '# Legacy memory\n');
  assert.equal(lstatSync(path.join(agentsHome, 'agent-memory')).isSymbolicLink(), true);
  assert.equal(realpathSync(path.join(agentsHome, 'agent-memory')), realpathSync(destination));
  assert.ok(first.memoryBackup && existsSync(first.memoryBackup));

  const second = await ensureConfigAndStorageMigrated({ trigger: 'init', env });
  assert.equal(second.configCreated.length, 0);
  assert.equal(second.memoryMigration, 'already-completed');
});

test('concurrent bootstrap calls serialize through one migration lock', async () => {
  const agentsHome = await createLegacyHome();
  const env = { PROJECT_MEMORY_AGENTS_HOME: agentsHome, OPENAI_API_KEY: '' };
  const results = await Promise.all([
    ensureConfigAndStorageMigrated({ trigger: 'mcp-startup', env }),
    ensureConfigAndStorageMigrated({ trigger: 'init', env }),
  ]);
  assert.equal(results.filter((result) => result.memoryMigration === 'completed').length, 1);
  assert.equal(results.filter((result) => result.memoryMigration === 'already-completed').length, 1);
});

test('bootstrap preserves divergent source and destination data', async () => {
  const agentsHome = await createLegacyHome();
  const destination = path.join(agentsHome, '.wiolett', 'global-memory');
  await fs.mkdir(path.join(destination, 'memories'), { recursive: true });
  await fs.writeFile(path.join(destination, 'memories', 'different.md'), '# Different\n', 'utf8');
  const env = { PROJECT_MEMORY_AGENTS_HOME: agentsHome, OPENAI_API_KEY: '' };

  await assert.rejects(
    ensureConfigAndStorageMigrated({ trigger: 'mcp-startup', env }),
    /both source and destination contain different data/,
  );
  assert.equal(readFileSync(path.join(agentsHome, 'agent-memory', 'memories', 'legacy.md'), 'utf8'), '# Legacy memory\n');
  assert.equal(readFileSync(path.join(destination, 'memories', 'different.md'), 'utf8'), '# Different\n');
});

test('bootstrap follows a later configured global-memory path change', async () => {
  const agentsHome = await createLegacyHome();
  const env = { PROJECT_MEMORY_AGENTS_HOME: agentsHome, OPENAI_API_KEY: '' };
  await ensureConfigAndStorageMigrated({ trigger: 'mcp-startup', env });
  const configPath = path.join(agentsHome, '.wiolett', 'config', 'mcp-config.yml');
  const source = readFileSync(configPath, 'utf8');
  await fs.writeFile(configPath, source.replace('global: .wiolett/global-memory', 'global: custom/global-memory'), 'utf8');

  const result = await ensureConfigAndStorageMigrated({ trigger: 'init', env });
  const destination = path.join(agentsHome, 'custom', 'global-memory');
  assert.equal(result.memoryMigration, 'completed');
  assert.equal(readFileSync(path.join(destination, 'memories', 'legacy.md'), 'utf8'), '# Legacy memory\n');
  assert.equal(realpathSync(path.join(agentsHome, 'agent-memory')), realpathSync(destination));
});

test('bootstrap ignores malformed legacy auth after canonical YAML exists', async () => {
  const agentsHome = await createLegacyHome();
  const env = { PROJECT_MEMORY_AGENTS_HOME: agentsHome, OPENAI_API_KEY: '' };
  await ensureConfigAndStorageMigrated({ trigger: 'init', env });
  await fs.writeFile(path.join(agentsHome, '.wiolett', 'auth-config.json'), '{broken legacy json', 'utf8');

  const result = await ensureConfigAndStorageMigrated({ trigger: 'mcp-startup', env });
  assert.equal(result.configCreated.length, 0);
  assert.equal(result.memoryMigration, 'already-completed');
});

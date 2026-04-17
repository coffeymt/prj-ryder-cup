#!/usr/bin/env node

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const VALID_ENVS = new Set(['preview', 'production']);

function printUsage() {
  console.error('Usage: node scripts/apply-migrations.mjs [--remote --env <preview|production>]');
}

function parseArgs(argv) {
  let remote = false;
  let env = 'preview';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--remote') {
      remote = true;
      continue;
    }

    if (arg === '--env') {
      const envValue = argv[index + 1];
      if (!envValue) {
        throw new Error('Missing value for --env. Expected preview or production.');
      }
      if (!VALID_ENVS.has(envValue)) {
        throw new Error(`Invalid --env value "${envValue}". Expected preview or production.`);
      }
      env = envValue;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument "${arg}".`);
  }

  if (!remote && argv.includes('--env')) {
    throw new Error('--env can only be used with --remote.');
  }

  return { remote, env };
}

async function runMigration(migrationPath, remote, env) {
  const targetArgs = remote ? ['--remote', '--env', env] : ['--local'];
  const npxArgs = ['wrangler', 'd1', 'execute', 'DB', ...targetArgs, '--file', migrationPath];
  const npxCommand = 'npx';

  await new Promise((resolve, reject) => {
    const child = spawn(npxCommand, npxArgs, {
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Wrangler exited with code ${code ?? 'unknown'}`));
    });
  });
}

async function main() {
  const { remote, env } = parseArgs(process.argv.slice(2));
  const targetLabel = remote ? `remote (${env})` : 'local';

  const scriptPath = fileURLToPath(import.meta.url);
  const scriptDir = path.dirname(scriptPath);
  const migrationsDir = path.resolve(scriptDir, '..', 'migrations');

  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const migrationFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (migrationFiles.length === 0) {
    console.log(`No migrations found in ${migrationsDir}.`);
    console.log(`Applied 0 migrations to ${targetLabel} D1`);
    return;
  }

  let appliedCount = 0;
  for (const fileName of migrationFiles) {
    const migrationPath = path.resolve(migrationsDir, fileName);
    console.log(`\nApplying migration: ${fileName} (${targetLabel})`);

    try {
      await runMigration(migrationPath, remote, env);
      appliedCount += 1;
    } catch (error) {
      console.error(`\nMigration failed: ${fileName}`);
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
      return;
    }
  }

  console.log(`\nApplied ${appliedCount} migrations to ${targetLabel} D1`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

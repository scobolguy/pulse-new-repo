import assert from 'node:assert/strict';
import { reloadNliConfig } from '../src/backend/nliConfig.mjs';

const originalProfile = process.env.NLI_PROFILE;
const originalModel = process.env.OLLAMA_MODEL;

try {
  delete process.env.NLI_PROFILE;
  delete process.env.OLLAMA_MODEL;

  let config = reloadNliConfig();
  assert.equal(config.profile, 't490-fast');
  assert.equal(config.model, 'phi3:latest');
  assert.equal(config.options.num_ctx, 1024);
  assert.equal(config.options.num_predict, 64);
  assert.equal(config.options.num_thread, 8);
  assert.equal(config.keepAlive, '30m');

  process.env.NLI_PROFILE = 't490-quality';
  config = reloadNliConfig();
  assert.equal(config.model, 'llama3:latest');

  process.env.OLLAMA_MODEL = 'qwen2.5:3b';
  config = reloadNliConfig();
  assert.equal(config.model, 'qwen2.5:3b');

  process.env.NLI_PROFILE = 'missing-profile';
  assert.throws(() => reloadNliConfig(), /is not defined/);

  console.log('[nli-config] PASS: profiles, model override, and invalid profile handling');
} finally {
  if (originalProfile === undefined) delete process.env.NLI_PROFILE;
  else process.env.NLI_PROFILE = originalProfile;

  if (originalModel === undefined) delete process.env.OLLAMA_MODEL;
  else process.env.OLLAMA_MODEL = originalModel;
}
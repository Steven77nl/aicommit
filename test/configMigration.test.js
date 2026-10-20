const assert = require('node:assert/strict');
const { test } = require('node:test');
const { migrateSettings, migrateApiKey, API_KEY_SECRET, API_KEY_MIGRATION } = require('../out/configMigration');

function settings(values) {
  const updates = [];
  return {
    values, updates,
    inspect: key => values[key],
    update(scope) {
      return async (key, value) => {
        updates.push([key, value, scope]);
        values[key] ??= {};
        if (value === undefined) delete values[key][scope];
        else values[key][scope] = value;
      };
    }
  };
}

test('Azure defaults migrate User settings and remove only copied sources', async () => {
  const config = settings({ azureEndpoint: { globalValue: 'https://azure.example.com' }, azureDeployment: { globalValue: 'deployment' }, openaiCompatibleModel: { globalValue: 'keep-me' } });
  await migrateSettings(config, 'globalValue', config.update('globalValue'));
  assert.equal(config.values.endpoint.globalValue, 'https://azure.example.com');
  assert.equal(config.values.model.globalValue, 'deployment');
  assert.equal(config.values.azureEndpoint.globalValue, undefined);
  assert.equal(config.values.openaiCompatibleModel.globalValue, 'keep-me');
  await migrateSettings(config, 'globalValue', config.update('globalValue'));
  assert.equal(config.updates.length, 4);
});

test('Workspace provider overrides User provider without losing scope', async () => {
  const config = settings({
    provider: { globalValue: 'azure', workspaceValue: 'openaiCompatible' },
    azureEndpoint: { globalValue: 'https://azure.example.com', workspaceValue: 'unused' },
    openaiCompatibleEndpoint: { workspaceValue: 'https://proxy.example.com/v1' },
    openaiCompatibleModel: { workspaceValue: 'gpt-6-luna' }
  });
  await migrateSettings(config, 'globalValue', config.update('globalValue'));
  await migrateSettings(config, 'workspaceValue', config.update('workspaceValue'));
  assert.deepEqual(config.values.endpoint, { globalValue: 'https://azure.example.com', workspaceValue: 'https://proxy.example.com/v1' });
  assert.equal(config.values.model.workspaceValue, 'gpt-6-luna');
  assert.equal(config.values.azureEndpoint.workspaceValue, 'unused');
});

test('Folder provider overrides are migrated at folder scope', async () => {
  const config = settings({
    provider: { workspaceValue: 'azure', workspaceFolderValue: 'openaiCompatible' },
    openaiCompatibleEndpoint: { workspaceFolderValue: 'http://localhost:4000' },
    openaiCompatibleModel: { workspaceFolderValue: 'folder-model' }
  });
  await migrateSettings(config, 'workspaceFolderValue', config.update('workspaceFolderValue'));
  assert.equal(config.values.endpoint.workspaceFolderValue, 'http://localhost:4000');
  assert.equal(config.values.model.workspaceFolderValue, 'folder-model');
});

test('explicit unified values, including empty values, are never overwritten', async () => {
  const config = settings({ endpoint: { globalValue: '' }, model: { globalValue: 'new-model' }, azureEndpoint: { globalValue: 'legacy-url' }, azureDeployment: { globalValue: 'old-model' } });
  await migrateSettings(config, 'globalValue', config.update('globalValue'));
  assert.deepEqual(config.updates, []);
  assert.equal(config.values.azureEndpoint.globalValue, 'legacy-url');
});

test('failed setting writes retain the legacy source', async () => {
  const config = settings({ azureEndpoint: { globalValue: 'legacy-url' } });
  await assert.rejects(migrateSettings(config, 'globalValue', async () => { throw new Error('write failed'); }), /write failed/);
  assert.equal(config.values.azureEndpoint.globalValue, 'legacy-url');
});

function storage(initial = {}) {
  const secrets = new Map(Object.entries(initial));
  const state = new Map();
  return {
    secrets, state,
    secretApi: { get: async key => secrets.get(key), store: async (key, value) => { secrets.set(key, value); } },
    stateApi: { get: key => state.get(key), update: async (key, value) => { state.set(key, value); } }
  };
}

test('only the selected provider secret migrates to the shared key', async () => {
  for (const provider of ['azure', 'openaiCompatible']) {
    const store = storage({ 'aicommitsummarizer.azureKey': 'azure-key', 'aicommitsummarizer.openaiCompatibleKey': 'proxy-key' });
    await migrateApiKey(store.secretApi, store.stateApi, provider);
    assert.equal(store.secrets.get(API_KEY_SECRET), provider === 'azure' ? 'azure-key' : 'proxy-key');
    assert.equal(store.state.get(API_KEY_MIGRATION), true);
    assert.equal(store.secrets.get('aicommitsummarizer.azureKey'), 'azure-key');
  }
});

test('existing shared key is preserved', async () => {
  const store = storage({ [API_KEY_SECRET]: 'new-key', 'aicommitsummarizer.azureKey': 'old-key' });
  await migrateApiKey(store.secretApi, store.stateApi, 'azure');
  assert.equal(store.secrets.get(API_KEY_SECRET), 'new-key');
});

test('reset keys are not resurrected on reload or provider switch', async () => {
  const store = storage({ 'aicommitsummarizer.azureKey': 'azure-key', 'aicommitsummarizer.openaiCompatibleKey': 'proxy-key' });
  await migrateApiKey(store.secretApi, store.stateApi, 'azure');
  store.secrets.delete(API_KEY_SECRET);
  await migrateApiKey(store.secretApi, store.stateApi, 'openaiCompatible');
  assert.equal(store.secrets.has(API_KEY_SECRET), false);
});

test('secret write failures leave migration retryable', async () => {
  const store = storage({ 'aicommitsummarizer.azureKey': 'old-key' });
  await assert.rejects(migrateApiKey({ ...store.secretApi, store: async () => { throw new Error('storage failed'); } }, store.stateApi, 'azure'), /storage failed/);
  assert.equal(store.state.has(API_KEY_MIGRATION), false);
  assert.equal(store.secrets.get('aicommitsummarizer.azureKey'), 'old-key');
});

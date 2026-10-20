export const API_KEY_SECRET = 'aicommitsummarizer.apiKey';
export const API_KEY_MIGRATION = 'aicommitsummarizer.apiKeyMigration.v1';

type Scope = 'globalValue' | 'workspaceValue' | 'workspaceFolderValue';
interface Configuration {
  inspect<T>(key: string): { defaultValue?: T; globalValue?: T; workspaceValue?: T; workspaceFolderValue?: T } | undefined;
}

// The caller supplies the VS Code scope target so this module can be tested
// without loading the extension host.
export async function migrateSettings(
  config: Configuration,
  scope: Scope,
  update: (key: string, value: string | undefined) => PromiseLike<void>
): Promise<void> {
  const provider = config.inspect<string>('provider');
  let selected = provider?.globalValue ?? provider?.defaultValue ?? 'azure';
  if (scope !== 'globalValue') selected = provider?.workspaceValue ?? selected;
  if (scope === 'workspaceFolderValue') selected = provider?.workspaceFolderValue ?? selected;
  if (selected !== 'azure' && selected !== 'openaiCompatible') return;

  const fields = selected === 'azure'
    ? [['azureEndpoint', 'endpoint'], ['azureDeployment', 'model']]
    : [['openaiCompatibleEndpoint', 'endpoint'], ['openaiCompatibleModel', 'model']];
  for (const [legacy, unified] of fields) {
    const value = config.inspect<string>(legacy)?.[scope];
    if (typeof value === 'string' && value.trim() && config.inspect<string>(unified)?.[scope] === undefined) {
      await update(unified, value);
      // Remove only the migrated source, and only after the new value is saved.
      await update(legacy, undefined);
    }
  }
}

interface Secrets {
  get(key: string): PromiseLike<string | undefined>;
  store(key: string, value: string): PromiseLike<void>;
}
interface State {
  get<T>(key: string): T | undefined;
  update(key: string, value: boolean): PromiseLike<void>;
}

export async function migrateApiKey(secrets: Secrets, state: State, provider: string): Promise<void> {
  if (state.get<boolean>(API_KEY_MIGRATION)) return;
  if (provider !== 'azure' && provider !== 'openaiCompatible') return;
  if (!await secrets.get(API_KEY_SECRET)) {
    const legacy = provider === 'azure' ? 'aicommitsummarizer.azureKey' : 'aicommitsummarizer.openaiCompatibleKey';
    const key = await secrets.get(legacy);
    if (key) await secrets.store(API_KEY_SECRET, key);
  }
  // Keep legacy secrets for recovery, but never import them again after reset.
  await state.update(API_KEY_MIGRATION, true);
}

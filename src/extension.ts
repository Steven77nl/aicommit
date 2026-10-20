import * as vscode from 'vscode';
import { exec } from 'child_process';
import { AiConfig, ApiProvider, GptVersion, providerName, requestSummary } from './aiClient';
import { API_KEY_SECRET, API_KEY_MIGRATION, migrateSettings, migrateApiKey } from './configMigration';

const MAX_DIFF_SIZE = 12000; // max characters for prompt

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('AI Commit');

  try {
    const config = vscode.workspace.getConfiguration('aicommitsummarizer');
    await migrateSettings(config, 'globalValue', (key, value) => config.update(key, value, vscode.ConfigurationTarget.Global));
    if (vscode.workspace.workspaceFolders?.length) {
      await migrateSettings(config, 'workspaceValue', (key, value) => config.update(key, value, vscode.ConfigurationTarget.Workspace));
      for (const folder of vscode.workspace.workspaceFolders) {
        const folderConfig = vscode.workspace.getConfiguration('aicommitsummarizer', folder.uri);
        await migrateSettings(folderConfig, 'workspaceFolderValue', (key, value) => folderConfig.update(key, value, vscode.ConfigurationTarget.WorkspaceFolder));
      }
    }
    await migrateApiKey(context.secrets, context.globalState, config.get<ApiProvider>('provider', 'azure'));
  } catch (error: any) {
    vscode.window.showErrorMessage(`AI Commit settings migration failed: ${error.message || error}. Legacy values have been retained where migration could not finish.`);
  }

  async function getSecret(key: string): Promise<string | undefined> {
    try {
      return await context.secrets.get(key);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to retrieve secret for key "${key}": ${error.message || error}`);
      return undefined;
    }
  }

  async function setSecret(key: string, value: string): Promise<void> {
    try {
      await context.secrets.store(key, value);
      vscode.window.showInformationMessage(`Secret stored successfully for key "${key}".`);
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to store secret for key "${key}": ${error.message || error}`);
      throw error;
    }
  }

  async function resetSecret(key: string): Promise<void> {
    try {
      await context.secrets.delete(key);
      vscode.window.showInformationMessage(`Secret cleared for key "${key}".`);
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to clear secret for key "${key}": ${error.message || error}`
      );
      throw error;
    }
  }

  async function resetApiKey(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      'Are you sure you want to reset the shared AI Commit API key for both providers?',
      { modal: true },
      'Yes',
      'No'
    );

    if (confirm !== 'Yes') {
      return;
    }

    await context.globalState.update(API_KEY_MIGRATION, true);
    await resetSecret(API_KEY_SECRET);
    vscode.window.showInformationMessage(
      'The shared API key has been reset. You will be prompted for a new key next time it is needed.'
    );
  }

  async function promptForApiKey(provider: ApiProvider): Promise<string | undefined> {
    const name = providerName(provider);
    const key = await vscode.window.showInputBox({
      prompt: `Enter your ${name} API Key`,
      ignoreFocusOut: true,
      password: true,
    });
    if (key) {
      try {
        await setSecret(API_KEY_SECRET, key);
        vscode.window.showInformationMessage(`${name} API key saved successfully.`);
      } catch (error) {
        // setSecret already shows error message and throws, so no need to duplicate here
      }
    }
    return key;
  }

  async function getApiKey(provider: ApiProvider): Promise<string | undefined> {
    let key = await getSecret(API_KEY_SECRET);
    if (!key) {
      key = await promptForApiKey(provider);
    }
    return key;
  }

  async function getConfig(): Promise<AiConfig | undefined> {
    try {
      const config = vscode.workspace.getConfiguration('aicommitsummarizer');
      const provider = config.get<ApiProvider>('provider', 'azure');
      if (provider !== 'azure' && provider !== 'openaiCompatible') {
        throw new Error('Please select a valid aicommitsummarizer.provider.');
      }
      const endpoint = config.get<string>('endpoint')?.trim();
      const model = config.get<string>('model')?.trim();
      const prompt = config.get<string>('userPrompt');
      const version = config.get<GptVersion>('gptVersion', 'GPT4');
      if (!endpoint || !model || !prompt?.trim()) {
        throw new Error('Please configure aicommitsummarizer.endpoint, aicommitsummarizer.model, and aicommitsummarizer.userPrompt.');
      }
      if (!['GPT4', 'GPT5', 'GPT6'].includes(version)) {
        throw new Error('Please select a valid aicommitsummarizer.gptVersion.');
      }
      if (provider === 'azure' && version === 'GPT6') {
        throw new Error('GPT6 requires aicommitsummarizer.provider to be openaiCompatible. Configure your LiteLLM endpoint and model.');
      }
      return { provider, endpoint, model, prompt, version };
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to retrieve configuration: ${error.message || error}`);
      return undefined;
    }
  }

  async function getGitRepoWithStaged() {
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
      if (!gitExtension) {
        vscode.window.showErrorMessage('Git extension is not available.');
        return undefined;
      }
      const api = gitExtension.getAPI(1);
      const repos = api?.repositories ?? [];
      if (repos.length === 0) {
        vscode.window.showErrorMessage('No Git repository found.');
        return undefined;
      }
      // Find first repository with Staged Changes
      const repoWithStaged = repos.find((r: any) => (r.state?.indexChanges?.length ?? 0) > 0);
      if (repoWithStaged) {
        return repoWithStaged
      }
      vscode.window.showInformationMessage('No staged changes found.');
      return undefined;

    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to get Git repository root: ${error.message || error}`);
      return undefined;
    }
  }

  async function getGitRoot(): Promise<string | undefined> {
    try {

      const repoWithStaged = await getGitRepoWithStaged()
      if (repoWithStaged) {
        return repoWithStaged.rootUri.fsPath;
      }
      vscode.window.showInformationMessage('No staged changes found.');
      return undefined;

    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to get Git repository root: ${error.message || error}`);
      return undefined;
    }
  }

  async function getStagedDiff(repoPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec('git diff --cached --unified=0', { cwd: repoPath }, (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          vscode.window.showErrorMessage(`Git diff command failed: ${stderr || error.message}`);
          reject(stderr || error.message);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  async function insertSummaryToCommitBox(summary: string) {
    try {
      const repoWithStaged = await getGitRepoWithStaged()

      if (repoWithStaged?.inputBox) {
        repoWithStaged.inputBox.value = summary;
        return; // Successfully inserted, no further work needed
      } else {
        vscode.window.showWarningMessage('Could not find Source Control input box to insert summary.');
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to insert AI summary into commit message box: ${error.message || error}`);
      throw error;
    }
  }

  async function generateSummary() {
    vscode.window.showInformationMessage('AI Commit Summary command triggered');
    const output = outputChannel;
    output.show(true);
    output.appendLine('Starting AI commit summary generation...');
    // The individual functions handle their own errors and notifications now
    try {
      const config = await getConfig();
      if (!config) {
        return;
      }
      const apiKey = await getApiKey(config.provider);
      if (!apiKey) {
        vscode.window.showErrorMessage(`${providerName(config.provider)} API key is required.`);
        return;
      }
      const repoPath = await getGitRoot();
      if (!repoPath) {
        return;
      }
      output.appendLine(`Using repo: ${repoPath}`);
      const diff = await getStagedDiff(repoPath);
      if (!diff) {
        vscode.window.showInformationMessage('No staged changes found.');
        return;
      }
      let userprompt = `${config.prompt}:\\n\\n${diff}`;
      if (userprompt.length > MAX_DIFF_SIZE) {
        userprompt = userprompt.slice(0, MAX_DIFF_SIZE) + '\\n\\n[Truncated]';
      }
      output.appendLine(`Calling ${providerName(config.provider)} (${config.model})...`);
      const summary = await requestSummary(config, apiKey, userprompt);
      output.appendLine('Summary received:');
      output.appendLine(summary);
      await insertSummaryToCommitBox(summary);
      vscode.window.showInformationMessage('AI commit summary inserted into commit message box.');
    } catch (err: any) {
      output.appendLine(`Error: ${err.message}`);
      vscode.window.showErrorMessage(`AI Commit Summarizer error: ${err.message}`);
    }
  }

  const disposable = vscode.commands.registerCommand(
    'aicommitsummarizer.generateSummary',
    generateSummary
  );

  const resetDisposable = vscode.commands.registerCommand(
    'aicommitsummarizer.resetApiKey',
    resetApiKey
  );

  context.subscriptions.push(disposable, resetDisposable);
}

export function deactivate() {}

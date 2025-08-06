import * as vscode from 'vscode';
import { exec } from 'child_process';
import fetch from 'node-fetch';

const MAX_DIFF_SIZE = 12000; // max characters for prompt

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('AI Commit');

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

  async function promptForApiKey(): Promise<string | undefined> {
    const key = await vscode.window.showInputBox({
      prompt: 'Enter your Azure OpenAI API Key',
      ignoreFocusOut: true,
      password: true,
    });
    if (key) {
      try {
        await setSecret('aicommit.azureKey', key);
        vscode.window.showInformationMessage('Azure OpenAI API key saved successfully.');
      } catch (error) {
        // setSecret already shows error message and throws, so no need to duplicate here
      }
    }
    return key;
  }

  async function getApiKey(): Promise<string | undefined> {
    let key = await getSecret('aicommit.azureKey');
    if (!key) {
      key = await promptForApiKey();
    }
    return key;
  }

  async function getConfig() {
    try {
      const config = vscode.workspace.getConfiguration('aicommit');
      const endpoint = config.get<string>('azureEndpoint');
      const deployment = config.get<string>('azureDeployment');
      if (!endpoint || !deployment) {
        vscode.window.showErrorMessage('Please configure aicommit.azureEndpoint and aicommit.azureDeployment in settings.');
        return { endpoint: undefined, deployment: undefined };
      }
      return { endpoint, deployment };
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to retrieve configuration: ${error.message || error}`);
      return { endpoint: undefined, deployment: undefined };
    }
  }

  async function getGitRoot(): Promise<string | undefined> {
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
      // Prefer the first repository that has staged (index) changes; otherwise fall back to the first repo
      const repoWithStaged = repos.find((r: any) => (r.state?.indexChanges?.length ?? 0) > 0);
      const targetRepo = repoWithStaged ?? repos[0];
      return targetRepo.rootUri.fsPath;
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

  async function callAzureOpenAI(endpoint: string, deployment: string, apiKey: string, prompt: string): Promise<string> {
    try {
      const url = `${endpoint.replace(/\/+$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=2023-05-15`;
      const body = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes git staged changes for commit messages.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.3,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        n: 1,
        stop: null
      };
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const errText = await response.text();
        vscode.window.showErrorMessage(`Azure OpenAI API error: ${response.status} ${response.statusText} - ${errText}`);
        throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText} - ${errText}`);
      }
      const data: any = await response.json();
      const summary = data.choices?.[0]?.message?.content;
      if (!summary) {
        vscode.window.showErrorMessage('No summary returned from Azure OpenAI');
        throw new Error('No summary returned from Azure OpenAI');
      }
      return summary.trim();
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to call Azure OpenAI: ${error.message || error}`);
      throw error;
    }
  }

  async function insertSummaryToCommitBox(summary: string) {
    try {
      // First try to use the Git extension API for direct access to the
      // repository-specific input box. This is more reliable than relying on
      // the global vscode.scm API which can be undefined if no providers are
      // registered yet.
      const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
      const repo = gitExtension?.getAPI(1)?.repositories?.[0];
      if (repo?.inputBox) {
        repo.inputBox.value = repo.inputBox.value
          ? repo.inputBox.value + '\\n\\n' + summary
          : summary;
        return; // Successfully inserted, no further work needed
      }

      // Fallback: ensure the Source Control view is visible and use the global
      // SCM input box.
      await vscode.commands.executeCommand('workbench.view.scm');
      const scmInput = vscode.scm.inputBox;
      if (scmInput) {
        scmInput.value = scmInput.value
          ? scmInput.value + '\\n\\n' + summary
          : summary;
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
      const { endpoint, deployment } = await getConfig();
      if (!endpoint || !deployment) {
        return;
      }
      const apiKey = await getApiKey();
      if (!apiKey) {
        vscode.window.showErrorMessage('Azure OpenAI API key is required.');
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
      let prompt = `Summarize these staged changes for a concise commit message:\\n\\n${diff}`;
      if (prompt.length > MAX_DIFF_SIZE) {
        prompt = prompt.slice(0, MAX_DIFF_SIZE) + '\\n\\n[Truncated]';
      }
      output.appendLine('Calling Azure OpenAI...');
      const summary = await callAzureOpenAI(endpoint, deployment, apiKey, prompt);
      output.appendLine('Summary received:');
      output.appendLine(summary);
      await insertSummaryToCommitBox(summary);
      vscode.window.showInformationMessage('AI commit summary inserted into commit message box.');
    } catch (err: any) {
      output.appendLine(`Error: ${err.message}`);
      vscode.window.showErrorMessage(`AI Commit Summarizer error: ${err.message}`);
    }
  }

  const disposable = vscode.commands.registerCommand('aicommit.generateSummary', generateSummary);
  context.subscriptions.push(disposable);
}

export function deactivate() {}

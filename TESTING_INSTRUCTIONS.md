# AI Commit Summarizer VS Code Extension - End-to-End Testing Instructions

This document provides step-by-step instructions to perform end-to-end testing of the AI Commit Summarizer VS Code extension on a sample git repository.

## Prerequisites

- VS Code with the AI Commit Summarizer extension installed (from this source).
- Azure OpenAI GPT-4 API key and configuration:
  - `aicommit.azureEndpoint` (e.g. https://your-resource.openai.azure.com/)
  - `aicommit.azureDeployment` (deployment name for GPT-4)
- Git installed and accessible in your system PATH.

## Test Setup

1. **Create a sample git repository:**

```bash
mkdir ~/aicommit-test-repo
cd ~/aicommit-test-repo
git init
echo "Initial content" > file.txt
git add file.txt
git commit -m "Initial commit"
```

2. **Make some changes and stage them:**

```bash
echo "Added line 1" >> file.txt
echo "Added line 2" >> file.txt
git add file.txt
```

3. **Open VS Code in the sample repo:**

```bash
code ~/aicommit-test-repo
```

4. **Configure the extension:**

- Open VS Code settings (`Ctrl+,` or `Cmd+,`).
- Search for `aicommit.azureEndpoint` and set your Azure OpenAI endpoint URL.
- Search for `aicommit.azureDeployment` and set your GPT-4 deployment name.
- The extension will prompt for your Azure OpenAI API key on first use; enter it when prompted.

## Testing Steps

### 1. Verify Button Appearance

- Open the Source Control view (`Ctrl+Shift+G` or `Cmd+Shift+G`).
- Confirm the button labeled "AI-Summarize Staged Changes" appears in the Source Control title bar.

### 2. Generate AI Commit Summary

- Click the "AI-Summarize Staged Changes" button.
- Observe the Output panel for "AI Commit" channel showing progress logs.
- Confirm that the staged changes are summarized by Azure OpenAI GPT-4.
- Confirm the AI-generated summary is inserted into the commit message box.

### 3. Test Error Handling

#### Missing Configuration

- Temporarily remove or clear `aicommit.azureEndpoint` or `aicommit.azureDeployment` in settings.
- Click the button again.
- Confirm an error message appears indicating missing configuration.

#### Missing API Key

- Clear the stored API key by running the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and executing:
  ```
  Developer: Open Secrets Storage
  ```
  Then remove the `aicommit.azureKey` entry.
- Click the button again.
- Confirm the extension prompts for the API key.
- Cancel the prompt to simulate missing API key.
- Confirm an error message appears indicating the API key is required.

## Notes and Improvements

- Observe any error messages or unexpected behavior.
- Note if the summary is accurate and concise.
- Check if the button is responsive and the UI updates correctly.
- Report any issues or suggestions for improvement.

---

These instructions should allow thorough end-to-end testing of the AI Commit Summarizer extension.

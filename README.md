# AI Commit Summarizer

AI Commit Summarizer is a Visual Studio Code extension that helps you generate concise commit messages by summarizing your staged git changes using Azure OpenAI GPT-4.

## Overview

This extension integrates with the Source Control view in VS Code and provides a button to generate AI-powered summaries of your staged changes. It uses the Azure OpenAI service to analyze your git diff and produce a meaningful commit message, saving you time and improving commit quality.

## Prerequisites

- A valid Azure OpenAI resource with GPT-4 deployment.
- Visual Studio Code version 1.70.0 or higher.
- Git installed and a git repository initialized in your workspace.

## Setup Instructions

1. **Configure Azure OpenAI Endpoint and Deployment**

   Open your VS Code settings (`File > Preferences > Settings` or `Ctrl+,`) and search for `aicommit`. Set the following configuration values:

   - `aicommit.azureEndpoint`: Your Azure OpenAI endpoint URL, e.g. `https://your-resource.openai.azure.com/`
   - `aicommit.azureDeployment`: The deployment name of your GPT-4 model in Azure OpenAI.

2. **Set Your Azure OpenAI API Key**

   The extension will prompt you to enter your Azure OpenAI API key the first time you use it. This key is stored securely in VS Code's secret storage.

   If you need to update or reset the key, you can clear it from VS Code's secret storage or reinstall the extension.

## Usage

1. Stage your changes in the Source Control view.
2. Click the **AI-Summarize Staged Changes** button in the Source Control title menu (the button appears when the git provider is active).
3. The extension will generate a commit message summary using Azure OpenAI and automatically insert it into the commit message input box.
4. Review and edit the generated commit message as needed, then commit your changes.

## Notes

- The extension limits the size of the staged diff sent to Azure OpenAI to avoid exceeding token limits.
- Ensure your Azure OpenAI resource has sufficient quota and permissions to use the GPT-4 deployment.
- Errors and status messages are shown in the VS Code output channel named "AI Commit" and as notifications.
- This extension currently supports only the first git repository in your workspace.

## License

MIT License

# AI Commit Summarizer

AI Commit Summarizer is a Visual Studio Code extension that generates concise commit messages from staged git changes using Azure OpenAI GPT-4/GPT-5 or GPT-6 versions through an OpenAI-compatible API such as LiteLLM.

## Overview

This extension integrates with the Source Control view in VS Code and provides a button to generate AI-powered summaries of your staged changes. It uses your selected API provider to analyze your git diff and produce a meaningful commit message.

## Prerequisites

- A LiteLLM/OpenAI-compatible endpoint with an available model and API key, or an Azure OpenAI resource with a GPT-4/GPT-5 deployment.
- Visual Studio Code version 1.70.0 or higher.
- Git installed and a git repository initialized in your workspace.

## Setup Instructions

### LiteLLM / OpenAI-compatible API (GPT-6)

Open VS Code settings and search for AI Commit Summarizer. Configure these settings in [the extension configuration](package.json):

| Setting | Value |
| --- | --- |
| Provider | **openaiCompatible** |
| Endpoint | Your API base URL, for example http://localhost:4000 or https://your-litellm.example.com/v1 |
| Model | The exact model name or alias exposed by your LiteLLM proxy for the desired GPT-6 version |
| Gpt Version | **GPT6** |

The endpoint is a base URL: the extension appends **/chat/completions**. Include **/v1** only if your proxy requires it; do not enter the full completion URL. Use HTTPS for remote proxies to protect your API key and staged changes.

The model is a free-form name, so different GPT-6 versions and custom LiteLLM aliases work without an extension update. The alias must already be configured and available in your proxy. GPT6 selects reasoning-oriented request parameters (a completion-token budget and low reasoning effort), without temperature or sampling penalties. GPT4 and GPT5 can also use this provider by selecting their corresponding family.

On first use, enter your **LiteLLM proxy API key**, not an Azure key. The extension sends it using Bearer authentication and stores it in VS Code secret storage. Both providers use the same Endpoint, Model, and stored API Key; only the request URL format and authentication scheme depend on Provider.

### Migration from older settings

On activation, the selected provider's legacy endpoint and model/deployment values are copied into the shared Endpoint and Model fields at their original User, Workspace, or Workspace Folder scope. Existing explicitly configured shared values are never overwritten, including intentionally empty values. Successfully copied legacy settings are removed; unused or conflicting legacy settings are retained and marked deprecated.

The selected provider's old API key is copied once into the shared secure key if no shared key exists. Old keys are retained for recovery but are not automatically restored after a reset or provider switch. API keys are never written to settings or logged.

Switching Provider does not switch credentials or restore old endpoints/models. Update Endpoint and Model, and run **AI Commit: Reset API Key** to enter the new provider's key when needed. The shared key is stored once for the extension, not separately for each workspace.

#### Troubleshooting LiteLLM routing and unsupported parameters

For the GPT-6 Luna alias, select **Provider: openaiCompatible**, **Gpt Version: GPT6**, and **Model: gpt-6-luna**. Set **Endpoint** to your LiteLLM base URL. Use this provider even if LiteLLM routes the model to Azure internally; the extension should communicate with the proxy using the OpenAI-compatible API, not Azure deployment URLs.

If the extension reports **Azure OpenAI API error** or logs **Calling Azure OpenAI**, check the provider setting in both User and Workspace settings (a workspace override can keep Azure selected). Rebuild and reinstall the updated extension, then reload the VS Code window if an older version is still running.

The extension omits presence and frequency penalties from all requests, including zero-valued penalties, because LiteLLM rejects them for some reasoning models. No proxy-side parameter-dropping workaround is needed for these parameters.

### Azure OpenAI (existing users)

Azure remains the default provider. Existing settings and the selected provider's stored key are migrated automatically. GPT6 must use the OpenAI-compatible provider.

1. **Configure Azure OpenAI Settings**

   Open your VS Code settings (`File > Preferences > Settings` or `Ctrl+,`) and search for `aicommit`. Set the following configuration values:

   - **Provider:** azure.
   - **Endpoint:** Your Azure OpenAI resource URL, for example https://your-resource.openai.azure.com/.
   - **Model:** The Azure deployment name for your GPT-4 or GPT-5 model.
   - `aicommitsummarizer.gptVersion`: Which GPT Version is being used (GPT-4 or GPT-5) as they have different API requirements. Default is GPT-4.
   - `aicommitsummarizer.userPrompt`: (Optional) Instruction prompt that will be prepended to your staged diff before it is sent to Azure OpenAI. Use this to tailor the style, tone, or length of the generated commit message.

2. **Set Your Azure OpenAI API Key**

   The extension will prompt you to enter your Azure OpenAI API key the first time you use it. This key is stored securely in VS Code's secret storage.

   To update or reset the shared key, run **AI Commit: Reset API Key** from the Command Palette. This resets the key used by both providers.

## Usage

1. Stage your changes for one of your repositories in the Source Control view.
2. Click the **AIC** button in the Source Control title menu (the button appears when the git provider is active).
3. The extension will generate a commit message summary using your selected provider and automatically insert it into the commit message input box.
4. Review and edit the generated commit message as needed, then commit your changes.

## Notes

- The extension limits the size of the staged diff sent to the API to avoid exceeding token limits. Staged content is sent to the configured provider; review it for sensitive data before generating a summary.
- Ensure your selected provider has sufficient quota and permissions to use the configured model.
- Errors and status messages are shown in the VS Code output channel named "AI Commit" and as notifications.
- This extension supports multiple repositories in a project, it will act on the first git repository found with staged changes.

## License

MIT License

# AI Commit Summarizer: End-to-End Testing

## Prerequisites

- VS Code with the rebuilt extension installed and the window reloaded.
- A Git repository with staged changes.
- A LiteLLM/OpenAI-compatible proxy or an Azure OpenAI resource with a working model and API key.
- Follow [the setup guide](README.md) for configuration.

## Unified configuration

1. In AI Commit Summarizer settings, select Provider, set Endpoint to the API base URL, and set Model to the Azure deployment name or LiteLLM model alias.
2. Select the appropriate Gpt Version. For GPT-6 Luna, choose openaiCompatible, GPT6, and model gpt-6-luna.
3. Click **AIC** in Source Control. Enter the selected service's API key when prompted.
4. Verify the AI Commit output identifies the provider and model, and a summary appears in the commit input box.
5. For LiteLLM, inspect proxy logs: the request uses the configured base path plus **/chat/completions**, Bearer authentication, and the exact model alias. It must not contain Azure deployment paths, an Azure API-version query, or presence/frequency penalties.
6. For Azure GPT4/GPT5, verify deployment-based routing and Azure API-key authentication.

## Migration

Use a test profile or back up your settings before these checks.

1. With unified Endpoint and Model unset, configure legacy Azure endpoint/deployment values at User scope. Select Azure and reload the extension. Confirm shared Endpoint/Model are populated at User scope and copied legacy fields are removed.
2. Repeat with legacy compatible endpoint/model values and the compatible provider at Workspace scope. Confirm Workspace values are migrated without modifying User values.
3. In a multi-root workspace, repeat with folder-specific provider overrides and legacy settings. Confirm folder settings remain at their original scope.
4. Set shared Endpoint or Model explicitly before migration, including an empty value. Confirm it is not overwritten and the conflicting legacy value remains available for recovery.
5. With both providers' legacy values present, verify that only the selected provider's values are copied at each scope.
6. On the first activation with this migration, confirm the selected provider's old stored key works without prompting, unless a shared key already exists. Existing shared keys must be preserved.
7. Run **AI Commit: Reset API Key**, then reload. Confirm the next generation prompts for a new key rather than silently restoring a legacy key.

## Provider switching and errors

- Switching Provider alone must not change Endpoint, Model, or the shared key. Set the new service's Endpoint/Model and reset the shared key when changing credentials.
- Clear Endpoint or Model: generation should report missing unified settings.
- Reset the shared key and cancel the next key prompt: generation should report that a key is required.
- Use an invalid key: the error should identify the selected provider.
- Select Azure with GPT6: generation should report that GPT6 requires the compatible provider without making an Azure request.
- With no staged changes, generation should not insert a summary.

Automated request and migration tests are described in [the test guide](test/README.md). Live service testing is still required to verify model availability and supported reasoning parameters.

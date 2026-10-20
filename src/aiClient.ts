import fetch from 'node-fetch';
import { URL } from 'url';

export type ApiProvider = 'azure' | 'openaiCompatible';
export type GptVersion = 'GPT4' | 'GPT5' | 'GPT6';

export interface AiConfig {
  provider: ApiProvider;
  endpoint: string;
  model: string;
  version: GptVersion;
  prompt: string;
}

export function providerName(provider: ApiProvider): string {
  return provider === 'azure' ? 'Azure OpenAI' : 'OpenAI-compatible (LiteLLM)';
}

export function buildChatRequest(config: AiConfig, apiKey: string, prompt: string) {
  const endpoint = new URL(config.endpoint);
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.search || endpoint.hash || endpoint.username || endpoint.password) {
    throw new Error('API endpoint must be an HTTP(S) base URL without credentials, a query string, or a fragment.');
  }
  if (config.provider === 'azure' && config.version === 'GPT6') {
    throw new Error('GPT6 requires the openaiCompatible provider. Configure your LiteLLM endpoint and model.');
  }

  const baseUrl = config.endpoint.replace(/\/+$/, '');
  const isAzure = config.provider === 'azure';
  const url = isAzure
    ? `${baseUrl}/openai/deployments/${encodeURIComponent(config.model)}/chat/completions?api-version=${config.version === 'GPT5' ? '2025-04-01-preview' : '2023-05-15'}`
    : `${baseUrl}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (isAzure) {
    headers['api-key'] = apiKey;
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const body = {
    ...(!isAzure ? { model: config.model } : {}),
    messages: [
      { role: 'system', content: 'You are a helpful assistant that summarizes git staged changes for commit messages.' },
      { role: 'user', content: prompt }
    ],
    // Omit penalties entirely: LiteLLM rejects them for some reasoning models,
    // even when their values are zero.
    ...(config.version === 'GPT4'
      ? { max_tokens: 300, temperature: 0.3, top_p: 1 }
      : { max_completion_tokens: 500, reasoning_effort: 'low' }),
    n: 1
  };
  return { url, headers, body };
}

export async function requestSummary(config: AiConfig, apiKey: string, prompt: string): Promise<string> {
  const { url, headers, body } = buildChatRequest(config, apiKey, prompt);
  const name = providerName(config.provider);
  // Preserve the existing retry for a reasoning response with no visible content.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${name} API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const data: any = await response.json();
    const summary = data.choices?.[0]?.message?.content;
    if (typeof summary === 'string' && summary.trim()) {
      return summary.trim();
    }
  }
  throw new Error(`No summary returned from ${name}`);
}

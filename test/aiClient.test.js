const assert = require('node:assert/strict');
const http = require('node:http');
const { test } = require('node:test');
const { buildChatRequest, requestSummary } = require('../out/aiClient');

const config = {
  provider: 'openaiCompatible',
  endpoint: 'https://litellm.example.com/v1/',
  model: 'my-gpt-6.1-alias',
  version: 'GPT6',
  prompt: 'Summarize changes'
};

test('GPT6 uses OpenAI-compatible routing, Bearer authentication, and the exact model alias', () => {
  const request = buildChatRequest(config, 'proxy-key', 'staged diff');
  assert.equal(request.url, 'https://litellm.example.com/v1/chat/completions');
  assert.equal(request.headers.Authorization, 'Bearer proxy-key');
  assert.equal(request.headers['api-key'], undefined);
  assert.equal(request.body.model, config.model);
  assert.equal(request.body.messages[1].content, 'staged diff');
  assert.equal(request.body.max_completion_tokens, 500);
  assert.equal(request.body.reasoning_effort, 'low');
  for (const parameter of ['max_tokens', 'temperature', 'top_p', 'frequency_penalty', 'presence_penalty']) {
    assert.equal(request.body[parameter], undefined);
  }
});

test('LiteLLM root base URLs do not gain an unwanted /v1 prefix', () => {
  const request = buildChatRequest({ ...config, endpoint: 'http://localhost:4000///' }, 'key', 'diff');
  assert.equal(request.url, 'http://localhost:4000/chat/completions');
});

test('GPT6 model versions and aliases are passed through unchanged', () => {
  for (const model of ['gpt-6', 'gpt-6.1', 'team/custom-model']) {
    assert.equal(buildChatRequest({ ...config, model }, 'key', 'diff').body.model, model);
  }
});

test('Azure GPT4 keeps its API version, authentication, and sampling parameters', () => {
  const request = buildChatRequest({ ...config, provider: 'azure', version: 'GPT4', endpoint: 'https://example.openai.azure.com/', model: 'my deployment' }, 'azure-key', 'diff');
  assert.equal(request.url, 'https://example.openai.azure.com/openai/deployments/my%20deployment/chat/completions?api-version=2023-05-15');
  assert.equal(request.headers['api-key'], 'azure-key');
  assert.equal(request.headers.Authorization, undefined);
  assert.equal(request.body.model, undefined);
  assert.equal(request.body.max_tokens, 300);
  assert.equal(request.body.temperature, 0.3);
});

test('Azure GPT5 keeps its preview API version and reasoning parameters', () => {
  const request = buildChatRequest({ ...config, provider: 'azure', version: 'GPT5' }, 'key', 'diff');
  assert.match(request.url, /api-version=2025-04-01-preview$/);
  assert.equal(request.body.max_completion_tokens, 500);
  assert.equal(request.body.reasoning_effort, 'low');
  assert.equal(request.body.frequency_penalty, undefined);
  assert.equal(request.body.presence_penalty, undefined);
  assert.equal(request.body.temperature, undefined);
});

test('penalties are omitted for every provider and model family', () => {
  for (const provider of ['azure', 'openaiCompatible']) {
    for (const version of ['GPT4', 'GPT5', 'GPT6']) {
      if (provider === 'azure' && version === 'GPT6') continue;
      const { body } = buildChatRequest({ ...config, provider, version }, 'key', 'diff');
      assert.equal(Object.hasOwn(body, 'presence_penalty'), false);
      assert.equal(Object.hasOwn(body, 'frequency_penalty'), false);
    }
  }
});

test('GPT4 and GPT5 also support OpenAI-compatible requests', () => {
  for (const version of ['GPT4', 'GPT5']) {
    const request = buildChatRequest({ ...config, version }, 'key', 'diff');
    assert.equal(request.body.model, config.model);
    assert.equal(request.url, 'https://litellm.example.com/v1/chat/completions');
  }
});

test('GPT6 cannot accidentally use Azure routing', () => {
  assert.throws(() => buildChatRequest({ ...config, provider: 'azure' }, 'key', 'diff'), /GPT6 requires the openaiCompatible provider/);
});

test('invalid or ambiguous endpoint URLs are rejected', () => {
  for (const endpoint of ['not a url', 'ftp://example.com', 'https://example.com?key=value', 'https://example.com/#fragment', 'https://user:password@example.com']) {
    assert.throws(() => buildChatRequest({ ...config, endpoint }, 'key', 'diff'));
  }
});

async function mockApi(t, handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { ...config, endpoint: `http://127.0.0.1:${server.address().port}/v1` };
}

test('summary requests send valid JSON and return trimmed response content', async t => {
  let received;
  const localConfig = await mockApi(t, (req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      received = { method: req.method, path: req.url, headers: req.headers, body: JSON.parse(body) };
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: '  Add GPT6 support\n' } }] }));
    });
  });
  assert.equal(await requestSummary(localConfig, 'test-key', 'diff content'), 'Add GPT6 support');
  assert.equal(received.method, 'POST');
  assert.equal(received.path, '/v1/chat/completions');
  assert.equal(received.headers.authorization, 'Bearer test-key');
  assert.equal(received.headers['content-type'], 'application/json');
  assert.equal(received.body.model, config.model);
  assert.equal(received.body.messages[1].content, 'diff content');
});

test('GPT6 Luna works through a LiteLLM-style API that rejects penalties', async t => {
  let received;
  const localConfig = await mockApi(t, (req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      received = { path: req.url, headers: req.headers, body: JSON.parse(body) };
      if ('presence_penalty' in received.body || 'frequency_penalty' in received.body) {
        res.writeHead(400);
        res.end('litellm.UnsupportedParamsError: azure does not support penalties');
        return;
      }
      res.end(JSON.stringify({ choices: [{ message: { content: 'Fix LiteLLM requests' } }] }));
    });
  });
  assert.equal(await requestSummary({ ...localConfig, model: 'gpt-6-luna' }, 'proxy-key', 'diff'), 'Fix LiteLLM requests');
  assert.equal(received.body.model, 'gpt-6-luna');
  assert.equal(received.path, '/v1/chat/completions');
  assert.equal(received.headers.authorization, 'Bearer proxy-key');
  assert.equal(received.headers['api-key'], undefined);
});

test('an empty reasoning response is retried once', async t => {
  let calls = 0;
  const localConfig = await mockApi(t, (req, res) => {
    calls++;
    res.end(JSON.stringify({ choices: [{ message: { content: calls === 1 ? null : 'Summary' } }] }));
  });
  assert.equal(await requestSummary(localConfig, 'key', 'diff'), 'Summary');
  assert.equal(calls, 2);
});

test('missing or whitespace-only summaries fail after two attempts', async t => {
  let calls = 0;
  const localConfig = await mockApi(t, (req, res) => {
    calls++;
    res.end(JSON.stringify({ choices: [{ message: { content: '  ' } }] }));
  });
  await assert.rejects(requestSummary(localConfig, 'key', 'diff'), /No summary returned from OpenAI-compatible/);
  assert.equal(calls, 2);
});

test('HTTP failures report provider and response details without retrying', async t => {
  let calls = 0;
  const localConfig = await mockApi(t, (req, res) => {
    calls++;
    res.writeHead(401);
    res.end('Invalid proxy key');
  });
  await assert.rejects(requestSummary(localConfig, 'key', 'diff'), /OpenAI-compatible \(LiteLLM\) API error: 401 Unauthorized - Invalid proxy key/);
  assert.equal(calls, 1);
});

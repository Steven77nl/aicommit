# Automated API tests

Run the project test command with npm. The pretest step compiles the TypeScript sources, then the Node test runner executes [the API tests](aiClient.test.js).

Tests cover Azure GPT-4/GPT-5 compatibility, GPT-6 request parameters, arbitrary model aliases, endpoint paths, provider-specific authentication, response parsing, empty-response retries, and HTTP errors. HTTP tests use a local mock server; no API key or external service is required. The test runner requires Node.js 18 or newer.

[Migration tests](configMigration.test.js) also verify scope preservation, provider precedence, existing-value protection, failed-write recovery, shared-key migration, and prevention of legacy-key restoration after reset.

# Changelog
All notable changes to this project will be documented here.

## [0.3.2] - 2026-10-20
### Fixed
- Omit presence and frequency penalties from all API requests to avoid LiteLLM unsupported-parameter errors, including reasoning requests made with Azure settings.

### Added
- OpenAI-compatible Chat Completions support for LiteLLM with configurable endpoint and model aliases.
- GPT-6 family support, including version-specific model names exposed by the proxy.
- Unified endpoint, model/deployment name, and secure API-key storage for both providers, with automatic migration from legacy fields.
- Automated request and response tests with a local mock API.

### Changed
- The API-key reset command now resets the shared key without reimporting legacy keys on reload.
- Legacy endpoint/model settings are migrated at their original configuration scope without overwriting explicitly configured unified values. Azure remains the default provider.

## [0.2.9] - 2026-02-06
### Fixed
- Shorten the button name to 'AIC'

## [0.2.8] - 2026-01-29
### Added
- Added an Command Palette command to reset the API key.

## [0.2.4] - 2025-08-10
### Fixed
- Fixed issue with intermitted 'No summary returned from Azure OpenAI' when using GPT5 model.

## [0.2.1] - 2025-08-10
### Added
- Support for the new Azure OpenAI GPT-5 model.

## [0.1.9] - 2025-08-07
### Fixed
- When multiple repositories in one project, don't use the first repository found, but detect first repository with staged changes.

## [0.1.8] - 2025-08-07
### Added
- Initial published version with Azure OpenAI GPT-4 support.

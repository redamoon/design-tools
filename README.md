# Design System Linter

A CLI tool to lint Design System tokens exported from Figma (e.g., via Figma Tokens / Token Studio). Combines static analysis with AI-powered semantic checks.

## Features

- **Token Normalization**: Reads `tokens.json` and normalizes them for analysis.
- **Static Rules**: Checks for naming conventions, raw color/pixel values, and duplicates.
- **AI Rules**: Uses LLMs (OpenAI/Gemini) to check semantic consistency, spacing alignment, and design complexity.
- **CLI**: Run locally or in CI/CD.
- **Code Analysis**: Analyzes code files to detect raw values and suggest design tokens.

## Quick Start

1.  **Install dependencies**:
    ```bash
    pnpm install
    ```

2.  **Environment Setup** (Optional, for AI features):
    Create a `.env` file in the project root:
    ```bash
    OPENAI_API_KEY=sk-...
    # OR
    GEMINI_API_KEY=AIza...
    ```

3.  **Run the linter**:
    ```bash
    # Development mode
    pnpm dev lint
    # Or build and run
    pnpm build
    pnpm start lint
    ```

4.  **Sync tokens from Figma** (Optional):
    ```bash
    pnpm start sync --key <file_key> --token <access_token>
    ```

5.  **Run tests**:
    ```bash
    pnpm test
    ```

6.  **Configuration**:
    Edit `designlintrc.json` to configure rules.

## Project Structure

This is a monorepo managed with pnpm workspaces:

- `packages/design-ai-linter/`: Main linter package
  - `src/adapters`: Logic to read tokens from files/APIs.
  - `src/rules`: Linter rules (static and AI-powered).
  - `src/cli`: CLI entry point.
  - `src/engine`: Static runner, AI runner, and candidate selector.
- `example/`: Example React application demonstrating linter usage

## Adding Rules

Create a new file in `packages/design-ai-linter/src/rules/` and export a function that takes `Token[]` and returns `Diagnostic[]`. Then register it in `packages/design-ai-linter/src/cli/cli.ts`.

For detailed architecture and AI implementation details, see [WALKTHROUGH.md](./WALKTHROUGH.md) and [ARCHITECTURE.md](./ARCHITECTURE.md).

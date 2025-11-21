# Design System Linter

A CLI tool to lint Design System tokens exported from Figma (e.g., via Figma Tokens / Token Studio).

## Features

- **Token Normalization**: Reads `tokens.json` and normalizes them for analysis.
- **Rule Engine**: Checks for naming conventions, color contrast (coming soon), and duplicates.
- **CLI**: Run locally or in CI/CD.

## Quick Start

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Run the linter**:
    ```bash
    npm run dev
    # or
    npm run build
    npm start
    ```

3.  **Configuration**:
    Edit `designlintrc.json` to configure rules.

## Project Structure

- `src/adapters`: Logic to read tokens from files/APIs.
- `src/rules`: Linter rules (e.g., naming convention).
- `src/cli`: CLI entry point.

## Adding Rules

Create a new file in `src/rules/` and export a function that takes `Token[]` and returns `Diagnostic[]`. Then register it in `src/cli/cli.ts`.

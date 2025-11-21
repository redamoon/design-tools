# AI Design System Linter - Walkthrough & Handover

## 🚀 Project Overview

This project is an **AI-powered Design System Linter** that bridges the gap between Figma design tokens and implementation code. It uses a 3-layer architecture:

1.  **Token Sync Layer**: Fetches and normalizes tokens from Figma.
2.  **Static Lint Layer**: Checks for deterministic issues (naming conventions, raw values).
3.  **AI Lint Layer**: Uses LLMs (OpenAI) to check for semantic consistency, complexity, and design intent.

## 🛠️ Setup & Installation

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Setup**:
    Create a `.env` file:
    ```bash
    OPENAI_API_KEY=sk-...
    FIGMA_FILE_KEY=...       # Optional: for sync
    FIGMA_ACCESS_TOKEN=...   # Optional: for sync
    ```

## 💻 Usage

### 1. Sync Tokens from Figma
Fetches variables from Figma and saves them to `tokens.json`.
```bash
npm start sync -- --key <file_key> --token <access_token>
# OR if env vars are set:
npm start sync
```

### 2. Run Linter (Static + AI)
Analyzes `tokens.json` using both static rules and AI rules.
```bash
npm start lint
```

## 🏗️ Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed diagrams.

-   **`src/sync/`**: Figma API integration.
-   **`src/engine/`**:
    -   `staticRunner.ts`: Executes regex/logic-based rules.
    -   `candidateSelector.ts`: Filters tokens for AI analysis.
    -   `aiRunner.ts`: Orchestrates OpenAI calls.
-   **`src/rules/`**:
    -   `naming-convention.ts`: Static rule.
    -   `ai/`: AI prompts (Semantic Naming, Spacing, Complexity).

## 🤖 AI Rules Implemented

1.  **Semantic Naming**: Checks if token names follow a consistent hierarchy and vocabulary.
2.  **Spacing Consistency**: Verifies if spacing tokens align with a 4px/8px grid.
3.  **Design Complexity**: Evaluates the cognitive load and redundancy of the system.

## 🔄 CI/CD

The project includes a GitHub Actions workflow (`.github/workflows/lint.yml`) that:
1.  Builds the project.
2.  Runs the linter on Pull Requests.
3.  (Optional) Syncs tokens if keys are provided.

## 📝 Next Steps

-   **Implement Advanced Reporting**: Output JSON/HTML for better CI integration.
-   **Expand Static Rules**: Add color contrast checks (WCAG).
-   **Figma Plugin**: Create a UI to run this directly in Figma.

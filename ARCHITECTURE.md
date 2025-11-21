# AI Design System Linter - Architecture

> [!IMPORTANT]
> This document outlines the system architecture for the AI-powered Design System Linter, combining static analysis with AI-driven intent verification.

## ① Overall Architecture

```mermaid
flowchart LR
    A[Figma Design<br>• Variables<br>• Components] 
        --> B[Token Sync Layer<br>Token Extractor]
    B --> C[Token Registry(JSON)]
    C --> D[Static Lint Layer<br>ESLint/Tailwind/Stylelint]
    D --> E[AI Candidate Selector<br>Extract Deviations]

    E --> F[AI Lint Engine<br>LLM(Claude/GPT/Gemini)]
    F --> G[Lint Report<br>• Reason<br>• Token Proposal<br>• Fixed Code]

    G --> H[Output<br>• CLI<br>• GitHub PR Comment<br>• HTML Report]
```

## ② Data Flow: Static Lint → AI Lint

```mermaid
sequenceDiagram
    autonumber

    participant FE as Frontend Code
    participant SL as Static Lint
    participant CS as Candidate Selector
    participant AI as AI Lint Engine
    participant OUT as Output Module

    FE ->> SL: Code Analysis (AST / Regex / Tailwind)
    SL ->> CS: Candidates (JSON)
    CS ->> AI: Send with Token & Figma Spec
    AI ->> OUT: AI Evaluation (Proposal/Reason/Code)
    OUT ->> FE: PR Comment or CLI Result
```

## ③ AI Internal Model

```mermaid
classDiagram
    class TokenRegistry {
        +colors: map
        +spacing: map
        +radii: map
        +shadows: map
    }

    class FigmaSpec {
        +componentName: string
        +intendedTokens: map
        +states: map
        +documentation: string
    }

    class CodeContext {
        +codeSnippet: string
        +ast: object
        +filePath: string
    }

    class AIResult {
        +issue: string
        +reason: string
        +suggestedToken: string
        +fixedCode: string
        +impact: string
    }

    TokenRegistry <.. AIResult : uses
    FigmaSpec <.. AIResult : uses
    CodeContext <.. AIResult : uses
```

## ④ GitHub Action / CI Integration

```mermaid
flowchart TD
    PR[Pull Request Open] --> CI[GitHub Actions]

    CI --> SYNC[Sync Tokens<br>Figma API]
    SYNC --> STATIC[Static Lint]
    STATIC --> AI_LINT[AI Lint Engine]
    AI_LINT --> COMMENT[PR Comment Bot]

    COMMENT --> PR
```

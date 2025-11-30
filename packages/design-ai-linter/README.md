# Design AI Linter

FigmaからエクスポートされたDesign Systemトークン（例：Figma Tokens / Token Studio経由）をリントするCLIツールです。静的解析とAIによる意味解析を組み合わせて、デザイントークンの品質を保証します。

## 機能

- **トークン正規化**: `tokens.json`を読み込み、解析用に正規化します
- **静的ルール**: 命名規則、生のカラー/ピクセル値、重複をチェックします
- **AIルール**: LLM（OpenAI/Gemini）を使用して、意味的な一貫性、スペーシングの整合性、デザインの複雑さをチェックします
- **コード解析**: コードファイルを解析して生の値を検出し、デザイントークンへの置き換えを提案します
- **カスタムプロンプト**: 任意のプロンプトファイルを読み込んでAIに送信し、トークン情報をコンテキストとして含めて実行できます
- **Figma同期**: Figma APIから直接トークンを同期できます
- **レポート出力**: JSON形式やPRコメント形式でレポートを出力できます

## インストール

```bash
pnpm install
```

## セットアップ

### 環境変数の設定（AI機能を使用する場合）

プロジェクトルートに`.env`ファイルを作成し、以下のいずれかを設定します：

```bash
OPENAI_API_KEY=sk-...
# または
GEMINI_API_KEY=AIza...
```

### 設定ファイルの作成

プロジェクトルートに`designlintrc.json`を作成します：

```json
{
  "source": {
    "type": "tokensJson",
    "path": "./tokens.json"
  },
  "rules": {
    "naming-convention": {
      "severity": "error",
      "pattern": "^([a-z]+)(\\.[a-z0-9\\-]+)*$"
    }
  },
  "report": {
    "format": ["console"],
    "outputPath": "./reports"
  }
}
```

## 使用方法

### 基本的なリント

```bash
# 開発モード
pnpm dev lint

# ビルドして実行
pnpm build
pnpm start lint
```

**デフォルト動作**: `lint`コマンドは、デフォルトでステージングされたファイルのみをチェックします。

### オプション

```bash
# カスタム設定ファイルを指定
dslint lint --config ./custom-config.json

# カスタムトークンファイルを指定
dslint lint --source ./custom-tokens.json

# コードファイルを解析（明示的に指定した場合）
dslint lint --files "src/**/*.{tsx,css}"

# ステージングされたファイルのみをチェック（デフォルト動作）
dslint lint --staged

# コミット範囲の差分のみをチェック
dslint lint --commit-diff HEAD~1..HEAD
dslint lint --commit-diff main..HEAD

# AIモデルを指定
dslint lint --model gpt-4o
dslint lint --model gemini-3-pro-preview

# JSONレポートを出力
dslint lint --json ./report.json

# PRコメント形式で出力
dslint lint --pr-comment
```

### fixコマンド

`fix`コマンドは、デフォルトで全ファイルを横断的にチェックします：

```bash
# 全ファイルをチェック
dslint fix

# ステージングされたファイルのみをチェック
dslint fix --staged

# コミット範囲の差分のみをチェック
dslint fix --commit-diff HEAD~1..HEAD

# 特定のモデルを指定
dslint fix --model gemini-2.5-flash

# コードファイルパターンを指定
dslint fix --files "src/**/*.{tsx,css}"
```

### カスタムプロンプトの実行

カスタムプロンプトファイルを使用して、AIにトークン分析を実行させることができます：

```bash
# 基本的な使用方法
dslint lint --prompt-file prompt.txt

# JSON形式で出力
dslint lint --prompt-file prompt.txt --prompt-output-json

# カスタムトークンファイルを指定
dslint lint --source ./custom-tokens.json --prompt-file prompt.txt

# 特定のモデルを指定
dslint lint --prompt-file prompt.txt --model gpt-4o
```

プロンプトファイル内で`{{TOKENS}}`プレースホルダーを使用すると、その位置にトークン情報が挿入されます。使用しない場合は、プロンプトの末尾に自動的に追加されます。

### Figmaからトークンを同期

```bash
# コマンドライン引数で指定
dslint sync --key <file_key> --token <access_token> --output ./tokens.json

# 環境変数で指定（.envファイルに設定）
FIGMA_FILE_KEY=xxx
FIGMA_ACCESS_TOKEN=xxx
dslint sync --output ./tokens.json
```

## Git差分のチェック

### lintコマンドのデフォルト動作

`lint`コマンドは、デフォルトでステージングされたファイルのみをチェックします。これにより、CI/CDパイプラインやpre-commitフックでの使用に適しています。

### コミット範囲の指定

特定のコミット範囲の差分のみをチェックできます：

```bash
# 直前のコミットとの差分
dslint lint --commit-diff HEAD~1..HEAD

# mainブランチとの差分
dslint lint --commit-diff main..HEAD

# 特定のコミット間の差分
dslint lint --commit-diff abc123..def456
```

### fixコマンドでの全ファイルチェック

`fix`コマンドは、デフォルトで全ファイルを横断的にチェックします。これにより、プロジェクト全体のリファクタリングや一括修正に適しています。

## AIモデルの指定

### 利用可能なモデル

**OpenAI:**
- `gpt-4o` (推奨)
- `gpt-4-turbo`
- `gpt-4-turbo-preview`
- `gpt-3.5-turbo`

**Gemini:**
- `gemini-3-pro-preview` (推奨)
- `gemini-2.5-flash`
- `gemini-1.5-flash`
- `gemini-pro`

### モデルの指定方法

```bash
# 特定のモデルを指定
dslint lint --model gpt-4o
dslint fix --model gemini-3-pro-preview

# モデルを指定しない場合、デフォルトの優先順位で自動的に試行されます
dslint lint
```

モデルを指定した場合でも、クォータ超過（429）やモデルが見つからない（404）エラーが発生した場合は、自動的に次のモデルにフォールバックします。

## ルール

### 静的ルール

#### naming-convention

トークン名が指定されたパターンに一致するかチェックします。

設定例：
```json
{
  "naming-convention": {
    "severity": "error",
    "pattern": "^([a-z]+)(\\.[a-z0-9\\-]+)*$"
  }
}
```

#### raw-color / raw-pixel

コードファイル内で生のカラー値やピクセル値が使用されていないかチェックします。コードファイルを`--files`オプションで指定した場合に自動的に有効になります。

### AIルール

#### ai-semantic-naming

AIを使用してトークン名の意味的一貫性をチェックします。以下の問題を検出します：

- トークンの一貫した階層的命名の違反
- "info" vs "information"のような同義語の混在
- 数値と記述的値の混在
- 命名の深さの不一致

#### ai-spacing-consistency

スペーシングトークンの一貫性をチェックします。スペーシングスケールの整合性や、使用されていないトークンの検出を行います。

#### ai-design-complexity

デザインシステムの複雑さを評価します。トークンの数、階層の深さ、使用パターンを分析して、システムの複雑さに関する警告を提供します。

## カスタムAIルール

デフォルトのAIルールに加えて、独自のカスタムAIルールを定義できます。プロンプトファイルとZodスキーマファイルを作成し、設定ファイルで参照することで、プロジェクト固有のルールを追加できます。

### カスタムルールの定義

1. **プロンプトファイルを作成** (`prompts/my-rule.txt`):

```
あなたはデザインシステムアーキテクトです。
以下のトークンを分析してください。

{{TOKENS}}

出力フォーマット:
{
  "issues": [
    {
      "problem": "string",
      "reason": "string",
      ...
    }
  ]
}
```

2. **スキーマファイルを作成** (`schemas/my-rule.ts`):

```typescript
import { z } from 'zod';

export const schema = z.object({
  issues: z.array(z.object({
    file: z.string().nullable().optional(),
    line: z.number().nullable().optional(),
    problem: z.string(),
    reason: z.string(),
    suggestedToken: z.string().nullable().optional(),
    fixedCode: z.string().nullable().optional(),
    impact: z.enum(['Low', 'Medium', 'High']).nullable().optional(),
    tokenName: z.string().nullable().optional(),
    suggestion: z.string().nullable().optional()
  }))
});
```

3. **設定ファイルに追加** (`designlintrc.json`):

```json
{
  "rules": {
    "custom-rules": [
      {
        "id": "my-custom-rule",
        "description": "My custom rule description",
        "severity": "warn",
        "prompt": "./prompts/my-rule.txt",
        "schema": "./schemas/my-rule.ts"
      }
    ]
  }
}
```

### プロンプトファイルのプレースホルダー

- `{{TOKENS}}`: トークン情報が自動的に挿入されます。使用しない場合は、プロンプトの末尾に自動的に追加されます。
- コードファイルが指定されている場合、コードファイルの情報も自動的に追加されます。

### スキーマファイルの要件

- TypeScriptファイル（`.ts`）またはJavaScriptファイル（`.js`）を使用できます
- `export const schema`または`export default schema`でZodスキーマをエクスポートする必要があります
- TypeScriptファイルを使用する場合、`ts-node`または`tsx`が必要です（プロジェクトにインストールされている必要があります）

### 使用例

```bash
# カスタムルールを含む設定でlint実行
dslint lint

# fixコマンドでもカスタムルールが実行される
dslint fix
```

詳細な例は`example/`ディレクトリを参照してください。

## コード解析

`--files`オプションを使用してコードファイルを解析すると、以下の機能が有効になります：

1. **生の値の検出**: コード内で直接使用されているカラー値やピクセル値を検出
2. **トークン提案**: 検出された生の値に対して、適切なデザイントークンへの置き換えを提案
3. **修正コードの生成**: トークンを使用した修正後のコードを提案

例：
```bash
dslint lint --files "src/**/*.{tsx,css}" --source ./tokens.json
```

## レポート

### JSONレポート

```bash
dslint lint --json ./report.json
dslint fix --json ./report.json
```

出力されるJSONには、検出されたすべての問題の詳細情報が含まれます。

### PRコメント形式

```bash
dslint lint --pr-comment
dslint fix --pr-comment
```

GitHubのPRコメントとして使用できる形式で出力されます。

## 開発

### ビルド

```bash
pnpm build
```

### テスト

```bash
pnpm test
```

### ルールの追加

新しいルールを追加するには：

1. `src/rules/`に新しいファイルを作成
2. `Token[]`を受け取り`Diagnostic[]`を返す関数をエクスポート
3. `src/cli/cli.ts`にルールを登録

静的ルールの例：
```typescript
import { Token, Diagnostic } from '../types';

export function myCustomRule(
  tokens: Token[], 
  config: any
): Diagnostic[] {
  const diags: Diagnostic[] = [];
  // ルールの実装
  return diags;
}
```

AIルールの例：
```typescript
import { AIRule } from '../types';
import { z } from 'zod';

export const myAIRule: AIRule = {
  id: 'my-ai-rule',
  description: 'My custom AI rule',
  severity: 'warn',
  schema: z.object({
    issues: z.array(z.object({
      // スキーマ定義
    }))
  }),
  prompt: (context) => `
    // プロンプトテンプレート
  `
};
```

## アーキテクチャ

詳細なアーキテクチャとAI実装の詳細については、ルートディレクトリの[WALKTHROUGH.md](../../WALKTHROUGH.md)と[ARCHITECTURE.md](../../ARCHITECTURE.md)を参照してください。

## ライセンス

MIT


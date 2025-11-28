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

### オプション

```bash
# カスタム設定ファイルを指定
pnpm start lint --config ./custom-config.json

# カスタムトークンファイルを指定
pnpm start lint --source ./custom-tokens.json

# コードファイルを解析
pnpm start lint --files "src/**/*.{tsx,css}"

# JSONレポートを出力
pnpm start lint --json ./report.json

# PRコメント形式で出力
pnpm start lint --pr-comment
```

### カスタムプロンプトの実行

カスタムプロンプトファイルを使用して、AIにトークン分析を実行させることができます：

```bash
# 基本的な使用方法
pnpm start lint --prompt-file prompt.txt

# JSON形式で出力
pnpm start lint --prompt-file prompt.txt --prompt-output-json

# カスタムトークンファイルを指定
pnpm start lint --source ./custom-tokens.json --prompt-file prompt.txt
```

プロンプトファイル内で`{{TOKENS}}`プレースホルダーを使用すると、その位置にトークン情報が挿入されます。使用しない場合は、プロンプトの末尾に自動的に追加されます。

### Figmaからトークンを同期

```bash
# コマンドライン引数で指定
pnpm start sync --key <file_key> --token <access_token> --output ./tokens.json

# 環境変数で指定（.envファイルに設定）
FIGMA_FILE_KEY=xxx
FIGMA_ACCESS_TOKEN=xxx
pnpm start sync --output ./tokens.json
```

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

## コード解析

`--files`オプションを使用してコードファイルを解析すると、以下の機能が有効になります：

1. **生の値の検出**: コード内で直接使用されているカラー値やピクセル値を検出
2. **トークン提案**: 検出された生の値に対して、適切なデザイントークンへの置き換えを提案
3. **修正コードの生成**: トークンを使用した修正後のコードを提案

例：
```bash
pnpm start lint --files "src/**/*.{tsx,css}" --source ./tokens.json
```

## レポート

### JSONレポート

```bash
pnpm start lint --json ./report.json
```

出力されるJSONには、検出されたすべての問題の詳細情報が含まれます。

### PRコメント形式

```bash
pnpm start lint --pr-comment
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


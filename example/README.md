# Design AI Linter Example

このディレクトリは、`design-ai-linter`の使用例を示すReactアプリケーションです。

## セットアップ

```bash
pnpm install
```

## 環境変数の設定

**重要**: AIルールを使用する場合は、**プロジェクトルート**（monorepoのルートディレクトリ、`example/`の親ディレクトリ）に`.env`ファイルを作成し、以下の環境変数を設定してください：

```bash
# プロジェクトルート（design-ai-linter/）に .env ファイルを作成
OPENAI_API_KEY=sk-...
# または
GEMINI_API_KEY=AIza...

# Figma同期を使用する場合（オプション）
FIGMA_FILE_KEY=...
FIGMA_ACCESS_TOKEN=...
```

`example/`ディレクトリから実行する場合でも、プロジェクトルートの`.env`ファイルが自動的に読み込まれます。`cli.ts`の`findProjectRoot`関数がmonorepo構造を認識し、ルートディレクトリを検出します。

## 開発サーバーの起動

```bash
pnpm dev
```

## Linterの実行

```bash
pnpm lint
```

このコマンドは、`src/`ディレクトリ内のコードファイルを解析し、raw color値やraw pixel値を検出して、適切なデザイントークンの使用を提案します。

## Tokenの取得

実際の利用では、プロジェクトルートからCLIコマンドでFigmaからtokenを取得できます：

```bash
# プロジェクトルートから実行
cd ..
pnpm start sync --key <FIGMA_FILE_KEY> --token <FIGMA_ACCESS_TOKEN> --output example/tokens.json

# または環境変数が設定されている場合
pnpm start sync --output example/tokens.json
```

## サンプルコンポーネント

- `Button.tsx` - raw color使用例（`#4285F4`など）
- `Card.tsx` - raw spacing使用例（`24px`など）
- `App.tsx` - メインアプリケーション

これらのコンポーネントには、linterが検出するraw color値とraw pixel値が含まれています。


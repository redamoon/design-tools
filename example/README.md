# Design AI Linter Example

このディレクトリは、`design-ai-linter`の使用例を示すReactアプリケーションです。

## セットアップ

```bash
pnpm install
```

## 開発サーバーの起動

```bash
pnpm dev
```

## Linterの実行

```bash
pnpm lint
```

**注意**: AIルールを使用する場合は、プロジェクトルート（`../`）に`.env`ファイルを作成し、以下の環境変数を設定してください：

```bash
# プロジェクトルートに .env ファイルを作成
OPENAI_API_KEY=sk-...
# または
GEMINI_API_KEY=...
```

exampleディレクトリから実行する場合でも、プロジェクトルートの`.env`ファイルが自動的に読み込まれます。

## Tokenの配布

実際の利用では、CLIコマンドでFigmaからtokenを取得して配布します：

```bash
# Figmaからtokenを同期
dslint sync --key <FIGMA_FILE_KEY> --token <FIGMA_ACCESS_TOKEN> --output tokens.json
```

## サンプルコンポーネント

- `Button.tsx` - raw color使用例（`#4285F4`など）
- `Card.tsx` - raw spacing使用例（`24px`など）
- `App.tsx` - メインアプリケーション

これらのコンポーネントには、linterが検出するraw color値とraw pixel値が含まれています。


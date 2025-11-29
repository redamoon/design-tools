# Design Tools

デザインシステムの品質を保証するためのツール集です。

## パッケージ

### [Design AI Linter](./packages/design-ai-linter/README.md)

FigmaからエクスポートされたDesign SystemトークンをリントするCLIツールです。静的解析とAIによる意味解析を組み合わせて、デザイントークンの品質を保証します。

**主な機能:**
- トークン正規化と静的ルールチェック（命名規則、生の値検出など）
- AIによる意味解析（一貫性チェック、スペーシング整合性、デザイン複雑さの評価）
- コードファイル解析とトークン提案
- Git差分のチェック（ステージングされたファイル、コミット範囲）
- `fix`コマンドによる全ファイル横断チェック
- AIモデルの指定（OpenAI/Gemini）
- Figma APIからのトークン同期
- カスタムプロンプトによる柔軟な分析
- JSON/PRコメント形式のレポート出力

詳細は[Design AI LinterのREADME](./packages/design-ai-linter/README.md)を参照してください。

## プロジェクト構造

このプロジェクトはpnpm workspacesで管理されるmonorepoです:

- `packages/design-ai-linter/`: メインのリントパッケージ
- `example/`: リントの使用例を示すReactアプリケーション

## クイックスタート

```bash
# 依存関係のインストール
pnpm install

# Design AI Linterの使用
cd packages/design-ai-linter
pnpm build

# ステージングされたファイルをチェック（デフォルト）
pnpm start lint

# 全ファイルをチェック
pnpm start fix

# exampleディレクトリで実行
cd example
pnpm lint
```

詳細なアーキテクチャとAI実装の詳細については、[WALKTHROUGH.md](./WALKTHROUGH.md)と[ARCHITECTURE.md](./ARCHITECTURE.md)を参照してください。

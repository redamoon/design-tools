# Design AI Linter

FigmaからエクスポートされたDesign Systemトークン（例：Figma Tokens / Token Studio経由）をリントするCLIツールです。静的解析とAIによる意味解析を組み合わせています。

## 機能

- **トークン正規化**: `tokens.json`を読み込み、解析用に正規化します。
- **静的ルール**: 命名規則、生のカラー/ピクセル値、重複をチェックします。
- **AIルール**: LLM（OpenAI/Gemini）を使用して、意味的な一貫性、スペーシングの整合性、デザインの複雑さをチェックします。
- **CLI**: ローカルまたはCI/CDで実行可能です。
- **コード解析**: コードファイルを解析して生の値を検出し、デザイントークンを提案します。

## クイックスタート

1.  **依存関係のインストール**:
    ```bash
    pnpm install
    ```

2.  **環境変数の設定** (AI機能を使用する場合):
    プロジェクトルートに`.env`ファイルを作成:
    ```bash
    OPENAI_API_KEY=sk-...
    # または
    GEMINI_API_KEY=AIza...
    ```

3.  **リントの実行**:
    ```bash
    # 開発モード
    pnpm dev lint
    # またはビルドして実行
    pnpm build
    pnpm start lint
    ```

4.  **Figmaからトークンを同期** (オプション):
    ```bash
    pnpm start sync --key <file_key> --token <access_token>
    ```

5.  **テストの実行**:
    ```bash
    pnpm test
    ```

6.  **設定**:
    `designlintrc.json`を編集してルールを設定します。

## プロジェクト構造

このプロジェクトはpnpm workspacesで管理されるmonorepoです:

- `packages/design-ai-linter/`: メインのリントパッケージ
  - `src/adapters`: ファイル/APIからトークンを読み込むロジック
  - `src/rules`: リントルール（静的ルールとAIルール）
  - `src/cli`: CLIエントリーポイント
  - `src/engine`: 静的ランナー、AIランナー、候補セレクター
- `example/`: リントの使用例を示すReactアプリケーション

## ルールの追加

`packages/design-ai-linter/src/rules/`に新しいファイルを作成し、`Token[]`を受け取り`Diagnostic[]`を返す関数をエクスポートします。その後、`packages/design-ai-linter/src/cli/cli.ts`に登録します。

詳細なアーキテクチャとAI実装の詳細については、[WALKTHROUGH.md](./WALKTHROUGH.md)と[ARCHITECTURE.md](./ARCHITECTURE.md)を参照してください。

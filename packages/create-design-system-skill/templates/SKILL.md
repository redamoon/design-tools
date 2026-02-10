---
name: design-system-guardian
description: |
  Design System実装・レビュー・運用を支援する共通スキル。
  トークン準拠、アクセシビリティ、コンポーネントAPI整合性、
  ドキュメント更新、回帰防止チェックを一貫して実施する。
version: 1.0.0
---

# Design System Guardian Skill

## Purpose
このスキルは、デザインシステム関連タスク（新規コンポーネント作成、既存改修、トークン変更、レビュー）で、
実装品質と一貫性を保つための共通ワークフローを定義します。

## Inputs
- 変更対象（component/token/docs）
- 対応範囲（UI・API・アクセシビリティ・テスト）
- 既存仕様（Figma/Storybook/README/設計ドキュメント）

## Non-negotiable Rules
1. トークンをハードコードしない（色、スペーシング、タイポ、radius、shadow）。
2. Semantic namingを優先する（見た目名より役割名）。
3. コンポーネントのvariant / size / stateの整合性を必ず確認する。
4. アクセシビリティ（ラベル、キーボード操作、コントラスト）を最小要件として扱う。
5. 実装変更時は利用者向けドキュメント（README/usage）を更新する。

## Workflow
1. **Scope確認**: 対象のUI要素と影響範囲を列挙する。
2. **Token整合チェック**: Design Tokenへの参照可否と不足トークンを確認する。
3. **API設計**: props命名・default挙動・破壊的変更有無を定義する。
4. **実装**: 既存パターンに合わせ、再利用性を優先して変更する。
5. **a11y確認**: role / aria / focus / contrast を点検する。
6. **テスト**: 単体テスト・スナップショット・lintを必要範囲で実行する。
7. **ドキュメント**: 変更理由・使い方・移行手順を追記する。

## Output Format (for agents)
- Summary
  - 変更点（component / token / docs）
- Risks
  - 影響範囲と潜在的破壊点
- Validation
  - 実行したコマンドと結果
- Follow-ups
  - 未対応項目（必要であれば）

## Review Checklist
- [ ] デザイントークンを経由している
- [ ] Variant/Stateごとの差分が明示されている
- [ ] キーボード操作で破綻しない
- [ ] 変更に対応するドキュメント更新済み
- [ ] CIで必要なチェックを通過

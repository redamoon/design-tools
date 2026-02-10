# Design System Skills (Multi-Agent)

このディレクトリには、Cursor / Codex / Claude Code で共通利用できるデザインシステム向けスキルを配置しています。

## Canonical skill
- `skills/design-system/SKILL.md`

## Agent mappings
- Cursor: `.cursor/rules/design-system-guardian.mdc`
- Codex: `AGENTS.md` から `skills/design-system/SKILL.md` を参照
- Claude Code: `CLAUDE.md` と `.claude/skills/design-system-guardian.md`

## 運用ルール
1. 仕様変更はまず `skills/design-system/SKILL.md` を更新。
2. 各エージェント向けファイルは参照先と短い要約に留める。
3. 破壊的変更を含む場合は version を更新し、変更理由を記載する。

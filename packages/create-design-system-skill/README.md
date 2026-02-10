# create-design-system-skill

複数エージェント (Cursor / Codex / Claude Code) で共通利用できるデザインシステム向け skill テンプレートを、リポジトリへ一括配置する CLI です。

## Usage

```bash
npx @design-tools/create-design-system-skill
```

### Dry run

```bash
npx @design-tools/create-design-system-skill --dry-run
```

### Options

- `--target <path>`: 出力先ディレクトリ (デフォルト: カレント)
- `--dry-run`: ファイルを書き込まず、予定される変更のみ表示
- `--force`: 既存ファイルがあっても上書き

## Generated files

- `AGENTS.md`
- `CLAUDE.md`
- `.claude/skills/design-system-guardian.md`
- `.cursor/rules/design-system-guardian.mdc`
- `skills/README.md`
- `skills/design-system/SKILL.md`
- `README.md` への Agent Skills セクション追記（未存在時のみ）

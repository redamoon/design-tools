#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const templateRoot = path.resolve(__dirname, '..', 'templates');

const FILE_MAPPINGS = [
  ['AGENTS.md', 'AGENTS.md'],
  ['CLAUDE.md', 'CLAUDE.md'],
  ['design-system-guardian.claude.md', '.claude/skills/design-system-guardian.md'],
  ['design-system-guardian.cursor.mdc', '.cursor/rules/design-system-guardian.mdc'],
  ['skills.README.md', 'skills/README.md'],
  ['SKILL.md', 'skills/design-system/SKILL.md']
];

const README_SNIPPET = `\n## Agent Skills\n\nCursor / Codex / Claude Code で共通利用するデザインシステム向けスキルを \`skills/\` に追加しました。\n\n- 説明: \`skills/README.md\`\n- Canonical skill: \`skills/design-system/SKILL.md\`\n`;

function parseArgs(argv) {
  const options = {
    target: process.cwd(),
    dryRun: false,
    force: false,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--target') {
      const nextArg = argv[i + 1];
      if (!nextArg) {
        throw new Error('--target requires a path argument');
      }
      options.target = path.resolve(nextArg);
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`create-design-system-skill\n\nUsage:\n  npx @design-tools/create-design-system-skill [options]\n\nOptions:\n  --target <path>  Target repository directory (default: current directory)\n  --dry-run        Print planned changes without writing files\n  --force          Overwrite existing files\n  -h, --help       Show this help\n`);
}

function ensureDirectory(filePath, dryRun) {
  const directory = path.dirname(filePath);
  if (dryRun) {
    return;
  }
  fs.mkdirSync(directory, { recursive: true });
}

function writeFileFromTemplate(templateFile, destinationFile, options) {
  const sourcePath = path.join(templateRoot, templateFile);
  const targetPath = path.join(options.target, destinationFile);
  const exists = fs.existsSync(targetPath);

  if (exists && !options.force) {
    console.log(`skip  ${destinationFile} (already exists, use --force to overwrite)`);
    return;
  }

  const action = exists ? 'update' : 'create';
  console.log(`${action} ${destinationFile}`);

  if (options.dryRun) {
    return;
  }

  const content = fs.readFileSync(sourcePath, 'utf8');
  ensureDirectory(targetPath, false);
  fs.writeFileSync(targetPath, content, 'utf8');
}

function updateRootReadme(options) {
  const readmePath = path.join(options.target, 'README.md');

  if (!fs.existsSync(readmePath)) {
    console.log('skip  README.md (not found)');
    return;
  }

  const readme = fs.readFileSync(readmePath, 'utf8');
  if (readme.includes('## Agent Skills')) {
    console.log('skip  README.md (Agent Skills section already exists)');
    return;
  }

  console.log('update README.md (append Agent Skills section)');
  if (options.dryRun) {
    return;
  }

  const separator = readme.endsWith('\n') ? '' : '\n';
  fs.writeFileSync(readmePath, `${readme}${separator}${README_SNIPPET}`, 'utf8');
}

function run() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return;
    }

    console.log(`Target: ${options.target}`);
    if (options.dryRun) {
      console.log('Running in dry-run mode. No files will be written.');
    }

    FILE_MAPPINGS.forEach(([templateFile, destinationFile]) => {
      writeFileFromTemplate(templateFile, destinationFile, options);
    });

    updateRootReadme(options);

    console.log('Done.');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

run();

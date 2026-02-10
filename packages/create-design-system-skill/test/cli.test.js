const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const cliPath = path.resolve(__dirname, '..', 'bin', 'create-design-system-skill.js');

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'skill-cli-'));
}

test('dry-run does not write files', () => {
  const dir = mkTmpDir();
  fs.writeFileSync(path.join(dir, 'README.md'), '# sample\n', 'utf8');

  const output = execFileSync(process.execPath, [cliPath, '--target', dir, '--dry-run'], {
    encoding: 'utf8'
  });

  assert.match(output, /Running in dry-run mode/);
  assert.equal(fs.existsSync(path.join(dir, 'AGENTS.md')), false);
  assert.equal(fs.readFileSync(path.join(dir, 'README.md'), 'utf8'), '# sample\n');
});

test('writes files and appends Agent Skills section', () => {
  const dir = mkTmpDir();
  fs.writeFileSync(path.join(dir, 'README.md'), '# sample\n', 'utf8');

  execFileSync(process.execPath, [cliPath, '--target', dir], { encoding: 'utf8' });

  assert.equal(fs.existsSync(path.join(dir, 'AGENTS.md')), true);
  assert.equal(fs.existsSync(path.join(dir, 'skills/design-system/SKILL.md')), true);

  const readme = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');
  assert.match(readme, /## Agent Skills/);
});

test('force overwrites existing files', () => {
  const dir = mkTmpDir();
  const readmePath = path.join(dir, 'README.md');
  const agentsPath = path.join(dir, 'AGENTS.md');
  const skillPath = path.join(dir, 'skills/design-system/SKILL.md');

  fs.mkdirSync(path.dirname(skillPath), { recursive: true });
  fs.writeFileSync(readmePath, '# sentinel readme\n', 'utf8');
  fs.writeFileSync(agentsPath, 'sentinel agents content\n', 'utf8');
  fs.writeFileSync(skillPath, 'sentinel skill content\n', 'utf8');

  execFileSync(process.execPath, [cliPath, '--target', dir, '--force'], { encoding: 'utf8' });

  assert.equal(fs.existsSync(skillPath), true);
  const generatedSkill = fs.readFileSync(skillPath, 'utf8');
  assert.doesNotMatch(generatedSkill, /sentinel skill content/);
  assert.match(generatedSkill, /# Design System Guardian Skill/);

  const generatedAgents = fs.readFileSync(agentsPath, 'utf8');
  assert.doesNotMatch(generatedAgents, /sentinel agents content/);
  assert.match(generatedAgents, /# Agent Instructions/);

  const readme = fs.readFileSync(readmePath, 'utf8');
  assert.match(readme, /# sentinel readme/);
  assert.match(readme, /## Agent Skills/);
});

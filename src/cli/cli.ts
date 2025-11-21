#!/usr/bin/env node
import { Command } from 'commander';
import { loadTokensFromJson } from '../adapters/tokensJsonAdapter';
import { ruleNamingConvention } from '../rules/naming-convention';
import fs from 'fs/promises';
import path from 'path';

const program = new Command();

program
    .name('dslint')
    .description('Design System Linter for Figma Tokens')
    .version('0.1.0');

program
    .command('lint')
    .description('Lint design tokens')
    .option('-c, --config <path>', 'config file', './designlintrc.json')
    .option('-s, --source <path>', 'tokens json')
    .action(async (opts) => {
        try {
            // Load config
            const configPath = path.resolve(process.cwd(), opts.config);
            let cfg;
            try {
                const configRaw = await fs.readFile(configPath, 'utf-8');
                cfg = JSON.parse(configRaw);
            } catch (e) {
                console.warn(`Warning: Could not load config at ${configPath}, using defaults.`);
                cfg = {
                    source: { path: './tokens.json' },
                    rules: {
                        'naming-convention': { severity: 'error', pattern: '^([a-z]+\\.)+[a-z0-9\\-]+$' }
                    }
                };
            }

            // Determine source path
            const sourcePath = opts.source || cfg.source.path;
            console.log(`Loading tokens from: ${sourcePath}`);

            const tokens = await loadTokensFromJson(path.resolve(process.cwd(), sourcePath));
            console.log(`Found ${tokens.length} tokens.`);

            const diags = [];

            // 1. Static Lint Layer
            console.log('🔍 Running Static Rules...');
            const { runStaticRules } = await import('../engine/staticRunner');
            const staticDiags = runStaticRules(tokens, cfg.rules);
            diags.push(...staticDiags);

            // 2. AI Candidate Selector
            const { selectAICandidates } = await import('../engine/candidateSelector');
            const candidateTokens = selectAICandidates(tokens, staticDiags);

            // 3. AI Lint Layer
            if (process.env.OPENAI_API_KEY && candidateTokens.length > 0) {
                console.log(`🤖 Running AI Rules on ${candidateTokens.length} candidates...`);
                const { runAIRules } = await import('../engine/aiRunner');
                const { semanticNamingRule } = await import('../rules/ai/semantic-naming');
                const { spacingConsistencyRule } = await import('../rules/ai/spacing-consistency');
                const { designComplexityRule } = await import('../rules/ai/design-complexity');

                const aiDiags = await runAIRules(candidateTokens, [
                    semanticNamingRule,
                    spacingConsistencyRule,
                    designComplexityRule
                ]);
                diags.push(...aiDiags);
            } else if (!process.env.OPENAI_API_KEY) {
                console.log('ℹ️  Skipping AI rules (OPENAI_API_KEY not found)');
            } else {
                console.log('ℹ️  No candidates for AI analysis.');
            }

            // Report results
            if (diags.length === 0) {
                console.log('✔ No problems found');
                process.exit(0);
            } else {
                console.log(`\nFound ${diags.length} issues:\n`);
                for (const d of diags) {
                    const color = d.severity === 'error' ? '\x1b[31m' : (d.severity === 'warn' ? '\x1b[33m' : '\x1b[36m');
                    const reset = '\x1b[0m';
                    console.log(`${color}[${d.severity.toUpperCase()}]${reset} ${d.ruleId}: ${d.message}`);
                    if (d.tokenName) console.log(`    Token: ${d.tokenName}`);
                    if (d.suggestion) console.log(`    Suggestion: ${d.suggestion}`);
                    console.log('');
                }

                // Exit with error if there are errors
                if (diags.some(d => d.severity === 'error')) {
                    process.exit(1);
                }
            }
        } catch (error: any) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    });

program
    .command('sync')
    .description('Sync tokens from Figma')
    .option('-k, --key <key>', 'Figma file key')
    .option('-t, --token <token>', 'Figma personal access token')
    .option('-o, --output <path>', 'Output path', './tokens.json')
    .action(async (opts) => {
        try {
            const { syncFigmaTokens } = await import('../sync/figmaSync');
            const fileKey = opts.key || process.env.FIGMA_FILE_KEY;
            const token = opts.token || process.env.FIGMA_ACCESS_TOKEN;

            if (!fileKey || !token) {
                console.error('Error: Figma file key and access token are required (via flags or env vars).');
                process.exit(1);
            }

            await syncFigmaTokens(fileKey, token, path.resolve(process.cwd(), opts.output));
        } catch (error: any) {
            console.error('Error syncing tokens:', error.message);
            process.exit(1);
        }
    });

program.parse(process.argv);

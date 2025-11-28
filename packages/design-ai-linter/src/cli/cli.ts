#!/usr/bin/env node
import { Command } from 'commander';
import { loadTokensFromJson } from '../adapters/tokensJsonAdapter';
import { loadCodeFiles } from '../adapters/codeFileAdapter';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env from project root, regardless of where the command is run from
// Try to find project root by looking for pnpm-workspace.yaml or package.json with dslint bin
const findProjectRoot = (): string => {
    let currentDir = process.cwd();
    const root = path.parse(currentDir).root;
    
    while (currentDir !== root) {
        const pnpmWorkspacePath = path.join(currentDir, 'pnpm-workspace.yaml');
        const packageJsonPath = path.join(currentDir, 'package.json');
        
        // Check for pnpm-workspace.yaml (monorepo root)
        if (fsSync.existsSync(pnpmWorkspacePath)) {
            return currentDir;
        }
        
        // Check if this package.json has the linter bin
        if (fsSync.existsSync(packageJsonPath)) {
            try {
                const pkg = JSON.parse(fsSync.readFileSync(packageJsonPath, 'utf-8'));
                if (pkg.bin && pkg.bin.dslint) {
                    return currentDir;
                }
            } catch {
                // Continue searching
            }
        }
        
        currentDir = path.dirname(currentDir);
    }
    
    return process.cwd();
};

// Load .env from project root, then from current directory as fallback
const projectRoot = findProjectRoot();
const rootEnvPath = path.join(projectRoot, '.env');
const currentEnvPath = path.join(process.cwd(), '.env');

// Try project root first, then current directory
if (fsSync.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
} else if (fsSync.existsSync(currentEnvPath)) {
    dotenv.config({ path: currentEnvPath });
} else {
    // Fallback to default behavior
    dotenv.config();
}

const program = new Command();

program
    .name('dslint')
    .description('Design AI Linter for Figma Tokens')
    .version('0.1.0');

program
    .command('lint')
    .description('Lint design tokens')
    .option('-c, --config <path>', 'config file', './designlintrc.json')
    .option('-s, --source <path>', 'tokens json')
    .option('-f, --files <glob>', 'code files to analyze (e.g., "src/**/*.{tsx,css}")')
    .option('--json <path>', 'output JSON report to file')
    .option('--pr-comment', 'output PR comment format')
    .option('--prompt-file <path>', 'custom prompt file to execute')
    .option('--prompt-output-json', 'output prompt response as JSON')
    .action(async (opts) => {
        try {
            // Load config
            const configPath = path.resolve(process.cwd(), opts.config);
            let cfg;
            try {
                const configRaw = await fs.readFile(configPath, 'utf-8');
                cfg = JSON.parse(configRaw);
            } catch (e) {
                console.warn(`⚠️  警告: 設定ファイル ${configPath} を読み込めませんでした。デフォルト設定を使用します。`);
                cfg = {
                    source: { path: './tokens.json' },
                    rules: {
                        'naming-convention': { severity: 'error', pattern: '^([a-z]+\\.)+[a-z0-9\\-]+$' }
                    }
                };
            }

            // Determine source path
            const sourcePath = opts.source || cfg.source.path;
            console.log(`📦 トークンを読み込み中: ${sourcePath}`);

            const tokens = await loadTokensFromJson(path.resolve(process.cwd(), sourcePath));
            console.log(`✅ ${tokens.length}個のトークンが見つかりました。`);

            // Handle custom prompt file if specified
            if (opts.promptFile) {
                try {
                    const promptFilePath = path.resolve(process.cwd(), opts.promptFile);
                    console.log(`📝 プロンプトファイルを読み込み中: ${promptFilePath}`);
                    const promptText = await fs.readFile(promptFilePath, 'utf-8');
                    
                    const { runCustomPrompt } = await import('../engine/aiRunner');
                    
                    // Determine provider
                    const hasOpenAI = !!process.env.OPENAI_API_KEY;
                    const hasGemini = !!process.env.GEMINI_API_KEY;
                    const provider = hasOpenAI ? 'openai' : (hasGemini ? 'gemini' : 'openai');
                    
                    console.log('🤖 カスタムプロンプトを実行中...');
                    const response = await runCustomPrompt(
                        promptText,
                        tokens,
                        undefined,
                        provider,
                        opts.promptOutputJson || false
                    );
                    
                    if (opts.promptOutputJson) {
                        // Try to parse as JSON and pretty print
                        try {
                            const jsonResponse = JSON.parse(response);
                            console.log('\n' + JSON.stringify(jsonResponse, null, 2));
                        } catch {
                            // If not valid JSON, output as-is
                            console.log('\n' + response);
                        }
                    } else {
                        console.log('\n' + response);
                    }
                    
                    process.exit(0);
                } catch (error: any) {
                    console.error('❌ カスタムプロンプトの実行中にエラーが発生しました:', error.message);
                    if (error.stack) {
                        console.error('   スタックトレース:', error.stack);
                    }
                    process.exit(1);
                }
            }

            // Load code files if --files option is provided
            let codeFiles;
            const filesPattern = opts.files || cfg.files;
            if (filesPattern) {
                console.log(`📁 コードファイルを読み込み中: ${filesPattern}`);
                codeFiles = await loadCodeFiles(filesPattern, process.cwd());
                console.log(`✅ ${codeFiles.length}個のコードファイルが見つかりました。`);
            }

            const diags = [];

            // 1. Static Lint Layer
            console.log('🔍 Running Static Rules...');
            const { runStaticRules } = await import('../engine/staticRunner');
            
            // Enable raw-color and raw-pixel rules if code files are provided
            const rulesConfig = { ...cfg.rules };
            if (codeFiles && codeFiles.length > 0) {
                if (!rulesConfig['raw-color']) {
                    rulesConfig['raw-color'] = { severity: 'warn', enabled: true };
                }
                if (!rulesConfig['raw-pixel']) {
                    rulesConfig['raw-pixel'] = { severity: 'warn', enabled: true };
                }
            }
            
            const staticDiags = runStaticRules(tokens, rulesConfig, codeFiles);
            diags.push(...staticDiags);

            // 2. AI Candidate Selector
            const { selectAICandidates } = await import('../engine/candidateSelector');
            const candidateTokens = selectAICandidates(tokens, staticDiags);

            // 3. AI Lint Layer
      const hasOpenAI = !!process.env.OPENAI_API_KEY;
      const hasGemini = !!process.env.GEMINI_API_KEY;
      const hasAIKey = hasOpenAI || hasGemini;

      if (hasAIKey && candidateTokens.length > 0) {
        console.log(`🤖 Running AI Rules on ${candidateTokens.length} candidates...`);
        const { runAIRules } = await import('../engine/aiRunner');
        const { semanticNamingRule } = await import('../rules/ai/semantic-naming');
        const { spacingConsistencyRule } = await import('../rules/ai/spacing-consistency');
        const { designComplexityRule } = await import('../rules/ai/design-complexity');

        const aiDiags = await runAIRules(
            candidateTokens, 
            [
                semanticNamingRule, 
                spacingConsistencyRule, 
                designComplexityRule
            ],
            undefined,
            'openai',
            codeFiles
        );
        diags.push(...aiDiags);
      } else if (!hasAIKey) {
        console.log('ℹ️  AIルールをスキップします（OPENAI_API_KEYまたはGEMINI_API_KEYが見つかりません）');
      } else {
        console.log('ℹ️  AI分析の候補がありません。');
      }

            // Generate reports if requested
            if (opts.json) {
                const { generateJSONReport } = await import('../reporters/jsonReporter');
                await generateJSONReport(diags, opts.json);
            }

            if (opts.prComment) {
                const { generatePRCommentReport } = await import('../reporters/prCommentReporter');
                const prComment = generatePRCommentReport(diags);
                console.log('\n' + prComment);
            }

            // Report results
            if (diags.length === 0) {
                console.log('✔ 問題は見つかりませんでした');
                process.exit(0);
            } else {
                console.log(`\n${diags.length}件の問題が見つかりました:\n`);
                for (const d of diags) {
                    const color = d.severity === 'error' ? '\x1b[31m' : (d.severity === 'warn' ? '\x1b[33m' : '\x1b[36m');
                    const reset = '\x1b[0m';
                    console.log(`${color}[${d.severity.toUpperCase()}]${reset} ${d.ruleId}: ${d.message}`);
                    if (d.file) {
                        console.log(`    ファイル: ${d.file}${d.line ? `:${d.line}` : ''}`);
                    }
                    if (d.tokenName) console.log(`    トークン: ${d.tokenName}`);
                    if (d.problem) console.log(`    問題: ${d.problem}`);
                    if (d.reason) console.log(`    理由: ${d.reason}`);
                    if (d.suggestedToken) console.log(`    推奨トークン: ${d.suggestedToken}`);
                    if (d.suggestion) console.log(`    提案: ${d.suggestion}`);
                    if (d.fixedCode) {
                        console.log(`    修正コード:`);
                        const fixedLines = d.fixedCode.split('\n');
                        fixedLines.forEach((line, _idx) => {
                            if (line.trim()) {
                                console.log(`      ${line}`);
                            }
                        });
                    }
                    if (d.impact) console.log(`    影響度: ${d.impact}`);
                    console.log('');
                }

                // Exit with error if there are errors
                if (diags.some(d => d.severity === 'error')) {
                    process.exit(1);
                }
            }
        } catch (error: any) {
            console.error('❌ エラー:', error.message);
            if (error.stack) {
                console.error('   スタックトレース:', error.stack);
            }
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
                console.error('❌ エラー: Figmaファイルキーとアクセストークンが必要です（フラグまたは環境変数で指定してください）。');
                process.exit(1);
            }

            await syncFigmaTokens(fileKey, token, path.resolve(process.cwd(), opts.output));
        } catch (error: any) {
            console.error('❌ トークンの同期中にエラーが発生しました:', error.message);
            if (error.message?.includes('401') || error.message?.includes('403')) {
                console.error('   認証エラー: アクセストークンが無効です。');
            } else if (error.message?.includes('404')) {
                console.error('   ファイルが見つかりません: ファイルキーを確認してください。');
            }
            process.exit(1);
        }
    });

program.parse(process.argv);

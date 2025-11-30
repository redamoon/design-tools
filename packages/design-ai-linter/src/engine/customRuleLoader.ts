import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { AIRule, LintContext } from '../types';
import { z } from 'zod';

type CustomRuleConfig = {
    id: string;
    description: string;
    severity: 'error' | 'warn' | 'info';
    prompt: string; // プロンプトファイルのパス
    schema: string; // スキーマファイルのパス
};

/**
 * Load custom AI rules from configuration
 * @param customRulesConfig Array of custom rule configurations
 * @param baseDir Base directory to resolve file paths (usually process.cwd())
 * @returns Array of AIRule objects
 */
export async function loadCustomRules(
    customRulesConfig: CustomRuleConfig[],
    baseDir: string = process.cwd()
): Promise<AIRule[]> {
    const rules: AIRule[] = [];

    for (const config of customRulesConfig) {
        try {
            // Load prompt file
            const promptPath = path.resolve(baseDir, config.prompt);
            if (!fsSync.existsSync(promptPath)) {
                console.warn(`⚠️  警告: プロンプトファイルが見つかりません: ${promptPath}`);
                continue;
            }
            const promptText = await fs.readFile(promptPath, 'utf-8');

            // Load schema file
            const schemaPath = path.resolve(baseDir, config.schema);
            if (!fsSync.existsSync(schemaPath)) {
                console.warn(`⚠️  警告: スキーマファイルが見つかりません: ${schemaPath}`);
                continue;
            }

            // Load schema module dynamically
            let schema: z.ZodTypeAny;
            try {
                // For TypeScript files, we need to use ts-node or tsx
                // First, try to require the file directly (works for .js files)
                if (schemaPath.endsWith('.ts')) {
                    // Register ts-node if not already registered
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    if (!require.extensions['.ts']) {
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-var-requires
                            require('ts-node/register');
                        } catch (e) {
                            // If ts-node is not available, try tsx
                            try {
                                // eslint-disable-next-line @typescript-eslint/no-var-requires
                                require('tsx/cjs/register');
                            } catch (e2) {
                                throw new Error('TypeScriptファイルを実行するには、ts-nodeまたはtsxが必要です。npm install -D ts-node または npm install -D tsx を実行してください。');
                            }
                        }
                    }
                }

                // Delete from require cache to allow reloading
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                delete require.cache[require.resolve(schemaPath)];

                // Require the schema module
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const schemaModule = require(schemaPath) as { schema?: z.ZodTypeAny; default?: z.ZodTypeAny };
                
                // Extract schema export
                if (schemaModule.schema) {
                    schema = schemaModule.schema;
                } else if (schemaModule.default) {
                    schema = schemaModule.default;
                } else {
                    throw new Error('スキーマファイルは`export const schema`または`export default schema`でスキーマをエクスポートする必要があります。');
                }

                // Validate that it's a Zod schema
                if (!schema || typeof schema.parse !== 'function') {
                    throw new Error('スキーマはZodスキーマである必要があります。');
                }
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`❌ スキーマファイルの読み込みエラー (${config.id}):`, errorMessage);
                continue;
            }

            // Create AIRule object
            const rule: AIRule = {
                id: config.id,
                description: config.description,
                severity: config.severity,
                schema: schema,
                prompt: (context: LintContext) => {
                    // Replace {{TOKENS}} placeholder or append tokens info
                    let finalPrompt = promptText;
                    const tokensContext = JSON.stringify(
                        context.tokens.map(t => ({ name: t.name, type: t.type, value: t.rawValue })),
                        null,
                        2
                    );

                    if (promptText.includes('{{TOKENS}}')) {
                        finalPrompt = promptText.replace('{{TOKENS}}', tokensContext);
                    } else {
                        finalPrompt = `${promptText}\n\nTokens:\n${tokensContext}`;
                    }

                    // Append code files if available
                    if (context.codeFiles && context.codeFiles.length > 0) {
                        finalPrompt += `\n\nCode Files:\n${context.codeFiles.map(f => `File: ${f.path}\n${f.content.substring(0, 500)}...`).join('\n\n')}`;
                    }

                    return finalPrompt;
                }
            };

            rules.push(rule);
            console.log(`✅ カスタムルールを読み込みました: ${config.id}`);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ カスタムルールの読み込みエラー (${config.id}):`, errorMessage);
        }
    }

    return rules;
}


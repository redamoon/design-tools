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
                let schemaModule: { schema?: z.ZodTypeAny; default?: z.ZodTypeAny } | undefined;
                
                if (schemaPath.endsWith('.ts')) {
                    // For TypeScript files, try multiple loading strategies
                    let loaded = false;
                    let lastError: Error | null = null;
                    
                    // Strategy 1: Try tsx if available (tsx supports bundler moduleResolution)
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-var-requires
                        require('tsx/cjs/register');
                        // Delete from cache to allow reloading
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-var-requires
                            delete require.cache[require.resolve(schemaPath)];
                        } catch {
                            // Cache entry might not exist yet
                        }
                        // eslint-disable-next-line @typescript-eslint/no-var-requires
                        schemaModule = require(schemaPath);
                        loaded = true;
                    } catch (tsxError) {
                        lastError = tsxError instanceof Error ? tsxError : new Error(String(tsxError));
                        // tsx is not available, try ts-node
                    }
                    
                    // Strategy 2: Try ts-node if tsx failed
                    if (!loaded) {
                        try {
                            // Register ts-node if not already registered
                            // eslint-disable-next-line @typescript-eslint/no-var-requires
                            if (!require.extensions['.ts']) {
                                // eslint-disable-next-line @typescript-eslint/no-var-requires
                                const tsNode = require('ts-node');
                                // Configure ts-node to support ES modules
                                // skipProject: true to ignore project tsconfig.json (which may have incompatible settings)
                                tsNode.register({
                                    transpileOnly: true,
                                    skipProject: true, // Ignore project tsconfig.json
                                    compilerOptions: {
                                        target: 'ES2020',
                                        module: 'commonjs',
                                        moduleResolution: 'node', // Use 'node' instead of 'bundler'
                                        esModuleInterop: true,
                                        allowSyntheticDefaultImports: true,
                                        skipLibCheck: true,
                                        strict: true
                                    }
                                });
                            }
                            // Delete from cache to allow reloading
                            try {
                                // eslint-disable-next-line @typescript-eslint/no-var-requires
                                delete require.cache[require.resolve(schemaPath)];
                            } catch {
                                // Cache entry might not exist yet
                            }
                            // eslint-disable-next-line @typescript-eslint/no-var-requires
                            schemaModule = require(schemaPath);
                            loaded = true;
                        } catch (tsNodeError) {
                            lastError = tsNodeError instanceof Error ? tsNodeError : new Error(String(tsNodeError));
                            // ts-node also failed
                        }
                    }
                    
                    // Strategy 3: Try dynamic import as last resort
                    if (!loaded) {
                        try {
                            const fileUrl = schemaPath.startsWith('/') 
                                ? `file://${schemaPath}` 
                                : `file://${path.resolve(schemaPath)}`;
                            schemaModule = await import(fileUrl) as { schema?: z.ZodTypeAny; default?: z.ZodTypeAny };
                            loaded = true;
                        } catch (importError) {
                            const importErrorMsg = importError instanceof Error ? importError.message : String(importError);
                            const errorMsg = lastError 
                                ? `TypeScriptファイルを読み込むことができませんでした。tsx/ts-nodeの読み込みに失敗: ${lastError.message}。動的インポートも失敗: ${importErrorMsg}` 
                                : `TypeScriptファイルを読み込むには、tsxまたはts-nodeが必要です。プロジェクトルートまたはexampleディレクトリで 'pnpm add -D ts-node' または 'pnpm add -D tsx' を実行してください。`;
                            throw new Error(errorMsg);
                        }
                    }
                } else {
                    // For JavaScript files, use dynamic import
                    const fileUrl = schemaPath.startsWith('/') 
                        ? `file://${schemaPath}` 
                        : `file://${path.resolve(schemaPath)}`;
                    schemaModule = await import(fileUrl) as { schema?: z.ZodTypeAny; default?: z.ZodTypeAny };
                }
                
                // Extract schema export
                if (!schemaModule) {
                    throw new Error('スキーマモジュールの読み込みに失敗しました。');
                }
                
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


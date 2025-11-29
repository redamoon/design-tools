import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { AIRule, Diagnostic, LintContext, Token } from "../types";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load .env from project root if not already loaded
// This ensures env vars are available even when imported from different directories
if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    // Try to find project root (where pnpm-workspace.yaml exists)
    let currentDir = __dirname;
    const root = path.parse(currentDir).root;
    
    while (currentDir !== root) {
        const pnpmWorkspacePath = path.join(currentDir, 'pnpm-workspace.yaml');
        if (fs.existsSync(pnpmWorkspacePath)) {
            const envPath = path.join(currentDir, '.env');
            if (fs.existsSync(envPath)) {
                dotenv.config({ path: envPath });
            }
            break;
        }
        currentDir = path.dirname(currentDir);
    }
}

type AIProvider = 'openai' | 'gemini';

export async function runAIRules(
    tokens: Token[],
    rules: AIRule[],
    apiKey?: string,
    provider: AIProvider = 'openai',
    codeFiles?: import('../types').CodeFile[],
    modelName?: string
): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const context: LintContext = { tokens, codeFiles };

    // Determine provider and key
    let activeProvider = provider;
    let finalApiKey = apiKey;

    if (!finalApiKey) {
        if (process.env.OPENAI_API_KEY) {
            activeProvider = 'openai';
            finalApiKey = process.env.OPENAI_API_KEY;
        } else if (process.env.GEMINI_API_KEY) {
            activeProvider = 'gemini';
            finalApiKey = process.env.GEMINI_API_KEY;
        }
    }

    if (!finalApiKey) {
        console.warn("⚠️  AIルールをスキップします: OPENAI_API_KEYまたはGEMINI_API_KEYが設定されていません。");
        return [];
    }

    console.log(`🤖 AIプロバイダーを使用: ${activeProvider.toUpperCase()}`);

    // Initialize Clients
    let openaiClient: OpenAI | null = null;
    let geminiClient: GoogleGenAI | null = null;

    if (activeProvider === 'openai') {
        openaiClient = new OpenAI({ apiKey: finalApiKey });
    } else {
        geminiClient = new GoogleGenAI({ apiKey: finalApiKey });
    }

    for (const rule of rules) {
        let jsonContent: any;
        try {
            console.log(`AIルールを実行中: ${rule.id}...`);
            const prompt = rule.prompt(context);

            if (activeProvider === 'openai' && openaiClient) {
                // Use specified model or try different OpenAI models in order of preference
                const defaultModelNames = ["gpt-4o", "gpt-4-turbo", "gpt-4-turbo-preview", "gpt-3.5-turbo"];
                const modelNames = modelName ? [modelName] : defaultModelNames;
                let modelSuccess = false;
                
                for (const currentModelName of modelNames) {
                    try {
                        const response = await openaiClient.chat.completions.create({
                            model: currentModelName,
                            messages: [
                                { role: "system", content: "You are an expert Design AI Linter. Output JSON only." },
                                { role: "user", content: prompt }
                            ],
                            response_format: { type: "json_object" }
                        });
                        const content = response.choices[0].message.content;
                        if (!content) {
                            if (modelName) {
                                throw new Error(`モデル ${currentModelName} が空のレスポンスを返しました`);
                            }
                            console.log(`⚠️  モデル ${currentModelName} が空のレスポンスを返しました。次のモデルを試します...`);
                            continue;
                        }
                        jsonContent = JSON.parse(content);
                        modelSuccess = true;
                        console.log(`✅ OpenAIモデル ${currentModelName} を使用しました`);
                        break; // Success, exit loop
                    } catch (error: any) {
                        // Handle different error formats
                        let errorMsg = '';
                        let errorCode = '';
                        if (error?.error?.message) {
                            errorMsg = error.error.message;
                            errorCode = error.error.code?.toString() || '';
                        } else if (error?.status) {
                            errorCode = error.status.toString();
                            errorMsg = error.message || '';
                        } else if (error?.message) {
                            errorMsg = error.message;
                            errorCode = error.code?.toString() || '';
                        } else if (typeof error === 'string') {
                            errorMsg = error;
                        } else {
                            errorMsg = JSON.stringify(error);
                        }
                        
                        // Check for quota/rate limit errors (429, 403, etc.) - always try next model
                        const isQuotaError = errorCode === '429' || 
                                            errorMsg.includes('429') ||
                                            errorMsg.includes('quota') ||
                                            errorMsg.includes('exceeded') ||
                                            errorMsg.includes('rate limit');
                        
                        // Check for model not found errors - always try next model
                        const isModelNotFoundError = errorMsg.includes('not found') || 
                                                    errorMsg.includes('not available') ||
                                                    errorMsg.includes('invalid_model') ||
                                                    errorMsg.includes('model_not_found');
                        
                        // If it's a quota error or model not found error, try next model (even if model is specified)
                        if (isQuotaError || isModelNotFoundError) {
                            if (isQuotaError) {
                                console.log(`⚠️  モデル ${currentModelName} のクォータを超過しています。次のモデルを試します...`);
                            } else {
                                console.log(`⚠️  モデル ${currentModelName} が利用できません。次のモデルを試します...`);
                            }
                            continue;
                        }
                        
                        // If model is specified and it's not a quota/model not found error, throw immediately
                        if (modelName) {
                            throw new Error(`モデル ${currentModelName} でエラー: ${errorMsg}`);
                        }
                        
                        // For other errors, log and try next model
                        console.log(`⚠️  モデル ${currentModelName} でエラー: ${errorMsg.substring(0, 150)}`);
                        continue;
                    }
                }
                
                if (!modelSuccess) {
                    throw new Error(modelName ? `指定されたモデル ${modelName} の試行に失敗しました` : 'すべてのOpenAIモデルの試行に失敗しました');
                }

            } else if (activeProvider === 'gemini' && geminiClient) {
                // Use specified model or try different Gemini models in order of preference
                // Note: Model names may vary by API version and region
                const defaultModelNames = ["gemini-3-pro-preview", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-pro"];
                const modelNames = modelName ? [modelName] : defaultModelNames;
                let lastError: any = null;
                let modelSuccess = false;
                
                for (const currentModelName of modelNames) {
                    try {
                        const response = await geminiClient.models.generateContent({
                            model: currentModelName,
                            contents: [
                                "You are an expert Design AI Linter. Output JSON only. Do not use markdown code blocks.",
                                prompt
                            ]
                        });
                        let text = response.text || '';
                        
                        // Clean up markdown code blocks if present (Gemini sometimes adds them)
                        text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
                        if (!text) {
                            throw new Error('Empty response from Gemini API');
                        }
                        jsonContent = JSON.parse(text);
                        modelSuccess = true;
                        console.log(`✅ モデル ${currentModelName} を使用しました`);
                        break; // Success, exit loop
                    } catch (error: any) {
                        lastError = error;
                        // Handle different error formats
                        let errorMsg = '';
                        let errorCode = '';
                        if (error?.error?.message) {
                            errorMsg = error.error.message;
                            errorCode = error.error.code?.toString() || '';
                        } else if (error?.message) {
                            errorMsg = error.message;
                            errorCode = error.code?.toString() || '';
                        } else if (typeof error === 'string') {
                            errorMsg = error;
                        } else {
                            errorMsg = JSON.stringify(error);
                        }
                        
                        // Check for quota/rate limit errors (429, 403, etc.) - always try next model
                        const isQuotaError = errorCode === '429' || 
                                            errorMsg.includes('429') ||
                                            errorMsg.includes('quota') ||
                                            errorMsg.includes('exceeded') ||
                                            errorMsg.includes('rate limit');
                        
                        // Check for model not found errors - always try next model
                        const isModelNotFoundError = errorMsg.includes('404') || 
                                                    errorMsg.includes('not found') || 
                                                    errorMsg.includes('not available') ||
                                                    errorMsg.includes('not supported') ||
                                                    errorMsg.includes('NOT_FOUND');
                        
                        // If it's a quota error or model not found error, try next model (even if model is specified)
                        if (isQuotaError || isModelNotFoundError) {
                            if (isQuotaError) {
                                console.log(`⚠️  モデル ${currentModelName} のクォータを超過しています。次のモデルを試します...`);
                            } else {
                                console.log(`⚠️  モデル ${currentModelName} が利用できません。次のモデルを試します...`);
                            }
                            continue;
                        }
                        
                        // If model is specified and it's not a quota/model not found error, throw immediately
                        if (modelName) {
                            throw new Error(`モデル ${currentModelName} でエラー: ${errorMsg}`);
                        }
                        
                        // For other errors, log and try next model
                        console.log(`⚠️  モデル ${currentModelName} でエラー: ${errorMsg.substring(0, 150)}`);
                        continue;
                    }
                }
                
                // If all models failed, throw the last error
                if (!modelSuccess && lastError) {
                    throw new Error(modelName ? `指定されたモデル ${modelName} の試行に失敗しました: ${lastError.message}` : lastError.message);
                }
            }

            // Handle case where AI returns array instead of object
            // Some models may return the issues array directly instead of wrapping it in an object
            if (Array.isArray(jsonContent)) {
                console.warn(`⚠️  AIが配列を返しました。オブジェクト形式に変換します。`);
                jsonContent = { issues: jsonContent };
            }

            // Validate with Zod schema
            let result;
            try {
                result = rule.schema.parse(jsonContent);
            } catch (schemaError: any) {
                // If schema validation fails, try to extract issues array if it exists
                if (jsonContent && typeof jsonContent === 'object' && 'issues' in jsonContent && Array.isArray(jsonContent.issues)) {
                    console.warn(`⚠️  スキーマバリデーションエラー: ${schemaError.message}`);
                    console.warn(`   レスポンスのissues配列を使用します。`);
                    result = { issues: jsonContent.issues };
                } else {
                    throw schemaError;
                }
            }

            if (result.issues) {
                for (const issue of result.issues) {
                    diagnostics.push({
                        ruleId: rule.id,
                        severity: rule.severity,
                        message: issue.problem || issue.message || '',
                        tokenName: issue.tokenName,
                        suggestion: issue.suggestion,
                        // Extended fields from specification
                        file: issue.file,
                        line: issue.line !== undefined ? issue.line : null,
                        problem: issue.problem,
                        reason: issue.reason,
                        suggestedToken: issue.suggestedToken,
                        fixedCode: issue.fixedCode,
                        impact: issue.impact
                    });
                }
            }
        } catch (error: any) {
            console.error(`❌ AIルール ${rule.id} の実行中にエラーが発生しました:`, error.message);
            
            // Zodスキーマエラーの詳細を表示
            if (error.issues) {
                console.error(`   スキーマバリデーションエラー詳細:`);
                error.issues.forEach((issue: any, index: number) => {
                    console.error(`     [${index + 1}] ${issue.path.join('.')}: ${issue.message}`);
                });
            }
            
            // エラーの詳細を日本語で表示
            if (error.message?.includes('404')) {
                console.error(`   モデルが見つかりません。利用可能なモデル名を確認してください。`);
            } else if (error.message?.includes('API key')) {
                console.error(`   APIキーが無効です。環境変数を確認してください。`);
            } else if (error.message?.includes('rate limit')) {
                console.error(`   レート制限に達しました。しばらく待ってから再試行してください。`);
            } else if (error.message?.includes('quota')) {
                console.error(`   クォータを超過しました。APIの使用量を確認してください。`);
            } else if (error.message?.includes('expected object')) {
                console.error(`   AIが期待されるオブジェクト形式で応答していません。`);
                console.error(`   レスポンス形式: ${Array.isArray(jsonContent) ? '配列' : typeof jsonContent}`);
            }
        }
    }

    return diagnostics;
}

export async function runCustomPrompt(
    promptText: string,
    tokens: Token[],
    apiKey?: string,
    provider: AIProvider = 'openai',
    outputJson: boolean = false,
    modelName?: string
): Promise<string> {
    // Determine provider and key
    let activeProvider = provider;
    let finalApiKey = apiKey;

    if (!finalApiKey) {
        if (process.env.OPENAI_API_KEY) {
            activeProvider = 'openai';
            finalApiKey = process.env.OPENAI_API_KEY;
        } else if (process.env.GEMINI_API_KEY) {
            activeProvider = 'gemini';
            finalApiKey = process.env.GEMINI_API_KEY;
        }
    }

    if (!finalApiKey) {
        throw new Error("OPENAI_API_KEYまたはGEMINI_API_KEYが設定されていません。");
    }

    console.log(`🤖 AIプロバイダーを使用: ${activeProvider.toUpperCase()}`);

    // Prepare tokens context
    const tokensContext = JSON.stringify(
        tokens.map(t => ({ name: t.name, type: t.type, value: t.rawValue })),
        null,
        2
    );

    // Process prompt: replace {{TOKENS}} placeholder or append tokens info
    let finalPrompt = promptText;
    if (promptText.includes('{{TOKENS}}')) {
        finalPrompt = promptText.replace('{{TOKENS}}', tokensContext);
    } else {
        finalPrompt = `${promptText}\n\nTokens:\n${tokensContext}`;
    }

    // Initialize Clients
    let openaiClient: OpenAI | null = null;
    let geminiClient: GoogleGenAI | null = null;

    if (activeProvider === 'openai') {
        openaiClient = new OpenAI({ apiKey: finalApiKey });
    } else {
        geminiClient = new GoogleGenAI({ apiKey: finalApiKey });
    }

    let responseContent: string = '';

    if (activeProvider === 'openai' && openaiClient) {
        // Use specified model or try different OpenAI models in order of preference
        const defaultModelNames = ["gpt-4o", "gpt-4-turbo", "gpt-4-turbo-preview", "gpt-3.5-turbo"];
        const modelNames = modelName ? [modelName] : defaultModelNames;
        let modelSuccess = false;

        for (const currentModelName of modelNames) {
            try {
                const systemMessage = outputJson
                    ? "You are an expert Design AI Linter. Output JSON only."
                    : "You are an expert Design AI Linter. Provide helpful and detailed responses.";

                const response = await openaiClient!.chat.completions.create({
                    model: currentModelName,
                    messages: [
                        { role: "system", content: systemMessage },
                        { role: "user", content: finalPrompt }
                    ],
                    ...(outputJson ? { response_format: { type: "json_object" } } : {})
                });
                const content = response.choices[0].message.content;
                if (!content) {
                    if (modelName) {
                        throw new Error(`モデル ${currentModelName} が空のレスポンスを返しました`);
                    }
                    console.log(`⚠️  モデル ${currentModelName} が空のレスポンスを返しました。次のモデルを試します...`);
                    continue;
                }
                responseContent = content;
                modelSuccess = true;
                console.log(`✅ OpenAIモデル ${currentModelName} を使用しました`);
                break; // Success, exit loop
            } catch (error: any) {
                // Handle different error formats
                let errorMsg = '';
                let errorCode = '';
                if (error?.error?.message) {
                    errorMsg = error.error.message;
                    errorCode = error.error.code?.toString() || '';
                } else if (error?.status) {
                    errorCode = error.status.toString();
                    errorMsg = error.message || '';
                } else if (error?.message) {
                    errorMsg = error.message;
                    errorCode = error.code?.toString() || '';
                } else if (typeof error === 'string') {
                    errorMsg = error;
                } else {
                    errorMsg = JSON.stringify(error);
                }

                // Check for quota/rate limit errors (429, 403, etc.) - always try next model
                const isQuotaError = errorCode === '429' || 
                                    errorMsg.includes('429') ||
                                    errorMsg.includes('quota') ||
                                    errorMsg.includes('exceeded') ||
                                    errorMsg.includes('rate limit');
                
                // Check for model not found errors - always try next model
                const isModelNotFoundError = errorMsg.includes('not found') ||
                                            errorMsg.includes('not available') ||
                                            errorMsg.includes('invalid_model') ||
                                            errorMsg.includes('model_not_found');

                // If it's a quota error or model not found error, try next model (even if model is specified)
                if (isQuotaError || isModelNotFoundError) {
                    if (isQuotaError) {
                        console.log(`⚠️  モデル ${currentModelName} のクォータを超過しています。次のモデルを試します...`);
                    } else {
                        console.log(`⚠️  モデル ${currentModelName} が利用できません。次のモデルを試します...`);
                    }
                    continue;
                }

                // If model is specified and it's not a quota/model not found error, throw immediately
                if (modelName) {
                    throw new Error(`モデル ${currentModelName} でエラー: ${errorMsg}`);
                }

                // For other errors, log and try next model
                console.log(`⚠️  モデル ${currentModelName} でエラー: ${errorMsg.substring(0, 150)}`);
                continue;
            }
        }

        if (!modelSuccess) {
            throw new Error(modelName ? `指定されたモデル ${modelName} の試行に失敗しました` : 'すべてのOpenAIモデルの試行に失敗しました');
        }

    } else if (activeProvider === 'gemini' && geminiClient) {
        // Use specified model or try different Gemini models in order of preference
        const defaultModelNames = ["gemini-3-pro-preview", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-pro"];
        const modelNames = modelName ? [modelName] : defaultModelNames;
        let lastError: any = null;
        let modelSuccess = false;

        for (const currentModelName of modelNames) {
            try {
                const systemMessage = outputJson
                    ? "You are an expert Design AI Linter. Output JSON only. Do not use markdown code blocks."
                    : "You are an expert Design AI Linter. Provide helpful and detailed responses.";

                const response = await geminiClient!.models.generateContent({
                    model: currentModelName,
                    contents: [
                        systemMessage,
                        finalPrompt
                    ]
                });
                let text = response.text || '';

                // Clean up markdown code blocks if present (Gemini sometimes adds them)
                if (outputJson) {
                    text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
                } else {
                    text = text.replace(/^```\w*\n/, '').replace(/\n```$/, '');
                }

                if (!text) {
                    throw new Error('Empty response from Gemini API');
                }
                responseContent = text;
                modelSuccess = true;
                console.log(`✅ モデル ${currentModelName} を使用しました`);
                break; // Success, exit loop
            } catch (error: any) {
                lastError = error;
                // Handle different error formats
                let errorMsg = '';
                let errorCode = '';
                if (error?.error?.message) {
                    errorMsg = error.error.message;
                    errorCode = error.error.code?.toString() || '';
                } else if (error?.message) {
                    errorMsg = error.message;
                    errorCode = error.code?.toString() || '';
                } else if (typeof error === 'string') {
                    errorMsg = error;
                } else {
                    errorMsg = JSON.stringify(error);
                }

                // Check for quota/rate limit errors (429, 403, etc.) - always try next model
                const isQuotaError = errorCode === '429' || 
                                    errorMsg.includes('429') ||
                                    errorMsg.includes('quota') ||
                                    errorMsg.includes('exceeded') ||
                                    errorMsg.includes('rate limit');
                
                // Check for model not found errors - always try next model
                const isModelNotFoundError = errorMsg.includes('404') ||
                                            errorMsg.includes('not found') ||
                                            errorMsg.includes('not available') ||
                                            errorMsg.includes('not supported') ||
                                            errorMsg.includes('NOT_FOUND');

                // If it's a quota error or model not found error, try next model (even if model is specified)
                if (isQuotaError || isModelNotFoundError) {
                    if (isQuotaError) {
                        console.log(`⚠️  モデル ${currentModelName} のクォータを超過しています。次のモデルを試します...`);
                    } else {
                        console.log(`⚠️  モデル ${currentModelName} が利用できません。次のモデルを試します...`);
                    }
                    continue;
                }

                // If model is specified and it's not a quota/model not found error, throw immediately
                if (modelName) {
                    throw new Error(`モデル ${currentModelName} でエラー: ${errorMsg}`);
                }

                // For other errors, log and try next model
                console.log(`⚠️  モデル ${currentModelName} でエラー: ${errorMsg.substring(0, 150)}`);
                continue;
            }
        }

        // If all models failed, throw the last error
        if (!modelSuccess && lastError) {
            throw new Error(modelName ? `指定されたモデル ${modelName} の試行に失敗しました: ${lastError.message}` : lastError.message);
        }
    }

    return responseContent;
}

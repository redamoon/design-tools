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
    codeFiles?: import('../types').CodeFile[]
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
        try {
            console.log(`AIルールを実行中: ${rule.id}...`);
            const prompt = rule.prompt(context);
            let jsonContent: any;

            if (activeProvider === 'openai' && openaiClient) {
                // Try different OpenAI models in order of preference
                const modelNames = ["gpt-4o", "gpt-4-turbo", "gpt-4-turbo-preview", "gpt-3.5-turbo"];
                let modelSuccess = false;
                
                for (const modelName of modelNames) {
                    try {
                        const response = await openaiClient.chat.completions.create({
                            model: modelName,
                            messages: [
                                { role: "system", content: "You are an expert Design AI Linter. Output JSON only." },
                                { role: "user", content: prompt }
                            ],
                            response_format: { type: "json_object" }
                        });
                        const content = response.choices[0].message.content;
                        if (!content) {
                            console.log(`⚠️  モデル ${modelName} が空のレスポンスを返しました。次のモデルを試します...`);
                            continue;
                        }
                        jsonContent = JSON.parse(content);
                        modelSuccess = true;
                        console.log(`✅ OpenAIモデル ${modelName} を使用しました`);
                        break; // Success, exit loop
                    } catch (error: any) {
                        // Handle different error formats
                        let errorMsg = '';
                        if (error?.error?.message) {
                            errorMsg = error.error.message;
                        } else if (error?.message) {
                            errorMsg = error.message;
                        } else if (typeof error === 'string') {
                            errorMsg = error;
                        } else {
                            errorMsg = JSON.stringify(error);
                        }
                        
                        // If it's a model not found error, try next model
                        if (errorMsg.includes('not found') || 
                            errorMsg.includes('not available') ||
                            errorMsg.includes('invalid_model') ||
                            errorMsg.includes('model_not_found')) {
                            console.log(`⚠️  モデル ${modelName} が利用できません。次のモデルを試します...`);
                            continue;
                        } else {
                            // For other errors, log and try next model
                            console.log(`⚠️  モデル ${modelName} でエラー: ${errorMsg.substring(0, 150)}`);
                            continue;
                        }
                    }
                }
                
                if (!modelSuccess) {
                    throw new Error('すべてのOpenAIモデルの試行に失敗しました');
                }

            } else if (activeProvider === 'gemini' && geminiClient) {
                // Try different Gemini models in order of preference
                // Note: Model names may vary by API version and region
                const modelNames = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-pro"];
                let lastError: any = null;
                let modelSuccess = false;
                
                for (const modelName of modelNames) {
                    try {
                        const response = await geminiClient.models.generateContent({
                            model: modelName,
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
                        console.log(`✅ モデル ${modelName} を使用しました`);
                        break; // Success, exit loop
                    } catch (error: any) {
                        lastError = error;
                        // Handle different error formats
                        let errorMsg = '';
                        if (error?.error?.message) {
                            errorMsg = error.error.message;
                        } else if (error?.message) {
                            errorMsg = error.message;
                        } else if (typeof error === 'string') {
                            errorMsg = error;
                        } else {
                            errorMsg = JSON.stringify(error);
                        }
                        
                        // If it's a 404 or model not found error, try next model
                        if (errorMsg.includes('404') || 
                            errorMsg.includes('not found') || 
                            errorMsg.includes('not available') ||
                            errorMsg.includes('not supported') ||
                            errorMsg.includes('NOT_FOUND')) {
                            console.log(`⚠️  モデル ${modelName} が利用できません。次のモデルを試します...`);
                            continue;
                        } else {
                            // For other errors, log and try next model (don't throw immediately)
                            console.log(`⚠️  モデル ${modelName} でエラー: ${errorMsg.substring(0, 150)}`);
                            continue;
                        }
                    }
                }
                
                // If all models failed, throw the last error
                if (!modelSuccess && lastError) {
                    throw lastError;
                }
            }

            // Validate with Zod schema
            const result = rule.schema.parse(jsonContent);

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
            // エラーの詳細を日本語で表示
            if (error.message?.includes('404')) {
                console.error(`   モデルが見つかりません。利用可能なモデル名を確認してください。`);
            } else if (error.message?.includes('API key')) {
                console.error(`   APIキーが無効です。環境変数を確認してください。`);
            } else if (error.message?.includes('rate limit')) {
                console.error(`   レート制限に達しました。しばらく待ってから再試行してください。`);
            } else if (error.message?.includes('quota')) {
                console.error(`   クォータを超過しました。APIの使用量を確認してください。`);
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
    outputJson: boolean = false
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
        // Try different OpenAI models in order of preference
        const modelNames = ["gpt-4o", "gpt-4-turbo", "gpt-4-turbo-preview", "gpt-3.5-turbo"];
        let modelSuccess = false;

        for (const modelName of modelNames) {
            try {
                const systemMessage = outputJson
                    ? "You are an expert Design AI Linter. Output JSON only."
                    : "You are an expert Design AI Linter. Provide helpful and detailed responses.";

                const response = await openaiClient!.chat.completions.create({
                    model: modelName,
                    messages: [
                        { role: "system", content: systemMessage },
                        { role: "user", content: finalPrompt }
                    ],
                    ...(outputJson ? { response_format: { type: "json_object" } } : {})
                });
                const content = response.choices[0].message.content;
                if (!content) {
                    console.log(`⚠️  モデル ${modelName} が空のレスポンスを返しました。次のモデルを試します...`);
                    continue;
                }
                responseContent = content;
                modelSuccess = true;
                console.log(`✅ OpenAIモデル ${modelName} を使用しました`);
                break; // Success, exit loop
            } catch (error: any) {
                // Handle different error formats
                let errorMsg = '';
                if (error?.error?.message) {
                    errorMsg = error.error.message;
                } else if (error?.message) {
                    errorMsg = error.message;
                } else if (typeof error === 'string') {
                    errorMsg = error;
                } else {
                    errorMsg = JSON.stringify(error);
                }

                // If it's a model not found error, try next model
                if (errorMsg.includes('not found') ||
                    errorMsg.includes('not available') ||
                    errorMsg.includes('invalid_model') ||
                    errorMsg.includes('model_not_found')) {
                    console.log(`⚠️  モデル ${modelName} が利用できません。次のモデルを試します...`);
                    continue;
                } else {
                    // For other errors, log and try next model
                    console.log(`⚠️  モデル ${modelName} でエラー: ${errorMsg.substring(0, 150)}`);
                    continue;
                }
            }
        }

        if (!modelSuccess) {
            throw new Error('すべてのOpenAIモデルの試行に失敗しました');
        }

    } else if (activeProvider === 'gemini' && geminiClient) {
        // Try different Gemini models in order of preference
        const modelNames = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-pro"];
        let lastError: any = null;
        let modelSuccess = false;

        for (const modelName of modelNames) {
            try {
                const systemMessage = outputJson
                    ? "You are an expert Design AI Linter. Output JSON only. Do not use markdown code blocks."
                    : "You are an expert Design AI Linter. Provide helpful and detailed responses.";

                const response = await geminiClient!.models.generateContent({
                    model: modelName,
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
                console.log(`✅ モデル ${modelName} を使用しました`);
                break; // Success, exit loop
            } catch (error: any) {
                lastError = error;
                // Handle different error formats
                let errorMsg = '';
                if (error?.error?.message) {
                    errorMsg = error.error.message;
                } else if (error?.message) {
                    errorMsg = error.message;
                } else if (typeof error === 'string') {
                    errorMsg = error;
                } else {
                    errorMsg = JSON.stringify(error);
                }

                // If it's a 404 or model not found error, try next model
                if (errorMsg.includes('404') ||
                    errorMsg.includes('not found') ||
                    errorMsg.includes('not available') ||
                    errorMsg.includes('not supported') ||
                    errorMsg.includes('NOT_FOUND')) {
                    console.log(`⚠️  モデル ${modelName} が利用できません。次のモデルを試します...`);
                    continue;
                } else {
                    // For other errors, log and try next model (don't throw immediately)
                    console.log(`⚠️  モデル ${modelName} でエラー: ${errorMsg.substring(0, 150)}`);
                    continue;
                }
            }
        }

        // If all models failed, throw the last error
        if (!modelSuccess && lastError) {
            throw lastError;
        }
    }

    return responseContent;
}

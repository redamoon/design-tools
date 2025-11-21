import OpenAI from "openai";
import { AIRule, Diagnostic, LintContext, Token } from "../types";
import dotenv from "dotenv";

dotenv.config();

export async function runAIRules(
    tokens: Token[],
    rules: AIRule[],
    apiKey?: string
): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];

    // Initialize OpenAI client
    // Prioritize passed key, then env var
    const finalApiKey = apiKey || process.env.OPENAI_API_KEY;

    if (!finalApiKey) {
        console.warn("Skipping AI rules: No OPENAI_API_KEY provided.");
        return [];
    }

    const client = new OpenAI({ apiKey: finalApiKey });
    const context: LintContext = { tokens };

    for (const rule of rules) {
        try {
            console.log(`Running AI Rule: ${rule.id}...`);
            const prompt = rule.prompt(context);

            const response = await client.chat.completions.create({
                model: "gpt-4-turbo-preview", // Or gpt-3.5-turbo for speed
                messages: [
                    { role: "system", content: "You are an expert Design System Linter. Output JSON only." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            });

            const content = response.choices[0].message.content;
            if (!content) continue;

            const json = JSON.parse(content);

            // Validate with Zod schema
            const result = rule.schema.parse(json);

            if (result.issues) {
                for (const issue of result.issues) {
                    diagnostics.push({
                        ruleId: rule.id,
                        severity: rule.severity,
                        message: issue.problem,
                        tokenName: issue.tokenName,
                        suggestion: issue.suggestion
                    });
                }
            }
        } catch (error: any) {
            console.error(`Error running AI rule ${rule.id}:`, error.message);
            // Don't crash the whole linter for one AI rule failure
        }
    }

    return diagnostics;
}

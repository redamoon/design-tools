import { AIRule } from '../../types';
import { z } from 'zod';

export const designComplexityRule: AIRule = {
    id: 'ai-design-complexity',
    description: 'Evaluates the overall complexity and cognitive load of the design system.',
    severity: 'info',
    schema: z.object({
        score: z.number().min(0).max(100),
        summary: z.string(),
        issues: z.array(z.object({
            file: z.string().optional(),
            line: z.number().nullable().optional(),
            problem: z.string(),
            reason: z.string(),
            suggestedToken: z.string().optional(),
            fixedCode: z.string().optional(),
            impact: z.enum(['Low', 'Medium', 'High']).optional(),
            tokenName: z.string().optional(),
            suggestion: z.string().optional()
        })),
        proposals: z.array(z.string())
    }),
    prompt: (context) => `
あなたはリードデザインシステムアーキテクトです。
提供されたデザイントークンを分析し、システム全体の複雑さと認知的負荷を評価してください。

評価項目:
1. **冗長性**: 類似した値を持つトークンが多すぎるか？
2. **命名の明確性**: 名前は直感的で一貫しているか？
3. **スケールの複雑さ**: スケール（色、スペーシング、タイポグラフィ）が複雑すぎる、または不規則か？
4. **認知的負荷**: 開発者が適切なトークンを選択するのがどれだけ難しいか？

出力フォーマット:
{
  "score": number (0-100, 100は完璧なシンプルさ/明確さ),
  "summary": "システムの健全性に関する簡潔な要約",
  "issues": [
    {
      "file": "string (optional)",
      "line": "number | null (optional)",
      "problem": "string",
      "reason": "string",
      "suggestedToken": "string (optional)",
      "fixedCode": "string (optional)",
      "impact": "Low | Medium | High (optional)",
      "tokenName": "string (optional)",
      "suggestion": "string (optional)"
    }
  ],
  "proposals": ["スペーシングスケールのリファクタリング", "color.infoをcolor.status.infoにリネーム"]
}

Tokens:
${JSON.stringify(context.tokens.map(t => ({ name: t.name, value: t.rawValue })), null, 2)}

${context.codeFiles && context.codeFiles.length > 0 ? `
Code Files:
${context.codeFiles.map(f => `File: ${f.path}\n${f.content.substring(0, 500)}...`).join('\n\n')}
` : ''}
`
};

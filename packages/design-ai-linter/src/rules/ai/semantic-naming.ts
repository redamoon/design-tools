import { AIRule } from '../../types';
import { z } from 'zod';

export const semanticNamingRule: AIRule = {
    id: 'ai-semantic-naming',
    description: 'Checks for semantic naming consistency using AI',
    severity: 'warn',
    schema: z.object({
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
        }))
    }),
    prompt: (context) => `
あなたはデザインシステムアーキテクト兼フロントエンドエンジニアです。
Design Token と実装コードの整合性を確認し、必要に応じて改善案を提示してください。

以下のトークンを分析し、命名の一貫性をチェックしてください。

ルール:
- トークンは一貫した階層的命名に従うべき
- "info" vs "information"のような同義語を避ける
- 数値と記述的値の混在を避ける
- 命名の深さの不一致を避ける

出力フォーマット:
{
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
  ]
}

Tokens:
${JSON.stringify(context.tokens.map(t => ({ name: t.name, value: t.rawValue })), null, 2)}

${context.codeFiles && context.codeFiles.length > 0 ? `
Code Files:
${context.codeFiles.map(f => `File: ${f.path}\n${f.content.substring(0, 500)}...`).join('\n\n')}
` : ''}
`
};

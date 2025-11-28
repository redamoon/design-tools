import { AIRule } from '../../types';
import { z } from 'zod';

export const spacingConsistencyRule: AIRule = {
    id: 'ai-spacing-consistency',
    description: 'Checks for spacing scale consistency (e.g. 4px grid) and outliers using AI',
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
    prompt: (context) => {
        const spacingTokens = context.tokens.filter(t => t.type === 'spacing' || t.name.includes('spacing') || t.name.includes('gap') || t.name.includes('padding') || t.name.includes('margin'));

        return `
あなたはデザインシステムアーキテクト兼フロントエンドエンジニアです。
Design Token と実装コードの整合性を確認し、必要に応じて改善案を提示してください。

以下のスペーシングトークンを分析し、モジュラースケール（通常4pxまたは8pxグリッド）との不一致を検出してください。

ルール:
- 確立されたスケールに適合しないトークン（外れ値）を特定
- 命名の不一致をチェック（例: "sm"のようなTシャツサイズと数値"4"の混在）
- グリッドに合わせるための修正を提案

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

Spacing Tokens:
${JSON.stringify(spacingTokens.map(t => ({ name: t.name, value: t.rawValue })), null, 2)}

${context.codeFiles && context.codeFiles.length > 0 ? `
Code Files:
${context.codeFiles.map(f => `File: ${f.path}\n${f.content.substring(0, 500)}...`).join('\n\n')}
` : ''}
`;
    }
};

import { AIRule } from '../../types';
import { z } from 'zod';

export const spacingConsistencyRule: AIRule = {
    id: 'ai-spacing-consistency',
    description: 'Checks for spacing scale consistency (e.g. 4px grid) and outliers using AI',
    severity: 'warn',
    schema: z.object({
        issues: z.array(z.object({
            file: z.string().nullable().optional(),
            line: z.number().nullable().optional(),
            problem: z.string(),
            reason: z.string(),
            suggestedToken: z.string().nullable().optional(),
            fixedCode: z.string().nullable().optional(),
            impact: z.enum(['Low', 'Medium', 'High']).nullable().optional(),
            tokenName: z.string().nullable().optional(),
            suggestion: z.string().nullable().optional()
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

出力フォーマット（必ずオブジェクト形式で返してください）:
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

重要: 必ずオブジェクト形式（{"issues": [...]}）で返してください。配列を直接返さないでください。

Spacing Tokens:
${JSON.stringify(spacingTokens.map(t => ({ name: t.name, value: t.rawValue })), null, 2)}

${context.codeFiles && context.codeFiles.length > 0 ? `
Code Files:
${context.codeFiles.map(f => `File: ${f.path}\n${f.content.substring(0, 500)}...`).join('\n\n')}
` : ''}
`;
    }
};

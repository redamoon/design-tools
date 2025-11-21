import { AIRule } from '../../types';
import { z } from 'zod';

export const spacingConsistencyRule: AIRule = {
    id: 'ai-spacing-consistency',
    description: 'Checks for spacing scale consistency (e.g. 4px grid) and outliers using AI',
    severity: 'warn',
    schema: z.object({
        issues: z.array(z.object({
            tokenName: z.string(),
            problem: z.string(),
            suggestion: z.string()
        }))
    }),
    prompt: (context) => {
        const spacingTokens = context.tokens.filter(t => t.type === 'spacing' || t.name.includes('spacing') || t.name.includes('gap') || t.name.includes('padding') || t.name.includes('margin'));

        return `
You are an expert design-system reviewer.
Analyze the following SPACING tokens and detect inconsistencies with a modular scale (typically 4px or 8px grid).

Rules:
- Identify tokens that do not fit the established scale (outliers).
- Check for inconsistent naming (e.g., mixing t-shirt sizes "sm" with numeric "4").
- Suggest corrections to align with the grid.

Output JSON with:
- "issues": [{ tokenName, problem, suggestion }]

Spacing Tokens:
${JSON.stringify(spacingTokens.map(t => ({ name: t.name, value: t.rawValue })), null, 2)}
`;
    }
};

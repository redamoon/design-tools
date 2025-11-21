import { AIRule } from '../../types';
import { z } from 'zod';

export const semanticNamingRule: AIRule = {
    id: 'ai-semantic-naming',
    description: 'Checks for semantic naming consistency using AI',
    severity: 'warn',
    schema: z.object({
        issues: z.array(z.object({
            tokenName: z.string(),
            problem: z.string(),
            suggestion: z.string()
        }))
    }),
    prompt: (context) => `
You are an expert design-system reviewer.
Analyze the following semantic design tokens and detect naming inconsistencies.

Rules:
- tokens should follow consistent hierarchical naming
- avoid synonyms like "info" vs "information"
- avoid mixing numeric and descriptive values
- avoid inconsistent depth in naming

Output JSON with:
- "issues": [{ tokenName, problem, suggestion }]

Tokens:
${JSON.stringify(context.tokens.map(t => ({ name: t.name, value: t.rawValue })), null, 2)}
`
};

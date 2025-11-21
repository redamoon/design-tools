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
            tokenName: z.string().optional(),
            problem: z.string(),
            suggestion: z.string()
        })),
        proposals: z.array(z.string())
    }),
    prompt: (context) => `
You are a Lead Design System Architect.
Analyze the provided design tokens to evaluate the overall COMPLEXITY and COGNITIVE LOAD of the system.

Evaluate:
1. **Redundancy**: Are there too many tokens with similar values?
2. **Naming Clarity**: Are names intuitive and consistent?
3. **Scale Complexity**: Are the scales (color, spacing, typography) too complex or irregular?
4. **Cognitive Load**: How hard is it for a developer to choose the right token?

Output JSON:
{
  "score": number (0-100, where 100 is perfect simplicity/clarity),
  "summary": "Brief executive summary of the system's health",
  "issues": [
    { "problem": "Too many gray shades", "suggestion": "Reduce grays to 5 steps" }
  ],
  "proposals": ["Refactor spacing scale", "Rename color.info to color.status.info"]
}

Tokens:
${JSON.stringify(context.tokens.map(t => ({ name: t.name, value: t.rawValue })), null, 2)}
`
};

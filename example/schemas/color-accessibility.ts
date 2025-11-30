import { z } from 'zod';

export const schema = z.object({
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
});


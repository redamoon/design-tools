import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runAIRules } from '../src/engine/aiRunner';
import { AIRule } from '../src/types';
import { z } from 'zod';

// Mock OpenAI
const mockCreate = vi.fn();
vi.mock('openai', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            chat: {
                completions: {
                    create: mockCreate
                }
            }
        }))
    };
});

describe('AI Runner', () => {
    const mockTokens = [
        { type: 'color', name: 'color.primary', rawValue: '#000' }
    ];

    const mockRule: AIRule = {
        id: 'test-rule',
        description: 'Test Rule',
        severity: 'error',
        prompt: () => 'test prompt',
        schema: z.object({
            issues: z.array(z.object({
                tokenName: z.string(),
                problem: z.string(),
                suggestion: z.string()
            }))
        })
    };

    beforeEach(() => {
        mockCreate.mockClear();
        process.env.OPENAI_API_KEY = 'test-key';
    });

    it('should parse AI response and return diagnostics', async () => {
        // Mock successful AI response
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: JSON.stringify({
                        issues: [{
                            tokenName: 'color.primary',
                            problem: 'Test problem',
                            suggestion: 'Test suggestion'
                        }]
                    })
                }
            }]
        });

        const results = await runAIRules(mockTokens, [mockRule]);

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({
            ruleId: 'test-rule',
            severity: 'error',
            message: 'Test problem',
            tokenName: 'color.primary',
            suggestion: 'Test suggestion'
        });
    });

    it('should handle invalid JSON from AI gracefully', async () => {
        mockCreate.mockResolvedValue({
            choices: [{
                message: {
                    content: 'Invalid JSON'
                }
            }]
        });

        const results = await runAIRules(mockTokens, [mockRule]);
        expect(results).toHaveLength(0);
    });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runAIRules } from '../src/engine/aiRunner';
import { AIRule } from '../src/types';
import { z } from 'zod';

// Mock GoogleGenAI
const mockGenerateContent = vi.fn();
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent
      }
    }))
  };
});

describe('AI Runner (Gemini)', () => {
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
    mockGenerateContent.mockClear();
    delete process.env.OPENAI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-gemini-key';
  });

  it('should use Gemini when GEMINI_API_KEY is present and OPENAI_API_KEY is missing', async () => {
    // Mock successful Gemini response
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        issues: [{
          tokenName: 'color.primary',
          problem: 'Gemini problem',
          suggestion: 'Gemini suggestion'
        }]
      })
    });

    const results = await runAIRules(mockTokens, [mockRule]);

    expect(results).toHaveLength(1);
    expect(results[0].message).toBe('Gemini problem');
  });

  it('should handle markdown code blocks from Gemini', async () => {
    mockGenerateContent.mockResolvedValue({
      text: "```json\n" + JSON.stringify({
        issues: []
      }) + "\n```"
    });

    const results = await runAIRules(mockTokens, [mockRule]);
    expect(results).toHaveLength(0);
  });
});

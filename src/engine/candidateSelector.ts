import { Token, Diagnostic } from '../types';

/**
 * Selects candidates for AI analysis.
 * In a real implementation, this would filter based on:
 * - Complexity (too many tokens?)
 * - Ambiguity (naming is unclear?)
 * - Recent changes (diff)
 * 
 * For now, it returns all tokens, or a subset if specified.
 */
export function selectAICandidates(tokens: Token[], staticDiagnostics: Diagnostic[]): Token[] {
    // Example logic: If a token failed static analysis with a warning, maybe ask AI for a better name?
    // For this MVP, we pass all tokens to AI to perform the semantic checks (Naming, Spacing, Complexity).

    // Optimization: We could limit the number of tokens sent to AI to avoid context limits.
    // const MAX_TOKENS = 100;
    // return tokens.slice(0, MAX_TOKENS);

    return tokens;
}

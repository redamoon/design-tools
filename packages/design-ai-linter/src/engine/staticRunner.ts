import { Token, Diagnostic, CodeFile } from '../types';
import { ruleNamingConvention } from '../rules/naming-convention';
import { extractRawColors, extractRawPixels } from '../adapters/codeFileAdapter';

export type StaticRuleConfig = {
    'naming-convention'?: { severity: 'error' | 'warn' | 'info', pattern: string };
    'raw-color'?: { severity: 'error' | 'warn' | 'info', enabled: boolean };
    'raw-pixel'?: { severity: 'error' | 'warn' | 'info', enabled: boolean };
};

export function runStaticRules(tokens: Token[], config: StaticRuleConfig, codeFiles?: CodeFile[]): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Rule: Naming Convention
    if (config['naming-convention']) {
        const ruleCfg = config['naming-convention'];
        const pattern = new RegExp(ruleCfg.pattern);
        diagnostics.push(...ruleNamingConvention(tokens, pattern, ruleCfg.severity));
    }

    // Rule: Raw Color Detection
    if (config['raw-color']?.enabled && codeFiles) {
        diagnostics.push(...detectRawColors(codeFiles, tokens, config['raw-color'].severity));
    }

    // Rule: Raw Pixel Detection
    if (config['raw-pixel']?.enabled && codeFiles) {
        diagnostics.push(...detectRawPixels(codeFiles, tokens, config['raw-pixel'].severity));
    }

    return diagnostics;
}

/**
 * Detect raw color values in code files and suggest tokens
 */
function detectRawColors(codeFiles: CodeFile[], tokens: Token[], severity: 'error' | 'warn' | 'info'): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    
    // Build a map of color tokens for quick lookup
    const colorTokens = tokens.filter(t => t.type === 'color');
    const colorTokenMap = new Map<string, Token[]>();
    
    for (const token of colorTokens) {
        const normalizedValue = normalizeColorValue(token.rawValue);
        if (!colorTokenMap.has(normalizedValue)) {
            colorTokenMap.set(normalizedValue, []);
        }
        colorTokenMap.get(normalizedValue)!.push(token);
    }
    
    for (const codeFile of codeFiles) {
        const rawColors = extractRawColors(codeFile.content);
        
        for (const color of rawColors) {
            const normalizedValue = normalizeColorValue(color.value);
            const matchingTokens = colorTokenMap.get(normalizedValue);
            
            if (!matchingTokens || matchingTokens.length === 0) {
                // No matching token found - suggest using a token
                diagnostics.push({
                    ruleId: 'raw-color',
                    message: `Raw color ${color.value} should use a design token`,
                    severity,
                    file: codeFile.path,
                    line: color.line,
                    problem: `raw color ${color.value}`,
                    reason: 'Design tokens should be used instead of raw color values for consistency',
                    suggestedToken: findClosestColorToken(color.value, colorTokens),
                    fixedCode: generateFixedCode(codeFile.content, color, findClosestColorToken(color.value, colorTokens)),
                    impact: 'Medium'
                });
            }
        }
    }
    
    return diagnostics;
}

/**
 * Detect raw pixel values in code files and suggest tokens
 */
function detectRawPixels(codeFiles: CodeFile[], tokens: Token[], severity: 'error' | 'warn' | 'info'): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    
    // Build a map of spacing/size tokens
    const spacingTokens = tokens.filter(t => 
        t.type === 'spacing' || 
        t.type === 'size' || 
        t.name.includes('spacing') || 
        t.name.includes('size')
    );
    
    for (const codeFile of codeFiles) {
        const rawPixels = extractRawPixels(codeFile.content);
        
        for (const pixel of rawPixels) {
            const pixelValue = parseFloat(pixel.value);
            const matchingToken = findMatchingSpacingToken(pixelValue, spacingTokens);
            
            if (!matchingToken) {
                diagnostics.push({
                    ruleId: 'raw-pixel',
                    message: `Raw pixel value ${pixel.value} should use a design token`,
                    severity,
                    file: codeFile.path,
                    line: pixel.line,
                    problem: `raw pixel ${pixel.value}`,
                    reason: 'Design tokens should be used instead of raw pixel values for consistency',
                    suggestedToken: findClosestSpacingToken(pixelValue, spacingTokens),
                    fixedCode: generateFixedCode(codeFile.content, pixel, findClosestSpacingToken(pixelValue, spacingTokens)),
                    impact: 'Medium'
                });
            }
        }
    }
    
    return diagnostics;
}

/**
 * Normalize color value for comparison
 */
function normalizeColorValue(value: string): string {
    // Convert hex to lowercase
    if (value.startsWith('#')) {
        return value.toLowerCase();
    }
    
    // Normalize RGB/RGBA
    if (value.startsWith('rgb')) {
        // Extract numbers and normalize
        const numbers = value.match(/\d+/g);
        if (numbers && numbers.length >= 3) {
            return `rgb(${numbers[0]},${numbers[1]},${numbers[2]})`;
        }
    }
    
    return value.toLowerCase();
}

/**
 * Find closest color token by value
 */
function findClosestColorToken(colorValue: string, tokens: Token[]): string {
    // Simple heuristic: return first color token if available
    if (tokens.length > 0) {
        return tokens[0].name;
    }
    return 'color.primary';
}

/**
 * Find matching spacing token by exact value
 */
function findMatchingSpacingToken(pixelValue: number, tokens: Token[]): Token | null {
    for (const token of tokens) {
        const tokenValue = typeof token.rawValue === 'number' 
            ? token.rawValue 
            : parseFloat(String(token.rawValue).replace('px', ''));
        
        if (Math.abs(tokenValue - pixelValue) < 0.1) {
            return token;
        }
    }
    return null;
}

/**
 * Find closest spacing token by value
 */
function findClosestSpacingToken(pixelValue: number, tokens: Token[]): string {
    let closest: Token | null = null;
    let minDiff = Infinity;
    
    for (const token of tokens) {
        const tokenValue = typeof token.rawValue === 'number' 
            ? token.rawValue 
            : parseFloat(String(token.rawValue).replace('px', ''));
        
        const diff = Math.abs(tokenValue - pixelValue);
        if (diff < minDiff) {
            minDiff = diff;
            closest = token;
        }
    }
    
    return closest ? closest.name : 'spacing.md';
}

/**
 * Generate fixed code suggestion
 */
function generateFixedCode(originalContent: string, match: { value: string; line: number; column: number }, suggestedToken: string): string {
    const lines = originalContent.split('\n');
    const lineIndex = match.line - 1;
    const line = lines[lineIndex];
    
    if (!line) return originalContent;
    
    // Replace the raw value with token reference
    // For CSS: var(--token-name)
    // For TSX: token variable or CSS variable
    const isCSS = line.includes(':') && line.includes(';');
    const replacement = isCSS 
        ? `var(--${suggestedToken.replace(/\./g, '-')})`
        : `token('${suggestedToken}')`;
    
    const fixedLine = line.replace(match.value, replacement);
    lines[lineIndex] = fixedLine;
    
    return lines.join('\n');
}

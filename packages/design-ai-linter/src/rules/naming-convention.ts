import { Token, Diagnostic } from '../types';

export function ruleNamingConvention(tokens: Token[], pattern: RegExp, severity: 'error' | 'warn' | 'info' = 'error'): Diagnostic[] {
    const diags: Diagnostic[] = [];
    for (const t of tokens) {
        if (!pattern.test(t.name)) {
            diags.push({
                ruleId: 'naming-convention',
                message: `Token name "${t.name}" does not match pattern ${pattern}`,
                severity,
                tokenName: t.name,
                suggestion: t.name.toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-')
            });
        }
    }
    return diags;
}

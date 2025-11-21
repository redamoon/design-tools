import { Token, Diagnostic } from '../types';
import { ruleNamingConvention } from '../rules/naming-convention';

export type StaticRuleConfig = {
    'naming-convention'?: { severity: 'error' | 'warn' | 'info', pattern: string };
};

export function runStaticRules(tokens: Token[], config: StaticRuleConfig): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Rule: Naming Convention
    if (config['naming-convention']) {
        const ruleCfg = config['naming-convention'];
        const pattern = new RegExp(ruleCfg.pattern);
        diagnostics.push(...ruleNamingConvention(tokens, pattern, ruleCfg.severity));
    }

    return diagnostics;
}

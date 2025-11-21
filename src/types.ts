export type Token = {
    type: string; // color | size | typography | shadow | ...
    name: string; // semantic path: color.primary.base
    rawValue: any;
    value?: any; // normalized
    meta?: Record<string, any>;
};

export type Diagnostic = {
    ruleId: string;
    message: string;
    severity: 'error' | 'warn' | 'info';
    tokenName?: string;
    suggestion?: string;
};

export type LintContext = {
    tokens: Token[];
    // Future: Add components, etc.
};

export type AIRule = {
    id: string;
    description: string;
    prompt: (context: LintContext) => string;
    schema: any; // Zod schema
    severity: 'error' | 'warn' | 'info';
};

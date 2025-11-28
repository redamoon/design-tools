import { Diagnostic } from '../types';
import fs from 'fs/promises';
import path from 'path';

export interface LintReport {
    issues: Array<{
        file?: string;
        line?: number | null;
        problem?: string;
        reason?: string;
        suggestedToken?: string;
        fixedCode?: string;
        impact?: 'Low' | 'Medium' | 'High';
        ruleId: string;
        message: string;
        severity: 'error' | 'warn' | 'info';
        tokenName?: string;
        suggestion?: string;
    }>;
    summary: {
        total: number;
        errors: number;
        warnings: number;
        info: number;
    };
}

export async function generateJSONReport(
    diagnostics: Diagnostic[],
    outputPath?: string
): Promise<string> {
    const report: LintReport = {
        issues: diagnostics.map(d => ({
            file: d.file,
            line: d.line,
            problem: d.problem,
            reason: d.reason,
            suggestedToken: d.suggestedToken,
            fixedCode: d.fixedCode,
            impact: d.impact,
            ruleId: d.ruleId,
            message: d.message,
            severity: d.severity,
            tokenName: d.tokenName,
            suggestion: d.suggestion
        })),
        summary: {
            total: diagnostics.length,
            errors: diagnostics.filter(d => d.severity === 'error').length,
            warnings: diagnostics.filter(d => d.severity === 'warn').length,
            info: diagnostics.filter(d => d.severity === 'info').length
        }
    };

    const jsonString = JSON.stringify(report, null, 2);

    if (outputPath) {
        const resolvedPath = path.resolve(process.cwd(), outputPath);
        await fs.writeFile(resolvedPath, jsonString, 'utf-8');
        console.log(`📄 レポートを ${resolvedPath} に書き込みました`);
    }

    return jsonString;
}


import { Diagnostic } from '../types';

export function generatePRCommentReport(diagnostics: Diagnostic[]): string {
    if (diagnostics.length === 0) {
        return '### 🎨 AI Design Lint 結果\n\n✔ 問題は見つかりませんでした。';
    }

    const errors = diagnostics.filter(d => d.severity === 'error');
    const warnings = diagnostics.filter(d => d.severity === 'warn');
    const info = diagnostics.filter(d => d.severity === 'info');

    let report = '### 🎨 AI Design Lint 結果\n\n';
    
    if (errors.length > 0) {
        report += `❌ **エラー**: ${errors.length}件\n`;
    }
    if (warnings.length > 0) {
        report += `⚠️ **警告**: ${warnings.length}件\n`;
    }
    if (info.length > 0) {
        report += `ℹ️ **情報**: ${info.length}件\n`;
    }
    
    report += '\n---\n\n';

    // Group by file
    const byFile = new Map<string, Diagnostic[]>();
    for (const diag of diagnostics) {
        const file = diag.file || 'Unknown';
        if (!byFile.has(file)) {
            byFile.set(file, []);
        }
        byFile.get(file)!.push(diag);
    }

    for (const [file, fileDiags] of byFile.entries()) {
        report += `#### 📄 ${file}\n\n`;
        
        for (const diag of fileDiags) {
            const severityIcon = diag.severity === 'error' ? '❌' : diag.severity === 'warn' ? '⚠️' : 'ℹ️';
            const lineInfo = diag.line !== null && diag.line !== undefined ? ` (line ${diag.line})` : '';
            
            report += `${severityIcon} **${diag.ruleId}**${lineInfo}\n\n`;
            
            if (diag.problem) {
                report += `- **問題**: ${diag.problem}\n`;
            }
            if (diag.reason) {
                report += `- **理由**: ${diag.reason}\n`;
            }
            if (diag.suggestedToken) {
                report += `- **推奨トークン**: \`${diag.suggestedToken}\`\n`;
            }
            if (diag.fixedCode) {
                report += `- **修正案**:\n`;
                report += `\`\`\`\n${diag.fixedCode}\n\`\`\`\n`;
            }
            if (diag.impact) {
                report += `- **影響度**: ${diag.impact}\n`;
            }
            if (diag.suggestion) {
                report += `- **提案**: ${diag.suggestion}\n`;
            }
            
            report += '\n';
        }
    }

    return report;
}


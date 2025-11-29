import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { CodeFile } from '../types';

/**
 * Load code files matching the given glob pattern
 * Supports simple patterns like "src/**\/*.{tsx,ts,css,scss}"
 */
export async function loadCodeFiles(
    pattern: string,
    baseDir: string = process.cwd()
): Promise<CodeFile[]> {
    const files: CodeFile[] = [];
    
    // Simple glob pattern matching
    // For now, support basic patterns like "src/**/*.tsx" or "src/**/*.{tsx,css}"
    const normalizedPattern = pattern.replace(/\\/g, '/');
    const parts = normalizedPattern.split('/');
    
    // Extract file extensions
    const extMatch = normalizedPattern.match(/\{([^}]+)\}/);
    const extensions = extMatch 
        ? extMatch[1].split(',').map(ext => ext.trim())
        : [normalizedPattern.split('.').pop() || ''];
    
    // Extract directory pattern (everything before the last /)
    const dirPattern = parts.slice(0, -1).join('/');
    
    // Resolve base directory
    const resolvedBaseDir = path.resolve(baseDir);
    
    // Recursively search for files
    await searchDirectory(resolvedBaseDir, dirPattern, extensions, files);
    
    return files;
}

async function searchDirectory(
    currentDir: string,
    dirPattern: string,
    extensions: string[],
    files: CodeFile[]
): Promise<void> {
    try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
            // Skip node_modules, dist, build, etc.
            if (entry.name.startsWith('.') || 
                entry.name === 'node_modules' || 
                entry.name === 'dist' || 
                entry.name === 'build') {
                continue;
            }
            
            const fullPath = path.join(currentDir, entry.name);
            
            if (entry.isDirectory()) {
                // Check if directory matches pattern (supports ** wildcard)
                if (dirPattern.includes('**') || dirPattern === '' || 
                    entry.name === dirPattern || 
                    dirPattern.split('/').includes(entry.name)) {
                    await searchDirectory(fullPath, dirPattern, extensions, files);
                }
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name);
                if (extensions.some(e => ext === `.${e}` || ext === e)) {
                    const content = await fs.readFile(fullPath, 'utf-8');
                    const relativePath = path.relative(process.cwd(), fullPath);
                    
                    // Determine language
                    let language: CodeFile['language'] = 'typescript';
                    if (ext === '.css') language = 'css';
                    else if (ext === '.scss' || ext === '.sass') language = 'scss';
                    else if (ext === '.js' || ext === '.jsx') language = 'javascript';
                    else if (ext === '.ts' || ext === '.tsx') language = 'typescript';
                    
                    files.push({
                        path: relativePath,
                        content,
                        language
                    });
                }
            }
        }
    } catch (error) {
        // Skip directories we can't read
        return;
    }
}

/**
 * Extract raw color values from code content
 * Returns array of { value, line, column }
 */
export function extractRawColors(content: string): Array<{ value: string; line: number; column: number }> {
    const colors: Array<{ value: string; line: number; column: number }> = [];
    const lines = content.split('\n');
    
    // Hex colors: #RRGGBB or #RGB
    const hexPattern = /#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/g;
    
    // RGB/RGBA: rgb(255, 255, 255) or rgba(255, 255, 255, 0.5)
    const rgbPattern = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/g;
    
    // HSL/HSLA: hsl(0, 100%, 50%) or hsla(0, 100%, 50%, 0.5)
    const hslPattern = /hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%(?:\s*,\s*[\d.]+)?\s*\)/g;
    
    lines.forEach((line, lineIndex) => {
        // Skip comments and strings that might contain color-like text
        // This is a simple heuristic - for production, use AST parsing
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
            return;
        }
        
        // Find hex colors
        let match;
        while ((match = hexPattern.exec(line)) !== null) {
            colors.push({
                value: match[0],
                line: lineIndex + 1,
                column: match.index + 1
            });
        }
        
        // Find RGB colors
        while ((match = rgbPattern.exec(line)) !== null) {
            colors.push({
                value: match[0],
                line: lineIndex + 1,
                column: match.index + 1
            });
        }
        
        // Find HSL colors
        while ((match = hslPattern.exec(line)) !== null) {
            colors.push({
                value: match[0],
                line: lineIndex + 1,
                column: match.index + 1
            });
        }
    });
    
    return colors;
}

/**
 * Extract raw pixel values from code content
 * Returns array of { value, line, column }
 */
export function extractRawPixels(content: string): Array<{ value: string; line: number; column: number }> {
    const pixels: Array<{ value: string; line: number; column: number }> = [];
    const lines = content.split('\n');
    
    // Match patterns like: 16px, 24px, 1.5px, etc.
    // But exclude common token patterns like var(--spacing-md)
    const pxPattern = /\b(\d+(?:\.\d+)?)px\b/g;
    
    lines.forEach((line, lineIndex) => {
        // Skip comments
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
            return;
        }
        
        // Skip if it's a CSS variable or token reference
        if (line.includes('var(') || line.includes('--')) {
            return;
        }
        
        let match;
        while ((match = pxPattern.exec(line)) !== null) {
            // Skip if it's part of a token name or variable
            const beforeMatch = line.substring(Math.max(0, match.index - 20), match.index);
            if (beforeMatch.includes('--') || beforeMatch.includes('token')) {
                continue;
            }
            
            pixels.push({
                value: match[0],
                line: lineIndex + 1,
                column: match.index + 1
            });
        }
    });
    
    return pixels;
}

/**
 * Get changed files from git diff
 * @param baseDir - Base directory to run git commands from
 * @param staged - If true, get staged files. If false, get unstaged files. If undefined, get both staged and unstaged.
 * @param commitRange - Optional commit range (e.g., "HEAD~1..HEAD" or "main..HEAD")
 * @returns Array of changed file paths relative to baseDir
 */
export function getGitChangedFiles(
    baseDir: string = process.cwd(),
    staged?: boolean,
    commitRange?: string
): string[] {
    try {
        let command: string;
        
        if (commitRange) {
            // Get files changed in commit range
            command = `git diff --name-only ${commitRange}`;
        } else if (staged === true) {
            // Get staged files
            command = 'git diff --cached --name-only';
        } else if (staged === false) {
            // Get unstaged files
            command = 'git diff --name-only';
        } else {
            // Get both staged and unstaged files
            command = 'git diff --name-only HEAD';
        }
        
        const output = execSync(command, {
            cwd: baseDir,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        const files = output
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .filter(file => {
                // Filter to only include code files that we can analyze
                const ext = path.extname(file);
                return ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.sass'].includes(ext);
            });
        
        return files;
    } catch (error: any) {
        // If git command fails (e.g., not a git repo), return empty array
        console.warn(`⚠️  Gitコマンドの実行に失敗しました: ${error.message}`);
        return [];
    }
}

/**
 * Load code files from git diff
 * @param baseDir - Base directory to run git commands from
 * @param staged - If true, get staged files. If false, get unstaged files. If undefined, get both staged and unstaged.
 * @param commitRange - Optional commit range (e.g., "HEAD~1..HEAD" or "main..HEAD")
 * @returns Array of CodeFile objects for changed files
 */
export async function loadCodeFilesFromGitDiff(
    baseDir: string = process.cwd(),
    staged?: boolean,
    commitRange?: string
): Promise<CodeFile[]> {
    const changedFiles = getGitChangedFiles(baseDir, staged, commitRange);
    const codeFiles: CodeFile[] = [];
    
    for (const filePath of changedFiles) {
        try {
            const fullPath = path.resolve(baseDir, filePath);
            const content = await fs.readFile(fullPath, 'utf-8');
            const ext = path.extname(filePath);
            
            // Determine language
            let language: CodeFile['language'] = 'typescript';
            if (ext === '.css') language = 'css';
            else if (ext === '.scss' || ext === '.sass') language = 'scss';
            else if (ext === '.js' || ext === '.jsx') language = 'javascript';
            else if (ext === '.ts' || ext === '.tsx') language = 'typescript';
            
            codeFiles.push({
                path: filePath,
                content,
                language
            });
        } catch (error: any) {
            // Skip files that can't be read (e.g., deleted files)
            console.warn(`⚠️  ファイルを読み込めませんでした: ${filePath} - ${error.message}`);
        }
    }
    
    return codeFiles;
}


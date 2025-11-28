import fs from 'fs/promises';
import { Token } from '../types';

export async function loadTokensFromJson(path: string): Promise<Token[]> {
    const raw = await fs.readFile(path, 'utf-8');
    const json = JSON.parse(raw);
    // Parses format compatible with Figma Tokens / Token Studio / W3C
    // Simplified example: { "color": { "primary": { "base": { "value": "#ff0000", "type": "color" } } } }
    const tokens: Token[] = [];

    function walk(obj: any, prefix = '') {
        for (const k of Object.keys(obj)) {
            const val = obj[k];
            const name = prefix ? `${prefix}.${k}` : k;

            // Check if this node is a token (has a 'value' or '$value' property)
            if (val && typeof val === 'object' && ('value' in val || '$value' in val)) {
                const rawValue = val.value ?? val.$value;
                const type = val.type ?? val.$type ?? (typeof rawValue === 'string' && rawValue.startsWith('#') ? 'color' : 'other');
                tokens.push({
                    type,
                    name,
                    rawValue,
                    meta: val
                });
            } else if (typeof val === 'object') {
                // Continue traversing
                walk(val, name);
            }
        }
    }

    walk(json);
    return tokens;
}

import { describe, it, expect, vi } from 'vitest';
import { loadTokensFromJson } from '../../src/adapters/tokensJsonAdapter';
import fs from 'fs/promises';

vi.mock('fs/promises');

describe('tokensJsonAdapter', () => {
    const mockRead = vi.mocked(fs.readFile);

    it('should parse standard format (value/type)', async () => {
        const json = {
            color: {
                primary: {
                    value: '#ff0000',
                    type: 'color'
                }
            }
        };
        mockRead.mockResolvedValue(JSON.stringify(json));

        const tokens = await loadTokensFromJson('dummy.json');
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toMatchObject({
            name: 'color.primary',
            rawValue: '#ff0000',
            type: 'color'
        });
    });

    it('should parse W3C format ($value/$type)', async () => {
        const json = {
            color: {
                primary: {
                    $value: '#00ff00',
                    $type: 'color'
                }
            }
        };
        mockRead.mockResolvedValue(JSON.stringify(json));

        const tokens = await loadTokensFromJson('dummy.json');
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toMatchObject({
            name: 'color.primary',
            rawValue: '#00ff00',
            type: 'color'
        });
    });

    it('should parse deeply nested plugin format (Collection/Mode)', async () => {
        const json = {
            "Collection 1": {
                "Mode 1": {
                    "brand": {
                        "primary": {
                            "$value": "#0000ff",
                            "$type": "color"
                        }
                    }
                }
            }
        };
        mockRead.mockResolvedValue(JSON.stringify(json));

        const tokens = await loadTokensFromJson('dummy.json');
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toMatchObject({
            name: 'Collection 1.Mode 1.brand.primary',
            rawValue: '#0000ff',
            type: 'color'
        });
    });

    it('should infer type from value if missing', async () => {
        const json = {
            spacing: {
                small: {
                    value: '8px'
                }
            },
            color: {
                text: {
                    value: '#333'
                }
            }
        };
        mockRead.mockResolvedValue(JSON.stringify(json));

        const tokens = await loadTokensFromJson('dummy.json');
        expect(tokens).toHaveLength(2);
        const colorToken = tokens.find(t => t.name === 'color.text');
        const spacingToken = tokens.find(t => t.name === 'spacing.small');

        expect(colorToken?.type).toBe('color');
        expect(spacingToken?.type).toBe('other');
    });
});

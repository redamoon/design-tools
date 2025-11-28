import fs from 'fs/promises';
import path from 'path';

// --- Types ---

// Variables API (Enterprise)
type FigmaVariable = {
    id: string;
    name: string;
    key: string;
    variableCollectionId: string;
    resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
    valuesByMode: { [modeId: string]: any };
};

type FigmaVariablesResponse = {
    status: number;
    error: boolean;
    meta: {
        variables: { [id: string]: FigmaVariable };
        variableCollections: { [id: string]: any };
    };
};

// Styles API (Standard/Pro)
type FigmaStyle = {
    key: string;
    file_key: string;
    node_id: string;
    style_type: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
    thumbnail_url: string;
    name: string;
    description: string;
};

type FigmaStylesResponse = {
    status: number;
    error: boolean;
    meta: {
        styles: FigmaStyle[];
    };
};

// Nodes API
type FigmaNodeResponse = {
    nodes: {
        [nodeId: string]: {
            document: {
                id: string;
                name: string;
                type: string;
                fills?: { type: string; color?: { r: number; g: number; b: number; a: number }; opacity?: number }[];
                style?: {
                    fontFamily: string;
                    fontWeight: number;
                    fontSize: number;
                    lineHeightPx: number;
                };
                // Add other properties as needed
            };
        };
    };
};

// --- Main Sync Function ---

export async function syncFigmaTokens(fileKey: string, personalAccessToken: string, outputPath: string) {
    console.log(`🔄 Figmaファイルからトークンを同期中: ${fileKey}...`);

    let tokens = {};
    let source = '';

    try {
        // Attempt 1: Try Variables API (Enterprise)
        console.log('👉 ローカル変数（Enterprise機能）の取得を試行中...');
        tokens = await trySyncVariables(fileKey, personalAccessToken);
        source = 'Variables';
        console.log('✅ 変数の取得に成功しました。');
    } catch (error: any) {
        // Check for 403 (Forbidden) or 404 (Not Found) which implies plan restriction or no variables
        if (error.message.includes('403') || error.message.includes('404')) {
            console.warn(`⚠️  変数APIが失敗しました（${error.message}）。スタイルAPIにフォールバックします...`);
            
            // Attempt 2: Fallback to Styles API (Pro/Standard)
            try {
                tokens = await syncStyles(fileKey, personalAccessToken);
                source = 'Styles';
                console.log('✅ スタイルの取得に成功しました。');
            } catch (styleError: any) {
                console.error('❌ スタイルの取得中にエラーが発生しました:', styleError.message);
                throw new Error('変数APIとスタイルAPIの両方からの同期に失敗しました。');
            }
        } else {
            // If it's another error (e.g. network), rethrow
            throw error;
        }
    }

    const outputContent = JSON.stringify(tokens, null, 2);
    await fs.writeFile(outputPath, outputContent);
    console.log(`💾 ${source}トークンを ${outputPath} に保存しました`);
}

// --- Strategies ---

async function trySyncVariables(fileKey: string, token: string): Promise<any> {
    const response = await fetch(`https://api.figma.com/v1/files/${fileKey}/variables/local`, {
        headers: { 'X-Figma-Token': token }
    });

    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
    }

    const data = await response.json() as FigmaVariablesResponse;
    if (data.error) throw new Error(JSON.stringify(data));

    const tokens: any = {};
    for (const v of Object.values(data.meta.variables)) {
        const name = v.name.replace(/\//g, '.');
        let value = v.valuesByMode[Object.keys(v.valuesByMode)[0]]; // Take first mode

        if (v.resolvedType === 'COLOR' && typeof value === 'object') {
            value = rgbaToHex(value.r, value.g, value.b, 1); // Variables usually don't have alpha in value object directly like this? 
            // Actually Figma variables color value is {r, g, b, a} usually? 
            // Let's stick to previous implementation logic but safer
             if ('r' in value) {
                 value = rgbaToHex(value.r, value.g, value.b, value.a ?? 1);
             }
        }

        setDeep(tokens, name.split('.'), { value, type: v.resolvedType.toLowerCase() });
    }
    return tokens;
}

async function syncStyles(fileKey: string, token: string): Promise<any> {
    // 1. Get Styles list
    const stylesResp = await fetch(`https://api.figma.com/v1/files/${fileKey}/styles`, {
        headers: { 'X-Figma-Token': token }
    });

    if (!stylesResp.ok) throw new Error(`Styles API: ${stylesResp.status} ${stylesResp.statusText}`);
    
    const stylesData = await stylesResp.json() as FigmaStylesResponse;
    if (stylesData.error || !stylesData.meta?.styles) throw new Error('Invalid Styles response');

    const styles = stylesData.meta.styles;
    if (styles.length === 0) return {};

    console.log(`${styles.length}個のスタイルが見つかりました。詳細を取得中...`);

    // 2. Get Node details for each style to find the actual value
    // Figma allows up to ~100-200 ids per request, but let's chunk safely if needed. 
    // For now, assuming reasonable size.
    const nodeIds = styles.map(s => s.node_id).join(',');
    const nodesResp = await fetch(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeIds}`, {
        headers: { 'X-Figma-Token': token }
    });

    if (!nodesResp.ok) throw new Error(`Nodes API: ${nodesResp.status} ${nodesResp.statusText}`);

    const nodesData = await nodesResp.json() as FigmaNodeResponse;
    const nodes = nodesData.nodes;

    const tokens: any = {};

    for (const style of styles) {
        const node = nodes[style.node_id]?.document;
        if (!node) continue;

        const name = style.name.replace(/\//g, '.');
        let value: any = null;
        let type = style.style_type.toLowerCase();

        if (style.style_type === 'FILL') {
            // Find the first solid color fill
            const fill = node.fills?.find(f => f.type === 'SOLID' && f.color);
            if (fill && fill.color) {
                value = rgbaToHex(fill.color.r, fill.color.g, fill.color.b, (fill.color.a ?? 1) * (fill.opacity ?? 1));
                type = 'color';
            }
        } else if (style.style_type === 'TEXT') {
            // Simplify text style to just font family/size for this demo
            if (node.style) {
                value = {
                    fontFamily: node.style.fontFamily,
                    fontSize: node.style.fontSize,
                    fontWeight: node.style.fontWeight
                };
                type = 'typography';
            }
        }

        if (value) {
            setDeep(tokens, name.split('.'), { value, type });
        }
    }

    return tokens;
}

// --- Helpers ---

function setDeep(obj: any, path: string[], value: any) {
    let current = obj;
    for (let i = 0; i < path.length; i++) {
        const key = path[i];
        if (i === path.length - 1) {
            current[key] = value;
        } else {
            current[key] = current[key] || {};
            current = current[key];
        }
    }
}

function rgbaToHex(r: number, g: number, b: number, a: number) {
    const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
    const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    return a < 1 ? `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}` : hex;
}

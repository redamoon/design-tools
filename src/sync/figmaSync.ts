import fs from 'fs/promises';
import path from 'path';

// Types for Figma API response (simplified)
type FigmaVariable = {
    id: string;
    name: string;
    key: string;
    variableCollectionId: string;
    resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
    valuesByMode: { [modeId: string]: any };
};

type FigmaAPIResponse = {
    status: number;
    error: boolean;
    meta: {
        variables: { [id: string]: FigmaVariable };
        variableCollections: { [id: string]: any };
    };
};

export async function syncFigmaTokens(fileKey: string, personalAccessToken: string, outputPath: string) {
    console.log(`🔄 Syncing tokens from Figma File: ${fileKey}...`);

    try {
        // In a real implementation, we would use fetch/axios here.
        // const response = await fetch(\`https://api.figma.com/v1/files/\${fileKey}/variables/local\`, {
        //   headers: { 'X-Figma-Token': personalAccessToken }
        // });
        // const data = await response.json();

        // MOCK DATA for demonstration
        const mockData: FigmaAPIResponse = {
            status: 200,
            error: false,
            meta: {
                variables: {
                    "var:1": {
                        id: "var:1",
                        name: "color/primary/500",
                        key: "key:1",
                        variableCollectionId: "col:1",
                        resolvedType: "COLOR",
                        valuesByMode: { "mode:1": { r: 0.1, g: 0.45, b: 0.91, a: 1 } } // #1A73E8
                    },
                    "var:2": {
                        id: "var:2",
                        name: "spacing/md",
                        key: "key:2",
                        variableCollectionId: "col:1",
                        resolvedType: "FLOAT",
                        valuesByMode: { "mode:1": 16 }
                    }
                },
                variableCollections: {}
            }
        };

        console.log(`✅ Fetched ${Object.keys(mockData.meta.variables).length} variables.`);

        // Transform to Design Token Format (W3C draft or simple JSON)
        const tokens: any = {};

        for (const v of Object.values(mockData.meta.variables)) {
            const name = v.name.replace(/\//g, '.'); // color/primary -> color.primary
            let value = v.valuesByMode["mode:1"]; // Assuming first mode

            // Convert Figma Color to Hex
            if (v.resolvedType === 'COLOR' && typeof value === 'object') {
                const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
                value = `#${toHex(value.r)}${toHex(value.g)}${toHex(value.b)}`;
            }

            // Build nested object or flat map. For this linter, flat map with semantic names is easier for now,
            // but let's stick to the format expected by our adapter (nested or flat).
            // Our adapter supports nested, but let's output a flat map for simplicity in this sync demo,
            // or reconstruct the nesting.

            // Let's output the format our tokens.json uses (nested).
            // Simple implementation: set value at path
            setDeep(tokens, name.split('.'), { value, type: v.resolvedType.toLowerCase() });
        }

        const outputContent = JSON.stringify(tokens, null, 2);
        await fs.writeFile(outputPath, outputContent);
        console.log(`💾 Saved tokens to ${outputPath}`);

    } catch (error: any) {
        console.error('❌ Error syncing Figma tokens:', error.message);
        throw error;
    }
}

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

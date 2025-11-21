import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// TOON Types
export type TokenMap = Record<string, string>; // Key -> Token
export type ReverseTokenMap = Record<string, string>; // Token -> Key

export class ToonConverter {
  private keyToToken: TokenMap;
  private tokenToKey: ReverseTokenMap;
  private nextTokenId: number;

  constructor(initialMap: TokenMap = {}) {
    this.keyToToken = { ...initialMap };
    this.tokenToKey = Object.entries(initialMap).reduce((acc, [k, v]) => {
      acc[v] = k;
      return acc;
    }, {} as ReverseTokenMap);
    
    // Determine next token ID based on existing ones or start at 1
    const existingIds = Object.values(this.keyToToken)
      .map(t => parseInt(t, 10))
      .filter(n => !isNaN(n));
    this.nextTokenId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
  }

  private getToken(key: string): string {
    if (this.keyToToken[key]) {
      return this.keyToToken[key];
    }
    const token = this.nextTokenId.toString().padStart(2, '0');
    this.keyToToken[key] = token;
    this.tokenToKey[token] = key;
    this.nextTokenId++;
    return token;
  }

  private getKey(token: string): string {
    return this.tokenToKey[token] || `UNKNOWN_${token}`;
  }

  public getMapping() {
    return { keyToToken: this.keyToToken, tokenToKey: this.tokenToKey };
  }

  // JSON -> TOON
  public jsonToToon(jsonInput: any): string {
    let obj: any;
    try {
        obj = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
    } catch (e) {
        throw new Error("Invalid JSON input");
    }

    const lines: string[] = [];

    const process = (item: any, level: number, parentIsArray: boolean = false) => {
      const indent = "  ".repeat(level);
      
      if (item === null) {
        return "null";
      } else if (typeof item === 'boolean') {
        return item ? "yes" : "no";
      } else if (typeof item === 'number' || typeof item === 'string') {
        return item.toString();
      } else if (Array.isArray(item)) {
        if (item.length === 0) return "[]";
        
        item.forEach(subItem => {
          if (typeof subItem === 'object' && subItem !== null) {
            // Array of objects/arrays
            lines.push(`${indent}-`);
            // For objects inside arrays, we process them at the same indentation level but they effectively belong to the dash
            // However, TOON format example implies structure. 
            // Let's assume:
            // 03:
            //   - value
            //   - key: value (if object)
            
            // If it's a complex object, we might need to indent its keys
            // But standard YAML list of objects:
            // - key: val
            
            if (Array.isArray(subItem)) {
                 process(subItem, level + 1, true);
            } else {
                 // Object inside array
                 const keys = Object.keys(subItem);
                 keys.forEach((k, idx) => {
                     const token = this.getToken(k);
                     const val = subItem[k];
                     const isComplex = typeof val === 'object' && val !== null;
                     // First key goes on same line as dash? Or indented?
                     // YAML: 
                     // - key: val
                     //   key2: val2
                     const prefix = idx === 0 ? `${indent}- ${token}:` : `${indent}  ${token}:`;
                     
                     // Actually, let's stick to the prompt example for arrays:
                     // 03:
                     //   - Kamehameha
                     //   - Spirit Bomb
                     // It seems simple lists are supported. Complex lists of objects might be tricky without specific spec.
                     // Let's treat object in array as:
                     // - 
                     //   01: val
                     
                     if (idx === 0) {
                         // HACK for simple object in array: just indent everything under the dash
                         // But wait, prompt says "Arrays should use '-' prefix".
                         // Let's try to keep it simple.
                         lines.push(`${indent}  ${token}: ${isComplex ? '' : process(val, 0)}`);
                         if (isComplex) process(val, level + 2);
                     } else {
                         lines.push(`${indent}  ${token}: ${isComplex ? '' : process(val, 0)}`);
                         if (isComplex) process(val, level + 2);
                     }
                 });
            }
          } else {
            // Primitive in array
            lines.push(`${indent}- ${process(subItem, 0)}`);
          }
        });
        return ""; // Handled via side effects (pushing to lines)
      } else if (typeof item === 'object') {
        // Object
        if (Object.keys(item).length === 0) return "{}";
        
        Object.entries(item).forEach(([k, v]) => {
          const token = this.getToken(k);
          const isComplex = typeof v === 'object' && v !== null;
          // If we are inside an array (parentIsArray), this function shouldn't be called directly to generate lines unless handled carefully.
          // But here we are handling the "value" part of a key-value pair, or the root object.
          
          const lineStart = `${indent}${token}:`;
          if (isComplex) {
            lines.push(lineStart);
            process(v, level + 1);
          } else {
            lines.push(`${lineStart} ${process(v, 0)}`);
          }
        });
        return "";
      }
      return String(item);
    };

    if (typeof obj === 'object' && obj !== null) {
        process(obj, 0);
    } else {
        // Root primitive
        return process(obj, 0);
    }

    return lines.join('\n');
  }

  // TOON -> JSON
  public toonToJson(toonInput: string): string {
    const lines = toonInput.split('\n').filter(l => l.trim().length > 0);
    
    // Simple parser using a stack
    // Each item in stack: { container: any, indent: number, key?: string, type: 'object' | 'array' | 'root' }
    
    const root: any = {};
    // We need to detect if root is array or object. 
    // If first line starts with "-", root is array. Else object.
    // But wait, TOON keys are tokens. "01: val". So root is likely object.
    
    // Let's build a tree first then convert to JSON
    
    type Node = {
      indent: number;
      key: string | null; // null if array item
      value: any; // string (placeholder) or primitives
      children: Node[];
      parent: Node | null;
      isArrayItem: boolean;
    };

    const rootNode: Node = { indent: -1, key: null, value: null, children: [], parent: null, isArrayItem: false };
    let lastNode = rootNode;
    
    // Helper to find parent for current indentation
    const findParent = (indent: number) => {
        let curr = lastNode;
        while (curr && curr.indent >= indent) {
            curr = curr.parent!;
        }
        return curr || rootNode;
    };

    for (const line of lines) {
        const indent = line.search(/\S/);
        const content = line.trim();
        
        if (content.startsWith('-')) {
            // Array item
            const valuePart = content.substring(1).trim();
            // It's a list item.
            // Parent should be at lower indent.
            const parent = findParent(indent);
            
            const newNode: Node = {
                indent,
                key: null,
                value: valuePart === '' ? null : valuePart, // If empty, might have children (nested)
                children: [],
                parent,
                isArrayItem: true
            };
            parent.children.push(newNode);
            lastNode = newNode;
            
            // Handle inline key-value inside array item? "- 01: val"
            // The prompt says "- Value". 
            // If valuePart contains ":", treat as object key? 
            // Prompt: 03: \n - Val1 \n - Val2.
            // Let's stick to basic array items for now.
        } else if (content.includes(':')) {
            // Key-Value
            const colonIdx = content.indexOf(':');
            const token = content.substring(0, colonIdx).trim();
            const valPart = content.substring(colonIdx + 1).trim();
            
            const parent = findParent(indent);
            
            const newNode: Node = {
                indent,
                key: token,
                value: valPart === '' ? null : valPart,
                children: [],
                parent,
                isArrayItem: false
            };
            parent.children.push(newNode);
            lastNode = newNode;
        } else {
            // Just a value? Should not happen in valid YAML-like structure unless multiline string (ignoring for now)
        }
    }

    // Convert Tree to Object
    const convertNode = (node: Node): any => {
        // Determine if this node represents an object, array, or primitive
        
        // If it has children:
        if (node.children.length > 0) {
            // Check if children are array items or object keys
            const isArray = node.children.every(c => c.isArrayItem);
            const isObject = node.children.every(c => !c.isArrayItem);
            
            if (isArray) {
                return node.children.map(c => {
                    if (c.value !== null && c.children.length === 0) return parseValue(c.value);
                    // If it has children, recurse
                    if (c.children.length > 0) return convertNode(c);
                    return null; // Empty dash?
                });
            } else if (isObject) {
                const obj: any = {};
                node.children.forEach(c => {
                    const realKey = this.getKey(c.key!);
                    if (c.value !== null && c.children.length === 0) {
                        obj[realKey] = parseValue(c.value);
                    } else {
                        obj[realKey] = convertNode(c);
                    }
                });
                return obj;
            } else {
                // Mixed? Format error. Default to object and ignore dashes?
                // Let's assume object.
                 const obj: any = {};
                node.children.forEach(c => {
                     if (c.key) {
                        const realKey = this.getKey(c.key);
                        obj[realKey] = c.children.length > 0 ? convertNode(c) : parseValue(c.value);
                     }
                });
                return obj;
            }
        } else {
            return parseValue(node.value);
        }
    };

    // Start conversion from root children
    // Root children should define the top-level structure
    const isRootArray = rootNode.children.every(c => c.isArrayItem);
    
    if (isRootArray) {
        const res = rootNode.children.map(c => {
             if (c.children.length > 0) return convertNode(c);
             return parseValue(c.value);
        });
        return JSON.stringify(res, null, 2);
    } else {
        // Root object
        const obj: any = {};
        rootNode.children.forEach(c => {
             if (c.key) {
                 const realKey = this.getKey(c.key);
                 if (c.children.length > 0) {
                     obj[realKey] = convertNode(c);
                 } else {
                     obj[realKey] = parseValue(c.value);
                 }
             }
        });
        return JSON.stringify(obj, null, 2);
    }
  }
}

function parseValue(val: any): any {
    if (val === null) return null;
    const v = String(val).trim();
    if (v === 'yes') return true;
    if (v === 'no') return false;
    if (!isNaN(Number(v))) return Number(v);
    return v;
}

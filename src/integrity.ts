import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const textExtensions = new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.css','.html','.md','.txt','.yml','.yaml','.svg']);

/** Normalize CRLF only. Keep whitespace, BOMs and all non-newline bytes significant. */
export function integrityHash(file: string, data: Uint8Array): string {
  let bytes = Buffer.from(data);
  if (textExtensions.has(path.extname(file).toLowerCase())) {
    const normalized = Buffer.allocUnsafe(bytes.length);
    let length = 0;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 13 && bytes[i + 1] === 10) continue;
      normalized[length++] = bytes[i];
    }
    bytes = normalized.subarray(0, length);
  }
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function fileHash(file: string): string {
  return integrityHash(file, fs.readFileSync(file));
}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {integrityHash} from './integrity';

test('text integrity is identical for LF, CRLF and mixed newlines',()=>{
 const lf=Buffer.from('첫 줄\nsecond line\n');
 for(const extension of ['ts','tsx','css','json','svg']){
  assert.equal(integrityHash('a.'+extension,lf),integrityHash('a.'+extension,Buffer.from('첫 줄\r\nsecond line\r\n')));
  assert.equal(integrityHash('a.'+extension,lf),integrityHash('a.'+extension,Buffer.from('첫 줄\r\nsecond line\n')));
 }
});
test('normalization does not conceal content, whitespace, lone CR or BOM changes',()=>{
 const original=integrityHash('a.ts',Buffer.from('value = 1;\n'));
 for(const changed of ['value = 2;\n','value=1;\n','value = 1;\r','\uFEFFvalue = 1;\n'])assert.notEqual(integrityHash('a.ts',Buffer.from(changed)),original);
});
test('binary media always use exact original bytes, including CRLF byte sequences',()=>{
 const crlf=Buffer.from([0,13,10,255]),lf=Buffer.from([0,10,255]);
 for(const extension of ['png','webp','jpg','wav','mp3']){
  assert.equal(integrityHash('a.'+extension,crlf),crypto.createHash('sha256').update(crlf).digest('hex'));
  assert.notEqual(integrityHash('a.'+extension,crlf),integrityHash('a.'+extension,lf));
 }
});
test('invalid UTF-8 bytes in a text file remain significant',()=>{
 assert.notEqual(integrityHash('a.ts',Buffer.from([255,10])),integrityHash('a.ts',Buffer.from([254,10])));
});

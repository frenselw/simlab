'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {checkDocs}=require('./check-docs');
const parent=path.resolve(__dirname,'../output/ci-tests');fs.mkdirSync(parent,{recursive:true});
const root=fs.mkdtempSync(path.join(parent,'docs-fixture-'));
try{
 fs.writeFileSync(path.join(root,'target.md'),'# Heading\n# Heading\n');
 fs.writeFileSync(path.join(root,'good.md'),'[ok](target.md#heading-1) [external](https://example.test/)');
 assert.equal(checkDocs(['good.md'],root).files.length,1);
 fs.unlinkSync(path.join(root,'target.md'));
 assert.throws(()=>checkDocs(['target.md'],root),/missing/,'deleting a document checks its remaining consumers');
 fs.writeFileSync(path.join(root,'target.md'),'# Heading\n# Heading\n');
 fs.writeFileSync(path.join(root,'bad.md'),'[missing](no.md)');
 assert.throws(()=>checkDocs(['bad.md'],root),/missing/);
 fs.writeFileSync(path.join(root,'bad.md'),'[bad anchor](target.md#absent)');
 assert.throws(()=>checkDocs(['bad.md'],root),/anchor/);
 fs.writeFileSync(path.join(root,'bad.md'),'[outside](../private.md)');
 assert.throws(()=>checkDocs(['bad.md'],root),/outside/);
}finally{assert.equal(path.dirname(root),parent);assert(path.basename(root).startsWith('docs-fixture-'));fs.rmSync(root,{recursive:true,force:true});}
console.log('Documentation checks reject missing files/anchors and escaping paths.');

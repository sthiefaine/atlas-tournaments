import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { enregistrerSource, listerSources, cheminSource } from '../../src/serveur/sources-assets';
function glb(uri?:string) {
  const texte=JSON.stringify({asset:{version:'2.0'},meshes:[{primitives:[]}],images:uri?[{uri}]:[]});
  const json=Buffer.from(texte.padEnd(Math.ceil(texte.length/4)*4,' '));
  const b=Buffer.alloc(20+json.length);b.writeUInt32LE(0x46546c67,0);b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(json.length,12);b.writeUInt32LE(0x4e4f534a,16);json.copy(b,20);return b;
}
test('source versionnée, idempotente, sans chemin reçu ni référence externe',async()=>{
  const racine=await mkdtemp(path.join(os.tmpdir(),'atlas-sources-'));
  try {
    const a=await enregistrerSource(racine,'batiment_qg_test',glb());
    const b=await enregistrerSource(racine,'batiment_qg_test',glb());
    assert.equal(a.revision,b.revision);assert.equal((await listerSources(racine,'batiment_qg_test')).length,1);
    await assert.rejects(enregistrerSource(racine,'batiment_qg_test',glb('https://example.com/texture.png')),/autonome/);
    await assert.rejects(enregistrerSource(racine,'batiment_qg_test',Buffer.from('faux')),/court/);
    assert.throws(()=>cheminSource(racine,'../secret',a.revision));
    assert.throws(()=>cheminSource(racine,'batiment_qg_test','../secret'));
  }finally{await rm(racine,{recursive:true,force:true});}
});

test('API privée : authentification, dépôt brut, téléchargement et limite avant lecture',async()=>{
  const {POST,GET}=await import('../../src/app/api/admin/assets/[id]/sources/route');
  const {signerSession,COOKIE_ADMIN}=await import('../../src/serveur/auth');
  const racine=await mkdtemp(path.join(os.tmpdir(),'atlas-source-api-'));
  const ancien={dir:process.env.ATLAS_ASSET_SOURCES_DIR,secret:process.env.AUTH_SECRET,url:process.env.ATLAS_UPLOAD_URL};
  process.env.ATLAS_ASSET_SOURCES_DIR=racine;process.env.AUTH_SECRET='test-sources-local';delete process.env.ATLAS_UPLOAD_URL;
  const ctx={params:Promise.resolve({id:'batiment_qg_fr_ile_de_france'})};
  const url='http://localhost/api/admin/assets/batiment_qg_fr_ile_de_france/sources';
  const cookie=`${COOKIE_ADMIN}=${signerSession({sujet:'test',expire:Date.now()+60000})}`;
  try{
    assert.equal((await GET(new Request(url),ctx)).status,403);
    assert.equal((await POST(new Request(url,{method:'POST',headers:{cookie,origin:'https://autre.test'}}),ctx)).status,403);
    assert.equal((await POST(new Request(url,{method:'POST',headers:{cookie,'content-type':'model/gltf-binary','content-length':String(151*1024*1024)}}),ctx)).status,413);
    const r=await POST(new Request(url,{method:'POST',headers:{cookie,'content-type':'model/gltf-binary'},body:new Uint8Array(glb())}),ctx);
    assert.equal(r.status,201);const {source}=await r.json();
    const liste=await GET(new Request(url,{headers:{cookie}}),ctx);assert.equal((await liste.json()).sources.length,1);
    const telecharge=await GET(new Request(url+'?revision='+source.revision,{headers:{cookie}}),ctx);
    assert.equal(telecharge.status,200);assert.deepEqual(Buffer.from(await telecharge.arrayBuffer()),glb());
  }finally{
    for(const [cle,val] of [['ATLAS_ASSET_SOURCES_DIR',ancien.dir],['AUTH_SECRET',ancien.secret],['ATLAS_UPLOAD_URL',ancien.url]] as const){if(val===undefined)delete process.env[cle];else process.env[cle]=val;}
    await rm(racine,{recursive:true,force:true});
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genererSpecs, nomTexture } from '../../src/assets';
import { encoderPng, creerImage } from '../../src/render/apercu/png';
import { controlerTextures } from '../../src/serveur/controle-textures';

function fiche() {
  const original=genererSpecs().find(s=>s.id==='unite_char_leger_base');
  assert.ok(original);
  const spec=structuredClone(original);
  spec.variantes.saisons=[];
  spec.textures=[{canal:'albedo',resolution:512,format:'png',obligatoire:true,note:'Essai de validation.'}];
  return spec;
}

test('le décodage mémorisé revérifie la résolution et le canal du lot suivant',()=>{
  const spec=fiche(),png=encoderPng(creerImage(512,512,[255,255,255]));
  const fichiers=new Map([[nomTexture(spec,'albedo'),png]]);
  assert.deepEqual(controlerTextures(spec,fichiers),[]);
  spec.textures[0]!.resolution=1024;
  assert.match(controlerTextures(spec,fichiers)[0]!.detail??'',/résolution/);
  spec.textures[0]!.resolution=512;
  spec.textures[0]!.canal='masque_equipe';
  assert.match(controlerTextures(spec,new Map([[nomTexture(spec,'masque_equipe'),png]]))[0]!.detail??'',/entièrement noir ou blanc/);
});

test('modifier les octets après un contrôle ne réutilise pas une ancienne image validée',()=>{
  const spec=fiche(),png=encoderPng(creerImage(512,512,[150,150,150]));
  const fichiers=new Map([[nomTexture(spec,'albedo'),png]]);
  assert.deepEqual(controlerTextures(spec,fichiers),[]);
  png[0]=0;
  assert.match(controlerTextures(spec,fichiers)[0]!.detail??'',/signature PNG absente/);
});

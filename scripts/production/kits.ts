/** Livrées candidates : BIN, UV, articulation et clips de la base préservés. */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, linkSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { genererSpecs } from '../../src/assets/catalogue';
import { nomModele, nomTexture, type AssetSpec } from '../../src/assets/spec';
import { lirePng, type PixelsPng } from '../../src/assets/png';
import { encoderPng, creerImage } from '../../src/render/apercu/png';
import { controlerDepot, type FichierLivre } from '../../src/serveur/depot-modeles';
import { decouperGlb, assemblerGlb } from '../infanterie/gltf';
import type { RapportCandidat } from './commun';
const SPECS=new Map(genererSpecs().map(s=>[s.id,s]));
const CACHE=new Map<string,Uint8Array>();const LIENS=new Map<string,string>();const PIXELS=new Map<string,PixelsPng>();
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
function pixels(b:Uint8Array){const h=hash(b);let p=PIXELS.get(h);if(!p){p=lirePng(b);PIXELS.set(h,p);if(PIXELS.size>12)PIXELS.delete(PIXELS.keys().next().value!);}return p;}
function redimensionner(b:Uint8Array,n:number):Uint8Array {const p=pixels(b);if(p.largeur===n&&p.hauteur===n)return b;const key=hash(b)+':'+n;const hit=CACHE.get(key);if(hit)return hit;const out=creerImage(n,n,[0,0,0]);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(Math.floor(y*p.hauteur/n)*p.largeur+Math.floor(x*p.largeur/n))*4;out.pixels.set(p.rgba.subarray(i,i+3),(y*n+x)*3);}const r=encoderPng(out);CACHE.set(key,r);if(CACHE.size>64)CACHE.delete(CACHE.keys().next().value!);return r;}
function teinter(albedo:Uint8Array,masque:Uint8Array,palette:string[],indice:number):{albedo:Uint8Array;masque:Uint8Array}{
 const key=JSON.stringify([hash(albedo),hash(masque),palette,indice]);const hit=CACHE.get(key);const hm=CACHE.get(key+'m');if(hit&&hm)return {albedo:hit,masque:hm};
 const a=pixels(albedo),m=pixels(masque),im=creerImage(a.largeur,a.hauteur,[0,0,0]),mask=creerImage(m.largeur,m.hauteur,[0,0,0]);
 const couleurs=palette.map(c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]);
 // Liserés abstraits à l'intérieur des panneaux hérités ; aucun drapeau ou texte.
 const bande=(x:number,y:number)=>((x+y*0)%32)<4;
 for(let y=0;y<m.hauteur;y++)for(let x=0;x<m.largeur;x++){const i=(y*m.largeur+x)*3;const blanc=m.rgba[(y*m.largeur+x)*4]===255&&bande(x,y);mask.pixels.fill(blanc?255:0,i,i+3);}
 for(let y=0;y<a.hauteur;y++)for(let x=0;x<a.largeur;x++){
  const p=(y*a.largeur+x)*4,si=(y*a.largeur+x)*3,mx=Math.floor(x*m.largeur/a.largeur),my=Math.floor(y*m.hauteur/a.hauteur);let c=[a.rgba[p]!,a.rgba[p+1]!,a.rgba[p+2]!];
  if(m.rgba[(my*m.largeur+mx)*4]===255){if(bande(mx,my))c=[150,150,150];else{const k=((Math.floor((x+y*(1+indice%3))/32)+indice)%7===0)?2:((x>>6)%3===0?1:0);const grain=((x*3+y*7)%5)-2;c=couleurs[k]!.map(v=>Math.max(0,Math.min(255,v+grain)));}}
  im.pixels.set(c,si);
 }
 const out={albedo:encoderPng(im),masque:encoderPng(mask)};CACHE.set(key,out.albedo);CACHE.set(key+'m',out.masque);while(CACHE.size>64)CACHE.delete(CACHE.keys().next().value!);return out;
}
export async function genererKit(spec:AssetSpec,sortie:string,repertoire='assets/livraisons'):Promise<RapportCandidat>{
 const nation=spec.cle.split('_')[0]!,cle=spec.cle.slice(nation.length+1),id=`unite_${cle}_base`;
 const baseSpec=SPECS.get(id)!;
 const dir=existsSync(path.join(repertoire,id,`${id}_lod0.glb`))?path.join(repertoire,id):'public/assets/modeles';
 if(!existsSync(path.join(dir,`${id}_lod0.glb`)))return {id:spec.id,ok:false,motifs:[{detail:`Base absente : ${id}`}],fichiers:[]};
 const base:FichierLivre[]=readdirSync(dir).filter(n=>n.startsWith(id+'_')&&/\.(png|glb)$/.test(n)).map(n=>({nom:n,octets:readFileSync(path.join(dir,n))}));
 if(existsSync(path.join(sortie,nomModele(spec,0)))){const anciens=readdirSync(sortie).filter(n=>n.startsWith(spec.id+'_')&&/\.(png|glb)$/.test(n)).map(n=>({nom:n,octets:readFileSync(path.join(sortie,n))}));const v=controlerDepot(spec,anciens,base);return {id:spec.id,ok:v.ok,motifs:v.motifs,fichiers:anciens.map(f=>f.nom),conserve:true};}
 const fichiers=new Map<string,Uint8Array>();const orig=new Map(base.map(f=>[f.nom,f.octets]));
 const style=JSON.parse(readFileSync(`content/styles/${nation}.json`,'utf8')) as {palette:{main:string;dark:string;light:string;accents:string[]}};
 const numero=nation.charCodeAt(0)+nation.charCodeAt(1);
 for(const saison of [undefined,...spec.variantes.saisons]){
  const albedo=orig.get(nomTexture(baseSpec,'albedo',saison)),masque=orig.get(nomTexture(baseSpec,'masque_equipe',saison));
  if(!albedo||!masque)continue;
  const teintes=teinter(redimensionner(albedo,spec.textures.find(t=>t.canal==='albedo')!.resolution),redimensionner(masque,spec.textures.find(t=>t.canal==='masque_equipe')!.resolution),[style.palette.main,style.palette.dark,style.palette.accents[0]??style.palette.light],numero);
  for(const t of spec.textures){const b=orig.get(nomTexture(baseSpec,t.canal,saison));if(b)fichiers.set(nomTexture(spec,t.canal,saison),t.canal==='albedo'?teintes.albedo:t.canal==='masque_equipe'?teintes.masque:redimensionner(b,t.resolution));}
 }
 for(const lod of spec.verification.lodRequis){const b=orig.get(nomModele(baseSpec,lod));if(!b)return {id:spec.id,ok:false,motifs:[{detail:`LOD base absent ${lod}`}],fichiers:[]};const{document,bin}=decouperGlb(b);for(const image of document.images as {uri?:string;name?:string}[]??[]){if(image.uri)image.uri=image.uri.replace(id,spec.id);if(image.name)image.name=image.name.replace(id,spec.id);}fichiers.set(nomModele(spec,lod),assemblerGlb(document,bin));}
 const verdict=controlerDepot(spec,[...fichiers].map(([nom,octets])=>({nom,octets})),base);
 if(!verdict.ok)return {id:spec.id,ok:false,motifs:verdict.motifs,fichiers:[]};
 mkdirSync(path.dirname(sortie),{recursive:true});const stage=mkdtempSync(path.join(path.dirname(sortie),`.${spec.id}-`));
 try{for(const[nom,b]of fichiers){const dest=path.join(stage,nom),h=hash(b),premier=LIENS.get(h);if(premier&&existsSync(premier))linkSync(premier,dest);else writeFileSync(dest,b,{flag:'wx'});}writeFileSync(path.join(stage,'version-candidat.json'),JSON.stringify({version:2,base:id,nation,validationArtistique:'non_effectuee'})+'\n');renameSync(stage,sortie);for(const[nom,b]of fichiers)LIENS.set(hash(b),path.join(sortie,nom));}catch(e){rmSync(stage,{recursive:true,force:true});throw e;}
 return {id:spec.id,ok:true,motifs:[],fichiers:[...fichiers.keys()]};
}
async function main(){const rep=path.resolve(process.argv[2]??'assets/livraisons'),filtre=process.argv[3];const rapports=[];for(const s of genererSpecs().filter(s=>s.type==='kit'&&(!filtre||s.id===filtre))){const r=await genererKit(s,path.join(rep,s.id),rep);rapports.push(r);writeFileSync(path.join(rep,'rapport-kits-candidats.json'),JSON.stringify(rapports,null,2)+'\n');console.log(JSON.stringify({id:r.id,ok:r.ok,conserve:r.conserve,motifs:r.motifs}));}writeFileSync(path.join(rep,'rapport-kits-candidats.json'),JSON.stringify(rapports,null,2)+'\n');if(rapports.some(r=>!r.ok))process.exitCode=1;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)void main().catch(e=>{console.error(e);process.exitCode=1;});

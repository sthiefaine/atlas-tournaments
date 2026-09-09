/** PNG RGBA réservé aux découpes de feuillage ; encodeur RGB historique inchangé. */
import { deflateSync } from 'node:zlib';
import { crc32, SIGNATURE_PNG, type Image } from '../../src/render/apercu/png';
function segment(nom:string, donnees:Uint8Array):Buffer {
 const type=Buffer.from(nom),corps=Buffer.concat([type,donnees]),sortie=Buffer.alloc(corps.length+8);
 sortie.writeUInt32BE(donnees.length,0);corps.copy(sortie,4);sortie.writeUInt32BE(crc32(corps),corps.length+4);return sortie;
}
export function encoderPngAlpha(image:Image,alpha:(x:number,y:number)=>number):Uint8Array {
 const ligne=1+image.largeur*4,brut=Buffer.alloc(image.hauteur*ligne);
 for(let y=0;y<image.hauteur;y++)for(let x=0;x<image.largeur;x++){
  const i=(y*image.largeur+x)*3,j=y*ligne+1+x*4;
  brut[j]=image.pixels[i]!;brut[j+1]=image.pixels[i+1]!;brut[j+2]=image.pixels[i+2]!;brut[j+3]=alpha(x,y);
 }
 const entete=Buffer.alloc(13);entete.writeUInt32BE(image.largeur,0);entete.writeUInt32BE(image.hauteur,4);entete[8]=8;entete[9]=6;
 return Buffer.concat([SIGNATURE_PNG,segment('IHDR',entete),segment('IDAT',deflateSync(brut,{level:9})),segment('IEND',new Uint8Array())]);
}
/** UV0 de chaque carte occupe la bande4 et ses gouttières habituelles. */
export function alphaFeuillage(x:number,y:number,resolution:number):number {
 const bande=x*8/resolution;if(Math.floor(bande)!==4)return 255;
 const u=(bande-4-.08)/.84,v=(y/resolution-.02)/.96;
 if(u<0||u>1||v<=0||v>=1)return 0;
 return Math.abs(u-.5)<=.46*Math.sin(Math.PI*v)?255:0;
}

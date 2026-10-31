import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(process.env.HINT_TOOLS_PACKAGE||import.meta.url),sharp=require('sharp');
const root=fileURLToPath(new URL('../',import.meta.url)),app=path.resolve(root,'../../..');
const files=[
  ['letter-detail',path.join(root,'assets/inputs/envelope-front-v1.png'),1024],
  ['daily-card-back',path.join(app,'public/brand/tarot/card-backs/07_Zodiac_Set_A_Detailed/11_Aquarius_Waterbearer_Teal_Gold.png'),640],
  ['daily-card-front',path.join(app,'public/brand/tarot/decks/hint-card-2/cards/17-TheStar.jpg'),640]
];
for(const [name,source,width] of files){
  const meta=await sharp(source).metadata();
  await sharp(source).resize({width,withoutEnlargement:true}).webp({quality:92,alphaQuality:100}).toFile(path.join(root,'assets',name+'.webp'));
  console.log(JSON.stringify({name,width:meta.width,height:meta.height}));
}

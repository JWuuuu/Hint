import { clamp, ease } from './motion.js';

export function createFacePainter(eyeImage) {
  const canvas=document.createElement('canvas');canvas.width=448;canvas.height=240;
  const ctx=canvas.getContext('2d'),box={x:196,y:230,width:224,height:120};
  function paint(p,look) {
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,448,240);
    ctx.setTransform(2,0,0,2,-box.x*2,-box.y*2);
    const thinking=p.thought||0,joy=p.joy||0,attention=p.attention||0,assurance=p.assurance||0;
    const playful=p.playful||0,expectant=p.expectant||0;
    for(const [index,cx,cy,closed] of [[0,250.64,273.72,p.eyeLeft],[1,360.23,291.89,p.eyeRight]]){
      const wide=1+attention*.14+expectant*.08;
      const narrow=thinking*(index===0?.26:.08);
      const shut=clamp(Math.max(closed,joy*.96));
      const x=cx+look.x*5.0,y=cy+look.y*4.0;
      ctx.save();ctx.translate(x,y);ctx.rotate(-thinking*.07);
      ctx.scale(wide,Math.max(.05,(1-shut*.95)*(1-narrow))*wide);
      ctx.globalAlpha=1-ease((shut-.75)/.25);
      ctx.drawImage(eyeImage,cx-24,cy-26,48,52,-24,-26,48,52);ctx.restore();
      const arc=ease((shut-.65)/.35);
      if(arc>0){
        ctx.save();ctx.globalAlpha=arc;ctx.strokeStyle='#704150';ctx.lineWidth=2.4;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(x-8.1,y+1.2);ctx.quadraticCurveTo(x,y-4.6-joy*1.5,x+8.1,y+1.2);
        ctx.stroke();ctx.restore();
      }
    }
    // One continuous mouth contour changes shape; no expression crossfades.
    const side=p.playfulSide||0;
    const x=300+thinking*9+playful*side*2,y=300+thinking*2-assurance*1.2;
    const width=19-thinking*8+joy*10+expectant*3+playful*5;
    const curve=6-thinking*7-attention*3+assurance*1+playful*2+expectant*1;
    const open=joy*12+thinking*2.5+expectant*1.2;
    const skew=side*playful*4;
    const gradient=ctx.createLinearGradient(0,y-1,0,y+curve+open+5);
    gradient.addColorStop(0,'#71414e');gradient.addColorStop(1,'#4f2c3e');
    ctx.fillStyle=gradient;ctx.strokeStyle='#75424e';ctx.lineWidth=2.2;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();ctx.moveTo(x-width/2,y+skew);ctx.quadraticCurveTo(x,y+curve*2,x+width/2,y-skew);
    if(open>.03){ctx.quadraticCurveTo(x+width*.06,y+curve*2+open*2,x-width/2,y+skew);ctx.closePath();ctx.fill();}
    ctx.stroke();
    if(joy>.05){
      ctx.save();ctx.globalAlpha=joy*.72;ctx.fillStyle='#c08088';
      ctx.beginPath();ctx.ellipse(x+1,y+curve+open*.65,6*joy,2.0*joy,0,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    if(playful+joy>0){
      for(const [cx,cy] of [[221,298],[383,321]]){
        const glow=ctx.createRadialGradient(cx,cy-joy*2,1,cx,cy,15);
        glow.addColorStop(0,'rgba(230,146,143,'+((playful+joy)*.14)+')');glow.addColorStop(1,'rgba(230,146,143,0)');
        ctx.fillStyle=glow;ctx.fillRect(cx-15,cy-15,30,30);
      }
    }
    return canvas;
  }
  return {paint,box};
}

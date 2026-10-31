import { clamp, ease } from './motion.js';

export function createFacePainter(eyeImage) {
  const canvas=document.createElement('canvas');canvas.width=448;canvas.height=240;
  const ctx=canvas.getContext('2d'),box={x:196,y:230,width:224,height:120};
  function paint(p,look) {
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,448,240);
    ctx.setTransform(2,0,0,2,-box.x*2,-box.y*2);
    const thinking=p.thought||0,joy=p.joy||0,attention=p.attention||0,assurance=p.assurance||0;
    const playful=p.playful||0,expectant=p.expectant||0;
    const shy=p.shy||0,sad=p.sad||0,grumpy=p.grumpy||0,tired=p.tired||0,round=p.round||0,yawn=p.yawn||0,speech=p.speech||0;
    for(const [index,cx,cy,closed] of [[0,250.64,273.72,p.eyeLeft],[1,360.23,291.89,p.eyeRight]]){
      const wide=1+attention*.14+expectant*.08+(p.wide||0)*.38+round*.12;
      const narrow=clamp(thinking*(index===0?.26:.08)+shy*.18+sad*.21+grumpy*.38+tired*.56+(p.soft||0)*.08+(p.reading||0)*.24,0,.8);
      const shut=clamp(Math.max(closed,joy*.96));
      const x=cx+look.x*(5+thinking*2+(p.reading||0)*4),y=cy+look.y*(4+thinking*2+(p.reading||0)*4);
      ctx.save();ctx.translate(x,y);ctx.rotate(-thinking*.07+(index===0?1:-1)*(grumpy*.16-sad*.07));
      ctx.scale(wide,Math.max(.05,(1-shut*.95)*(1-narrow))*wide);
      if(grumpy>0){
        const slope=(index===0?1:-1)*7*grumpy,top=-27+22*grumpy;
        ctx.beginPath();ctx.moveTo(-26,top-slope);ctx.lineTo(26,top+slope);ctx.lineTo(26,30);ctx.lineTo(-26,30);ctx.closePath();ctx.clip();
      }
      ctx.globalAlpha=1-ease((shut-.75)/.25);
      ctx.drawImage(eyeImage,cx-24,cy-26,48,52,-24,-26,48,52);ctx.restore();
      const arc=ease((shut-.65)/.35);
      if(arc>0){
        ctx.save();ctx.globalAlpha=arc;ctx.strokeStyle='#704150';ctx.lineWidth=2.4;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(x-8.1,y+1.2);ctx.quadraticCurveTo(x,y-4.6-joy*1.5+tired*8+sad*9,x+8.1,y+1.2);
        ctx.stroke();ctx.restore();
      }
      const brow=Math.max(grumpy,sad,thinking*.65,attention*.45,(p.wide||0)*.55,round*.7);
      if(brow>.05){
        ctx.save();ctx.globalAlpha=brow*.85;ctx.strokeStyle='#855765';ctx.lineWidth=2.1;ctx.lineCap='round';
        const tilt=(index===0?1:-1)*(grumpy*6.5-sad*6),lift=thinking*(index===0?6:0)+round*7+(p.wide||0)*5;
        ctx.beginPath();ctx.moveTo(x-10,y-18-tilt-lift);ctx.quadraticCurveTo(x,y-20-lift,x+10,y-18+tilt-lift);ctx.stroke();ctx.restore();
      }
    }
    // One continuous mouth contour changes shape; no expression crossfades.
    const side=p.playfulSide||0;
    const x=300+thinking*9+playful*side*2-grumpy*4,y=300+thinking*2-assurance*1.2+sad*2;
    const width=19-thinking*8+joy*10+expectant*3+playful*5+round*3+speech*4-shy*3-grumpy*6;
    const curve=6-thinking*9-attention*5.5+assurance+playful*2+expectant-shy*4-sad*15-grumpy*13-(p.reading||0)*6;
    const open=joy*12+thinking*2.5+expectant*1.2+round*12+yawn*17+speech*10;
    const circle=Math.max(round,yawn,speech*.65);
    const skew=side*playful*4+shy*1.5;
    const gradient=ctx.createLinearGradient(0,y-1,0,y+curve+open+5);
    gradient.addColorStop(0,'#71414e');gradient.addColorStop(1,'#4f2c3e');
    ctx.fillStyle=gradient;ctx.strokeStyle='#75424e';ctx.lineWidth=2.2;ctx.lineCap='round';ctx.lineJoin='round';
    const radius=width*.48+yawn*5;
    const top=(curve*(1-circle)-radius*circle)*4/3;
    const bottom=((curve+open)*(1-circle)+radius*circle)*4/3;
    const upperX=width*(1/6+circle/3);
    ctx.beginPath();ctx.moveTo(x-width/2,y+skew);
    ctx.bezierCurveTo(x-upperX,y+top+skew/3,x+upperX,y+top-skew/3,x+width/2,y-skew);
    if(open>.03){
      ctx.bezierCurveTo(x+width*(.207+circle*.293),y+bottom-skew/3,x-width*(.127+circle*.373),y+bottom+skew/3,x-width/2,y+skew);
      ctx.closePath();ctx.fill();
    }
    ctx.stroke();
    if(joy>.05){
      ctx.save();ctx.globalAlpha=joy*.72;ctx.fillStyle='#c08088';
      ctx.beginPath();ctx.ellipse(x+1,y+curve+open*.65,6*joy,2.0*joy,0,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    if(playful+joy+shy>0){
      for(const [cx,cy] of [[221,298],[383,321]]){
        const glow=ctx.createRadialGradient(cx,cy-joy*2,1,cx,cy,18);
        glow.addColorStop(0,'rgba(228,132,139,'+Math.min(.6,(playful+joy)*.14+shy*.54)+')');glow.addColorStop(1,'rgba(230,146,143,0)');
        ctx.fillStyle=glow;ctx.fillRect(cx-18,cy-18,36,36);
        if(shy>.1){ctx.save();ctx.globalAlpha=shy*.5;ctx.strokeStyle='#c8818c';ctx.lineWidth=1.6;ctx.lineCap='round';for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(cx+i*5-1,cy-3);ctx.lineTo(cx+i*5+1,cy+3);ctx.stroke();}ctx.restore();}
      }
    }
    return canvas;
  }
  return {paint,box};
}

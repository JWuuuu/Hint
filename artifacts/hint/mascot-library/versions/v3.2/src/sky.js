import { clamp, ease } from './motion.js';
import { zodiacPatterns } from './zodiac-patterns.js';

export function createJourneySky(canvas) {
  const ctx=canvas.getContext('2d');
  let width=390,height=780,seed=18457,lastTime=null;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const stars=Array.from({length:1600},()=>({x:(random()-.5)*9,y:(random()-.5)*13,z:random()*4.43,
    light:.34+random()*.74,warm:random()>.6}));
  const placements=[[-.62,-.22],[.18,-.46],[.72,.02],[-.22,.38],[.58,-.34],[-.72,.12],[.04,.48],[.88,.28],[-.48,-.44],[.35,.36],[-.86,.36],[.78,-.12]];
  const starts=[.1,.17,.24,.32,.42,.52,.64,.76,.9,1.04,1.18,1.34];
  const travel=[];let distance=0;
  for(let i=0;i<=300;i++){
    const t=i/120,rush=ease((t-.88)/1.1),brake=1-ease((t-1.94)/.62);
    travel.push(distance);distance+=(1.82+.2*Math.sin(t*1.2))*(1+rush*2.6+Math.max(0,t-.88)*.72)*brake/120;
  }
  function pathAt(t){const i=clamp(t*120,0,travel.length-1),lo=Math.floor(i);return travel[lo]+((travel[lo+1]??travel[lo])-travel[lo])*(i-lo);}
  function draw(time,fade=0){
    const t=Math.min(2.6,Math.max(0,time)),focal=Math.min(width,height)*.92,cx=width/2,cy=height*.49;
    canvas.style.opacity=String(1-fade);
    if(fade>=1||t===lastTime)return;
    lastTime=t;
    ctx.clearRect(0,0,width,height);ctx.fillStyle='#09080f';ctx.fillRect(0,0,width,height);
    const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,height*.67);
    glow.addColorStop(0,'#393027');glow.addColorStop(.25,'#191623');glow.addColorStop(1,'#09080f');
    ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    const distance=pathAt(t),past=pathAt(Math.max(0,t-1/60)),visibility=ease(t/.34)*(1-ease((t-2.15)/.65)*.75);
    for(const s of stars){
      const z=.17+((s.z-distance)%4.43+4.43)%4.43;
      const x=cx+s.x/z*focal,y=cy+s.y/z*focal;
      if(x<0||x>width||y<0||y>height)continue;
      const alpha=Math.min(.85,(.23+(1-z/4.6)*.58)*s.light*visibility);
      const color=s.warm?'238,212,165':'233,236,235';
      const radius=clamp(focal/z*.0026,.28,1.2);
      const oldZ=z+distance-past,px=cx+s.x/oldZ*focal,py=cy+s.y/oldZ*focal;
      ctx.strokeStyle=`rgba(${color},${alpha*.6})`;ctx.lineWidth=.5;
      ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,y);ctx.stroke();
      ctx.fillStyle=`rgba(${color},${alpha})`;ctx.fillRect(x,y,radius,radius);
    }
    zodiacPatterns.forEach((pattern,i)=>{
      const age=t-starts[i],z=4.1-age*(1.38+ease((t-.88)/1.1)*.48);
      if(age<0||z<=.3)return;
      const visible=ease(age/.22)*(1-ease((age-1.85)/.4))*(1-ease((t-2.08)/.55));
      const origin=placements[i],scale=Math.min(width,height)*.49/Math.max(.42,z),a=(i-5)*.062;
      const points=pattern.nodes.map(([x,y])=>[cx+origin[0]/z*focal+(x*Math.cos(a)-y*Math.sin(a))*scale,cy+origin[1]/z*focal+(x*Math.sin(a)+y*Math.cos(a))*scale]);
      ctx.strokeStyle=`rgba(237,231,213,${visible*.6})`;ctx.lineWidth=.7;
      for(const [a,b] of pattern.edges){ctx.beginPath();ctx.moveTo(...points[a]);ctx.lineTo(...points[b]);ctx.stroke();}
      ctx.fillStyle=`rgba(255,247,224,${visible})`;
      for(const p of points){ctx.beginPath();ctx.arc(...p,clamp(1.6/z,.65,1.8),0,Math.PI*2);ctx.fill();}
    });
  }
  return {draw,resize(w,h){width=w;height=h;lastTime=null;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}};
}

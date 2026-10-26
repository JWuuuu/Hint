import { ease, clamp, sampleGesture, sampleActivity, blendPose, sampleEnvelope, projectEnvelopePoint, HANDOFF_TIME, idleBlink } from './motion.js';

export const letterSceneTiming=Object.freeze({offer:2.4,handoff:HANDOFF_TIME,approachEnd:1.62,openStart:1.64,openEnd:2.24,extractStart:2.3,extractEnd:3,presentEnd:3.58,handoffStart:3.58,handoffEnd:3.8,settled:3.8,flip:.62});
export const paperCorners=[[233,356],[362,378],[345,467],[221,445]];
export const dailyActorFrame={x:.08,y:.205,width:.84,height:.42};
const letterMix=(a,b,t)=>a+(b-a)*t;

export function projectBodyPoint(point,p,time,look,frame={x:0,y:0,width:1,height:1}){
  let [x,y]=point.map(v=>v/640);
  const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
  const rotate=(cx,cy,a)=>{const dx=x-cx,dy=y-cy;x=cx+dx*Math.cos(a)-dy*Math.sin(a);y=cy+dx*Math.sin(a)+dy*Math.cos(a);};
  const upper=1-smooth(.47,.65,y);rotate(.49,.575,p.lean*upper);x+=p.lean*.12*upper;
  x+=(p.turn||0)*.024*upper;
  const head=1-smooth(.48,.575,y);x+=head*look.x*.004;y+=head*(look.y*.002+p.head*.012);
  y+=(.46-y)*head*Math.max(p.head,0)*.018;
  const belly=Math.exp(-2*(((x-.48)/.27)**2+((y-.69)/.30)**2));
  x+=(x-.49)*belly*(Math.sin(time*1.25)*.007+(p.breath||0)*.02);
  y+=belly*(Math.sin(time*1.25)*.0015-(p.breath||0)*.0015);
  y+=(p.crouch||0)*.037*(1-smooth(.48,.88,y));x-=(x-.49)*belly*(p.crouch||0)*.025;
  x=.5+(x-.5)*(1+p.scale+p.squash);y=.68+(y-.68)*(1+p.scale-p.squash);
  rotate(.5,.68,p.roll);x+=p.x;y+=p.y;
  return [frame.x+(.5+(x-.5)*.94)*frame.width,frame.y+(.5+(y-.5)*.94)*frame.height];
}

export function paperSourcePoint(u,v){
  const [a,b,c,d]=paperCorners;
  return [0,1].map(k=>(1-v)*letterMix(a[k],b[k],u)+v*letterMix(d[k],c[k],u));
}

export function sampleLetterActing(phase,time,clock){
  const gesture=phase==='offer'?'offer-letter':phase==='delivery'?'deliver-letter':'reading';
  const gestureTime=phase==='offer'?Math.min(time,2.4):phase==='delivery'?Math.min(time,1.8):time;
  let pose=phase==='reading'?sampleActivity('reading',time):sampleGesture(gesture,gestureTime);
  if(phase==='delivery'&&time>1.8)pose=blendPose(pose,sampleActivity('reading',time-1.8),ease((time-1.8)/1.1));
  const calm=1-pose.engage*.85;
  pose.y+=Math.sin(clock*1.3)*.0035*calm;
  const blink=idleBlink(clock)*(1-pose.engage);
  pose.eyeLeft=Math.max(pose.eyeLeft,blink);pose.eyeRight=Math.max(pose.eyeRight,blink);
  return {pose,look:{x:pose.gazeX,y:pose.gazeY},gesture,gestureTime};
}

export function createLetterAnchor(geometry,clock,frame=dailyActorFrame){
  const acting=sampleLetterActing('delivery',HANDOFF_TIME,clock);
  const epsilon=1e-4;
  const samples=[-epsilon,epsilon].map(offset=>{
    const sample=sampleLetterActing('delivery',HANDOFF_TIME+offset,clock+offset);
    return {sample,envelope:sampleEnvelope('deliver-letter',Math.min(HANDOFF_TIME,HANDOFF_TIME+offset),'offered',geometry),clock:clock+offset};
  });
  const velocityCorners=[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>{
    const points=samples.map(({sample,envelope,clock})=>heldPaperPoint(u,v,envelope,sample.pose,clock,sample.look,frame));
    return [0,1].map(k=>(points[1][k]-points[0][k])/(epsilon*2));
  });
  return {...acting,clock,frame:{...frame},envelope:sampleEnvelope('deliver-letter',HANDOFF_TIME,'offered',geometry),velocityCorners};
}

export function heldPaperPoint(u,v,envelope,pose,clock,look,frame=dailyActorFrame){
  return projectBodyPoint(projectEnvelopePoint(paperSourcePoint(u,v),envelope),pose,clock,look,frame);
}

export function transportedPaperPoint(u,v,anchor,progress,target={x:.5,y:.515,width:.68,height:.235},elapsed=0){
  if(progress>=1)return [target.x+(u-.5)*target.width,target.y+(v-.5)*target.height];
  const start=heldPaperPoint(u,v,anchor.envelope,anchor.pose,anchor.clock,anchor.look,anchor.frame);
  const center=heldPaperPoint(.5,.5,anchor.envelope,anchor.pose,anchor.clock,anchor.look,anchor.frame);
  const left=heldPaperPoint(0,.5,anchor.envelope,anchor.pose,anchor.clock,anchor.look,anchor.frame);
  const right=heldPaperPoint(1,.5,anchor.envelope,anchor.pose,anchor.clock,anchor.look,anchor.frame);
  const initialWidth=Math.hypot(right[0]-left[0],(right[1]-left[1])*2),growth=target.width/initialWidth;
  const depth=1/(1-(1-1/growth)*progress);
  const rotation=ease(progress),cx=letterMix(center[0],target.x,progress),cy=letterMix(center[1],target.y,progress);
  const end=[(u-.5)*target.width/growth,(v-.5)*target.height/growth];
  const velocity=anchor.velocityCorners;
  const carry=elapsed*(1-ease(elapsed/.32));
  const momentum=velocity?[0,1].map(k=>((1-v)*letterMix(velocity[0][k],velocity[1][k],u)+v*letterMix(velocity[3][k],velocity[2][k],u))*carry):[0,0];
  return [cx+letterMix(start[0]-center[0],end[0],rotation)*depth+momentum[0],cy+letterMix(start[1]-center[1],end[1],rotation)*depth+momentum[1]];
}

export function sampleLetterScene(phase,time,clock,anchor,geometry){
  const acting=sampleLetterActing(phase,time,clock),delivery=phase==='delivery'||phase==='reading';
  const t=phase==='reading'?letterSceneTiming.settled:time;
  const approach=delivery?ease((t-HANDOFF_TIME)/(letterSceneTiming.approachEnd-HANDOFF_TIME)):0;
  const opening=delivery?ease((t-letterSceneTiming.openStart)/.6):0;
  const extraction=delivery?ease((t-letterSceneTiming.extractStart)/(letterSceneTiming.extractEnd-letterSceneTiming.extractStart)):0;
  const move=delivery?ease((t-.85)/1.25):0;
  const actor={x:letterMix(.08,.69,move),y:letterMix(.205,.155,move)-.02*Math.sin(Math.PI*move),width:letterMix(.84,.27,move),height:letterMix(.42,.135,move)};
  const envelope=sampleEnvelope(acting.gesture,acting.gestureTime,delivery&&t>=HANDOFF_TIME?'delivered':'held',geometry);
  const lowered=delivery?ease((t-2.65)/.95):0;
  const point=(u,v)=>delivery&&t>=HANDOFF_TIME
    ?transportedPaperPoint(u,v,anchor,approach,{x:.5,y:.515+lowered*.83,width:.68,height:.235},t-HANDOFF_TIME)
    :heldPaperPoint(u,v,envelope,acting.pose,clock,acting.look,actor);
  return {...acting,actor,point,approach,opening,extraction,shadow:1-move*.65,
    phase:!delivery?time>=2.4?'offered':'offering':t<HANDOFF_TIME?'gripping':t<1.62?'approaching':t<2.24?'opening':t<3.18?'taking-card':'card-ready'};
}

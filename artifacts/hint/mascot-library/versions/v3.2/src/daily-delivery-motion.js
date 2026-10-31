import {ease,blendPose,sampleEnvelope,carryMotion} from './motion.js';
import {letterSceneTiming,sampleLetterActing,createLetterAnchor,heldPaperPoint,transportedPaperPoint} from './letter-scene-motion.js';

const timing=letterSceneTiming;
export const dailyDeliveryDuration=timing.offer+timing.settled;
const mix=(a,b,t)=>t>=1?b:t<=0?a:a+(b-a)*t;
const frameMix=(a,b,t)=>Object.fromEntries(['x','y','width','height'].map(k=>[k,mix(a[k],b[k],t)]));
const carry=(values,velocity,time)=>{
  const u=Math.min(1,time/.22),d=.22*(u-2.5*u**4+3*u**5-u**6);
  return carryMotion(values,velocity,d);
};

// Coordinates are measured from the actual card and shared viewport. The final
// plane exactly matches the DOM card; the receipt and its front never enter WebGL.
export function sampleDailyDelivery({time,clock,source,card,home,aspect,geometry}){
  const width=Math.min(.88,card.width*1.9),height=width*aspect;
  const offer={x:card.x+card.width/2-width/2,y:card.y+card.height*.52-height/2,width,height};
  const t=Math.max(0,time-timing.offer),delivering=time>=timing.offer;
  const acting=sampleLetterActing(delivering?'delivery':'offer',delivering?t:time,clock);
  const entry=ease(time/.85),move=delivering?ease((t-.85)/1.25):0;
  const actor=frameMix(frameMix(carry(source.actor,source.velocity?.actor,time),offer,entry),home,move);
  actor.y-=.014*Math.sin(Math.PI*entry)+.012*Math.sin(Math.PI*move);
  const pose=blendPose(carry(source.pose,source.velocity?.pose,time),acting.pose,ease(time/.65));
  const fromLook=carry(source.look,source.velocity?.look,time);
  const look={x:mix(fromLook.x,acting.look.x,ease(time/.65)),y:mix(fromLook.y,acting.look.y,ease(time/.65))};
  const approach=delivering?ease((t-timing.handoff)/(timing.approachEnd-timing.handoff)):0;
  const opening=delivering?ease((t-timing.openStart)/(timing.openEnd-timing.openStart)):0;
  const extraction=delivering?ease((t-timing.extractStart)/(timing.extractEnd-timing.extractStart)):0;
  const presentation=delivering?ease((t-timing.extractEnd)/(timing.presentEnd-timing.extractEnd)):0;
  const handoff=time>=dailyDeliveryDuration?1:delivering?ease((t-timing.handoffStart)/(timing.handoffEnd-timing.handoffStart)):0;
  const released=delivering&&t>=timing.handoff;
  const anchor=createLetterAnchor(geometry,clock-t+timing.handoff,offer);
  const target={x:card.x+card.width/2,y:card.y+card.height*1.12+card.width*aspect*.91*.25,width:card.width*1.65,height:card.width*aspect*.91};
  const lower=delivering?ease((t-timing.extractEnd)/.5):0;
  const envelope=sampleEnvelope(acting.gesture,acting.gestureTime,released?'delivered':'held',geometry);
  const basePoint=(u,v)=>released
    ?transportedPaperPoint(u,v,anchor,approach,target,t-timing.handoff)
    :heldPaperPoint(u,v,envelope,pose,clock,look,actor);
  const point=(u,v)=>{const p=basePoint(u,v);return [p[0],p[1]+lower*target.height*.24];};
  const cardPoint=(u,v)=>{
    if(presentation>=1)return [card.x+card.width*u,card.y+card.height*v];
    // First pull one rigid card completely through the opening. Only after its
    // bottom clears the paper does it move toward the reader at a larger scale.
    const tuckedScale=target.height*.86/card.height;
    const clearY=target.y-target.height/2-card.height*tuckedScale/2-card.height*.025;
    const scale=mix(tuckedScale,1,presentation);
    const cy=mix(mix(target.y,clearY,extraction),card.y+card.height/2,presentation);
    return [target.x+(u-.5)*card.width*scale,cy+(v-.5)*card.height*scale];
  };
  return {...acting,pose,look,actor,letter:released?'delivered':'offered',
    letterScene:{point,cardPoint,cardTexture:'app-card-back',cardFrame:{...card},cardOpacity:1-handoff,handoff,presentation,
      approach,opening,extraction,opacity:ease(time/.45),envelopeOpacity:1-ease((t-timing.extractEnd)/.42)},
    phase:time>=dailyDeliveryDuration?'ready':!delivering?'offering':t<timing.handoff?'gripping':t<timing.openStart?'approaching':t<timing.extractStart?'opening':'taking-card'};
}

import { clamp, ease, neutralPose, sampleGesture, blendPose, idleBlink } from './motion.js';

export const entranceTiming = Object.freeze({ flight: 2.82, peek: .62, anticipation: .12, jump: .56, settle: .3, wave: 4.5 });
export const WAVE_START = 4.42;
export const ENTRANCE_END = WAVE_START + entranceTiming.wave;
const mixNumber = (a,b,t) => a+(b-a)*t;
const cubicPoint = (a,b,c,d,t) => (1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d;
function entranceBeat(points,time){
  if(time<=points[0][0])return points[0][1];
  for(let i=1;i<points.length;i++)if(time<=points[i][0]){
    const [a,x]=points[i-1],[b,y]=points[i];return mixNumber(x,y,ease((time-a)/(b-a)));
  }
  return points.at(-1)[1];
}

export function applyJourneyReaction(base,reaction,elapsed=0) {
  if(!reaction)return base;
  const time=reaction.time+elapsed;
  const weight=ease(time/.18)*(1-ease((time-reaction.duration+.25)/.25));
  if(weight===0)return base;
  const pose=sampleGesture(reaction.id,time);
  if(reaction.id!=='wink-left'&&reaction.id!=='wink-right')return blendPose(base,pose,weight);
  const result={...base};
  // A tap changes the expression without replacing the ongoing paw movement.
  for(const key of ['eyeLeft','eyeRight','playful','playfulSide'])result[key]=mixNumber(base[key],pose[key],weight);
  for(const key of ['headYaw','headRoll','head','roll','x','y'])result[key]+=pose[key]*weight*.7;
  result.engage=mixNumber(base.engage,1,weight);
  return result;
}

export function sampleEntrance(seconds) {
  const t=Math.max(0,seconds),local=t-entranceTiming.flight;
  const pose=neutralPose();
  let actor={x:.55,y:.64,width:.5,opacity:0,front:false},phase='flight';
  const skyFade=ease((t-3.65)/.77),logoOpacity=ease((t-1.48)/.64)*(1-ease((t-3.85)/.35));
  if(local>=0){
    actor.opacity=1;phase='peek';
    const peek=ease(local/.5);
    actor.y=mixNumber(.64,.455,peek);
    pose.headYaw=.17*peek;pose.headRoll=-.07*peek;pose.gazeX=-.38*peek;pose.attention=.45*peek;
    if(local>=.62){
      phase='anticipation';
      const prep=ease((local-.62)/.12);
      actor.y=.455+.008*prep;pose.crouch=.13*prep;pose.breath=.3;
    }
    if(local>=.74){
      phase='jump';
      const u=ease((local-.74)/.56);
      actor.x=cubicPoint(.55,.66,.6,.5,u);
      actor.y=cubicPoint(.463,.205,.195,.505,u);
      actor.width=mixNumber(.5,.8,u);
      actor.front=u>=.5;
      pose.crouch=.13*(1-ease(u/.2));pose.squash=-.015*Math.sin(Math.PI*u);
      pose.roll=-.055*Math.sin(Math.PI*u);pose.headYaw=.17*(1-ease(u));
      pose.headRoll=-.07*(1-ease(u));pose.gazeX=-.38*(1-ease(u));
      pose.scarfLag=-.7*Math.sin(Math.PI*u);pose.attention=.45*(1-ease(u));
    }
    if(local>=1.3){
      phase='settle';actor={x:.5,y:.505,width:.8,opacity:1,front:true};
      const s=local-1.3;
      pose.squash=entranceBeat([[0,0],[.075,.024],[.19,-.006],[.3,0]],s);
      pose.crouch=entranceBeat([[0,0],[.08,.2],[.2,-.03],[.3,0]],s);
      pose.scarfLag=entranceBeat([[0,0],[.08,.65],[.22,-.12],[.3,0]],s);
    }
    pose.engage=1;
  }
  let gesture='idle',gestureTime=0,actingPose=pose;
  if(t>=WAVE_START){
    phase=t<ENTRANCE_END?'welcome':'ready';gesture='welcome';gestureTime=Math.min(t-WAVE_START,4.5);
    actingPose=sampleGesture(gesture,gestureTime);
    actingPose.engage=Math.max(actingPose.engage,1-ease((t-WAVE_START)/.35));
    actingPose.scarfLag=0;
  }
  const quiet=1-actingPose.engage*.8;
  actingPose.y+=Math.sin(t*1.3)*.0035*quiet;
  const blink=idleBlink(t)*(1-actingPose.engage);
  actingPose.eyeLeft=Math.max(actingPose.eyeLeft,blink);actingPose.eyeRight=Math.max(actingPose.eyeRight,blink);
  const feet=actor.y+actor.width*.39;
  const height=Math.max(0,.505+.8*.39-feet);
  return {time:t,phase,actor,pose:actingPose,gesture,gestureTime,skyFade,logoOpacity,
    maskY:.48,shadow:{opacity:local<.74?0:.16*(1-clamp(height*1.8)),scale:1-clamp(height)*.4},
    bubble:ease((t-WAVE_START-.18)/.28),content:ease((t-WAVE_START-.05)/.4)};
}

export function sampleProfileTransition(from,elapsed) {
  const u=ease(elapsed/.9),pose=neutralPose();
  pose.headYaw=-.14;pose.headRoll=.075;pose.gazeX=-.5;pose.gazeY=.35;pose.attention=.45;
  const moving=sampleEntrance(from.time+elapsed);
  moving.pose=applyJourneyReaction(moving.pose,from.reaction,elapsed);
  const actor={x:mixNumber(moving.actor.x,.82,u),y:mixNumber(moving.actor.y,.27,u)-.055*Math.sin(Math.PI*u),width:mixNumber(moving.actor.width,.31,u),opacity:mixNumber(moving.actor.opacity,1,u)};
  actor.front=moving.actor.front||actor.y+actor.width*.21<.417;
  const scene={...from,phase:elapsed>=.9?'profile':'moving-to-profile',skyFade:mixNumber(moving.skyFade,1,ease(elapsed/.3)),logoOpacity:moving.logoOpacity*(1-ease(elapsed/.22)),bubble:moving.bubble*(1-ease(elapsed/.16)),
    actor,
    pose:blendPose(moving.pose,pose,u),gesture:'idle',gestureTime:0,content:ease((elapsed-.32)/.4),
    welcomeContent:moving.content*(1-ease(elapsed/.18)),brand:mixNumber(moving.content,1,ease(elapsed/.3)),
    shadow:{opacity:moving.shadow.opacity*(1-u),scale:moving.shadow.scale}};
  scene.pose.scarfLag=(moving.pose.scarfLag||0)*(1-u)-.12*Math.sin(Math.PI*u);
  return scene;
}

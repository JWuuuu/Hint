export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const ease = value => { const t = clamp(value); return t * t * t * (t * (t * 6 - 15) + 10); };

export function curve(points, time) {
  if (!points?.length) return 0;
  if (time <= points[0][0]) return points[0][1];
  if (time >= points.at(-1)[0]) return points.at(-1)[1];
  let i = 0;
  while (points[i + 1][0] < time) i++;
  const slope = index => {
    if (index === 0 || index === points.length - 1) return 0;
    const h0 = points[index][0] - points[index - 1][0];
    const h1 = points[index + 1][0] - points[index][0];
    const a = (points[index][1] - points[index - 1][1]) / h0;
    const b = (points[index + 1][1] - points[index][1]) / h1;
    if (a * b <= 0) return 0;
    const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
    return (w1 + w2) / (w1 / a + w2 / b);
  };
  const h = points[i + 1][0] - points[i][0], u = (time - points[i][0]) / h;
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * points[i][1] + (u3 - 2 * u2 + u) * h * slope(i)
    + (-2 * u3 + 3 * u2) * points[i + 1][1] + (u3 - u2) * h * slope(i + 1);
}

export const gestures = {
  'wink-left': {
    label: 'Left wink', title: 'Just between us.', duration: 1.9,
    tracks: {
      roll: [[0, 0], [.25, -.018], [.68, .059], [1.08, .037], [1.9, 0]],
      y: [[0, 0], [.28, .003], [.72, -.008], [1.9, 0]],
      eyeRight: [[0, 0], [.38, 0], [.54, 1], [.77, 1], [1.07, 0], [1.9, 0]],
      head: [[0, 0], [.3, -.15], [.68, .25], [1.9, 0]],
      playful: [[0,0],[.22,0],[.57,1],[.85,1],[1.9,0]],
      playfulSide: [[0,0],[.35,1],[1.25,1],[1.9,0]],
      pawDip: [[0,0],[.3,0],[.69,1],[1.05,.7],[1.9,0]]
    }
  },
  'wink-right': {
    label: 'Right wink', title: 'A little spark.', duration: 2.05,
    tracks: {
      roll: [[0, 0], [.28, .018], [.73, -.055], [1.2, -.032], [2.05, 0]],
      x: [[0, 0], [.3, .002], [.8, -.005], [2.05, 0]],
      y: [[0, 0], [.3, .003], [.78, -.005], [2.05, 0]],
      eyeLeft: [[0, 0], [.43, 0], [.6, 1], [.86, 1], [1.17, 0], [2.05, 0]],
      playful: [[0,0],[.28,0],[.65,.9],[.94,.9],[2.05,0]],
      playfulSide: [[0,0],[.4,-1],[1.32,-1],[2.05,0]],
      pawDip: [[0,0],[.35,0],[.78,-1],[1.18,-.6],[2.05,0]],
      head: [[0,0],[.28,-.12],[.78,.18],[2.05,0]]
    }
  },
  nod: {
    label: 'Nod', title: 'I’m with you.', duration: 2.3,
    tracks: {
      head: [[0, 0], [.32, -.65], [.83, 1.85], [1.04,1.8], [1.65, -.25], [2.3, 0]],
      y: [[0, 0], [.32, -.006], [.85, .018], [1.08,.017], [1.7, -.003], [2.3, 0]],
      gazeY: [[0,0],[.32,-.2],[.82,.8],[1.1,.8],[1.65,0],[2.3,0]],
      assurance: [[0,0],[.6,.7],[.87,1],[1.4,1],[2.3,0]],
      pawHug: [[0,0],[.35,0],[.9,1],[1.15,1],[2.3,0]],
      eyeLeft: [[0, 0], [.42, 0], [.73, 1], [1.04, 1], [1.4, 0], [2.3, 0]],
      eyeRight: [[0, 0], [.42, 0], [.73, 1], [1.04, 1], [1.4, 0], [2.3, 0]]
    }
  },
  listening: {
    label: 'Listening', title: 'I’m listening.', duration: 4.4,
    tracks: {
      scale: [[0, 0], [1.1, .04], [2.9, .04], [4.4, 0]],
      roll: [[0, 0], [.28,-.014], [1.15, .075], [2.9, .069], [4.4, 0]],
      lean: [[0,0],[.3,-.008],[1.2,.085],[2.9,.079],[4.4,0]],
      head: [[0, 0], [.3,.18], [1.1,-.3], [2.9,-.24], [4.4,0]],
      x: [[0,0],[1.1,-.003],[2.9,-.003],[4.4,0]],
      y: [[0, 0], [1.1, -.008], [2.9, -.008], [4.4, 0]],
      gazeX: [[0,0],[1.0,-.45],[2.9,-.4],[4.4,0]],
      attention: [[0,0],[.85,1],[3.0,1],[4.4,0]],
      pawOpen: [[0,0],[.3,0],[1.1,1],[2.9,1],[4.2,0],[4.4,0]],
      eyeLeft: [[0, 0], [2.2, 0], [2.34, 1], [2.42, 1], [2.62, 0], [4.4, 0]],
      eyeRight: [[0, 0], [2.2, 0], [2.34, 1], [2.42, 1], [2.62, 0], [4.4, 0]]
    }
  },
  thinking: {
    label: 'Thinking', title: 'Let me think…', duration: 4.6,
    tracks: {
      roll: [[0, 0], [.35, .018], [1.3, -.062], [2.9, -.055], [4.6, 0]],
      lean: [[0,0],[.35,.01],[1.4,-.062],[2.8,-.058],[4.6,0]],
      x: [[0, 0], [1.3, .004], [2.9, .004], [4.6, 0]],
      y: [[0,0],[.35,-.002],[1.4,.005],[2.9,.005],[4.6,0]],
      gazeX: [[0, 0], [.4, -.15], [1.15, 1], [2.9, .88], [4.2, 0], [4.6, 0]],
      gazeY: [[0, 0], [.4, .1], [1.15, -1], [2.9, -.92], [4.2, 0], [4.6, 0]],
      head: [[0, 0], [.35,-.15], [1.4,.65], [2.8,.58], [4.6, 0]],
      thought: [[0,0],[.4,0],[1.0,1],[3.0,1],[4.3,0],[4.6,0]],
      pawThink: [[0,0],[.3,0],[1.25,1],[3,1],[4.4,0],[4.6,0]],
      question: [[0,0],[.95,0],[1.5,1],[2.9,1],[3.6,0],[4.6,0]]
    }
  },
  celebration: {
    label: 'Celebration', title: 'A little moment of joy.', duration: 2.9,
    tracks: {
      y: [[0, 0], [.36, .012], [.98, -.073], [1.36, -.068], [2.05, .009], [2.9, 0]],
      squash: [[0, 0], [.36, .032], [.86, -.014], [1.36, -.007], [2.05, .023], [2.9, 0]],
      roll: [[0, 0], [.38, -.016], [1.06, .026], [1.58, .012], [2.24, -.009], [2.9, 0]],
      eyeLeft: [[0, 0], [.65, 0], [.85, 1], [1.27, 1], [1.63, 0], [2.9, 0]],
      eyeRight: [[0, 0], [.65, 0], [.85, 1], [1.27, 1], [1.63, 0], [2.9, 0]],
      joy: [[0,0],[.35,0],[.87,1],[1.48,1],[2.55,0],[2.9,0]],
      pawCelebrate: [[0,0],[.36,0],[1.0,1],[1.45,1],[2.5,0],[2.9,0]],
      sparkles: [[0,0],[.7,0],[1.03,1],[1.5,1],[2.2,0],[2.9,0]]
    }
  },
  'offer-letter': {
    label: 'Offer a letter', title: 'A letter for you.', duration: 2.2,
    tracks: {
      y: [[0,0],[.3,.004],[1.5,-.006],[2.2,-.006]],
      roll: [[0,0],[.3,.006],[1.55,-.014],[2.2,-.014]],
      head: [[0,0],[.5,.1],[1.5,-.25],[2.2,-.25]],
      scale: [[0,0],[1.6,.012],[2.2,.012]],
      expectant: [[0,0],[.55,.25],[1.6,1],[2.2,1]],
      gazeY: [[0,0],[.45,.9],[.75,.9],[1.65,0],[2.2,0]],
      gazeX: [[0,0],[.45,-.25],[.75,-.25],[1.65,0],[2.2,0]]
    }
  },
  'deliver-letter': {
    label: 'Deliver letter', title: 'This one is yours.', duration: 2.6,
    tracks: {
      y: [[0,-.006],[.45,-.009],[1.65,.003],[2.6,0]],
      roll: [[0,-.014],[.55,-.018],[1.8,.007],[2.6,0]],
      head: [[0,-.25],[.6,-.4],[1.4,.24],[2.6,0]],
      scale: [[0,.012],[.4,.018],[1.8,0],[2.6,0]],
      eyeLeft: [[0,0],[1.13,0],[1.3,.7],[1.65,0],[2.6,0]],
      eyeRight: [[0,0],[1.13,0],[1.3,.7],[1.65,0],[2.6,0]],
      expectant: [[0,1],[.65,1],[1.45,.35],[2.6,0]],
      gazeY: [[0,0],[.4,-.25],[.95,-.8],[1.4,-.6],[2.2,0],[2.6,0]],
      assurance: [[0,0],[.85,0],[1.4,.9],[1.8,.7],[2.6,0]],
      joy: [[0,0],[.95,0],[1.45,.24],[1.85,.18],[2.6,0]]
    }
  }
};

export function sampleGesture(id, time) {
  const clip = gestures[id];
  const pose = { x: 0, y: 0, roll: 0, head: 0, lean: 0, squash: 0, scale: 0, eyeLeft: 0, eyeRight: 0, gazeX: 0, gazeY: 0,
    thought:0,joy:0,attention:0,assurance:0,playful:0,playfulSide:0,expectant:0,
    pawThink:0,pawOpen:0,pawCelebrate:0,pawHug:0,pawDip:0,question:0,sparkles:0 };
  if (!clip) return { ...pose, engage: 0 };
  for (const [key, track] of Object.entries(clip.tracks)) pose[key] = curve(track, time);
  pose.engage = ease(time / .32) * (1 - ease((time - clip.duration + .5) / .5));
  if(id==='offer-letter')pose.engage=ease(time/.32);
  if(id==='deliver-letter')pose.engage=1-ease((time-2.1)/.5);
  return pose;
}

export const letterKeys = {
  'offer-letter': [[0,0],[.3,0],[.95,1],[1.8,2],[2.2,2]],
  'deliver-letter': [[0,2],[.25,2],[.7,3],[1.6,4],[2.6,5]]
};

function sampleLetterPaws(geometry, id, time, letter) {
  const keys=letterKeys[id] || [[0,letter==='delivered'?5:0],[1,letter==='delivered'?5:0]];
  let index=0;while(index<keys.length-2&&keys[index+1][0]<time)index++;
  const u=clamp((time-keys[index][0])/(keys[index+1][0]-keys[index][0]));
  return ['left','right'].map(side=>{
    const poses=geometry[side],a=poses[keys[index][1]],b=poses[keys[index+1][1]];
    const interpolate=get=>curve(keys.map(([t,i])=>[t,get(poses[i])]),time);
    const spread=id==='deliver-letter'?curve([[0,0],[.25,0],[.7,6],[1.6,0],[2.6,0]],time)*(side==='left'?-1:1):0;
    return {side,a:keys[index][1],b:keys[index+1][1],mix:ease(u),
      center:[0,1].map(c=>interpolate(p=>p.center[c])+(c===0?spread:0)),
      points:a.points.map((_,j)=>[0,1].map(c=>interpolate(p=>p.points[j][c])+(c===0?spread:0))),
      uvA:a,uvB:b};
  });
}

export function samplePaws(geometry,id,time,letter,expressionGeometry,pose=sampleGesture(id,time)) {
  const paws=sampleLetterPaws(geometry,id,time,letter);
  paws.forEach(p=>{p.textureA='letter-'+p.side+'-'+p.a;p.textureB='letter-'+p.side+'-'+p.b;});
  if(!expressionGeometry||id.includes('letter'))return paws;
  function blend(index,sourceIndex,weight,reflect=false,offset=[0,0]) {
    if(weight<=0)return;
    const p=paws[index],source=expressionGeometry.wave[sourceIndex],n=source.points.length;
    const uv=reflect?{center:source.center,points:source.points.map((_,j)=>source.points[(n/2-j+n)%n])}:source;
    const world=q=>[(reflect?410-q[0]:q[0])+offset[0],q[1]+offset[1]];
    const target={center:world(uv.center),points:uv.points.map(world)};
    p.center=p.center.map((v,c)=>v+(target.center[c]-v)*weight);
    p.points=p.points.map((q,j)=>q.map((v,c)=>v+(target.points[j][c]-v)*weight));
    p.uvB=uv;p.textureB='paw-'+sourceIndex;p.mix=ease(weight);
  }
  function connected(name,weight) {
    const drawing=expressionGeometry.connected?.[name];
    if(!drawing||weight<=0)return;
    const index=drawing.side==='right'?1:0,p=paws[index],arc=Math.sin(weight*Math.PI);
    const position=(v,c,target)=>v+(target-v)*weight+(c===0?(index?5:-5):-3)*arc;
    p.center=p.center.map((v,c)=>position(v,c,drawing.center[c]));
    p.points=p.points.map((q,j)=>q.map((v,c)=>position(v,c,drawing.points[j][c])));
    p.uvB=drawing.uv;p.textureB=drawing.texture;p.mix=ease(weight);
  }
  connected('thinking',pose.pawThink);
  connected('listening',pose.pawOpen);
  blend(0,2,pose.pawCelebrate);
  if(letter==='delivered'&&pose.pawCelebrate>0)blend(1,2,pose.pawCelebrate,true,[198,0]);
  for(const p of paws){
    const dx=(p.side==='left'?1:-1)*pose.pawHug*7;
    const dy=-pose.pawHug*5+pose.pawDip*(p.side==='left'?-3:2);
    p.center=[p.center[0]+dx,p.center[1]+dy];p.points=p.points.map(q=>[q[0]+dx,q[1]+dy]);
  }
  return paws;
}

export function sampleEnvelope(id,time,letter) {
  let amount=0,release=0;
  if(id==='offer-letter')amount=curve([[0,0],[.3,0],[.95,.55],[1.8,1],[2.2,1]],time);
  if(id==='deliver-letter'){amount=1;release=ease((time-.25)/1.25);}
  const opacity=letter==='delivered'&&id!=='offer-letter'?0:id==='deliver-letter'?1-ease((time-.8)/.7):1;
  return {x:2*amount,y:-25*amount-48*release,scale:1+.2*amount+.7*release,angle:-.105*amount-.09*release,opacity,front:id==='deliver-letter'?ease((time-.25)/.35):0};
}

export function idleBlink(time) {
  const p = (time + 2.7) % 4.9;
  return p > .29 ? 0 : p < .085 ? ease(p / .085) : p < .125 ? 1 : 1 - ease((p - .125) / .165);
}

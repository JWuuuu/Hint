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

export const welcomeKeys=[
  [0,0,0,0,0],[.24,0,.004,.004,.018],[.75,1,-.005,-.005,-.008],
  [1.13,2,-.010,-.012,-.027],[1.43,3,-.014,-.018,-.039],
  [1.72,4,-.016,-.020,-.045],[2.10,5,-.006,-.021,-.019],
  [2.47,4,-.012,-.018,-.034],[2.80,3,-.004,-.014,-.010],
  [3.16,2,.008,-.005,.018],[3.65,1,.010,.004,.029],
  [4.07,0,-.002,-.002,-.009],[4.5,0,0,0,0]
];
export const gestures = {
  sleepy:{label:'Sleepy',title:'Just a little sleepy.',duration:4.6,tracks:{
    tired:[[0,0],[.45,.25],[1.3,1],[3.1,1],[4.6,0]],
    yawn:[[0,0],[.65,0],[1.3,.85],[1.9,1],[2.55,.25],[3.05,0],[4.6,0]],
    eyeLeft:[[0,0],[.6,.25],[1.3,1],[2.5,1],[3.35,.65],[3.65,1],[4.2,.15],[4.6,0]],
    eyeRight:[[0,0],[.66,.25],[1.38,1],[2.55,1],[3.38,.7],[3.7,1],[4.25,.1],[4.6,0]],
    head:[[0,0],[.55,.45],[1.4,-.55],[2.1,-.55],[3.3,1.7],[3.75,1.7],[4.2,-.2],[4.6,0]],
    roll:[[0,0],[1.3,-.015],[2,-.015],[3.35,.047],[3.75,.047],[4.25,-.008],[4.6,0]],
    y:[[0,0],[1.5,-.008],[2.1,-.008],[3.4,.019],[3.75,.019],[4.25,-.003],[4.6,0]],
    breath:[[0,0],[1.4,.8],[2,.8],[3.1,-.5],[4.6,0]],
    pawHug:[[0,0],[1.3,.3],[3.5,.3],[4.6,0]],
    gazeY:[[0,0],[2.7,.45],[3.6,.6],[4.6,0]]
  }},
  frustrated:{label:'A little frustrated',title:'Hmm. Let’s try again.',duration:3.5,tracks:{
    grumpy:[[0,0],[.4,.1],[1,.85],[1.85,.85],[2.7,.3],[3.5,0]],
    turn:[[0,0],[.3,.15],[1.15,-.85],[1.85,-.85],[2.7,-.2],[3.5,0]],
    gazeX:[[0,0],[.4,.1],[1.1,-1],[1.85,-1],[2.7,-.15],[3.5,0]],
    roll:[[0,0],[.35,.01],[1.1,-.042],[1.85,-.042],[2.7,.007],[3.5,0]],
    head:[[0,0],[.4,.2],[1.1,-.25],[1.85,-.25],[2.6,.35],[3.5,0]],
    pawHug:[[0,0],[1,.75],[1.9,.75],[3.5,0]],
    breath:[[0,0],[1.3,.3],[2.35,-.4],[3.5,0]],
    y:[[0,0],[1.1,-.005],[1.85,-.005],[2.7,.006],[3.5,0]]
  }},
  disappointed:{label:'Disappointed',title:'That was a little hard.',duration:4,tracks:{
    sad:[[0,0],[.5,.15],[1.3,1],[2.6,1],[4,0]],
    breath:[[0,0],[.5,.6],[1.8,-.65],[3.1,-.1],[4,0]],
    head:[[0,0],[.4,-.1],[1.5,1.55],[2.65,1.55],[4,0]],
    y:[[0,0],[.45,-.004],[1.6,.026],[2.7,.026],[4,0]],
    roll:[[0,0],[1.5,-.026],[2.7,-.026],[4,0]],
    gazeY:[[0,0],[1.2,1.2],[2.7,1.2],[4,0]],
    gazeX:[[0,0],[1.2,-.25],[2.7,-.25],[4,0]],
    pawHug:[[0,0],[.4,.15],[1.6,-.4],[2.7,-.4],[4,0]],
    eyeLeft:[[0,0],[1.3,.15],[2.7,.15],[4,0]],
    eyeRight:[[0,0],[1.3,.15],[2.7,.15],[4,0]]
  }},
  comfort:{label:'Comfort',title:'I’m here with you.',duration:3.8,tracks:{
    soft:[[0,0],[.8,1],[2.6,1],[3.8,0]],
    assurance:[[0,0],[.9,.85],[2.6,.85],[3.8,0]],
    pawReach:[[0,0],[.3,0],[1.1,.95],[2.5,.95],[3.8,0]],
    roll:[[0,0],[.3,-.012],[1.2,.048],[2.5,.048],[3.8,0]],
    lean:[[0,0],[1.2,.032],[2.5,.032],[3.8,0]],
    scale:[[0,0],[1.2,.035],[2.5,.035],[3.8,0]],
    head:[[0,0],[.35,-.2],[1.35,.5],[2.6,.4],[3.8,0]],
    gazeY:[[0,0],[1.2,.2],[2.5,.2],[3.8,0]],
    eyeLeft:[[0,0],[1.2,.18],[2.5,.18],[3.8,0]],
    eyeRight:[[0,0],[1.2,.18],[2.5,.18],[3.8,0]]
  }},
  shy:{label:'Shy',title:'Aw, thank you.',duration:3.6,tracks:{
    shy:[[0,0],[.45,.15],[1.15,1],[2.3,1],[3.6,0]],
    head:[[0,0],[.3,-.15],[1.15,1.35],[2.3,1.35],[3.6,0]],
    turn:[[0,0],[1.1,-.6],[2.3,-.6],[3.6,0]],
    roll:[[0,0],[.3,.013],[1.2,-.046],[2.3,-.046],[3.6,0]],
    gazeX:[[0,0],[1,-.9],[2.35,-.9],[3.6,0]],
    gazeY:[[0,0],[1.1,1],[2.35,1],[3.6,0]],
    pawHug:[[0,0],[1.2,1],[2.35,1],[3.6,0]],
    y:[[0,0],[1.2,.013],[2.35,.013],[3.6,0]],
    eyeLeft:[[0,0],[1.1,.24],[2.3,.24],[3.6,0]],
    eyeRight:[[0,0],[1.1,.18],[2.3,.18],[3.6,0]]
  }},
  surprised:{label:'Surprised',title:'Oh!',duration:2.7,tracks:{
    wide:[[0,0],[.2,0],[.57,.85],[1.1,.85],[2.7,0]],
    round:[[0,0],[.22,0],[.6,1],[1.08,1],[1.85,.2],[2.7,0]],
    scale:[[0,0],[.17,.006],[.6,-.04],[1.1,-.04],[2.1,.006],[2.7,0]],
    y:[[0,0],[.2,.002],[.62,.015],[1.1,.015],[2.1,-.002],[2.7,0]],
    head:[[0,0],[.2,.2],[.6,-.75],[1.08,-.75],[2.7,0]],
    roll:[[0,0],[.2,-.008],[.62,.035],[1.1,.035],[2.7,0]],
    pawHug:[[0,0],[.25,0],[.6,.95],[1.15,.95],[2.7,0]],
    gazeY:[[0,0],[.58,-.15],[1.1,-.15],[2.7,0]],
    eyeLeft:[[0,0],[1.75,0],[1.87,1],[1.97,1],[2.18,0],[2.7,0]],
    eyeRight:[[0,0],[1.75,0],[1.87,1],[1.97,1],[2.18,0],[2.7,0]]
  }},
  curious:{label:'Curious',title:'Oh? Tell me more.',duration:3.4,tracks:{
    wide:[[0,0],[.35,.05],[1.05,1],[2.15,1],[3.4,0]],
    round:[[0,0],[1.05,.18],[2.1,.18],[3.4,0]],
    roll:[[0,0],[.3,.013],[1.12,-.065],[2.13,-.065],[3.4,0]],
    lean:[[0,0],[.3,.009],[1.12,-.05],[2.13,-.05],[3.4,0]],
    x:[[0,0],[.3,.002],[1.12,-.014],[2.13,-.014],[3.4,0]],
    scale:[[0,0],[.35,-.008],[1.1,.045],[2.15,.045],[3.4,0]],
    head:[[0,0],[.3,.2],[1.1,-.55],[2.15,-.55],[3.4,0]],
    gazeX:[[0,0],[1.05,-.45],[2.15,-.4],[3.4,0]],
    gazeY:[[0,0],[1.05,-.12],[2.15,-.12],[3.4,0]],
    pawReach:[[0,0],[.4,0],[1.1,.35],[2.15,.35],[3.4,0]]
  }},
  'shake-head':{label:'Shake head',title:'Not this time.',duration:3.1,tracks:{
    turn:[[0,0],[.3,.15],[.78,-1.1],[1.35,1.1],[1.95,-.65],[2.5,.2],[3.1,0]],
    gazeX:[[0,0],[.78,-.8],[1.35,.8],[1.95,-.4],[3.1,0]],
    roll:[[0,0],[.78,-.025],[1.35,.025],[1.95,-.016],[3.1,0]],
    x:[[0,0],[.78,-.004],[1.35,.004],[1.95,-.003],[3.1,0]],
    head:[[0,0],[.35,-.25],[1.7,-.1],[3.1,0]],
    soft:[[0,0],[.6,.8],[2.1,.8],[3.1,0]],
    thought:[[0,0],[.6,.17],[2.1,.17],[3.1,0]],
    pawHug:[[0,0],[.7,.5],[1.95,.5],[3.1,0]]
  }},
  welcome:{label:'Welcome',title:'Hey, welcome to Hint.',duration:4.5,tracks:{
    x:welcomeKeys.map(k=>[k[0],k[2]]),y:welcomeKeys.map(k=>[k[0],k[3]]),roll:welcomeKeys.map(k=>[k[0],k[4]]),
    assurance:[[0,0],[1,.3],[3,.3],[4.5,0]]
  }},
  idle:{label:'Idle',title:'Here with you.',duration:6,tracks:{}},
  waiting:{label:'Waiting',title:'One moment.',duration:6,tracks:{
    pawHug:[[0,0],[.8,.65],[4.8,.65],[6,0]],
    expectant:[[0,0],[.8,.3],[4.8,.3],[6,0]],
    thought:[[0,0],[.8,.2],[4.8,.2],[6,0]],
    gazeX:[[0,0],[1.2,.9],[2.4,.9],[3.5,-.55],[4.6,-.55],[6,0]],
    gazeY:[[0,0],[1.2,.12],[4.6,.12],[6,0]],
    roll:[[0,0],[1.3,.027],[2.4,.027],[3.7,-.023],[4.6,-.023],[6,0]],
    x:[[0,0],[1.3,.009],[2.4,.009],[3.7,-.009],[4.6,-.009],[6,0]],
    head:[[0,0],[.9,.25],[2.4,.25],[3.7,.05],[6,0]]
  }},
  speaking:{label:'Speaking',title:'Let’s talk.',duration:5.6,tracks:{
    speech:[[0,0],[.6,1],[4.7,1],[5.6,0]],
    assurance:[[0,0],[.7,.4],[4.8,.4],[5.6,0]],
    head:[[0,0],[.5,-.2],[1.1,.35],[1.65,-.18],[2.3,.28],[3,-.18],[3.8,.32],[4.6,-.15],[5.6,0]],
    roll:[[0,0],[.65,-.02],[2.3,.018],[3.8,-.015],[5.6,0]],
    pawReach:[[0,0],[.7,.25],[1.4,.5],[2.4,.25],[3.7,.45],[4.7,.2],[5.6,0]],
    gazeX:[[0,0],[1,.2],[2.6,-.15],[4,.2],[5.6,0]]
  }},
  reading:{label:'Reading',title:'Take your time.',duration:5.4,tracks:{
    head:[[0,0],[.35,-.15],[1.15,1.55],[3.8,1.45],[5.4,0]],
    y:[[0,0],[1.1,.014],[3.8,.012],[5.4,0]],
    roll:[[0,0],[1.1,.02],[3.8,.016],[5.4,0]],
    gazeY:[[0,0],[1,.75],[2.7,.86],[3.9,.95],[5.4,0]],
    gazeX:[[0,0],[1,-.8],[1.7,.65],[2.05,-.7],[2.9,.65],[3.25,-.7],[3.9,.35],[5.4,0]],
    reading:[[0,0],[1,1],[4.1,1],[5.4,0]],
    pawHug:[[0,0],[1.1,.35],[3.9,.35],[5.4,0]],
    soft:[[0,0],[1,.45],[4,.45],[5.4,0]]
  }},
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
    label: 'Offer a letter', title: 'This is for you.', duration: 2.4,
    tracks: {
      breath: [[0,0],[.42,1],[1.35,-.3],[2.4,0]],
      y: [[0,0],[.42,-.008],[1.6,.009],[2.4,.008]],
      roll: [[0,0],[.42,.009],[1.55,-.016],[2.4,-.013]],
      head: [[0,0],[.4,.45],[.75,.45],[1.75,-.27],[2.4,-.22]],
      lean: [[0,0],[.4,-.01],[1.7,.016],[2.4,.012]],
      scale: [[0,0],[.4,.003],[1.7,.025],[2.4,.022]],
      expectant: [[0,0],[.6,.2],[1.65,1],[2.4,1]],
      gazeY: [[0,0],[.35,.9],[.7,.8],[1.55,-.06],[2.4,0]],
      gazeX: [[0,0],[.4,-.2],[.75,-.2],[1.5,0],[2.4,0]]
    }
  },
  'deliver-letter': {
    label: 'Deliver letter', title: 'Yours to keep.', duration: 1.8,
    tracks: {
      y: [[0,.008],[.35,.012],[1.1,-.003],[1.8,0]],
      roll: [[0,-.013],[.35,-.018],[1.25,.006],[1.8,0]],
      lean: [[0,.012],[.35,.02],[1.3,-.004],[1.8,0]],
      head: [[0,-.22],[.4,-.3],[1,.42],[1.8,0]],
      scale: [[0,.022],[.32,.03],[1.3,0],[1.8,0]],
      expectant: [[0,1],[.45,1],[1.4,0],[1.8,0]],
      gazeY: [[0,0],[.5,.2],[1,1],[1.8,0]],
      assurance: [[0,0],[.55,0],[1.05,.8],[1.8,0]],
      joy: [[0,0],[.65,0],[1.2,.3],[1.8,0]]
    }
  }
};

export function neutralPose() {
  return { x: 0, y: 0, roll: 0, head: 0, lean: 0, squash: 0, scale: 0, eyeLeft: 0, eyeRight: 0, gazeX: 0, gazeY: 0,
    thought:0,joy:0,attention:0,assurance:0,playful:0,playfulSide:0,expectant:0,
    pawThink:0,pawOpen:0,pawCelebrate:0,pawHug:0,pawDip:0,question:0,sparkles:0,breath:0,turn:0,wide:0,soft:0,round:0,speech:0,reading:0,shy:0,sad:0,grumpy:0,tired:0,yawn:0,pawReach:0,pawWave:0,waveTime:0,engage:0 };
}

export function sampleGesture(id, time) {
  const clip = gestures[id],pose=neutralPose();
  if (!clip) return { ...pose, engage: 0 };
  for (const [key, track] of Object.entries(clip.tracks)) pose[key] = curve(track, time);
  pose.eyeLeft=clamp(pose.eyeLeft);pose.eyeRight=clamp(pose.eyeRight);
  pose.engage = ease(time / .32) * (1 - ease((time - clip.duration + .5) / .5));
  if(id==='offer-letter')pose.engage=ease(time/.32);
  if(id==='deliver-letter')pose.engage=1-ease((time-1.3)/.5);
  if(id==='speaking')pose.speech*=speechEnvelope(time);
  if(id==='welcome'){
    pose.pawWave=ease(time/.22)*(1-ease((time-4.2)/.3));
    pose.waveTime=time>=4.5?0:time;
    pose.engage=ease(time/.7)*(1-ease((time-3.8)/.7));
  }
  return pose;
}

export const HANDOFF_TIME = .48;
export const letterKeys = {
  'offer-letter': [[0,0],[.42,0],[1.18,1],[2.1,2],[2.4,2]],
  'deliver-letter': [[0,2],[.26,2],[.48,3],[1.12,4],[1.8,5]]
};

function sampleLetterPaws(geometry, id, time, letter) {
  const keys=letterKeys[id] || [[0,letter==='delivered'?5:0],[1,letter==='delivered'?5:0]];
  let index=0;while(index<keys.length-2&&keys[index+1][0]<time)index++;
  const u=clamp((time-keys[index][0])/(keys[index+1][0]-keys[index][0]));
  return ['left','right'].map(side=>{
    const poses=geometry[side],a=poses[keys[index][1]],b=poses[keys[index+1][1]];
    const interpolate=get=>curve(keys.map(([t,i])=>[t,get(poses[i])]),time);
    const spread=id==='deliver-letter'?curve([[0,0],[.48,0],[.85,5],[1.4,0],[1.8,0]],time)*(side==='left'?-1:1):0;
    return {side,a:keys[index][1],b:keys[index+1][1],mix:ease(u),
      center:[0,1].map(c=>interpolate(p=>p.center[c])+(c===0?spread:0)),
      points:a.points.map((_,j)=>[0,1].map(c=>interpolate(p=>p.points[j][c])+(c===0?spread:0))),
      uvA:a,uvB:b};
  });
}

export function samplePaws(geometry,id,time,letter,expressionGeometry,pose=sampleGesture(id,time),greetingGeometry) {
  const paws=sampleLetterPaws(geometry,id,time,letter);
  paws.forEach(p=>{p.textureA='letter-'+p.side+'-'+p.a;p.textureB='letter-'+p.side+'-'+p.b;});
  if(!expressionGeometry)return paws;
  if(pose.pawWave>0&&greetingGeometry){
    const data=greetingGeometry,phase=pose.waveTime;
    let index=0;while(index<welcomeKeys.length-2&&welcomeKeys[index+1][0]<phase)index++;
    const a=data.poses[welcomeKeys[index][1]],b=data.poses[welcomeKeys[index+1][1]];
    const sample=get=>curve(welcomeKeys.map(([t,i])=>[t,get(data.poses[i])]),phase);
    const angle=sample(p=>p.angle),radius=sample(p=>p.radius),c=Math.cos(angle),s=Math.sin(angle);
    const center=[data.root[0]+c*radius,data.root[1]+s*radius];
    const outline=a.local.map((_,j)=>{const x=sample(p=>p.local[j][0]),y=sample(p=>p.local[j][1]);return [center[0]+c*x-s*y,center[1]+s*x+c*y];}).reverse();
    const p=paws[0],weight=pose.pawWave,base=p.uvA;
    const uvA={center:a.center,points:[]},uvB={center:b.center,points:[]};
    const textureA=a.points.slice().reverse(),textureB=b.points.slice().reverse();
    // All drawings use the same radial order, including when a wave is interrupted.
    const points=base.points.map((_,j)=>{
      const angle=j/base.points.length*Math.PI*2,dx=Math.cos(angle),dy=Math.sin(angle);
      let radius=Infinity,index=0,weight=0;
      for(let i=0;i<outline.length;i++){
        const q=outline[i],r=outline[(i+1)%outline.length],ex=r[0]-q[0],ey=r[1]-q[1],den=dx*ey-dy*ex;
        if(Math.abs(den)<1e-9)continue;
        const ax=q[0]-center[0],ay=q[1]-center[1],distance=(ax*ey-ay*ex)/den,u=(ax*dy-ay*dx)/den;
        if(distance>0&&u>=0&&u<=1&&distance<radius){radius=distance;index=i;weight=u;}
      }
      for(const [uv,source] of [[uvA,textureA],[uvB,textureB]])uv.points.push(source[index].map((v,k)=>v+(source[(index+1)%source.length][k]-v)*weight));
      return [center[0]+dx*radius,center[1]+dy*radius];
    });
    // The approved drawings share the same shoulder pivot throughout the wave.
    p.center=p.center.map((v,k)=>v+(center[k]-v)*weight);
    if(weight<1){
      p.points=points.map((q,j)=>q.map((v,k)=>base.points[j][k]+(v-base.points[j][k])*weight));
    }else p.points=points;
    p.uvA=uvA;p.uvB=uvB;
    p.textureA='paw-'+welcomeKeys[index][1];p.textureB='paw-'+welcomeKeys[index+1][1];
    p.mix=clamp((phase-welcomeKeys[index][0])/(welcomeKeys[index+1][0]-welcomeKeys[index][0]));
    p.uvC=base;p.textureC='letter-left-'+p.a;p.baseMix=1-weight;
  }
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
    if(p.uvC){p.uvC=drawing.uv;p.textureC=drawing.texture;p.baseMix=ease(weight);}
    else{p.uvB=drawing.uv;p.textureB=drawing.texture;p.mix=ease(weight);}
  }
  connected('thinking',pose.pawThink);
  connected('listening',pose.pawOpen);
  if(pose.pawReach>0){
    const p=paws[0],angle=.65*pose.pawReach,c=Math.cos(angle),s=Math.sin(angle);
    const rotate=q=>[205+(q[0]-205)*c-(q[1]-380)*s,380+(q[0]-205)*s+(q[1]-380)*c];
    p.center=rotate(p.center);p.points=p.points.map(rotate);
  }
  blend(0,2,pose.pawCelebrate);
  if(letter==='delivered'&&pose.pawCelebrate>0)blend(1,2,pose.pawCelebrate,true,[198,0]);
  for(const p of paws){
    const dx=(p.side==='left'?1:-1)*pose.pawHug*7;
    const dy=-pose.pawHug*5+pose.pawDip*(p.side==='left'?-3:2);
    p.center=[p.center[0]+dx,p.center[1]+dy];p.points=p.points.map(q=>[q[0]+dx,q[1]+dy]);
  }
  return paws;
}

export function sampleEnvelope(id,time,letter,geometry) {
  const releasing=id==='deliver-letter';
  const ownership=letter==='delivered'||releasing&&time>=HANDOFF_TIME;
  const attachmentTime=releasing?Math.min(time,HANDOFF_TIME):time;
  let x=0,y=0,scale=1,angle=0;
  if(geometry&&(id.includes('letter')||letter==='offered')){
    const paws=sampleLetterPaws(geometry,id,attachmentTime,letter);
    const left=[paws[0].center[0]+28,paws[0].center[1]-3];
    const right=[paws[1].center[0]-28,paws[1].center[1]-14];
    const base=[geometry.left[0].center[0]+28,geometry.left[0].center[1]-3];
    const other=[geometry.right[0].center[0]-28,geometry.right[0].center[1]-14];
    const bx=other[0]-base[0],by=other[1]-base[1],dx=right[0]-left[0],dy=right[1]-left[1];
    angle=Math.atan2(dy,dx)-Math.atan2(by,bx);
    scale=Math.hypot(dx,dy)/Math.hypot(bx,by);
    const mx=(base[0]+other[0])/2,my=(base[1]+other[1])/2;
    const c=Math.cos(angle),s=Math.sin(angle);
    x=(left[0]+right[0])/2+(292-mx)*c*scale-(411-my)*s*scale-292;
    y=(left[1]+right[1])/2+(292-mx)*s*scale+(411-my)*c*scale-411;
  }
  return {x,y,scale,angle,opacity:1,front:ownership?1:0,
    received:ownership,release:letter==='delivered'&&!releasing?1:releasing?ease((time-HANDOFF_TIME)/.84):0};
}

export function idleBlink(time) {
  const p = (time + 2.7) % 4.9;
  return p > .29 ? 0 : p < .085 ? ease(p / .085) : p < .125 ? 1 : 1 - ease((p - .125) / .165);
}

export const activities = ['idle','listening','thinking','reading','speaking','waiting'];
export function speechEnvelope(time){
  const t=time%4.8;
  let level=0;
  for(const [center,width,height] of [[.32,.22,.65],[.76,.19,.4],[1.15,.28,.82],[1.9,.26,.6],[2.39,.21,.85],[2.87,.2,.45],[3.55,.3,.72],[4.15,.19,.42]]){
    const x=Math.abs(t-center)/width;if(x<1)level+=height*(1+Math.cos(Math.PI*x))/2;
  }
  return level;
}
export function blendPose(a,b,amount){
  const out=neutralPose();
  for(const key of Object.keys(out))out[key]=(a[key]||0)+((b[key]||0)-(a[key]||0))*amount;
  if(a.pawWave>0&&!b.pawWave)out.waveTime=a.waveTime;
  return out;
}
export function sampleActivity(id,time){
  let p=neutralPose();
  if(id==='listening'){
    p=sampleGesture('listening',1.65);p.eyeLeft=p.eyeRight=0;
    p.head+=Math.sin(time*Math.PI/4)*.12;p.roll+=Math.sin(time*Math.PI/5)*.004;
    p.gazeX=-.25+Math.sin(time*Math.PI/6)*.15;
  }
  if(id==='thinking'){
    p=sampleGesture('thinking',1.8);p.eyeLeft=p.eyeRight=0;
    p.gazeX=.83+Math.sin(time*Math.PI/5)*.13;p.gazeY=-.85+Math.sin(time*Math.PI/7)*.08;
    p.head+=Math.sin(time*Math.PI/5)*.1;
    p.question=.65+.12*Math.sin(time*Math.PI/8);
  }
  if(id==='reading'){
    p=sampleGesture('reading',1.2);
    const line=time%5.6;
    p.gazeX=curve([[0,-.75],[1.8,.65],[2.3,-.75],[4.2,.65],[4.75,-.75],[5.6,-.75]],line);
    p.gazeY=.85+Math.sin(time*Math.PI/7)*.09;
    p.head=1.5+Math.sin(time*Math.PI/7)*.14;
    p.reading=1;p.soft=.45;
  }
  if(id==='speaking'){
    p=sampleGesture('speaking',1.1);p.speech=speechEnvelope(time);
    p.head=Math.sin(time*Math.PI/2.4)*.25;p.roll=Math.sin(time*Math.PI/3.6)*.016;
    p.pawReach=.28+.13*Math.sin(time*Math.PI/3);
    p.gazeX=.15*Math.sin(time*Math.PI/4);p.assurance=.4;
  }
  if(id==='waiting'){
    p=sampleGesture('waiting',1.4);
    p.gazeX=curve([[0,0],[1.7,.9],[3.2,.9],[4.8,0],[6.2,-.65],[7.8,-.65],[9.6,0],[12,0]],time%12);
    p.roll=.025*Math.sin(time*Math.PI/6);p.x=.008*Math.sin(time*Math.PI/6);
    p.head=.15+.1*Math.sin(time*Math.PI/6);p.pawHug=.65;
  }
  p.engage=id==='idle'?0:.92;
  return p;
}

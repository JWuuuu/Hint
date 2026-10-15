import { samplePaws, sampleEnvelope, sampleGesture, projectEnvelopePoint, HANDOFF_TIME, ease } from './motion.js';
import { createFacePainter } from './face.js';
import { projectBodyPoint } from './letter-scene-motion.js';

export async function createRenderer(canvas, bundle) {
  const images = await Promise.all(Object.entries(bundle.images).map(async ([name, src]) => {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error(`Could not load ${name}`)); image.src = src; });
    return [name, image];
  }));
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error('Graphics support is unavailable.');
  const vertex = `precision highp float;
    attribute vec2 a_position,a_uv,a_uvB,a_uvC;
    varying vec2 v_uv,v_uvB,v_uvC;
    uniform float u_time,u_part,u_engage,u_head,u_lean,u_breath,u_turn,u_crouch,u_scarf;
    uniform vec2 u_look,u_shape;
    uniform vec4 u_frame;
    uniform vec3 u_pose,u_headRotation;
    vec2 rotate(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
    float area(vec2 p,vec2 c,vec2 r){vec2 q=(p-c)/r;return exp(-dot(q,q)*2.);}
    void main(){v_uv=a_uv;v_uvB=a_uvB;v_uvC=a_uvC;vec2 p=a_position;
      if(u_part>3.5){gl_Position=vec4(p.x*2.-1.,1.-p.y*2.,0.,1.);return;}
      if(u_part<2.5){
        if(u_part<.5||u_part>1.5){
        float neck=1.-smoothstep(.48,.73,p.y);
        float depth=.15*area(p,vec2(.49,.43),vec2(.43,.37));
        vec3 headPoint=vec3(p-vec2(.49,.585),depth);
        float cy=cos(u_headRotation.x),sy=sin(u_headRotation.x);
        headPoint=vec3(headPoint.x*cy+headPoint.z*sy,headPoint.y,-headPoint.x*sy+headPoint.z*cy);
        float cp=cos(u_headRotation.y),sp=sin(u_headRotation.y);
        headPoint=vec3(headPoint.x,headPoint.y*cp+headPoint.z*sp,-headPoint.y*sp+headPoint.z*cp);
        vec2 turned=vec2(.49,.585)+rotate(headPoint.xy,u_headRotation.z)/(1.-(headPoint.z-depth)*.5);
        p=mix(p,turned,neck);
        }
        float upper=1.-smoothstep(.47,.65,p.y);
        p=vec2(.49,.575)+rotate(p-vec2(.49,.575),u_lean*upper);
        p.x+=u_lean*.12*upper;
        p.x+=u_turn*.024*upper;
        float head=1.-smoothstep(.48,.575,p.y);p.x+=head*u_look.x*.004;p.y+=head*(u_look.y*.002+u_head*.012);
        p.y+=(.46-p.y)*head*max(u_head,0.)*.018;
      }
      if(u_part<.5){
        float tip=area(p,vec2(.63,.16),vec2(.19,.20));p.x+=tip*sin(u_time*1.3-.7)*.003*(1.-u_engage*.75);
        float scarf=area(p,vec2(.735,.617),vec2(.083,.065));p.y+=scarf*(sin(u_time*1.8-1.2)*.002+u_scarf*.012);
        p.x+=scarf*u_scarf*.004;
      }
      float belly=area(p,vec2(.48,.69),vec2(.27,.30));p.x+=(p.x-.49)*belly*(sin(u_time*1.25)*.007+u_breath*.02);p.y+=belly*(sin(u_time*1.25)*.0015-u_breath*.0015);
      p.y+=u_crouch*.037*(1.-smoothstep(.48,.88,p.y));
      p.x-=(p.x-.49)*belly*u_crouch*.025;
      p=vec2(.5,.68)+(p-vec2(.5,.68))*vec2(1.+u_shape.x+u_shape.y,1.+u_shape.x-u_shape.y);
      p=vec2(.5,.68)+rotate(p-vec2(.5,.68),u_pose.z)+u_pose.xy;
      p=vec2(.5,.5)+(p-vec2(.5,.5))*.94;
      p=u_frame.xy+p*u_frame.zw;
      gl_Position=vec4(p.x*2.-1.,1.-p.y*2.,0.,1.);
    }`;
  const fragment = `precision mediump float;
    varying vec2 v_uv,v_uvB,v_uvC;
    uniform sampler2D u_image,u_imageB,u_imageC;
    uniform float u_opacity,u_mix,u_base,u_paper;
    void main(){
      vec4 a=texture2D(u_image,v_uv),b=texture2D(u_imageB,v_uvB),c=texture2D(u_imageC,v_uvC);
      if(u_paper>.5){
        vec2 q=v_uvB;
        float flap=.65*(1.-abs(q.x-.5)*2.);
        float seal=length((q-vec2(.494,.59))/vec2(.131,.204));
        vec2 paperUV=vec2(.0625,.2375)+vec2(.8555,.5422)*(vec2(.12,.03)+q*vec2(.76,.36));
        vec4 plain=texture2D(u_image,paperUV);
        float edge=1.;
        if(u_paper<1.5){
          edge=smoothstep(-.003,.003,q.y-flap);
          if(seal<1.04)a=plain;
        }else if(u_paper<3.5){
          edge=1.-smoothstep(-.003,.003,q.y-flap);
          if(u_paper>2.5)a=vec4(plain.rgb*.97,1.);
          else if(seal<1.04)a=plain;
        }else if(u_paper<4.5)a=vec4(plain.rgb*.92,1.);
        else edge=1.-smoothstep(.995,1.005,seal);
        gl_FragColor=vec4(a.rgb*a.a,a.a)*u_opacity*edge;return;
      }
      vec4 drawing=mix(vec4(a.rgb*a.a,a.a),vec4(b.rgb*b.a,b.a),u_mix);
      gl_FragColor=mix(drawing,vec4(c.rgb*c.a,c.a),u_base)*u_opacity;
    }`;
  const compile = (type, source) => {
    const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  const program = gl.createProgram();
  const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, fragment)];
  shaders.forEach(shader => gl.attachShader(program, shader));gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const attributes = ['position', 'uv', 'uvB', 'uvC'].map(name => gl.getAttribLocation(program, 'a_' + name));
  attributes.forEach(value => gl.enableVertexAttribArray(value));
  const uniforms = Object.fromEntries(['time', 'part', 'engage', 'head', 'lean', 'breath', 'turn', 'crouch', 'scarf', 'headRotation', 'look', 'shape', 'pose', 'opacity', 'mix', 'base','frame','paper'].map(name => [name, gl.getUniformLocation(program, 'u_' + name)]));
  gl.uniform1i(gl.getUniformLocation(program,'u_image'),0);gl.uniform1i(gl.getUniformLocation(program,'u_imageB'),1);
  gl.uniform1i(gl.getUniformLocation(program,'u_imageC'),2);
  const textures = Object.fromEntries(images.map(([name, img]) => {
    const texture = gl.createTexture();gl.bindTexture(gl.TEXTURE_2D, texture);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    return [name, texture];
  }));
  const meshes = [];
  function mesh(vertices, indices, dynamic = false, components = 6) {
    const v = gl.createBuffer(), i = gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER, v);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, i);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    const result = { v, i, count: indices.length, components };meshes.push(result);return result;
  }
  const vertices = [], indices = [], n = 140;
  for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) vertices.push(x/n, y/n, x/n, y/n, x/n, y/n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const a = y*(n+1)+x, b = a+n+1;indices.push(a,b,a+1,a+1,b,b+1); }
  const body = mesh(vertices, indices);
  function patchMesh(box,steps=24){
    const v=[],ind=[];
    for(let y=0;y<=steps;y++)for(let x=0;x<=steps;x++)v.push((box.x+box.width*x/steps)/640,(box.y+box.height*y/steps)/640,x/steps,y/steps,x/steps,y/steps);
    for(let y=0;y<steps;y++)for(let x=0;x<steps;x++){const a=y*(steps+1)+x,b=a+steps+1;ind.push(a,b,a+1,a+1,b,b+1);}
    return mesh(v,ind);
  }
  const facePainter=createFacePainter(Object.fromEntries(images)['expression-eyes']);
  const faceMesh=patchMesh(facePainter.box);
  const accentsCanvas=document.createElement('canvas');accentsCanvas.width=accentsCanvas.height=640;
  const accentsContext=accentsCanvas.getContext('2d');
  function dynamicTexture(name,source){
    if(!textures[name]){textures[name]=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,textures[name]);
      for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
      for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);
    }else gl.bindTexture(gl.TEXTURE_2D,textures[name]);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
  }
  function paintAccents(p){
    const c=accentsContext;c.clearRect(0,0,640,640);
    if(p.question>0){c.save();c.globalAlpha=p.question;c.translate(476,138+(1-p.question)*8);c.rotate(-.12);
      c.font='500 46px Georgia';c.textAlign='center';c.fillStyle='#977188';c.fillText('?',0,0);c.restore();}
    if(p.sparkles>0)for(const [x,y,r,a] of [[168,189,10,.2],[477,260,7,-.18]]){
      c.save();c.globalAlpha=p.sparkles*.9;c.translate(x,y+(1-p.sparkles)*5);c.rotate(a);c.scale(.65+p.sparkles*.35,.65+p.sparkles*.35);
      c.fillStyle='#bd9c68';c.beginPath();c.moveTo(0,-r);c.quadraticCurveTo(r*.17,-r*.17,r,0);c.quadraticCurveTo(r*.17,r*.17,0,r);c.quadraticCurveTo(-r*.17,r*.17,-r,0);c.quadraticCurveTo(-r*.17,-r*.17,0,-r);c.fill();c.restore();
    }
    dynamicTexture('accents',accentsCanvas);
  }
  const envelopeMesh = mesh(vertices,indices,true);
  const paperSteps=24,paperVertices=new Float32Array((paperSteps+1)**2*6),paperIndices=[];
  for(let y=0;y<paperSteps;y++)for(let x=0;x<paperSteps;x++){const a=y*(paperSteps+1)+x,b=a+paperSteps+1;paperIndices.push(a,b,a+1,a+1,b,b+1);}
  const paperMesh=mesh(paperVertices,paperIndices,true);
  function paintPaper(point,part,texture='letter-detail'){
    let offset=0;
    for(let y=0;y<=paperSteps;y++)for(let x=0;x<=paperSteps;x++){
      const u=x/paperSteps,v=y/paperSteps,p=point(u,v);
      paperVertices[offset++]=p[0];paperVertices[offset++]=p[1];
      paperVertices[offset++]=texture==='letter-detail'?.0625+u*.8555:u;
      paperVertices[offset++]=texture==='letter-detail'?.2375+v*.5422:v;
      paperVertices[offset++]=u;paperVertices[offset++]=v;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,paperMesh.v);gl.bufferSubData(gl.ARRAY_BUFFER,0,paperVertices);
    gl.uniform1f(uniforms.paper,part);draw(paperMesh,texture,4);gl.uniform1f(uniforms.paper,0);
  }
  function paintLetterScene(scene){
    const point=scene.point,angle=scene.opening*Math.PI*.94;
    const fold=(u,v)=>{const depth=1/(1+Math.sin(angle)*v*.18);return point(.5+(u-.5)*depth,v*Math.cos(angle)*depth);};
    if(scene.opening>.5)paintPaper(fold,3);
    paintPaper(point,4);
    if(scene.opening>0){
      const extraction=scene.extraction,flip=scene.flip||0;
      const card=(u,v)=>{
        const initial=point(.3075+.385*u,.07+.84*v),y=.265+.315*v;
        const py=initial[1]+(y-initial[1])*extraction;
        const middle=point(.5,.49)[0]+(.5-point(.5,.49)[0])*extraction;
        const face=flip>.5?1-u:u;
        const xf=initial[0]+(.29+.42*face-initial[0])*extraction;
        return [middle+(xf-middle)*Math.cos(Math.PI*flip),py];
      };
      paintPaper(card,0,flip>.5?'daily-card-front':'daily-card-back');
    }
    paintPaper(point,1);
    if(scene.opening<=.5)paintPaper(fold,2);
    paintPaper(point,5);
  }
  const rings=8,count=bundle.letterGeometry.segments,pawIndices=[];
  for(let j=0;j<count;j++)pawIndices.push(0,1+j,1+(j+1)%count);
  for(let r=1;r<rings;r++)for(let j=0;j<count;j++){
    const a=1+(r-1)*count+j,b=1+(r-1)*count+(j+1)%count,c=1+r*count+j,d=1+r*count+(j+1)%count;
    pawIndices.push(a,c,b,b,c,d);
  }
  const paws=[mesh(new Float32Array((1+rings*count)*8),pawIndices,true,8),mesh(new Float32Array((1+rings*count)*8),pawIndices,true,8)];
  function updatePaw(target,p) {
    const data=[];
    const uvC=p.uvC||p.uvA;
    const push=(position,a,b,c)=>data.push(position[0]/640,position[1]/640,a[0]/640,a[1]/640,b[0]/640,b[1]/640,c[0]/640,c[1]/640);
    push(p.center,p.uvA.center,p.uvB.center,uvC.center);
    for(let r=1;r<=rings;r++)for(let j=0;j<count;j++){
      const f=r/rings;
      push(p.points[j].map((v,c)=>p.center[c]+(v-p.center[c])*f),p.uvA.points[j].map((v,c)=>p.uvA.center[c]+(v-p.uvA.center[c])*f),p.uvB.points[j].map((v,c)=>p.uvB.center[c]+(v-p.uvB.center[c])*f),uvC.points[j].map((v,c)=>uvC.center[c]+(v-uvC.center[c])*f));
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,target.v);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(data));
  }
  let target={x:.49,y:.89,scale:1.18,angle:-.169};
  let actorFrame={x:0,y:0,width:1,height:1};
  const project=(q,p,time,look)=>projectBodyPoint(q,p,time,look,actorFrame);
  function updateEnvelope(p,pose,time,look,gesture,gestureTime) {
    const data=new Float32Array(vertices);
    const anchor=sampleGesture('deliver-letter',HANDOFF_TIME),base=sampleGesture(gesture,gestureTime);
    for(const key of ['x','y','roll'])anchor[key]+=pose[key]-base[key];
    for(let i=0;i<data.length;i+=6){
      const x=vertices[i]*640-292,y=vertices[i+1]*640-411;
      const point=projectEnvelopePoint([vertices[i]*640,vertices[i+1]*640],p);
      if(p.received){
        const held=project(point,anchor,time,look);
        const end=[target.x+(x*Math.cos(target.angle)-y*Math.sin(target.angle))*target.scale/640,target.y+(x*Math.sin(target.angle)+y*Math.cos(target.angle))*target.scale/640];
        data[i]=held[0]+(end[0]-held[0])*p.release;data[i+1]=held[1]+(end[1]-held[1])*p.release;
      }else{data[i]=point[0]/640;data[i+1]=point[1]/640;}
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,envelopeMesh.v);gl.bufferSubData(gl.ARRAY_BUFFER,0,data);
  }
  function draw(target, texture, part = 0, opacity = 1, textureB=texture, mix=0, textureC=texture, base=0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, target.v);
    attributes.forEach((attribute, i) => gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, target.components*4, Math.min(i,target.components/2-1)*8));
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, target.i);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D, textures[texture]);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,textures[textureB]);
    gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,textures[textureC]);
    gl.uniform1f(uniforms.part, part);gl.uniform1f(uniforms.opacity, opacity);gl.uniform1f(uniforms.mix,mix);
    gl.uniform1f(uniforms.base,base);
    gl.drawElements(gl.TRIANGLES, target.count, gl.UNSIGNED_SHORT, 0);
  }
  gl.viewport(0, 0, canvas.width, canvas.height);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return {
    setLetterTarget(value){target={...target,...value};},
    render(pose, time, look, letter = 'held', gesture='wink-left', gestureTime=0, presentation={}) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      actorFrame=presentation.actorFrame||{x:0,y:0,width:1,height:1};
      gl.uniform4f(uniforms.frame,actorFrame.x,actorFrame.y,actorFrame.width,actorFrame.height);
      gl.uniform1f(uniforms.paper,0);
      gl.uniform1f(uniforms.time, time);gl.uniform1f(uniforms.engage, pose.engage);
      gl.uniform1f(uniforms.head, pose.head);
      gl.uniform1f(uniforms.lean, pose.lean || 0);
      gl.uniform1f(uniforms.breath, pose.breath || 0);
      gl.uniform1f(uniforms.turn, pose.turn || 0);
      gl.uniform1f(uniforms.crouch, pose.crouch || 0);
      gl.uniform1f(uniforms.scarf, pose.scarfLag || 0);
      gl.uniform3f(uniforms.headRotation,pose.headYaw||0,pose.headPitch||0,pose.headRoll||0);
      gl.uniform2f(uniforms.look, look.x, look.y);gl.uniform2f(uniforms.shape, pose.scale, pose.squash);
      gl.uniform3f(uniforms.pose, pose.x, pose.y, pose.roll);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      {
        draw(body,'expression-body');
        dynamicTexture('face',facePainter.paint(pose,look));draw(faceMesh,'face',2);
        const envelope=sampleEnvelope(gesture,gestureTime,letter,bundle.letterGeometry);
        if(!presentation.letterScene&&presentation.showEnvelope!==false){
          updateEnvelope(envelope,pose,time,look,gesture,gestureTime);
          if(envelope.opacity>0)draw(envelopeMesh,'envelope',envelope.received?4:1,envelope.opacity);
        }
        const foreground=presentation.letterScene?.approach>.014;
        if(presentation.letterScene&&!foreground)paintLetterScene(presentation.letterScene);
        samplePaws(bundle.letterGeometry,gesture,gestureTime,letter,bundle.expressionGeometry,pose,bundle.geometry).forEach((p,i)=>{
          updatePaw(paws[i],p);draw(paws[i],p.textureA,1,1,p.textureB,p.mix,p.textureC||p.textureA,p.baseMix||0);
        });
        if(presentation.letterScene&&foreground)paintLetterScene(presentation.letterScene);
        if(pose.question>0||pose.sparkles>0){paintAccents(pose);draw(body,'accents',3);}
      }
    },
    destroy() { meshes.forEach(m => { gl.deleteBuffer(m.v);gl.deleteBuffer(m.i); });Object.values(textures).forEach(t => gl.deleteTexture(t));shaders.forEach(s => gl.deleteShader(s));gl.deleteProgram(program); }
  };
}

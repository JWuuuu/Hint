import { samplePaws, sampleEnvelope } from './motion.js';
import { createFacePainter } from './face.js';

export async function createRenderer(canvas, bundle) {
  const images = await Promise.all(Object.entries(bundle.images).map(async ([name, src]) => {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error(`Could not load ${name}`)); image.src = src; });
    return [name, image];
  }));
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error('Graphics support is unavailable.');
  const vertex = `precision highp float;
    attribute vec2 a_position,a_uv,a_uvB;
    varying vec2 v_uv,v_uvB;
    uniform float u_time,u_part,u_engage,u_head,u_lean;
    uniform vec2 u_look,u_shape;
    uniform vec3 u_pose;
    vec2 rotate(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
    float area(vec2 p,vec2 c,vec2 r){vec2 q=(p-c)/r;return exp(-dot(q,q)*2.);}
    void main(){v_uv=a_uv;v_uvB=a_uvB;vec2 p=a_position;
      if(u_part<2.5){
        float upper=1.-smoothstep(.47,.65,p.y);
        p=vec2(.49,.575)+rotate(p-vec2(.49,.575),u_lean*upper);
        p.x+=u_lean*.12*upper;
        float head=1.-smoothstep(.48,.575,p.y);p.x+=head*u_look.x*.004;p.y+=head*(u_look.y*.002+u_head*.012);
        p.y+=(.46-p.y)*head*max(u_head,0.)*.018;
      }
      if(u_part<.5){
        float tip=area(p,vec2(.63,.16),vec2(.19,.20));p.x+=tip*sin(u_time*1.3-.7)*.003*(1.-u_engage*.75);
        float scarf=area(p,vec2(.735,.617),vec2(.083,.065));p.y+=scarf*sin(u_time*1.8-1.2)*.002;
      }
      float belly=area(p,vec2(.48,.69),vec2(.27,.30));p.x+=(p.x-.49)*belly*sin(u_time*1.25)*.007;p.y+=belly*sin(u_time*1.25)*.0015;
      p=vec2(.5,.68)+(p-vec2(.5,.68))*vec2(1.+u_shape.x+u_shape.y,1.+u_shape.x-u_shape.y);
      p=vec2(.5,.68)+rotate(p-vec2(.5,.68),u_pose.z)+u_pose.xy;
      p=vec2(.5,.5)+(p-vec2(.5,.5))*.94;
      gl_Position=vec4(p.x*2.-1.,1.-p.y*2.,0.,1.);
    }`;
  const fragment = `precision mediump float;varying vec2 v_uv,v_uvB;uniform sampler2D u_image,u_imageB;uniform float u_opacity,u_mix;void main(){vec4 a=texture2D(u_image,v_uv),b=texture2D(u_imageB,v_uvB);gl_FragColor=mix(vec4(a.rgb*a.a,a.a),vec4(b.rgb*b.a,b.a),u_mix)*u_opacity;}`;
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
  const attributes = ['position', 'uv', 'uvB'].map(name => gl.getAttribLocation(program, 'a_' + name));
  attributes.forEach(value => gl.enableVertexAttribArray(value));
  const uniforms = Object.fromEntries(['time', 'part', 'engage', 'head', 'lean', 'look', 'shape', 'pose', 'opacity', 'mix'].map(name => [name, gl.getUniformLocation(program, 'u_' + name)]));
  gl.uniform1i(gl.getUniformLocation(program,'u_image'),0);gl.uniform1i(gl.getUniformLocation(program,'u_imageB'),1);
  const textures = Object.fromEntries(images.map(([name, img]) => {
    const texture = gl.createTexture();gl.bindTexture(gl.TEXTURE_2D, texture);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    return [name, texture];
  }));
  const meshes = [];
  function mesh(vertices, indices, dynamic = false) {
    const v = gl.createBuffer(), i = gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER, v);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, i);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    const result = { v, i, count: indices.length };meshes.push(result);return result;
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
  const rings=8,count=bundle.letterGeometry.segments,pawIndices=[];
  for(let j=0;j<count;j++)pawIndices.push(0,1+j,1+(j+1)%count);
  for(let r=1;r<rings;r++)for(let j=0;j<count;j++){
    const a=1+(r-1)*count+j,b=1+(r-1)*count+(j+1)%count,c=1+r*count+j,d=1+r*count+(j+1)%count;
    pawIndices.push(a,c,b,b,c,d);
  }
  const paws=[mesh(new Float32Array((1+rings*count)*6),pawIndices,true),mesh(new Float32Array((1+rings*count)*6),pawIndices,true)];
  function updatePaw(target,p) {
    const data=[];
    const push=(position,a,b)=>data.push(position[0]/640,position[1]/640,a[0]/640,a[1]/640,b[0]/640,b[1]/640);
    push(p.center,p.uvA.center,p.uvB.center);
    for(let r=1;r<=rings;r++)for(let j=0;j<count;j++){
      const f=r/rings;
      push(p.points[j].map((v,c)=>p.center[c]+(v-p.center[c])*f),p.uvA.points[j].map((v,c)=>p.uvA.center[c]+(v-p.uvA.center[c])*f),p.uvB.points[j].map((v,c)=>p.uvB.center[c]+(v-p.uvB.center[c])*f));
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,target.v);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(data));
  }
  function updateEnvelope(p) {
    const data=new Float32Array(vertices),c=Math.cos(p.angle),s=Math.sin(p.angle);
    for(let i=0;i<data.length;i+=6){
      const x=vertices[i]*640-292,y=vertices[i+1]*640-411;
      data[i]=(292+p.x+(x*c-y*s)*p.scale)/640;data[i+1]=(411+p.y+(x*s+y*c)*p.scale)/640;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,envelopeMesh.v);gl.bufferSubData(gl.ARRAY_BUFFER,0,data);
  }
  function draw(target, texture, part = 0, opacity = 1, textureB=texture, mix=0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, target.v);
    attributes.forEach((attribute, i) => gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 24, i*8));
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, target.i);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D, textures[texture]);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,textures[textureB]);
    gl.uniform1f(uniforms.part, part);gl.uniform1f(uniforms.opacity, opacity);gl.uniform1f(uniforms.mix,mix);
    gl.drawElements(gl.TRIANGLES, target.count, gl.UNSIGNED_SHORT, 0);
  }
  gl.viewport(0, 0, canvas.width, canvas.height);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return {
    render(pose, time, look, letter = 'held', gesture='wink-left', gestureTime=0) {
      gl.uniform1f(uniforms.time, time);gl.uniform1f(uniforms.engage, pose.engage);
      gl.uniform1f(uniforms.head, pose.head);
      gl.uniform1f(uniforms.lean, pose.lean || 0);
      gl.uniform2f(uniforms.look, look.x, look.y);gl.uniform2f(uniforms.shape, pose.scale, pose.squash);
      gl.uniform3f(uniforms.pose, pose.x, pose.y, pose.roll);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      {
        draw(body,'expression-body');
        dynamicTexture('face',facePainter.paint(pose,look));draw(faceMesh,'face',2);
        const envelope=sampleEnvelope(gesture,gestureTime,letter);
        updateEnvelope(envelope);
        if(envelope.front<1&&envelope.opacity>0)draw(envelopeMesh,'envelope',1,envelope.opacity);
        samplePaws(bundle.letterGeometry,gesture,gestureTime,letter,bundle.expressionGeometry,pose).forEach((p,i)=>{
          updatePaw(paws[i],p);draw(paws[i],p.textureA,1,1,p.textureB,p.mix);
        });
        if(envelope.front>0&&envelope.opacity>0)draw(envelopeMesh,'envelope',1,envelope.opacity*envelope.front);
        if(pose.question>0||pose.sparkles>0){paintAccents(pose);draw(body,'accents',3);}
      }
    },
    destroy() { meshes.forEach(m => { gl.deleteBuffer(m.v);gl.deleteBuffer(m.i); });Object.values(textures).forEach(t => gl.deleteTexture(t));shaders.forEach(s => gl.deleteShader(s));gl.deleteProgram(program); }
  };
}

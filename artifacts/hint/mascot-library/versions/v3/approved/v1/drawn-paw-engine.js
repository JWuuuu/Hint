(() => {
  const root=document.getElementById('hint-drawn-paw');
  const canvas=root.querySelector('canvas'),pause=root.querySelector('[data-pause]'),trigger=root.querySelector('[data-wave]'),timeline=root.querySelector('input'),output=root.querySelector('output');
  const geometry=__GEOMETRY__,assets=__ASSETS__;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),saved=window.openai?.widgetState?.privateContent;
  const duration=4.5,config={speed:1,float:1};
  const state={clock:0,gesture:0,active:!reduced.matches,paused:reduced.matches||Boolean(saved?.version==='drawn-paw'&&saved.paused),lookX:0,lookY:0,targetX:0,targetY:0};
  const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10);};
  const keys=[
    [0,0,0,0,0], [.24,0,.004,.004,.018], [.75,1,-.005,-.005,-.008],
    [1.13,2,-.010,-.012,-.027], [1.43,3,-.014,-.018,-.039],
    [1.72,4,-.016,-.020,-.045], [2.10,5,-.006,-.021,-.019],
    [2.47,4,-.012,-.018,-.034], [2.80,3,-.004,-.014,-.010],
    [3.16,2,.008,-.005,.018], [3.65,1,.010,.004,.029],
    [4.07,0,-.002,-.002,-.009], [4.5,0,0,0,0]
  ];
  const channels=keys.map(k=>{
    const p=geometry.poses[k[1]];
    return [p.angle,p.radius,...p.local.flat(),...k.slice(2)];
  });
  const slopes=channels.map((row,i)=>row.map((v,c)=>{
    if(i===0||i===keys.length-1)return 0;
    const h0=keys[i][0]-keys[i-1][0],h1=keys[i+1][0]-keys[i][0],a=(v-channels[i-1][c])/h0,b=(channels[i+1][c]-v)/h1;
    if(a*b<=0)return 0;const w1=2*h1+h0,w2=h1+2*h0;return (w1+w2)/(w1/a+w2/b);
  }));
  function sample(t){
    let i=0;while(i<keys.length-2&&keys[i+1][0]<t)i++;
    const span=keys[i+1][0]-keys[i][0],u=clamp((t-keys[i][0])/span),u2=u*u,u3=u2*u;
    const values=channels[i].map((v,c)=>(2*u3-3*u2+1)*v+(u3-2*u2+u)*span*slopes[i][c]+(-2*u3+3*u2)*channels[i+1][c]+(u3-u2)*span*slopes[i+1][c]);
    return {i,u,values,a:geometry.poses[keys[i][1]],b:geometry.poses[keys[i+1][1]]};
  }
  let gl,program,textures,uniforms,attributes,bodyMesh,pawMesh,raf=0,previous=0,visible=true;
  const vertex=`precision highp float;
    attribute vec2 a_position,a_uv0,a_uv1;
    varying vec2 v_uv0,v_uv1;
    uniform float u_time,u_blink,u_paw,u_engage;
    uniform vec2 u_look;
    uniform vec3 u_pose;
    vec2 rotate(vec2 p,float a){float c=cos(a),s=sin(a);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
    float area(vec2 p,vec2 c,vec2 r){vec2 q=(p-c)/r;return exp(-dot(q,q)*2.);}
    vec2 eye(vec2 p,vec2 c){vec2 q=(p-c)/vec2(.040,.059);float w=1.-smoothstep(.48,1.,length(q));p.y+=(c.y-p.y)*u_blink*.9*w;p.y-=u_blink*.0018*(1.-smoothstep(0.,.48,abs(q.x)))*w;p+=u_look*vec2(.003,.002)*w*(1.-u_blink);return p;}
    void main(){v_uv0=a_uv0;v_uv1=a_uv1;vec2 p=a_position;
      if(u_paw<.5){
        p=eye(p,vec2(.39163,.42768));p=eye(p,vec2(.56286,.45608));
        float head=1.-smoothstep(.48,.57,p.y);p.x+=head*u_look.x*.004;p.y+=head*u_look.y*.002;
        float tip=area(p,vec2(.63,.16),vec2(.19,.20));p.x+=tip*sin(u_time*1.3-.7)*.003*(1.-u_engage*.75);
        float scarf=area(p,vec2(.735,.617),vec2(.083,.065));p.y+=scarf*sin(u_time*1.8-1.2)*.002;
      }
      float belly=area(p,vec2(.48,.69),vec2(.27,.30));p.x+=(p.x-.49)*belly*sin(u_time*1.25)*.007;p.y+=belly*sin(u_time*1.25)*.0015;
      p=vec2(.5,.68)+rotate(p-vec2(.5,.68),u_pose.z)+u_pose.xy;
      p=vec2(.5,.5)+(p-vec2(.5,.5))*.94;
      gl_Position=vec4(p.x*2.-1.,1.-p.y*2.,0.,1.);
    }`;
  const fragment=`precision mediump float;varying vec2 v_uv0,v_uv1;uniform sampler2D u_image0,u_image1;uniform float u_mix;void main(){vec4 a=texture2D(u_image0,v_uv0),b=texture2D(u_image1,v_uv1);gl_FragColor=mix(vec4(a.rgb*a.a,a.a),vec4(b.rgb*b.a,b.a),u_mix);}`;
  function blink(t){const p=(t+2.7)%4.9;return p>.29?0:p<.085?ease(p/.085):p<.125?1:1-ease((p-.125)/.165);}
  function makeMesh(vertices,indices,dynamic=false){const v=gl.createBuffer(),i=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,v);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),dynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,i);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);return {v,i,count:indices.length};}
  function makeBody(){const v=[],indices=[],n=140;for(let y=0;y<=n;y++)for(let x=0;x<=n;x++)v.push(x/n,y/n,x/n,y/n,x/n,y/n);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const a=y*(n+1)+x,b=a+n+1;indices.push(a,b,a+1,a+1,b,b+1);}return makeMesh(v,indices);}
  const rings=8,count=geometry.segments;
  function makePaw(){const indices=[];for(let j=0;j<count;j++)indices.push(0,1+j,1+(j+1)%count);for(let r=1;r<rings;r++)for(let j=0;j<count;j++){const a=1+(r-1)*count+j,b=1+(r-1)*count+(j+1)%count,c=1+r*count+j,d=1+r*count+(j+1)%count;indices.push(a,c,b,b,c,d);}return makeMesh(new Float32Array((1+rings*count)*6),indices,true);}
  function posePaw(p){
    const [angle,radius]=p.values,c=Math.cos(angle),s=Math.sin(angle),center=[geometry.root[0]+c*radius,geometry.root[1]+s*radius],out=[];
    const push=(x,y,a,b)=>out.push(x/640,y/640,a[0]/640,a[1]/640,b[0]/640,b[1]/640);
    push(...center,p.a.center,p.b.center);
    for(let r=1;r<=rings;r++)for(let j=0;j<count;j++){
      const f=r/rings,qx=p.values[2+j*2]*f,qy=p.values[3+j*2]*f;
      const uv0=p.a.points[j].map((v,k)=>p.a.center[k]+(v-p.a.center[k])*f),uv1=p.b.points[j].map((v,k)=>p.b.center[k]+(v-p.b.center[k])*f);
      push(center[0]+c*qx-s*qy,center[1]+s*qx+c*qy,uv0,uv1);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,pawMesh.v);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(out));
    return center;
  }
  function draw(mesh,a,b,mix,paw){
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh.v);for(let i=0;i<3;i++)gl.vertexAttribPointer(attributes[i],2,gl.FLOAT,false,24,i*8);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.i);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures[a]);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,textures[b]);gl.uniform1f(uniforms.mix,mix);gl.uniform1f(uniforms.paw,paw);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);
  }
  function render(){
    if(!uniforms)return;
    const t=state.clock,g=state.gesture,p=sample(g),v=p.values,engage=ease(g/.7)*(1-ease((g-3.8)/.7)),idle=(1-engage*.75)*config.float;
    const x=v.at(-3)+state.lookX*.003*(1-engage),y=v.at(-2)+.010*Math.sin(t*1.3)*idle,a=v.at(-1)+.009*Math.sin(t*.9)*idle;
    gl.uniform1f(uniforms.time,t);gl.uniform1f(uniforms.blink,reduced.matches?0:blink(t));gl.uniform1f(uniforms.engage,engage);gl.uniform2f(uniforms.look,state.lookX*(1-engage*.9),state.lookY*(1-engage*.9));gl.uniform3f(uniforms.pose,x,y,a);
    const center=posePaw(p);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);draw(bodyMesh,0,0,0,0);draw(pawMesh,keys[p.i][1]+1,keys[p.i+1][1]+1,p.u,1);
    pause.textContent=state.paused?'Play':'Pause';timeline.value=Math.round(g*1000);output.textContent=g===0||g>=duration?'Rest':g<1.43?'Lift':g<2.8?'Wave':'Return';
    trigger.disabled=state.active&&!state.paused;trigger.textContent=trigger.disabled?'Waving…':g>0&&g<duration?'Continue wave':g>=duration?'Wave again':'Wave to Hint';
    canvas.dataset.time=t.toFixed(3);canvas.dataset.gesture=g.toFixed(3);canvas.dataset.paw=center.map(n=>n.toFixed(3)).join(',');canvas.dataset.pose=v.map(n=>n.toFixed(3)).join(',');
    root.querySelector('.hint-shadow').style.transform=`translateX(${x*150}px) scaleX(${1+y*5})`;
  }
  function build(images){
    gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true});if(!gl)throw Error('Graphics support unavailable');
    const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
    program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
    attributes=['position','uv0','uv1'].map(n=>gl.getAttribLocation(program,'a_'+n));for(const a of attributes)gl.enableVertexAttribArray(a);
    uniforms=Object.fromEntries(['time','blink','paw','engage','look','pose','mix'].map(n=>[n,gl.getUniformLocation(program,'u_'+n)]));gl.uniform1i(gl.getUniformLocation(program,'u_image0'),0);gl.uniform1i(gl.getUniformLocation(program,'u_image1'),1);
    textures=images.map(img=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);return t;});
    bodyMesh=makeBody();pawMesh=makePaw();gl.viewport(0,0,768,768);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);canvas.dataset.ready='true';render();start();
  }
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;previous=0;}
  function start(){if(gl&&!state.paused&&visible&&!document.hidden&&!raf)raf=requestAnimationFrame(tick);}
  function tick(now){raf=0;if(state.paused||!visible||document.hidden||!root.isConnected){previous=0;return;}const dt=previous?Math.min((now-previous)/1000,.04):0;previous=now;if(!reduced.matches)state.clock+=dt;if(state.active){state.gesture=Math.min(duration,state.gesture+dt*config.speed);if(state.gesture>=duration){state.active=false;if(reduced.matches)state.paused=true;}}const k=1-Math.exp(-dt*7);state.lookX+=(state.targetX-state.lookX)*k;state.lookY+=(state.targetY-state.lookY)*k;render();start();}
  function persist(){window.openai?.setWidgetState?.({modelContent:{mascot:'Hint',gesture:'rounded paw wave',position:output.textContent},privateContent:{version:'drawn-paw',paused:state.paused}})?.catch(()=>{});}
  function wave(){if(state.active&&!state.paused)return;if(state.gesture>=duration)state.gesture=0;state.active=true;state.paused=false;stop();render();start();persist();}
  trigger.addEventListener('click',wave);root.querySelector('.hint-character').addEventListener('click',wave);pause.addEventListener('click',()=>{state.paused=!state.paused;if(!state.paused&&state.gesture>0&&state.gesture<duration)state.active=true;stop();render();start();persist();});
  timeline.addEventListener('input',()=>{state.gesture=Number(timeline.value)/1000;state.active=false;state.paused=true;stop();render();});timeline.addEventListener('change',persist);
  root.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const b=canvas.getBoundingClientRect();state.targetX=Math.max(-1,Math.min(1,(e.clientX-b.left-b.width*.5)/(b.width*.6)));state.targetY=Math.max(-1,Math.min(1,(e.clientY-b.top-b.height*.45)/(b.height*.6)));});root.addEventListener('pointerleave',()=>{state.targetX=0;state.targetY=0;});
  document.addEventListener('visibilitychange',()=>{stop();start();});new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;stop();start();}).observe(canvas);reduced.addEventListener('change',()=>{state.paused=reduced.matches;stop();render();start();});
  window.addEventListener('openai:set_globals',e=>{const s=e.detail?.globals?.widgetState?.privateContent;if(!s||s.version!=='drawn-paw')return;state.paused=Boolean(s.paused);stop();render();start();});
  if(globalThis.Tweak){const tweak=new Tweak({container:root.querySelector('.hint-card'),onChange:render});tweak.addSlider(config,'speed',{label:'Wave speed',min:.7,max:1.2,step:.1,unit:'×'});tweak.addSlider(config,'float',{label:'Float amount',min:0,max:1.2,step:.1});}
  Promise.all(assets.map(src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;}))).then(build).catch(e=>{root.querySelector('.hint-status').textContent='The animation could not load.';console.error(e);});
})();

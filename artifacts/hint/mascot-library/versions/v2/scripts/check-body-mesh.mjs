import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gestures, sampleGesture } from '../src/motion.js';

const {chromium}=createRequire(import.meta.url)('@playwright/test');
const root=fileURLToPath(new URL('../',import.meta.url));
const source=await readFile(path.join(root,'src/renderer.js'),'utf8');
const vertex=source.match(/const vertex = `([\s\S]*?)`;/)[1];
const samples=[];
for(const [id,clip] of Object.entries(gestures))for(let i=0;i<=Math.ceil(clip.duration*30);i++){
  const time=Math.min(clip.duration,i/30);samples.push({id,time,pose:sampleGesture(id,time)});
}
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage();
  const results=await page.evaluate(({vertex,samples})=>{
    const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2');
    if(!gl)throw Error('WebGL2 is needed to inspect transformed vertices.');
    const source='#version 300 es\n'+vertex.replace(/attribute /g,'in ').replace(/varying /g,'out ')
      .replace('void main(){','out vec2 tf_position;\nvoid main(){').replace('gl_Position=','tf_position=p;gl_Position=');
    function compile(kind,text){const s=gl.createShader(kind);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
    const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,source));
    gl.attachShader(program,compile(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(0.);}'));
    gl.transformFeedbackVaryings(program,['tf_position'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const n=140,count=(n+1)*(n+1),input=new Float32Array(count*2),output=new Float32Array(count*2);
    for(let y=0;y<=n;y++)for(let x=0;x<=n;x++){const i=(y*(n+1)+x)*2;input[i]=x/n;input[i+1]=y/n;}
    const positions=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,positions);gl.bufferData(gl.ARRAY_BUFFER,input,gl.STATIC_DRAW);
    const attribute=gl.getAttribLocation(program,'a_position');gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
    const feedback=gl.createBuffer();gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,feedback);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,output.byteLength,gl.STREAM_READ);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,feedback);gl.enable(gl.RASTERIZER_DISCARD);
    const u=Object.fromEntries(['time','part','engage','head','lean','look','shape','pose'].map(name=>[name,gl.getUniformLocation(program,'u_'+name)]));
    const report=[];
    for(const part of [0,1,2]){
      let min=Infinity;
      gl.uniform1f(u.part,part);
      for(const {id,time,pose:p} of samples){
        gl.uniform1f(u.time,time);gl.uniform1f(u.engage,p.engage);gl.uniform1f(u.head,p.head);
        gl.uniform1f(u.lean,p.lean);
        gl.uniform2f(u.look,p.gazeX,p.gazeY);gl.uniform2f(u.shape,p.scale,p.squash);gl.uniform3f(u.pose,p.x,p.y,p.roll);
        gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,count);gl.endTransformFeedback();
        gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);
        if(gl.getError()!==gl.NO_ERROR)throw Error('Could not read transformed mesh');
        const area=(a,b,c)=>(output[b]-output[a])*(output[c+1]-output[a+1])-(output[b+1]-output[a+1])*(output[c]-output[a]);
        for(let y=0;y<n;y++)for(let x=0;x<n;x++){
          const a=(y*(n+1)+x)*2,b=a+2,c=a+(n+1)*2,d=c+2;
          const first=area(a,b,c),second=area(b,d,c);
          if(!Number.isFinite(first)||!Number.isFinite(second)||first<=0||second<=0)throw Error(id+' '+time+' has an inverted or invalid triangle');
          min=Math.min(min,first,second);
        }
      }
      report.push({part:['body','paws','face'][part],frames:samples.length,verticesPerFrame:count,trianglesPerFrame:n*n*2,minimumSignedDoubleArea:min,valid:true});
    }
    return report;
  },{vertex,samples});
  assert.ok(results.every(r=>r.valid));
  await writeFile(path.join(root,'evidence/body-mesh-audit.json'),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results));
}finally{await browser.close();}

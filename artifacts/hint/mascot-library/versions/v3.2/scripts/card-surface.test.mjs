import test from 'node:test';
import assert from 'node:assert/strict';
import {cardSurface} from '../src/renderer.js';

test('the flying back uses the same cover crop and border box as the DOM card',()=>{
  for(const [width,height] of [[142,228],[202.194,325.04]]){
    const material=cardSurface(width,height,1024/1536);
    assert.equal(material.radius,20);assert.equal(material.border,1.5);
    const innerWidth=width-3,innerHeight=height-3;
    const imageScale=Math.max(innerWidth/1024,innerHeight/1536);
    assert.ok(Math.abs(material.crop[0]-innerWidth/(1024*imageScale))<1e-10);
    assert.ok(Math.abs(material.crop[1]-innerHeight/(1536*imageScale))<1e-10);
    assert.ok(material.crop[0]<1,'portrait image is cropped horizontally instead of stretched');
  }
});

test('cover mapping handles a taller receiving surface without distorting the image',()=>{
  const material=cardSurface(240,240,2/3);
  assert.equal(material.crop[0],1);
  assert.ok(Math.abs(material.crop[1]-2/3)<1e-10);
});

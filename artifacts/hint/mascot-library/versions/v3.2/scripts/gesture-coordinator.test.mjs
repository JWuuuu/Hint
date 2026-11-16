import test from 'node:test';
import assert from 'node:assert/strict';
import {createGestureCoordinator} from '../src/gesture-coordinator.js';

test('one owner: priorities are reassure > presentation > acknowledgement > arrival',()=>{
  for(const [id,active,expected] of [
    ['reassure','present-card',true],['present-card','reassure',false],
    ['present-card','acknowledge',true],['celebration','present-card',false],
    ['nod','welcome-back',true],['welcome-back','nod',false],['reassure','reassure',false],
  ])assert.equal(createGestureCoordinator(()=>0).accept(id,{active}),expected,`${id} against ${active}`);
});
test('failure cooldown is 8s; acknowledgement aliases share 6s; arrivals have 20s',()=>{
  for(const [id,duplicate,wait] of [['reassure','reassure',8000],['acknowledge','celebration',6000],['nod','acknowledge',6000],['welcome-back','welcome',20000]]){
    let now=0;const c=createGestureCoordinator(()=>now);
    assert.equal(c.accept(id),true);now=wait-1;assert.equal(c.accept(duplicate),false);
    now=wait;assert.equal(c.accept(duplicate),true);
  }
});
test('success/arrival requests older than 400ms drop without consuming the next fresh event',()=>{
  for(const id of ['acknowledge','nod','celebration','present-card','welcome-back']){
    const c=createGestureCoordinator(()=>401);
    assert.equal(c.accept(id,{requestedAt:0}),false);
    assert.equal(c.accept(id,{requestedAt:1}),true);
  }
});

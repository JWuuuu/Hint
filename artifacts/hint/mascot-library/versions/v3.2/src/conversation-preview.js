import {createHintScenePlayer} from './scene-player.js';

export async function createConversationPreview(root,assets){
  const find=selector=>root.querySelector(selector),stage=find('[data-stage]'),canvas=find('[data-canvas]'),actor=find('[data-actor]');
  const phaseOptions={ask:[['idle','New conversation'],['thinking','Thinking'],['reading','Reading'],['waiting','Waiting']],voice:[['starting','Connecting'],['listening','Listening'],['thinking','Thinking'],['preparing','Preparing speech'],['speaking','Speech playing'],['paused','Paused'],['error','Connection interrupted']]};
  const voiceCopy={starting:['One moment.','Getting ready to listen.'],listening:['I’m listening.','Take your time. I’m here.'],thinking:['Let me think.','I’m staying with your question.'],preparing:['Just a moment.','Your reply is almost ready.'],speaking:['Let’s look at this together.','You can interrupt whenever you need.'],paused:['A quiet pause.','Continue whenever you’re ready.'],error:['Let’s try that again.','Your words can wait. There’s no rush.']};
  let player=null,room='ask',phase='idle',messages=0,queue=[],generation=0,lastUI='',disposed=false;
  find('[data-fallback]').src=assets.images['empty-rest'];
  const listeners=[],on=(node,event,fn)=>{node.addEventListener(event,fn);listeners.push(()=>node.removeEventListener(event,fn));};
  function appendMessage(text,role){const node=document.createElement('div');node.className='message '+role;node.textContent=text;find('[data-feed]').append(node);messages++;}
  function syncUI(frame){
    const context=frame.state.context,isVoice=context.room==='voice',away=context.room==='away',thread=messages>0||context.hasMessages;
    find('[data-room-title]').textContent=isVoice?'Hint':'Ask Hint';
    find('[data-intro]').hidden=isVoice||away||thread||context.keyboardOpen;
    find('[data-caption]').hidden=isVoice||away||!thread&&!context.keyboardOpen;
    find('[data-caption-detail]').textContent=context.phase==='thinking'?'Thinking with you…':context.phase==='reading'?'A little perspective.':'Here with you.';
    find('[data-feed]').hidden=isVoice||away||!thread;
    find('[data-composer]').hidden=isVoice||away;find('[data-composer-note]').hidden=isVoice||away;
    find('[data-composer] button').disabled=context.phase==='thinking';
    find('[data-voice-copy]').hidden=!isVoice;find('[data-voice-controls]').hidden=!isVoice;
    find('[data-away]').hidden=!away;
    const copy=voiceCopy[context.phase]||voiceCopy.starting;
    find('[data-voice-title]').textContent=copy[0];find('[data-voice-detail]').textContent=copy[1];
    const paused=context.phase==='paused'||context.phase==='error';
    find('[data-voice-pause]').textContent=paused?'▷':'Ⅱ';find('[data-voice-pause]').setAttribute('aria-label',paused?'Resume conversation':'Pause conversation');
    find('[data-interrupt]').hidden=!isVoice||context.phase!=='speaking';
    find('[data-pause]').textContent=frame.state.paused&&context.phase!=='paused'?'Resume motion':'Pause motion';
    for(const button of root.querySelectorAll('[data-room]'))button.setAttribute('aria-pressed',String(button.dataset.room===room&&!away));
  }
  function paint(frame){
    const rect=stage.getBoundingClientRect(),a=frame.actor;
    actor.style.width=a.width*rect.width+'px';actor.style.height=a.height*rect.height+'px';actor.style.transform=`translate3d(${a.x*rect.width}px,${a.y*rect.height}px,0)`;
    actor.hidden=frame.state.placement==='away'&&!frame.state.transitioning;
    find('[data-fallback]').hidden=!frame.fallback;
    find('[data-shadow]').style.left=frame.shadow.x*100+'%';find('[data-shadow]').style.top=frame.shadow.y*100+'%';find('[data-shadow]').style.width=frame.shadow.width*100+'%';find('[data-shadow]').style.opacity=String(frame.shadow.opacity);
    const key=JSON.stringify(frame.state.context)+frame.state.paused;
    if(key!==lastUI){lastUI=key;syncUI(frame);}
    find('[data-state]').textContent=`${frame.state.activity} · ${frame.state.phase} · ${frame.state.clock.toFixed(2)} s`;
    if(player&&queue.length&&frame.state.clock>=queue[0].at){const step=queue.shift();if(step.generation===generation)step.run();}
  }
  function choices(){
    const select=find('[data-phase-select]');select.replaceChildren();
    for(const [value,label] of phaseOptions[room]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}select.value=phase;
  }
  function changePhase(value,{cancel=true}={}){
    if(cancel){generation++;queue=[];}phase=value;find('[data-phase-select]').value=phase;
    player.setContext({room,phase,audioPlaying:room==='voice'&&phase==='speaking',hasMessages:room==='ask'&&(messages>0||phase!=='idle'),keyboardOpen:false,typing:false});
  }
  function changeRoom(value){generation++;queue=[];room=value;phase=room==='ask'?(messages?'waiting':'idle'):'starting';choices();player.setContext({room,phase,audioPlaying:false,hasMessages:messages>0,keyboardOpen:false,typing:false});}
  function schedule(delay,run){queue.push({at:player.getState().clock+delay,generation,run});queue.sort((a,b)=>a.at-b.at);}
  const api={
    setRoom:changeRoom,setPhase:changePhase,
    runVoiceSequence(){changeRoom('voice');for(const [time,value] of [[1.3,'listening'],[5.5,'thinking'],[9,'preparing'],[11,'speaking'],[16,'listening'],[22,'thinking'],[25,'preparing'],[27,'speaking'],[32,'listening']])schedule(time,()=>changePhase(value,{cancel:false}));},
    send(text){
      if(room!=='ask'||phase==='thinking'||!text.trim())return false;
      appendMessage(text.trim(),'user');find('[data-composer] input').value='';changePhase('thinking');
      schedule(2.8,()=>{appendMessage('You don’t have to solve everything at once. What is one small step that would make today feel a little easier?','reply');changePhase('reading',{cancel:false});});return true;
    },
    reset(){generation++;queue=[];messages=0;find('[data-feed]').replaceChildren();find('[data-composer] input').value='';player.resume();changeRoom('ask');},
    getState:()=>({...player.getState(),pending:queue.length,messages}),getFrame:()=>player.getFrame(),
    pause(){player.pause();},resume(){player.resume();},setMotionPolicy:policy=>player.setMotionPolicy(policy),setSpeed:value=>player.setSpeed(value),
    setAccentsVisible:value=>player.setAccentsVisible(value),react:()=>player.react(),
    destroy(){disposed=true;generation++;queue=[];listeners.forEach(remove=>remove());player.destroy();}
  };
  player=await createHintScenePlayer(canvas,{assets,pointerTarget:stage,onFrame:paint});
  if(disposed){player.destroy();return api;}choices();
  for(const button of root.querySelectorAll('[data-room]'))on(button,'click',()=>changeRoom(button.dataset.room));
  on(find('[data-phase-select]'),'change',event=>changePhase(event.target.value));on(actor,'click',()=>player.react());
  on(find('[data-sequence]'),'click',api.runVoiceSequence);on(find('[data-reset]'),'click',api.reset);
  on(find('[data-pause]'),'click',()=>player.getState().paused?player.resume():player.pause());
  on(find('[data-speed]'),'change',event=>player.setSpeed(Number(event.target.value)));
  on(find('[data-labels]'),'change',event=>stage.dataset.labels=event.target.checked?'hidden':'visible');
  on(find('[data-accents]'),'change',event=>player.setAccentsVisible(!event.target.checked));
  on(find('[data-composer]'),'submit',event=>{event.preventDefault();api.send(find('[data-composer] input').value);});
  on(find('[data-composer] input'),'focus',()=>player.setContext({keyboardOpen:true}));
  on(find('[data-composer] input'),'blur',()=>player.setContext({keyboardOpen:false}));
  on(find('[data-composer] input'),'input',event=>player.setContext({typing:Boolean(event.target.value)}));
  on(find('[data-voice-pause]'),'click',()=>changePhase(['paused','error'].includes(phase)?'starting':'paused'));
  on(find('[data-interrupt]'),'click',()=>changePhase('listening'));
  const leave=()=>{generation++;queue=[];player.setContext({room:'away',audioPlaying:false,phase:'idle'});};
  on(find('[data-leave]'),'click',leave);on(find('[data-voice-end]'),'click',leave);on(find('[data-return]'),'click',()=>changeRoom('ask'));
  return api;
}

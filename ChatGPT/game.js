'use strict';

const $ = id => document.getElementById(id);
const canvas = $('arena');
const ctx = canvas.getContext('2d');
const W = 168, H = 100, TARGET = 80;
const dirs = {left:[-1,0], right:[1,0], up:[0,-1], down:[0,1]};
const keyDirs = {ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right',ArrowUp:'up',w:'up',ArrowDown:'down',s:'down'};
const names = ['Outer Drift','Ion Passage','Violet Reach','Night Meridian','Event Horizon'];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = 'ready', level = 1, lives = 3, score = 0, elapsed = 0;
let grid, player, enemy, trails, trailSet, origin, heading, terrain, border, openRegion, patrol, crawlers;
let covered = 0, phase = .7, moveClock = 0, grace = 0, tPrev = 0, frameTime = 0;
let scaleX = 1, scaleY = 1, viewW = 1, viewH = 1, audioOn = true, audio, noteUntil = 0;
let helpResume = false, effects = [], lastGeometry = [], pointerStart = null;
try { audioOn = localStorage.getItem('styx-audio') !== 'off'; } catch {}
const cell = (x,y) => y*W+x;
const pos = i => ({x:i%W,y:Math.floor(i/W)});
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const pad = (v,n) => String(v).padStart(n,'0');
const same = (a,b) => a.x===b.x && a.y===b.y;
function safe(x,y){return x<0||y<0||x>=W||y>=H||grid[cell(x,y)]===1}
function tone(f,end,duration,when=0,volume=.045,type='sine'){
  if(!audioOn || !audio || audio.state!=='running') return;
  const osc=audio.createOscillator(), gain=audio.createGain(), t=audio.currentTime+when;
  osc.type=type;osc.frequency.setValueAtTime(f,t);osc.frequency.exponentialRampToValueAtTime(end,t+duration);
  gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+duration+.01);
}
function unlock(){if(!audioOn)return;try{audio ||= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}

function setSound(toggle=false){
  if(toggle){audioOn=!audioOn;try{localStorage.setItem('styx-audio',audioOn?'on':'off')}catch{}if(audioOn){unlock();tone(500,700,.1)}}
  $('sound').querySelector('use').setAttribute('href',audioOn?'#volume':'#mute');
  const label=audioOn?'Sound on':'Sound off';$('sound').querySelector('span').textContent=label;
  $('sound').setAttribute('aria-label',label);$('sound').setAttribute('aria-pressed',String(audioOn));
}
function rebuildTerrain(){
  terrain=new Path2D();border=new Path2D();openRegion=new Path2D();const edges=new Map();
  let n=0;
  const edge=(x,y,ex,ey)=>{const a=y*(W+1)+x,b=ey*(W+1)+ex;const list=edges.get(a)||[];list.push(b);edges.set(a,list);border.moveTo(x,y);border.lineTo(ex,ey)};
  for(let y=0;y<H;y++){
    let start=0;
    for(let x=0;x<=W;x++){
      if(x===W||grid[cell(x,y)]!==grid[cell(start,y)]){(grid[cell(start,y)]?terrain:openRegion).rect(start,y,x-start,1);start=x}
      if(x===W)continue;
      if(safe(x,y)){if(x>0&&y>0&&x<W-1&&y<H-1)n++;continue}
      if(safe(x,y-1))edge(x,y,x+1,y);
      if(safe(x+1,y))edge(x+1,y,x+1,y+1);
      if(safe(x,y+1))edge(x+1,y+1,x,y+1);
      if(safe(x-1,y))edge(x,y+1,x,y);
    }
  }
  covered=n*100/((W-2)*(H-2));
  const loops=[];
  while(edges.size){
    const first=edges.keys().next().value;let next=first,loop=[];
    do{loop.push({x:next%(W+1),y:Math.floor(next/(W+1))});const list=edges.get(next);if(!list)break;const v=list.pop();if(!list.length)edges.delete(next);next=v}while(next!==first);
    loops.push(loop);
  }
  patrol=loops.sort((a,b)=>b.length-a.length)[0]||[];
  for(const c of crawlers){
    let near=0,dist=Infinity;if(c.where)patrol.forEach((p,i)=>{const d=(p.x-c.where.x)**2+(p.y-c.where.y)**2;if(d<dist){dist=d;near=i}});
    c.at=c.where?near:patrol.length*c.start;c.where=patrol[Math.floor(c.at)];
  }
}
function sector(){
  grid=new Uint8Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const edge=x===0||x===W-1||y===0||y===H-1;
    const corner=(x<39&&y<11)||(x<25&&y<23)||(x<13&&y<29);
    const bottom=(x<21&&y>=68)||(x<42&&y>=80)||(x<57&&y>=91);
    const far=(x>=146&&y>=68)||(x>=130&&y>=79)||(x>=112&&y>=91);
    if(edge||corner||bottom||far)grid[cell(x,y)]=1;
  }
  player={x:41,y:80};enemy={x:W*.56,y:H*.47,vx:5.5+level*.85,vy:2.6+level*.45};
  trails=[];trailSet=new Set();origin=null;heading=null;moveClock=0;grace=1.7;effects=[];
  crawlers=[{start:.18,sign:1},{start:.71,sign:-1}];if(level>2)crawlers.push({start:.92,sign:1});
  rebuildTerrain();updateHUD();
}
function updateHUD(){
  $('score').textContent=pad(score,6);scores.updateBest();$('sector').textContent=pad(level,2);
  $('sectorName').textContent=names[(level-1)%names.length];$('pct').textContent=Math.floor(covered);
  $('meter').style.width=Math.min(100,covered/TARGET*100)+'%';$('meter').parentElement.setAttribute('aria-valuenow',String(Math.min(80,Math.floor(covered))));
  $('lives').innerHTML=Array.from({length:3},(_,i)=>'<svg aria-hidden="true" class="'+(i>=lives?'lost':'')+'"><use href="#ship"/></svg>').join('');
  $('lives').setAttribute('aria-label',lives+' lives');updateCoords();
}
function updateCoords(){$('coord').textContent='X '+pad(player.x,3)+'   Y '+pad(player.y,3)}
function changeState(s){
  $('game-version').hidden=s!=='ready';
  $('score-open').hidden=s!=='ready';
  $('best-label').hidden=s==='ready';
  state=s;heading=null;moveClock=0;const data={
    ready:['Standby','Start game','▶','Enter'],playing:['In play','Pause game','Ⅱ','Space'],paused:['Paused','Resume game','▶','Space'],
    over:['Run ended','Play again','↻','Enter'],clear:['Sector clear','Next sector','▶','Enter']
  }[s];
  $('status').textContent=data[0];$('status').parentElement.classList.toggle('playing',s==='playing');
  $('actionText').textContent=data[1];$('actionIcon').textContent=data[2];$('actionKey').textContent=data[3];
  $('overlay').hidden=!['paused','over','clear'].includes(s);
  if(!$('overlay').hidden){
    const copy=s==='paused'?['Sector '+pad(level,2),'Run paused','Your field is holding.','Resume game']:s==='over'?['Run complete','Game over','Final score  '+pad(score,6),'Play again']:['Territory secured','Sector clear',Math.floor(covered)+'% claimed · Sector '+pad(level+1,2)+' unlocked','Next sector'];
    ['overlayTag','overlayTitle','overlayCopy','overlayAction'].forEach((id,i)=>$(id).textContent=copy[i]);$('restartRun').hidden=s!=='paused';
  }
}
function begin(){score=0;level=1;lives=3;elapsed=0;phase=.7;$('time').textContent='00:00';$('notice').textContent='';sector();changeState('playing');tone(200,610,.24);canvas.focus({preventScroll:true})}
function action(){
  unlock();if(state==='ready'||state==='over')begin();
  else if(state==='playing')changeState('paused');
  else if(state==='paused'){changeState('playing');canvas.focus({preventScroll:true})}
  else if(state==='clear'){level++;sector();changeState('playing');canvas.focus({preventScroll:true})}
}
function message(s){$('notice').textContent=s;noteUntil=performance.now()+1900}
function lose(cause){
  if(grace>0||state!=='playing')return false;
  burst(player.x+.5,player.y+.5,'#ff8970',32);lives--;tone(210,40,.35,0,.065,'triangle');
  if(origin)player={...origin};trails=[];trailSet.clear();origin=null;heading=null;grace=2.1;
  updateHUD();if(lives===0){changeState('over');scores.finish({score,level})}else message(cause+' · Life lost');
  return true;
}
function claim(){
  const startCount=covered;
  for(const p of trails)grid[cell(p.x,p.y)]=1;
  // The unclaimed component containing the Styx survives the cut.
  const seed=cell(clamp(Math.floor(enemy.x),1,W-2),clamp(Math.floor(enemy.y),1,H-2));
  let root=seed;
  if(grid[root]){let d=Infinity;for(let i=0;i<grid.length;i++)if(!grid[i]){const p=pos(i),v=(p.x-enemy.x)**2+(p.y-enemy.y)**2;if(v<d){d=v;root=i}}}
  const seen=new Uint8Array(W*H),queue=new Int32Array(W*H);let head=0,tail=0;
  if(!grid[root]){seen[root]=1;queue[tail++]=root}
  while(head<tail){const i=queue[head++];for(const k of [i-1,i+1,i-W,i+W])if(!grid[k]&&!seen[k]){seen[k]=1;queue[tail++]=k}}
  for(let i=0;i<grid.length;i++)if(!seen[i])grid[i]=1;
  for(let i=0;i<trails.length;i+=5)burst(trails[i].x,trails[i].y,'#85fff0',2);
  trails=[];trailSet.clear();origin=null;rebuildTerrain();
  const gain=Math.max(1,Math.round((covered-startCount)*100*level));score+=gain;updateHUD();
  message('+'+gain+'  ·  Territory claimed');tone(370,600,.13);tone(650,1000,.23,.09);
  if(covered>=TARGET){changeState('clear');tone(800,1400,.42,.2)}
}
function move(){
  if(!heading||state!=='playing')return;
  const [dx,dy]=dirs[heading],x=player.x+dx,y=player.y+dy;
  if(x<0||x>=W||y<0||y>=H){heading=null;return}
  if(trailSet.has(cell(x,y))){if(grace>0){heading=null;return}lose('Trail crossed');return}
  const last=player;player={x,y};
  if(!safe(x,y)){if(!origin){origin={...last};tone(320,240,.065)}trails.push(player);trailSet.add(cell(x,y))}
  else if(trails.length){
    if(origin&&same(player,origin)&&trails.length===1){trails=[];trailSet.clear();origin=null}
    else claim();
    heading=null;
  }
  updateCoords();
}
function steer(dir){unlock();if(state==='ready')begin();if(state!=='playing')return;heading=dir;moveClock=Math.max(moveClock,.028)}
function burst(x,y,color,count){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,v=1+Math.random()*7;effects.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,color,life:.4+Math.random()*.45})}}
function enemyGeometry(){
  const rows=[],t=phase,uShift=.12*Math.sin(t*.31),angle=-.32+.11*Math.sin(t*.4);
  const ca=Math.cos(angle),sa=Math.sin(angle);
  for(let j=0;j<43;j++){
    const f=j/42,b=(f-.5)*1.36,pts=[];
    for(let i=0;i<=120;i++){
      const u=i*Math.PI/60;
      const x=12.6*Math.sin(u+b*.78)+7.4*Math.sin(2*u+.55+b+uShift)+2.9*Math.cos(3*u+t*.41);
      const y=8.5*Math.sin(2*u+1.06+b*.94+t*.25)+4.6*Math.cos(3*u+.65+b*.53)+3.2*Math.sin(u-b+t*.21);
      pts.push([enemy.x+1.20*(x*ca-y*sa),enemy.y+1.16*(x*sa+y*ca)]);
    }
    rows.push(pts);
  }
  return rows;
}
function update(dt){
  if(state==='playing'){
    elapsed+=dt;grace=Math.max(0,grace-dt);
    $('time').textContent=pad(Math.floor(elapsed/60),2)+':'+pad(Math.floor(elapsed%60),2);
    const speed=1+Math.min(level-1,10)*.055;
    const dx=enemy.vx*(.76+.24*Math.sin(phase*.87))*dt*speed,dy=(enemy.vy+1.2*Math.sin(phase*1.17))*dt*speed;
    if(safe(Math.floor(enemy.x+dx),Math.floor(enemy.y)))enemy.vx*=-1;else enemy.x+=dx;
    if(safe(Math.floor(enemy.x),Math.floor(enemy.y+dy)))enemy.vy*=-1;else enemy.y+=dy;
    moveClock+=dt;while(moveClock>=.032){moveClock-=.032;move()}
  }
  if(state==='playing'||(state==='ready'&&!reduced)){
    phase+=dt*(state==='ready'?.22:.79);
    for(const c of crawlers){
      if(!patrol.length)continue;
      c.at=(c.at+c.sign*dt*(state==='ready'?2.4:7+level*1.5)+patrol.length)%patrol.length;
      c.where=patrol[Math.floor(c.at)];
      if(state==='playing'&&grace<=0)for(let n=0;n<7;n++){
        const p=patrol[(Math.floor(c.at)-c.sign*n+patrol.length*2)%patrol.length];
        const near=q=>Math.hypot(q.x+.5-p.x,q.y+.5-p.y)<1.13;
        if(near(player)||(origin&&near(origin))){lose('Crawler contact');break}
      }
    }
  }
  lastGeometry=enemyGeometry();
  if(trails.length&&grace<=0&&state==='playing'){
    outer:for(let j=0;j<lastGeometry.length;j+=3){
      for(const [x,y] of lastGeometry[j])if(trailSet.has(cell(Math.floor(x),Math.floor(y)))){lose('Styx contact');break outer}
    }
  }
  effects=effects.filter(p=>p.life>0);if(state==='playing')for(const p of effects){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt}
  if(noteUntil&&performance.now()>noteUntil){$('notice').textContent='';noteUntil=0}
}

const backdrop=document.createElement('canvas');
let cachedTerrain=null, cachedWidth=0, cachedHeight=0;
function resize(){
  const box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  viewW=box.width;viewH=box.height;scaleX=viewW/W;scaleY=viewH/H;
  canvas.width=Math.max(1,Math.round(viewW*dpr));canvas.height=Math.max(1,Math.round(viewH*dpr));
  ctx.setTransform(dpr,0,0,dpr,0,0);cachedTerrain=null;
}
function paintTerrain(){
  if(cachedTerrain===terrain&&cachedWidth===canvas.width&&cachedHeight===canvas.height)return;
  cachedTerrain=terrain;cachedWidth=canvas.width;cachedHeight=canvas.height;
  backdrop.width=canvas.width;backdrop.height=canvas.height;
  const g=backdrop.getContext('2d');g.scale(canvas.width/W,canvas.height/H);
  g.fillStyle='rgba(1,10,17,.22)';g.fillRect(0,0,W,H);
  g.strokeStyle='rgba(96,169,185,.11)';g.lineWidth=.095;g.beginPath();
  for(let x=0;x<W;x+=5.5){g.moveTo(x,0);g.lineTo(x,H)}
  for(let y=0;y<H;y+=5.5){g.moveTo(0,y);g.lineTo(W,y)}g.stroke();
  g.strokeStyle='rgba(142,187,196,.26)';g.lineWidth=.095;g.beginPath();
  for(let x=11;x<W;x+=22)for(let y=11;y<H;y+=22){g.moveTo(x-.43,y);g.lineTo(x+.43,y);g.moveTo(x,y-.43);g.lineTo(x,y+.43)}g.stroke();
  const grad=g.createLinearGradient(0,0,W,H);grad.addColorStop(0,'rgba(29,126,126,.54)');grad.addColorStop(.55,'rgba(9,74,83,.6)');grad.addColorStop(1,'rgba(40,138,138,.49)');
  g.fillStyle=grad;g.fill(terrain);g.save();g.clip(terrain);g.lineWidth=.12;g.strokeStyle='rgba(102,224,209,.34)';g.beginPath();
  for(let k=-H;k<W;k+=1.45){g.moveTo(k+H,0);g.lineTo(k,H)}g.stroke();g.restore();
  g.shadowColor='#40e7d4';g.shadowBlur=5;g.strokeStyle='rgba(111,236,218,.94)';g.lineWidth=.26;g.stroke(border);g.shadowBlur=0;
  g.strokeStyle='rgba(103,210,200,.6)';g.lineWidth=.14;g.strokeRect(.3,.3,W-.6,H-.6);
}
function drawStyx(){
  ctx.save();ctx.clip(openRegion);
  const aura=ctx.createRadialGradient(enemy.x,enemy.y,0,enemy.x,enemy.y,28);
  aura.addColorStop(0,'rgba(231,50,105,.13)');aura.addColorStop(.55,'rgba(247,64,130,.055)');aura.addColorStop(1,'rgba(238,61,105,0)');
  ctx.fillStyle=aura;ctx.fillRect(enemy.x-28,enemy.y-28,56,56);
  ctx.globalCompositeOperation='screen';ctx.lineJoin='round';
  const palette=[[255,168,77],[255,108,78],[255,78,133],[244,91,182],[255,170,191]];
  for(let j=0;j<lastGeometry.length;j++){
    const pts=lastGeometry[j],mix=j/(lastGeometry.length-1)*4,ix=Math.min(3,Math.floor(mix)),v=mix-ix;
    const rgb=palette[ix].map((n,k)=>Math.round(n*(1-v)+palette[ix+1][k]*v));
    ctx.strokeStyle='rgba('+rgb.join(',')+','+(j%7===0?.94:.74)+')';ctx.lineWidth=j%7===0?.18:.11;
    ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
    if(j%10===0){ctx.strokeStyle='rgba('+rgb.join(',')+',.07)';ctx.lineWidth=.95;ctx.stroke()}
  }
  for(let i=0;i<40;i++){const a=i*2.399+phase*.12,r=12+((i*71)%96)/9;
    ctx.fillStyle=i%3?'#f79aa65e':'#ffc89b90';ctx.fillRect(enemy.x+Math.cos(a)*r,enemy.y+Math.sin(a)*r*.8,.11+(i%3)*.055,.16)}
  ctx.restore();
}
function drawActors(){
  for(const c of crawlers){
    for(let n=6;n>=0;n--){
      const f=c.at-c.sign*n*1.08,i=Math.floor(f),a=patrol[(i+patrol.length*2)%patrol.length],b=patrol[(i+1+patrol.length*2)%patrol.length];
      if(!a||!b)continue;
      const x=a.x+(b.x-a.x)*(f-i),y=a.y+(b.y-a.y)*(f-i);
      ctx.fillStyle=n===0?'#fff0a7':'hsl('+(32+n)+',90%,'+(74-n*5)+'%)';ctx.shadowColor='#ffaa32';ctx.shadowBlur=n<2?8:3;
      ctx.beginPath();ctx.arc(x,y,.56-n*.042,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.shadowBlur=0;
  if(origin){ctx.beginPath();ctx.moveTo(origin.x+.5,origin.y+.5);for(const p of trails)ctx.lineTo(p.x+.5,p.y+.5);
    ctx.strokeStyle='#66ffed';ctx.lineWidth=.43;ctx.shadowColor='#2effd4';ctx.shadowBlur=9;ctx.stroke();ctx.shadowBlur=0}
  const x=player.x+.5,y=player.y+.5;
  const glow=ctx.createRadialGradient(x,y,0,x,y,4);glow.addColorStop(0,'#96fffbbb');glow.addColorStop(.35,'#5bf8e969');glow.addColorStop(1,'#3fffe000');ctx.fillStyle=glow;ctx.fillRect(x-4,y-4,8,8);
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.shadowColor='#61fff1';ctx.shadowBlur=9;
  ctx.fillStyle='#f3fffb';ctx.fillRect(-.8,-.8,1.6,1.6);ctx.shadowBlur=0;ctx.strokeStyle='#92fff1';ctx.lineWidth=.12;ctx.strokeRect(-1.27,-1.27,2.54,2.54);ctx.restore();
  if(state==='ready'){ctx.save();ctx.scale(1/scaleX,1/scaleY);const px=x*scaleX,py=y*scaleY;ctx.strokeStyle='#b3e7dc99';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px+7,py-7);ctx.lineTo(px+16,py-16);ctx.lineTo(px+25,py-16);ctx.stroke();ctx.fillStyle='#c8eee7';ctx.font='bold 10px Consolas, monospace';ctx.fillText('YOU',px+29,py-13);ctx.restore()}
  for(const p of effects){ctx.globalAlpha=Math.min(1,p.life*1.7);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,.34,.34)}ctx.globalAlpha=1;
}
function render(){
  if(viewW<1||viewH<1)return;
  ctx.clearRect(0,0,viewW,viewH);paintTerrain();ctx.drawImage(backdrop,0,0,viewW,viewH);
  ctx.save();ctx.scale(scaleX,scaleY);drawStyx();drawActors();ctx.restore();
}
function frame(ms){
  const dt=tPrev?Math.min(.06,(ms-tPrev)/1000):0;
  // Keep the background animation economical on high-refresh displays.
  if(ms-frameTime>=1000/(state==='playing'?60:30)-1){tPrev=ms;frameTime=ms;update(dt);render()}
  requestAnimationFrame(frame);
}
function showHelp(){helpResume=state==='playing';if(helpResume)changeState('paused');$('instructions').showModal()}
function hideHelp(){$('instructions').close()}
$('instructions').addEventListener('close',()=>{if(helpResume&&state==='paused'){changeState('playing');canvas.focus({preventScroll:true})}helpResume=false});
$('instructions').addEventListener('click',e=>{if(e.target===$('instructions')){const b=e.target.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)hideHelp()}});
$('guide').onclick=showHelp;$('close').onclick=hideHelp;$('gotIt').onclick=hideHelp;
$('action').onclick=action;$('overlayAction').onclick=action;$('restartRun').onclick=()=>{unlock();begin()};$('sound').onclick=()=>setSound(true);
$('full').onclick=async()=>{
  const field=$('field');try{if(document.fullscreenElement)await document.exitFullscreen();else if(field.requestFullscreen)await field.requestFullscreen();else field.classList.toggle('expanded')}catch{field.classList.toggle('expanded')}
  canvas.focus({preventScroll:true});syncFull();
};
function syncFull(){const label=document.fullscreenElement||$('field').classList.contains('expanded')?'Exit expanded playfield':'Expand playfield';$('full').setAttribute('aria-label',label);$('full').title=label}
const compact=matchMedia('(max-width: 800px)');
function placeAction(){
  const button=$('action');
  if(compact.matches)document.querySelector('.field-foot').insertBefore(button,document.querySelector('.time'));
  else document.querySelector('.telemetry').append(button);
}
compact.addEventListener('change',placeAction);placeAction();
document.addEventListener('fullscreenchange',syncFull);
document.addEventListener('keydown',e=>{
  if($('instructions').open||$('score-dialog').open||e.metaKey||e.ctrlKey||e.altKey)return;
  const k=e.key.length===1?e.key.toLowerCase():e.key;
  if(keyDirs[k]){e.preventDefault();if(!e.repeat)steer(keyDirs[k]);return}
  if(k==='Escape'&&$('field').classList.contains('expanded')){$('field').classList.remove('expanded');syncFull();return}
  if((k==='Enter'||k===' ')&&e.target.closest('button')&&k==='Enter')return;
  if(['Enter',' ','Escape','m'].includes(k)){
    e.preventDefault();if(e.repeat)return;
    if(k==='m')setSound(true);
    else if(k===' '||k==='Escape'){if(state==='playing'||state==='paused')action()}
    else action();
  }
});
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointerStart={x:e.clientX,y:e.clientY};canvas.focus({preventScroll:true});unlock()});
canvas.addEventListener('pointermove',e=>{if(!pointerStart)return;const dx=e.clientX-pointerStart.x,dy=e.clientY-pointerStart.y;if(Math.max(Math.abs(dx),Math.abs(dy))>13){steer(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));pointerStart={x:e.clientX,y:e.clientY}}});
canvas.addEventListener('pointerup',()=>pointerStart=null);canvas.addEventListener('pointercancel',()=>pointerStart=null);
document.querySelectorAll('[data-dir]').forEach(b=>b.addEventListener('click',()=>steer(b.dataset.dir)));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')changeState('paused')});
function returnToStart(){
  score=0;level=1;lives=3;elapsed=0;phase=.7;
  $('time').textContent='00:00';$('notice').textContent='';
  sector();changeState('ready');$('action').focus({preventScroll:true});
}
const scores=new Scoreboard(action,returnToStart);
$('game-version').textContent='Version '+document.querySelector('meta[name="version"]').content;
sector();setSound();changeState('ready');new ResizeObserver(resize).observe(canvas);resize();requestAnimationFrame(frame);

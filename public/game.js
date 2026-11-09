(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height;
const $=id=>document.getElementById(id);
const ui={score:$('score'),best:$('best'),wave:$('wave'),ships:$('ships'),overlay:$('overlay'),title:$('overlayTitle'),text:$('overlayText'),start:$('startBtn'),sound:$('soundBtn')};
const keys=new Set(),touch={left:false,right:false,thrust:false,fire:false};
let state='ready',ship,rocks=[],shots=[],saucers=[],particles=[],score=0,lives=3,wave=1,nextExtra=10000,fireCooldown=0,saucerTimer=8,invulnerable=0,muted=false,audio=null,best=Number(loadBest()||0),last=0,elapsed=0;
// localStorage can throw in Firefox when site data/cookies are blocked; never let that stop the game.
function loadBest(){try{return localStorage.getItem('asteroids-enhanced-best')}catch(e){return 0}}
function saveBest(v){try{localStorage.setItem('asteroids-enhanced-best',String(v))}catch(e){}}
// Phosphor colors. stroke = line color, glow = canvas shadow color. "white" keeps the original look.
const PALETTE={
  green:{name:'CRT GREEN',stroke:'#39ff6a',glow:'#00ff41'},
  amber:{name:'CRT AMBER',stroke:'#ffb000',glow:'#ff8a00'},
  white:{name:'WHITE',stroke:'#d9f8ff',glow:'#7deeff'}
};
const PALETTE_KEYS=Object.keys(PALETTE);
const COLOR_PARTS=[['ship','SHIP'],['rocks','ASTEROIDS'],['saucers','SAUCERS'],['bullets','BULLETS']];
const COLORS_KEY='asteroids-enhanced-colors';
function loadColors(){const out={ship:'white',rocks:'white',saucers:'white',bullets:'white'};try{const c=JSON.parse(localStorage.getItem(COLORS_KEY)||'{}');for(const k in out)if(PALETTE[c[k]])out[k]=c[k]}catch(e){}return out}
function saveColors(){try{localStorage.setItem(COLORS_KEY,JSON.stringify(colors))}catch(e){}}
let colors=loadColors();
function ink(part){const p=PALETTE[colors[part]];ctx.strokeStyle=p.stroke;ctx.fillStyle=p.stroke;ctx.shadowColor=p.glow}
// Remaining-ships display: small vector ship icons (same outline as the player ship, pointing up).
const MAX_SHIP_ICONS=8;
const SHIP_ICON='<svg class="ship-icon" viewBox="-13 -18 26 32" aria-hidden="true"><path d="M0,-17 L10,12 L0,8 L-10,12 Z"/></svg>';
let shownLives=-1;
function renderShips(){
  if(lives===shownLives)return;shownLives=lives;
  const n=Math.max(0,lives),icons=Math.min(n,MAX_SHIP_ICONS);
  ui.ships.innerHTML=SHIP_ICON.repeat(icons)+(n>MAX_SHIP_ICONS?`<span class="ship-more">+${n-MAX_SHIP_ICONS}</span>`:'');
  ui.ships.setAttribute('aria-label',`${n} ship${n===1?'':'s'} left`);
}
renderShips();
ui.best.textContent=fmt(best);ui.sound.textContent='SOUND: ON · TEST';
function fmt(n){return String(n).padStart(6,'0')}
function audioCtx(){
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass)return null;
  if(!audio){
    try{
      audio=new AudioContextClass();
      masterGain=audio.createGain();
      masterGain.gain.value=.72;
      masterGain.connect(audio.destination);
    }catch(e){audio=null;return null}
  }
  if(audio.state==='suspended') audio.resume().catch(()=>{});
  return audio;
}
let masterGain=null;
function unlockAudio(){
  const ac=audioCtx();
  if(ac && ac.state==='suspended') ac.resume().catch(()=>{});
}
function tone(freq=440,dur=.08,type='square',vol=.045,slide=0){
  const ac=audioCtx();
  if(muted||!ac||!masterGain)return;
  try{
    const o=ac.createOscillator(),g=ac.createGain(),now=ac.currentTime;
    o.type=type;
    o.frequency.setValueAtTime(freq,now);
    if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(25,freq+slide),now+dur);
    g.gain.setValueAtTime(.0001,now);
    g.gain.linearRampToValueAtTime(vol,now+.008);
    g.gain.exponentialRampToValueAtTime(.0001,now+dur);
    o.connect(g);g.connect(masterGain);
    o.start(now);o.stop(now+dur+.015);
    o.onended=()=>{o.disconnect();g.disconnect()};
  }catch(e){}
}
let thrustSoundTimer=0;
function sound(name){
  if(muted)return;
  if(name==='shoot')tone(760,.065,'square',.055,-430);
  else if(name==='boom'){tone(105,.25,'sawtooth',.075,-75);tone(48,.18,'triangle',.035,-20)}
  else if(name==='thrust'&&thrustSoundTimer<=0){tone(115,.11,'sawtooth',.025,55);thrustSoundTimer=.22}
  else if(name==='saucer'){tone(270,.24,'triangle',.04,150)}
  else if(name==='warp'){tone(560,.32,'sine',.055,-470)}
  else if(name==='extra')tone(880,.18,'sine',.05,440);
}
function rand(a,b){return a+Math.random()*(b-a)}function wrap(o){if(o.x<0)o.x+=W;if(o.x>W)o.x-=W;if(o.y<0)o.y+=H;if(o.y>H)o.y-=H}
function newShip(){return{x:W/2,y:H/2,vx:0,vy:0,a:-Math.PI/2,r:13}}
function makeRock(x,y,size,angle=rand(0,Math.PI*2),speed=rand(.35,1.15)){const n=9+Math.floor(Math.random()*5),pts=[];for(let i=0;i<n;i++)pts.push(rand(.72,1.22));return{x,y,size,a:angle,spin:rand(-.012,.012),vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r:size===3?37:size===2?22:12,pts}}
function addRock(x,y,size){rocks.push(makeRock(x,y,size))}
function startWave(){rocks=[];shots=[];const count=Math.min(4+wave,12);for(let i=0;i<count;i++){let x,y;do{x=rand(0,W);y=rand(0,H)}while(Math.hypot(x-W/2,y-H/2)<150);rocks.push(makeRock(x,y,3))}ui.wave.textContent=String(wave).padStart(2,'0')}
function start(){audioCtx();score=0;lives=3;wave=1;nextExtra=10000;ship=newShip();shots=[];saucers=[];particles=[];invulnerable=2.5;fireCooldown=0;saucerTimer=7;startWave();state='playing';ui.overlay.classList.add('hidden');updateHud()}
function updateHud(){ui.score.textContent=fmt(score);renderShips();ui.best.textContent=fmt(best)}
function burst(x,y,count=12,part='rocks'){for(let i=0;i<count;i++){const a=rand(0,Math.PI*2),s=rand(.6,3);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.25,.8),max:.8,part})}}
function award(n){score+=n;while(score>=nextExtra){lives++;nextExtra+=10000}if(score>best){best=score;saveBest(best)}updateHud()}
function fire(){if(fireCooldown>0)return;shots.push({x:ship.x+Math.cos(ship.a)*16,y:ship.y+Math.sin(ship.a)*16,vx:ship.vx+Math.cos(ship.a)*420,vy:ship.vy+Math.sin(ship.a)*420,life:1.05});fireCooldown=.18;sound('shoot')}
function hyperspace(){if(!ship||state!=='playing')return;ship.x=rand(35,W-35);ship.y=rand(35,H-35);ship.vx=ship.vy=0;invulnerable=1.4;sound('warp')}
function hitShip(){if(invulnerable>0)return;burst(ship.x,ship.y,24,'ship');lives--;updateHud();sound('boom');if(lives<=0){state='over';showOverlay('GAME OVER',`Final score: ${fmt(score)} · Best: ${fmt(best)}`,'PLAY AGAIN')}else{ship=newShip();invulnerable=2.3}}
function splitRock(index){const r=rocks[index];rocks.splice(index,1);burst(r.x,r.y,r.size===3?13:9,'rocks');award(r.size===3?20:r.size===2?50:100);if(r.size>1){for(let i=0;i<2;i++)rocks.push(makeRock(r.x,r.y,r.size-1,rand(0,Math.PI*2),rand(.8,1.8)))}sound('boom')}
function showOverlay(title,text,button){ui.title.textContent=title;ui.text.textContent=text;ui.start.textContent=button;ui.overlay.classList.remove('hidden')}
function pause(){if(state==='playing'){state='paused';showOverlay('PAUSED','Take a breather. Your flight is on hold.','RESUME')}else if(state==='paused'){state='playing';ui.overlay.classList.add('hidden')}}
function input(name){
  const aliases={
    'ArrowLeft':['ArrowLeft','KeyA'],'a':['KeyA'],'ArrowRight':['ArrowRight','KeyD'],'d':['KeyD'],
    'ArrowUp':['ArrowUp','KeyW'],'w':['KeyW'],' ':['Space']
  };
  const candidates=aliases[name]||[name];
  return candidates.some(k=>keys.has(k)||keys.has(k.toLowerCase()));
}
function update(dt){if(state!=='playing')return;elapsed+=dt;thrustSoundTimer=Math.max(0,thrustSoundTimer-dt);dt=Math.min(dt,.04);if(input('ArrowLeft')||input('a')||touch.left)ship.a-=4.9*dt;if(input('ArrowRight')||input('d')||touch.right)ship.a+=4.9*dt;
if(input('ArrowUp')||input('w')||touch.thrust){ship.vx+=Math.cos(ship.a)*330*dt;ship.vy+=Math.sin(ship.a)*330*dt;if(Math.random()<.25) sound('thrust')}
const speed=Math.hypot(ship.vx,ship.vy),max=340;if(speed>max){ship.vx=ship.vx/speed*max;ship.vy=ship.vy/speed*max}ship.vx*=Math.pow(.992,dt*60);ship.vy*=Math.pow(.992,dt*60);ship.x+=ship.vx*dt;ship.y+=ship.vy*dt;wrap(ship);
if(input(' ')||touch.fire){fireCooldown-=dt;fire()}else fireCooldown=0;
if(invulnerable>0)invulnerable-=dt;
for(const s of shots){s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;wrap(s)}shots=shots.filter(s=>s.life>0);
for(const r of rocks){r.x+=r.vx*60*dt;r.y+=r.vy*60*dt;r.a+=r.spin*60*dt;wrap(r)}
for(let i=rocks.length-1;i>=0;i--){const r=rocks[i];for(let j=shots.length-1;j>=0;j--){const b=shots[j];if(Math.hypot(r.x-b.x,r.y-b.y)<r.r){shots.splice(j,1);splitRock(i);break}}}
if(invulnerable<=0&&rocks.some(r=>Math.hypot(r.x-ship.x,r.y-ship.y)<r.r+10))hitShip();
saucerTimer-=dt;if(saucerTimer<=0&&saucers.length===0){const dir=Math.random()<.5?1:-1;saucers.push({x:dir===1?-25:W+25,y:rand(60,H-60),vx:dir*rand(75,115),vy:rand(-35,35),fire:1.2,small:Math.random()<.45});saucerTimer=rand(13,22);sound('saucer')}
for(const u of saucers){u.x+=u.vx*dt;u.y+=u.vy*dt+Math.sin(elapsed*3)*25*dt;u.fire-=dt;if(u.fire<=0){const a=Math.atan2(ship.y-u.y,ship.x-u.x)+rand(-.25,.25);shots.push({x:u.x,y:u.y,vx:Math.cos(a)*240,vy:Math.sin(a)*240,life:2,enemy:true});u.fire=rand(1.2,2.1)}}
saucers=saucers.filter(u=>u.x>-60&&u.x<W+60);
for(let j=shots.length-1;j>=0;j--){const b=shots[j];if(b.enemy&&Math.hypot(b.x-ship.x,b.y-ship.y)<12){shots.splice(j,1);hitShip()}}
for(let i=saucers.length-1;i>=0;i--){const u=saucers[i];for(let j=shots.length-1;j>=0;j--){if(!shots[j].enemy&&Math.hypot(shots[j].x-u.x,shots[j].y-u.y)<(u.small?10:17)){shots.splice(j,1);saucers.splice(i,1);award(u.small?1000:200);burst(u.x,u.y,15,'saucers');break}}}
for(const p of particles){p.x+=p.vx*60*dt;p.y+=p.vy*60*dt;p.life-=dt;wrap(p)}particles=particles.filter(p=>p.life>0);
if(rocks.length===0){wave++;startWave();invulnerable=1.8}
}
function polygon(x,y,r,pts,angle=0){ctx.beginPath();pts.forEach((v,i)=>{const a=angle+i/pts.length*Math.PI*2,px=x+Math.cos(a)*r*v,py=y+Math.sin(a)*r*v;i?ctx.lineTo(px,py):ctx.moveTo(px,py)});ctx.closePath()}
function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#02050a';ctx.fillRect(0,0,W,H);
ctx.save();ctx.lineWidth=1.65;ctx.shadowBlur=3;
ink('rocks');for(const r of rocks){polygon(r.x,r.y,r.r,r.pts,r.a);ctx.stroke()}
ink('saucers');for(const u of saucers){ctx.beginPath();ctx.ellipse(u.x,u.y, u.small?12:19,5,0,Math.PI,Math.PI*2);ctx.lineTo(u.x+(u.small?9:14),u.y+5);ctx.lineTo(u.x-(u.small?9:14),u.y+5);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.ellipse(u.x,u.y-3, u.small?6:9,4,0,Math.PI,Math.PI*2);ctx.stroke()}
ink('bullets');for(const b of shots){ctx.beginPath();ctx.arc(b.x,b.y,b.enemy?2.5:2,0,Math.PI*2);ctx.fill()}
for(const p of particles){ctx.fillStyle=PALETTE[colors[p.part]].stroke;ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillRect(p.x,p.y,2,2)}ctx.globalAlpha=1;
if(ship&&state==='playing'&&(invulnerable<=0||Math.floor(elapsed*10)%2===0)){ink('ship');ctx.save();ctx.translate(ship.x,ship.y);ctx.rotate(ship.a);ctx.beginPath();ctx.moveTo(17,0);ctx.lineTo(-12,-10);ctx.lineTo(-8,0);ctx.lineTo(-12,10);ctx.closePath();ctx.stroke();if(input('ArrowUp')||input('w')||touch.thrust){ctx.beginPath();ctx.moveTo(-9,-5);ctx.lineTo(-19,0);ctx.lineTo(-9,5);ctx.stroke()}ctx.restore()}
ctx.restore();
}
// Star field
const stars=Array.from({length:95},()=>({x:Math.random()*W,y:Math.random()*H,a:rand(.12,.55)}));
const original=draw;draw=function(){original();ctx.save();ctx.fillStyle='#b9d9e8';for(const s of stars){ctx.globalAlpha=s.a;ctx.fillRect(s.x,s.y,1.2,1.2)}ctx.restore()};
function loop(t){const dt=last?Math.min((t-last)/1000,.05):0;last=t;update(dt);draw();requestAnimationFrame(loop)}
window.addEventListener('keydown',e=>{
  const code=e.code||e.key;
  if(['ArrowLeft','ArrowRight','ArrowUp','Space','ShiftLeft','ShiftRight'].includes(code))e.preventDefault();
  keys.add(code);
  unlockAudio();
  if(e.repeat)return;
  if(code==='Enter'&&(state==='ready'||state==='over'))start();
  else if(code==='KeyP'||code==='Escape')pause();
  else if(code==='ShiftLeft'||code==='ShiftRight')hyperspace();
  else if(code==='KeyC')cycleAllColors();
});
window.addEventListener('keyup',e=>keys.delete(e.code||e.key));
window.addEventListener('pointerdown',unlockAudio,{passive:true});
window.addEventListener('blur',()=>{keys.clear();if(state==='playing')pause()});
ui.start.addEventListener('click',()=>{unlockAudio();if(state==='paused')pause();else start()});
ui.sound.addEventListener('click',()=>{
  muted=!muted;
  ui.sound.textContent=muted?'SOUND: OFF':'SOUND: ON · TEST';
  if(!muted){unlockAudio();setTimeout(()=>tone(660,.12,'sine',.06,260),40)}
});
$('fullBtn').addEventListener('click',()=>{const el=document.querySelector('.game-frame');if(!document.fullscreenElement)el.requestFullscreen?.();else document.exitFullscreen?.()});
document.querySelectorAll('[data-control]').forEach(b=>{const k=b.dataset.control;const down=e=>{e.preventDefault();touch[k]=true;audioCtx()},up=e=>{e.preventDefault();touch[k]=false};b.addEventListener('pointerdown',down);['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,up))});
// Color panel: one row per object plus an ALL row; choices saved in this browser.
const colorBtn=$('colorBtn'),colorPanel=$('colorPanel');
function swatches(part){return PALETTE_KEYS.map(k=>`<button type="button" class="swatch" data-part="${part}" data-color="${k}" style="--sw:${PALETTE[k].stroke}" title="${PALETTE[k].name}" aria-label="${PALETTE[k].name}"><i></i></button>`).join('')}
colorPanel.innerHTML=[['all','ALL'],...COLOR_PARTS].map(([part,label])=>`<div class="color-row${part==='all'?' all':''}"><span>${label}</span><div role="group" aria-label="${label} color">${swatches(part)}</div></div>`).join('')+'<div class="color-hint">C: CYCLE ALL COLORS</div>';
function applyColors(){
  const parts=COLOR_PARTS.map(p=>p[0]),same=parts.every(p=>colors[p]===colors.ship);
  colorPanel.querySelectorAll('.swatch').forEach(b=>{const on=b.dataset.part==='all'?same&&colors.ship===b.dataset.color:colors[b.dataset.part]===b.dataset.color;b.setAttribute('aria-pressed',on)});
  const sp=PALETTE[colors.ship],root=document.documentElement.style;root.setProperty('--ship-ink',sp.stroke);root.setProperty('--ship-glow',sp.glow+'88');
}
function setColor(part,key){if(!PALETTE[key])return;if(part==='all')COLOR_PARTS.forEach(([p])=>colors[p]=key);else colors[part]=key;saveColors();applyColors()}
function cycleAllColors(){const i=PALETTE_KEYS.indexOf(colors.ship);setColor('all',PALETTE_KEYS[(i+1)%PALETTE_KEYS.length])}
function toggleColorPanel(open=colorPanel.hidden){colorPanel.hidden=!open;colorBtn.setAttribute('aria-expanded',open)}
colorBtn.addEventListener('click',e=>{e.stopPropagation();toggleColorPanel()});
colorPanel.addEventListener('click',e=>{e.stopPropagation();const b=e.target.closest('.swatch');if(b)setColor(b.dataset.part,b.dataset.color)});
document.addEventListener('click',()=>{if(!colorPanel.hidden)toggleColorPanel(false)});
applyColors();
requestAnimationFrame(loop);
})();

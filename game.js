import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060712);
scene.fog = new THREE.FogExp2(0x070812, 0.045);

const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.05, 60);
camera.position.set(0, 1.68, 2.25);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
const vrButton = VRButton.createButton(renderer, { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
vrButton.style.zIndex = '12';
document.body.appendChild(vrButton);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clock = new THREE.Clock();
const interactables = [];
const state = { score: 0, selectedGlass: null, glassContents: [], ice: 0, shaken: false, guestIndex: 0, dialogueStep: 0, open: false };

const recipes = {
  'Neon Sunset': { ingredients: ['Orange', 'Grenadine', 'Vodka'], glass: 'Highball', ice: 2 },
  'Midnight Blue': { ingredients: ['Blue Curaçao', 'Limette', 'Soda'], glass: 'Coupe', ice: 1 },
  'Velvet Berry': { ingredients: ['Beeren', 'Limette', 'Gin'], glass: 'Tumbler', ice: 2 }
};
const guests = [
  { name: 'Maya', order: 'Neon Sunset', color: 0xd8a286, hair: 0x24140d, outfit: 0x80295f, lines: ['Ein Neon Sunset, bitte. Überrasche mich.', 'Du wirkst, als würdest du deinen Job wirklich lieben.', 'Also – bist du immer so charmant hinter der Bar?'] },
  { name: 'Elena', order: 'Midnight Blue', color: 0xe0ae8d, hair: 0x17131d, outfit: 0x214e79, lines: ['Für mich einen Midnight Blue.', 'Die Aussicht ist gut. Die Gesellschaft vielleicht noch besser.', 'Das war eine ziemlich elegante Antwort.'] },
  { name: 'Sofia', order: 'Velvet Berry', color: 0xb87962, hair: 0x2a1710, outfit: 0x6d2232, lines: ['Velvet Berry. Nicht zu süß.', 'Ich bewerte Bars nach ihren Drinks – und Barkeeper nach ihrem Humor.', 'Du sammelst gerade Pluspunkte.'] }
];

const mats = {
  dark: new THREE.MeshStandardMaterial({ color: 0x111321, roughness: .55, metalness: .25 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x391f18, roughness: .38, metalness: .05 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb87931, roughness: .24, metalness: .84 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xd8efff, transmission: .88, transparent: true, opacity: .55, roughness: .08, metalness: 0, thickness: .12 }),
  ice: new THREE.MeshPhysicalMaterial({ color: 0xcaf3ff, transmission: .7, transparent: true, opacity: .8, roughness: .12 }),
};

function mesh(geo, mat, pos, parent = scene) { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
function addLabel(text, position, scale=.22, color='#ffffff', parent=scene) {
  const c = document.createElement('canvas'); c.width=768; c.height=192; const x=c.getContext('2d');
  x.clearRect(0,0,c.width,c.height); x.font='700 52px system-ui'; x.textAlign='center'; x.textBaseline='middle'; x.fillStyle=color; x.fillText(text,384,96);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(c), transparent:true })); s.position.set(...position); s.scale.set(scale*4, scale, 1); parent.add(s); return s;
}
function button3D(text, pos, action, width=.55, color=0x5d2d88) {
  const g = new THREE.Group(); g.position.set(...pos); scene.add(g);
  const b = mesh(new RoundedBoxGeometry(width,.16,.055,4,.025), new THREE.MeshStandardMaterial({color,roughness:.3,metalness:.25}), [0,0,0], g);
  addLabel(text,[0,0,.035],.105,'#ffffff',g); b.userData.action=action; b.userData.baseY=0; interactables.push(b); return g;
}

// Room
mesh(new THREE.PlaneGeometry(18,18), new THREE.MeshStandardMaterial({color:0x090a10,roughness:.82}), [0,0,0]).rotation.x=-Math.PI/2;
const back = mesh(new THREE.PlaneGeometry(18,7), new THREE.MeshStandardMaterial({color:0x101221,roughness:.72}), [0,3.5,-5]);
mesh(new THREE.BoxGeometry(6.8,.18,1.35), mats.wood, [0,1.08,-.35]);
mesh(new THREE.BoxGeometry(6.9,.12,1.4), mats.brass, [0,1.18,-.35]);
mesh(new THREE.BoxGeometry(6.6,1.1,.12), mats.dark, [0,.58,-1.03]);
for(let i=-3;i<=3;i++) { const shelf=mesh(new THREE.BoxGeometry(.9,.08,.28),mats.brass,[i*.9,2.15,-4.82]); shelf.castShadow=false; }
for(let i=0;i<12;i++) {
  const colors=[0x7b1d2f,0x1d5d78,0xd08225,0x39784e,0x6a287e];
  const bottle=mesh(new THREE.CylinderGeometry(.055,.07,.42,18),new THREE.MeshPhysicalMaterial({color:colors[i%colors.length],transmission:.25,roughness:.15}),[-2.7+i*.49,2.43,-4.7]);
  mesh(new THREE.CylinderGeometry(.027,.027,.12,12),mats.brass,[bottle.position.x,2.69,-4.7]);
}
for(let i=0;i<7;i++){ const bulb=new THREE.PointLight(i%2?0xff4fcb:0x49cfff,3.2,4.4,2); bulb.position.set(-4.5+i*1.5,3.3,-2.8); scene.add(bulb); mesh(new THREE.SphereGeometry(.045,12,8),new THREE.MeshBasicMaterial({color:bulb.color}),[bulb.position.x,bulb.position.y,bulb.position.z]); }
scene.add(new THREE.HemisphereLight(0x7276ac,0x191013,1.7));
const key = new THREE.SpotLight(0xffd6bb,32,9,Math.PI/5,.5,1.2); key.position.set(0,5,2); key.target.position.set(0,1,-2.5); key.castShadow=true; scene.add(key,key.target);

// Tablet
const tablet = new THREE.Group(); tablet.position.set(-2.38,1.5,-.55); tablet.rotation.y=.28; scene.add(tablet);
mesh(new RoundedBoxGeometry(1.18,.78,.07,5,.04),new THREE.MeshStandardMaterial({color:0x171a25,metalness:.7,roughness:.2}),[0,0,0],tablet);
mesh(new RoundedBoxGeometry(1.08,.68,.078,4,.02),new THREE.MeshBasicMaterial({color:0x102d43}),[0,0,.01],tablet);
addLabel('REZEPT-TABLET',[0,.23,.06],.085,'#8ee9ff',tablet);
Object.entries(recipes).forEach(([name,r],i)=>{
  const y=.08-i*.18; addLabel(`${name}: ${r.ingredients.join(' · ')}`,[0,y,.06],.055,'#ffffff',tablet);
});

// Prep station buttons
button3D('Highball',[-1.2,1.32,.12],()=>selectGlass('Highball'),.48,0x254e76);
button3D('Coupe',[-.62,1.32,.12],()=>selectGlass('Coupe'),.44,0x254e76);
button3D('Tumbler',[-.06,1.32,.12],()=>selectGlass('Tumbler'),.48,0x254e76);
const ingredients=['Orange','Grenadine','Vodka','Blue Curaçao','Limette','Soda','Beeren','Gin'];
ingredients.forEach((n,i)=>button3D(n,[-2.55+(i%4)*.62,1.32,.62+Math.floor(i/4)*.24],()=>addIngredient(n),.55,[0xd26b2d,0xb72a52,0xaebbd2,0x2779b8,0x78a932,0x75b9d0,0xa52b62,0x8091aa][i]));
button3D('EIS',[.72,1.32,.2],addIce,.42,0x7ec6e7);
button3D('SHAKEN',[1.25,1.32,.2],shake,.52,0x9959ad);
button3D('SERVIEREN',[2.04,1.32,.2],serve,.74,0xb67c34);

// Glass visualization
const drinkGlass = new THREE.Group(); drinkGlass.position.set(0,1.36,-.36); scene.add(drinkGlass);
let glassMesh, liquidMesh;
function rebuildGlass(type='Highball') {
  drinkGlass.clear();
  let geo = type==='Coupe' ? new THREE.CylinderGeometry(.24,.08,.22,32,1,true) : type==='Tumbler' ? new THREE.CylinderGeometry(.22,.18,.38,32,1,true) : new THREE.CylinderGeometry(.18,.15,.58,32,1,true);
  glassMesh=mesh(geo,mats.glass,[0,type==='Coupe'?.23:.28,0],drinkGlass); glassMesh.material.side=THREE.DoubleSide;
  const h=type==='Coupe'?.16:type==='Tumbler'?.31:.5; liquidMesh=mesh(new THREE.CylinderGeometry(type==='Coupe'?.19:.15,type==='Coupe'?.07:.13,h,28),new THREE.MeshPhysicalMaterial({color:0x1a3855,transparent:true,opacity:.72,roughness:.18}),[0,type==='Coupe'?.23:.26,0],drinkGlass); liquidMesh.scale.y=.05;
  if(type==='Coupe'){ mesh(new THREE.CylinderGeometry(.025,.025,.27,12),mats.glass,[0,.03,0],drinkGlass); mesh(new THREE.CylinderGeometry(.14,.14,.025,24),mats.glass,[0,-.11,0],drinkGlass); }
}
rebuildGlass();

// Guest
const guestRoot = new THREE.Group(); guestRoot.position.set(0,0,-2.45); scene.add(guestRoot);
function makeGuest(data){
  guestRoot.clear();
  const body=mesh(new THREE.CapsuleGeometry(.31,.67,8,20),new THREE.MeshStandardMaterial({color:data.outfit,roughness:.55}),[0,1.32,0],guestRoot);
  const neck=mesh(new THREE.CylinderGeometry(.105,.12,.16,18),new THREE.MeshStandardMaterial({color:data.color,roughness:.6}),[0,1.86,0],guestRoot);
  const head=mesh(new THREE.SphereGeometry(.255,32,24),new THREE.MeshStandardMaterial({color:data.color,roughness:.62}),[0,2.08,0],guestRoot);
  head.scale.set(.88,1.08,.9);
  const hair=mesh(new THREE.SphereGeometry(.27,28,20,0,Math.PI*2,0,Math.PI*.62),new THREE.MeshStandardMaterial({color:data.hair,roughness:.78}),[0,2.14,-.015],guestRoot); hair.scale.set(.94,1.05,.95);
  [-1,1].forEach(s=>{ mesh(new THREE.SphereGeometry(.024,12,8),new THREE.MeshStandardMaterial({color:0x17151d}),[s*.083,2.1,.225],guestRoot); });
  mesh(new THREE.TorusGeometry(.055,.012,8,18,Math.PI),new THREE.MeshStandardMaterial({color:0x8d3c45}),[0,2.0,.23],guestRoot).rotation.z=Math.PI;
  addLabel(data.name,[0,2.56,0],.14,'#ffc7f5',guestRoot);
}

const dialoguePanel = new THREE.Group(); dialoguePanel.position.set(0,2.65,-1.95); scene.add(dialoguePanel);
const panelBg=mesh(new RoundedBoxGeometry(2.5,.54,.055,5,.035),new THREE.MeshStandardMaterial({color:0x121629,roughness:.34,metalness:.35}),[0,0,0],dialoguePanel);
const dialogueLabel=addLabel('',[0,.09,.04],.105,'#ffffff',dialoguePanel);
const choiceA=button3D('Charmant antworten',[-.62,2.37,-1.94],()=>reply(true),1.08,0x773e8d);
const choiceB=button3D('Professionell bleiben',[.62,2.37,-1.94],()=>reply(false),1.08,0x354d72);

function updateDialogue(){
  const g=guests[state.guestIndex]; setSpriteText(dialogueLabel,g.lines[Math.min(state.dialogueStep,g.lines.length-1)],46);
  document.getElementById('guestName').textContent=g.name; document.getElementById('orderName').textContent=g.order;
}
function setSpriteText(sprite,text,size=50){ const c=sprite.material.map.image,x=c.getContext('2d'); x.clearRect(0,0,c.width,c.height); x.font=`700 ${size}px system-ui`; x.textAlign='center'; x.textBaseline='middle'; x.fillStyle='#fff'; const words=text.split(' '); let line='',lines=[]; for(const w of words){ const t=line+w+' '; if(x.measureText(t).width>700){lines.push(line);line=w+' ';}else line=t;} lines.push(line); lines.slice(0,2).forEach((l,i)=>x.fillText(l,384,70+i*62)); sprite.material.map.needsUpdate=true; }
function reply(flirty){ state.score+=flirty?18:10; state.dialogueStep=Math.min(2,state.dialogueStep+1); toast(flirty?'Charmant! +18':'Souverän. +10'); updateScore(); updateDialogue(); }
function selectGlass(name){ state.selectedGlass=name; state.glassContents=[]; state.ice=0; state.shaken=false; rebuildGlass(name); toast(`${name}-Glas gewählt`); }
function addIngredient(name){ if(!state.selectedGlass){toast('Wähle zuerst ein Glas.');return;} if(state.glassContents.length>=5){toast('Das Glas ist voll.');return;} state.glassContents.push(name); liquidMesh.scale.y=Math.min(1,.18+state.glassContents.length*.18); const palette={Orange:0xff8c27,Grenadine:0xd61f45,Vodka:0xdceafa,'Blue Curaçao':0x168be2,Limette:0x78b83b,Soda:0xc9e9f5,Beeren:0xa62963,Gin:0xaec5d9}; liquidMesh.material.color.lerp(new THREE.Color(palette[name]),.55); toast(`${name} hinzugefügt`); }
function addIce(){ if(!state.selectedGlass){toast('Wähle zuerst ein Glas.');return;} state.ice=Math.min(3,state.ice+1); for(let i=0;i<2;i++){ const cube=mesh(new RoundedBoxGeometry(.075,.075,.075,2,.012),mats.ice,[(Math.random()-.5)*.16,.18+Math.random()*.18,(Math.random()-.5)*.12],drinkGlass); cube.rotation.set(Math.random(),Math.random(),Math.random()); } toast('Eis hinzugefügt'); }
function shake(){ if(state.glassContents.length<2){toast('Noch zu wenig im Glas.');return;} state.shaken=true; toast('Perfekt geschüttelt!'); }
function serve(){ const g=guests[state.guestIndex],r=recipes[g.order]; if(!state.selectedGlass){toast('Du brauchst einen Drink.');return;} let pts=0; pts+=state.selectedGlass===r.glass?25:0; const correct=state.glassContents.filter(x=>r.ingredients.includes(x)).length; const wrong=state.glassContents.length-correct; pts+=correct*18-wrong*8; pts+=Math.max(0,15-Math.abs(state.ice-r.ice)*8); pts+=state.shaken?10:0; pts=Math.max(0,pts); state.score+=pts; updateScore(); toast(`${g.name}: ${pts>=85?'Fantastisch!':pts>=55?'Sehr gut!':'Da ist Luft nach oben.'} +${pts}`); setTimeout(nextGuest,1500); }
function nextGuest(){ state.guestIndex=(state.guestIndex+1)%guests.length; state.dialogueStep=0; state.selectedGlass=null; state.glassContents=[]; state.ice=0; state.shaken=false; rebuildGlass(); makeGuest(guests[state.guestIndex]); updateDialogue(); }
function updateScore(){ document.getElementById('score').textContent=state.score; }
let toastTimer; function toast(t){ const e=document.getElementById('toast'); e.textContent=t; e.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>e.classList.remove('show'),1800); }

makeGuest(guests[0]); updateDialogue();

// Controllers
const controllerModelFactory = new XRControllerModelFactory();
for(let i=0;i<2;i++){
  const c=renderer.xr.getController(i); c.addEventListener('selectstart',()=>selectFrom(c)); scene.add(c);
  const line=mesh(new THREE.CylinderGeometry(.002,.002,4,8),new THREE.MeshBasicMaterial({color:0x82dfff}),[0,0,-2],c); line.rotation.x=Math.PI/2;
  const grip=renderer.xr.getControllerGrip(i); grip.add(controllerModelFactory.createControllerModel(grip)); scene.add(grip);
}
function selectFrom(controller){ const origin=new THREE.Vector3(),dir=new THREE.Vector3(0,0,-1); controller.getWorldPosition(origin); dir.applyQuaternion(controller.getWorldQuaternion(new THREE.Quaternion())); raycaster.set(origin,dir); activateHit(raycaster.intersectObjects(interactables,false)); }
function activateHit(hits){ if(hits.length){ const obj=hits[0].object; obj.userData.action?.(); obj.scale.set(.94,.94,.94); setTimeout(()=>obj.scale.set(1,1,1),110); } }
addEventListener('pointermove',e=>{ mouse.x=e.clientX/innerWidth*2-1; mouse.y=-(e.clientY/innerHeight)*2+1; });
addEventListener('pointerdown',()=>{ if(!state.open)return; raycaster.setFromCamera(mouse,camera); activateHit(raycaster.intersectObjects(interactables,false)); });
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

document.getElementById('start').addEventListener('click',()=>{state.open=true;document.getElementById('loading').classList.add('hidden');toast('Die Bar ist geöffnet.');});

renderer.setAnimationLoop(()=>{
  const t=clock.getElapsedTime();
  guestRoot.position.y=Math.sin(t*1.2)*.012;
  dialoguePanel.position.y=2.65+Math.sin(t*.9)*.018;
  drinkGlass.rotation.y=Math.sin(t*.8)*.03;
  interactables.forEach(o=>{ if(o.parent) o.parent.rotation.x=Math.sin(t*1.3+o.parent.position.x)*.012; });
  renderer.render(scene,camera);
});

import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

const recipes={
 'Velvet Sunset':{glass:'Highball',ice:2,ingredients:['Vodka','Orange','Grenadine'],method:'Shaken',color:'#d85e34'},
 'Blue Reverie':{glass:'Coupe',ice:1,ingredients:['Gin','Blue Curaçao','Limette'],method:'Shaken',color:'#2778a4'},
 'Rose After Dark':{glass:'Tumbler',ice:2,ingredients:['Gin','Beeren','Limette'],method:'Shaken',color:'#9c3555'}
};
const guests=[
 {name:'Maya',order:'Velvet Sunset',accent:'#9b4539',lines:['„Ein Velvet Sunset, bitte. Überrasche mich.“','„Du wirkst sehr konzentriert. Ist das Leidenschaft oder Perfektionismus?“','„Ich mag Menschen, die zuhören können.“'],choices:[['Leidenschaft. Perfektion kommt hoffentlich ins Glas.','Bei guten Gästen nehme ich mir gern Zeit.'],['Ein bisschen von beidem. Was beeindruckt dich mehr?','Das Rezept entscheidet. Ich halte mich daran.'],['Dann erzähl mir, was deinen Abend besonders machen würde.','Ich merke mir Wünsche. Das gehört zum Handwerk.']]},
 {name:'Elena',order:'Blue Reverie',accent:'#315b72',lines:['„Für mich eine Blue Reverie. Trocken und elegant.“','„Die Bar hat Stil. Bist du auch Teil des Konzepts?“','„Du hast eine angenehm ruhige Art.“'],choices:[['Nur an meinen besten Abenden. Heute sieht es gut aus.','Ich sorge dafür, dass das Konzept funktioniert.'],['Ich könnte dir die Hausführung nach Feierabend geben.','Stil ist vor allem Aufmerksamkeit fürs Detail.'],['Ruhe hilft beim Mixen — und beim Zuhören.','Danke. Dein Drink ist gleich fertig.']]},
 {name:'Sofia',order:'Rose After Dark',accent:'#77324a',lines:['„Rose After Dark. Nicht zu süß.“','„Ich bewerte Bars nach Drinks und Barkeeper nach Humor.“','„Okay, du sammelst gerade Pluspunkte.“'],choices:[['Dann hoffe ich, dass beides heute fünf Sterne bekommt.','Beim Drink kann ich Präzision garantieren.'],['Mein Humor ist trocken. Genau wie dein nächster Drink.','Ich konzentriere mich lieber auf die Balance.'],['Die nehme ich gern — zusammen mit ehrlichem Feedback.','Dann bleiben wir professionell erfolgreich.']]}
];
const ingredientColors={'Vodka':'#d9e2e5','Orange':'#df8737','Grenadine':'#a91f37','Gin':'#b8ced2','Blue Curaçao':'#237fb5','Limette':'#75a944','Beeren':'#a3315b'};
const allIngredients=Object.keys(ingredientColors);
const GAME_VERSION='0.3.0';
const state={score:0,guest:0,dialogue:0,glass:null,ingredients:[],ice:0,shaken:false,started:false,selectedRecipe:'Velvet Sunset'};
let vrUI=null;

const scene=new THREE.Scene();scene.background=new THREE.Color(0x090807);scene.fog=new THREE.FogExp2(0x120c09,.032);
const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.05,70);camera.position.set(0,2.05,5.7);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');document.body.prepend(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.55,-1.2);controls.enablePan=false;controls.minDistance=3.8;controls.maxDistance=7.5;controls.minPolarAngle=.95;controls.maxPolarAngle=1.55;controls.enableDamping=true;

const vrButton=VRButton.createButton(renderer,{optionalFeatures:['local-floor','bounded-floor','hand-tracking']});vrButton.style.cssText+=';z-index:60;right:24px;bottom:24px;display:none';document.body.appendChild(vrButton);

const mat=(color,rough=.5,metal=.1)=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
const box=(s,p,m,parent=scene)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(...s),m);o.position.set(...p);o.castShadow=o.receiveShadow=true;parent.add(o);return o};
const cyl=(r1,r2,h,p,m,parent=scene)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,32),m);o.position.set(...p);o.castShadow=o.receiveShadow=true;parent.add(o);return o};

// Architectural shell
box([16,.18,16],[0,-.08,0],mat(0x17120f,.78));
box([16,6,.18],[0,3,-5.2],mat(0x18110d,.82));
box([.18,6,12],[-8,3,.5],mat(0x110f0e,.85));box([.18,6,12],[8,3,.5],mat(0x110f0e,.85));
for(let i=-5;i<=5;i++){box([.05,4.8,.16],[i*1.25,3,-5.08],mat(i%2?0x2a1b15:0x20140f,.7));}
// Back bar
box([7.5,.16,.65],[0,1.4,-4.62],mat(0x3a2116,.28));box([7.5,.09,.7],[0,1.5,-4.62],mat(0xb08043,.22,.72));
for(let y of [2.0,2.72,3.44]){box([7.4,.08,.35],[0,y,-4.75],mat(0x9b713e,.25,.55));}
const bottleCols=[0x5e241c,0x37593e,0x92702d,0x244c5c,0x7b303e,0x6b5a28];
for(let row=0;row<3;row++)for(let i=0;i<13;i++){const x=-3.45+i*.57;const h=.34+((i*7+row*3)%5)*.035;const b=cyl(.055,.075,h,[x,1.75+row*.72,-4.55],new THREE.MeshPhysicalMaterial({color:bottleCols[(i+row)%bottleCols.length],roughness:.18,transmission:.13,thickness:.1}));cyl(.025,.025,.11,[x,b.position.y+h/2+.055,-4.55],mat(0xb68a55,.25,.7));}
// Mirror and logo
const mirror=new THREE.Mesh(new THREE.PlaneGeometry(6.6,2.45),new THREE.MeshPhysicalMaterial({color:0x6b5e52,metalness:.92,roughness:.18}));mirror.position.set(0,3.05,-5.03);scene.add(mirror);
// Counter
box([8.6,.22,1.6],[0,1.08,-.4],mat(0x4a2819,.24));box([8.75,.075,1.7],[0,1.23,-.4],mat(0xb88a52,.16,.72));box([8.45,1.05,.12],[0,.57,.36],mat(0x17110e,.48,.18));
for(let i=-3;i<=3;i++) box([.08,.8,.08],[i*1.15,.62,.42],mat(0xc09a60,.19,.75));
// Hanging lights
for(let i=-2;i<=2;i++){cyl(.012,.012,1.2,[i*1.55,4.45,-.7],mat(0x241a15,.3,.7));const shade=cyl(.28,.1,.28,[i*1.55,3.82,-.7],mat(0x211612,.3,.65));const l=new THREE.PointLight(0xffc787,5.2,4.8,1.7);l.position.set(i*1.55,3.62,-.7);scene.add(l);}
scene.add(new THREE.HemisphereLight(0x786c62,0x24140e,1.15));const key=new THREE.SpotLight(0xffd0a0,42,12,Math.PI/5,.6,1.4);key.position.set(0,6,3);key.target.position.set(0,1.5,-2.5);key.castShadow=true;scene.add(key,key.target);const rim=new THREE.SpotLight(0xa95f55,28,9,Math.PI/4,.7,1.3);rim.position.set(-4,4,-2);rim.target.position.set(0,1.7,-2.7);scene.add(rim,rim.target);

// Decorative foreground objects
for(let i=0;i<5;i++){const g=cyl(.12,.1,.34,[-2.8+i*.42,1.46,-.05],new THREE.MeshPhysicalMaterial({color:0xdde7e4,transparent:true,opacity:.28,roughness:.07,transmission:.8,thickness:.08}));}
box([.7,.06,.45],[2.7,1.38,-.05],mat(0x6a3c22,.4));

// Stylized guest with layered materials
const guestRoot=new THREE.Group();guestRoot.position.set(0,0,-2.75);scene.add(guestRoot);
function buildGuest(g){guestRoot.clear();const skin=mat(0xc88e70,.58);const dress=mat(parseInt(g.accent.slice(1),16),.35,.08);const body=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.72,8,24),dress);body.position.set(0,1.35,0);body.castShadow=true;guestRoot.add(body);const neck=cyl(.10,.12,.18,[0,1.89,0],skin,guestRoot);const head=new THREE.Mesh(new THREE.SphereGeometry(.255,40,32),skin);head.scale.set(.88,1.08,.92);head.position.set(0,2.13,0);head.castShadow=true;guestRoot.add(head);const hair=new THREE.Mesh(new THREE.SphereGeometry(.285,36,24,0,Math.PI*2,0,Math.PI*.68),mat(0x21140f,.7));hair.position.set(0,2.19,-.015);hair.scale.set(.98,1.05,.98);guestRoot.add(hair);for(const s of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.018,12,8),mat(0x1a1311,.35));eye.position.set(s*.078,2.15,.229);guestRoot.add(eye);}const mouth=new THREE.Mesh(new THREE.TorusGeometry(.047,.009,8,18,Math.PI),mat(0x7d3540,.4));mouth.position.set(0,2.045,.225);mouth.rotation.z=Math.PI;guestRoot.add(mouth);for(const s of [-1,1]){const arm=cyl(.085,.075,.58,[s*.39,1.42,0],skin,guestRoot);arm.rotation.z=s*.22;}}

// 3D drink display
const drinkRoot=new THREE.Group();drinkRoot.position.set(0,1.25,-.22);scene.add(drinkRoot);let liquid;
function rebuildDrink(){drinkRoot.clear();const type=state.glass||'Highball';const glassMat=new THREE.MeshPhysicalMaterial({color:0xe8f3ef,transparent:true,opacity:.34,roughness:.06,transmission:.9,thickness:.08,side:THREE.DoubleSide});let h=.5,r=.16;if(type==='Tumbler'){h=.34;r=.21}if(type==='Coupe'){h=.2;r=.24}const shell=new THREE.Mesh(new THREE.CylinderGeometry(type==='Coupe'?r:.92*r,type==='Coupe'?.07:r*.82,h,40,1,true),glassMat);shell.position.y=h/2+.02;drinkRoot.add(shell);liquid=new THREE.Mesh(new THREE.CylinderGeometry(type==='Coupe'?r*.8:r*.8,type==='Coupe'?.06:r*.7,h*.72,36),new THREE.MeshPhysicalMaterial({color:0xbe713b,roughness:.18,transparent:true,opacity:.78}));liquid.position.y=h*.37+.02;liquid.scale.y=Math.max(.03,state.ingredients.length/4);drinkRoot.add(liquid);if(type==='Coupe'){cyl(.022,.022,.24,[0,-.09,0],glassMat,drinkRoot);cyl(.13,.13,.025,[0,-.22,0],glassMat,drinkRoot);}for(let i=0;i<state.ice;i++)for(let j=0;j<2;j++){const cube=box([.07,.07,.07],[(Math.random()-.5)*.14,.12+i*.055,(Math.random()-.5)*.1],new THREE.MeshPhysicalMaterial({color:0xcfe8e7,transmission:.6,transparent:true,opacity:.7,roughness:.12}),drinkRoot);cube.rotation.set(Math.random(),Math.random(),Math.random())}if(state.ingredients.length){const last=state.ingredients.at(-1);liquid.material.color.set(ingredientColors[last]);}}

function renderUI(){const g=guests[state.guest];document.getElementById('guestName').textContent=g.name;document.getElementById('orderName').textContent=g.order;document.getElementById('score').textContent=String(state.score).padStart(4,'0');document.getElementById('guestCardName').textContent=g.name;document.getElementById('guestInitial').textContent=g.name[0];document.getElementById('guestAvatar').style.background=`radial-gradient(circle at 50% 28%,#d3a37e 0 17%,transparent 18%),radial-gradient(ellipse at 50% 50%,#261713 0 38%,transparent 39%),linear-gradient(145deg,${g.accent},#17100e)`;document.getElementById('guestLine').textContent=g.lines[state.dialogue];const choices=document.getElementById('dialogueChoices');choices.innerHTML='';g.choices[state.dialogue].forEach((text,i)=>{const b=document.createElement('button');b.className='choice-btn';b.textContent=text;b.onclick=()=>chooseDialogue(i===0);choices.appendChild(b)});renderRecipe();renderStation();updateVRUI();}
function renderRecipe(){const tabs=document.getElementById('recipeTabs');tabs.innerHTML='';Object.keys(recipes).forEach(n=>{const b=document.createElement('button');b.className='recipe-tab'+(n===state.selectedRecipe?' active':'');b.textContent=n;b.onclick=()=>{state.selectedRecipe=n;renderRecipe()};tabs.appendChild(b)});const r=recipes[state.selectedRecipe];document.getElementById('recipeDetail').innerHTML=`<h4>${state.selectedRecipe}</h4><ol>${r.ingredients.map(x=>`<li>${x}</li>`).join('')}<li>${r.ice} Portion${r.ice>1?'en':''} Eis</li><li>${r.method}</li></ol><div class="recipe-meta"><span>${r.glass}</span><span>${r.method}</span></div>`}
function renderStation(){document.querySelectorAll('[data-glass]').forEach(b=>b.classList.toggle('active',b.dataset.glass===state.glass));document.querySelectorAll('[data-ingredient]').forEach(b=>b.classList.toggle('active',state.ingredients.includes(b.dataset.ingredient)));document.getElementById('shakeBtn').classList.toggle('active',state.shaken);document.getElementById('glassStatus').textContent=state.glass?`${state.glass} · ${state.ice}× Eis`:'Noch kein Glas gewählt';document.getElementById('contentsStatus').textContent=state.ingredients.length?state.ingredients.join(' · '):'Dein Drink ist leer.';document.getElementById('liquidPreview').style.height=`${Math.min(88,state.ingredients.length*24)}%`;document.getElementById('liquidPreview').style.background=state.ingredients.length?ingredientColors[state.ingredients.at(-1)]:'#be6d38';document.getElementById('icePreview').style.opacity=state.ice?1:0;document.getElementById('qualityPill').textContent=state.shaken?'GESHAKT':state.ingredients.length?'IM AUFBAU':'BEREIT';rebuildDrink();}
function setupButtons(){const gb=document.getElementById('glassButtons');['Highball','Coupe','Tumbler'].forEach((n,i)=>{const b=document.createElement('button');b.className='tool-btn';b.dataset.glass=n;b.innerHTML=`<span>${['▯','▽','▱'][i]}</span>${n}`;b.onclick=()=>{state.glass=n;renderStation();toast(`${n} gewählt`)};gb.appendChild(b)});const ib=document.getElementById('ingredientButtons');allIngredients.forEach(n=>{const b=document.createElement('button');b.className='tool-btn';b.dataset.ingredient=n;b.innerHTML=`<span>●</span>${n}`;b.querySelector('span').style.color=ingredientColors[n];b.onclick=()=>addIngredient(n);ib.appendChild(b)});document.getElementById('iceBtn').onclick=()=>{if(!state.glass)return toast('Wähle zuerst ein Glas.');state.ice=Math.min(3,state.ice+1);renderStation();toast('Eis hinzugefügt')};document.getElementById('shakeBtn').onclick=()=>{if(state.ingredients.length<2)return toast('Mindestens zwei Zutaten nötig.');state.shaken=true;renderStation();toast('Sauber geschüttelt')};document.getElementById('serveBtn').onclick=serve;document.getElementById('resetDrink').onclick=resetDrink;document.getElementById('nextGuestBtn').onclick=nextGuest;}
function addIngredient(n){if(!state.glass)return toast('Wähle zuerst ein Glas.');if(state.ingredients.length>=5)return toast('Das Glas ist voll.');state.ingredients.push(n);renderStation();toast(`${n} hinzugefügt`)}
function chooseDialogue(charming){state.score+=charming?16:10;state.dialogue=Math.min(2,state.dialogue+1);renderUI();toast(charming?'Charmant · +16':'Professionell · +10')}
function resetDrink(){state.glass=null;state.ingredients=[];state.ice=0;state.shaken=false;renderStation();toast('Station zurückgesetzt')}
function serve(){const g=guests[state.guest],r=recipes[g.order];if(!state.glass||!state.ingredients.length)return toast('Der Drink ist noch nicht fertig.');const glass=state.glass===r.glass?20:0;const correct=r.ingredients.filter(x=>state.ingredients.includes(x)).length*18;const wrong=state.ingredients.filter(x=>!r.ingredients.includes(x)).length*-9;const ice=Math.max(0,14-Math.abs(state.ice-r.ice)*7);const method=state.shaken?12:0;const total=Math.max(0,glass+correct+wrong+ice+method);state.score+=total;document.getElementById('resultTitle').textContent=total>=90?'Außergewöhnlich.':total>=65?'Sehr gelungen.':'Noch nicht ganz rund.';document.getElementById('resultScore').textContent=`+${total}`;document.getElementById('resultBreakdown').innerHTML=`<div><span>Glas</span><b>+${glass}</b></div><div><span>Zutaten</span><b>${correct+wrong>=0?'+':''}${correct+wrong}</b></div><div><span>Eis</span><b>+${ice}</b></div><div><span>Technik</span><b>+${method}</b></div>`;document.getElementById('resultModal').classList.remove('hidden');showVRResult(total,{glass,ingredients:correct+wrong,ice,method});renderUI()}
function nextGuest(){document.getElementById('resultModal').classList.add('hidden');if(vrUI?.resultPanel)vrUI.resultPanel.visible=false;state.guest=(state.guest+1)%guests.length;state.dialogue=0;state.selectedRecipe=guests[state.guest].order;resetDrink();buildGuest(guests[state.guest]);renderUI()}
let tt;function toast(t){const e=document.getElementById('toast');e.textContent=t;e.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('show'),1500)}
function start(desktop=true){state.started=true;document.getElementById('intro').classList.add('hidden');document.querySelectorAll('.game-ui').forEach(e=>e.classList.remove('hidden'));if(!desktop){vrButton.style.display='block';toast('Klicke unten rechts auf ENTER VR.')}renderUI()}
document.getElementById('desktopStart').onclick=()=>start(true);document.getElementById('vrStart').onclick=()=>start(false);addEventListener('keydown',e=>{if(e.key.toLowerCase()==='h')document.querySelectorAll('.game-ui').forEach(x=>x.classList.toggle('hidden'))});
setupButtons();buildGuest(guests[0]);rebuildDrink();renderUI();

// Quest controller ray; desktop uses the full DOM UI.
// Full Quest interaction layer: two controller rays, large spatial UI, haptics and hover feedback.
const raycaster=new THREE.Raycaster();
const interactive=[];
const controllers=[];
const cmf=new XRControllerModelFactory();
const tempMatrix=new THREE.Matrix4();
const desktopCamera={position:camera.position.clone(),target:controls.target.clone()};

function canvasTexture(width=1024,height=256){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return {canvas,ctx:canvas.getContext('2d'),texture};
}
function roundedRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.closePath()}
function drawTextTexture(target,{title='',subtitle='',accent='#cda769',background='#171310',center=false}={}){
  const {canvas,ctx,texture}=target;ctx.clearRect(0,0,canvas.width,canvas.height);
  const grad=ctx.createLinearGradient(0,0,canvas.width,canvas.height);grad.addColorStop(0,background);grad.addColorStop(1,'#090807');
  roundedRect(ctx,5,5,canvas.width-10,canvas.height-10,30);ctx.fillStyle=grad;ctx.fill();ctx.strokeStyle='rgba(244,234,216,.2)';ctx.lineWidth=5;ctx.stroke();
  ctx.textAlign=center?'center':'left';ctx.textBaseline='middle';const x=center?canvas.width/2:42;
  ctx.fillStyle=accent;ctx.font='700 26px Arial';ctx.fillText(subtitle.toUpperCase(),x,52);
  ctx.fillStyle='#f4ead8';ctx.font='700 48px Arial';
  const words=title.split(' ');let line='',lines=[];for(const word of words){const test=line?line+' '+word:word;if(ctx.measureText(test).width>canvas.width-84&&line){lines.push(line);line=word}else line=test}if(line)lines.push(line);
  lines.slice(0,2).forEach((l,i)=>ctx.fillText(l,x,120+i*55));texture.needsUpdate=true;
}
function makePanel(size,pos,rotation=[0,0,0],color=0x171310){
  const group=new THREE.Group();group.position.set(...pos);group.rotation.set(...rotation);vrUI.root.add(group);
  const back=box([size[0]+.06,size[1]+.06,.055],[0,0,-.035],mat(0x070605,.32,.5),group);
  const face=box([size[0],size[1],.045],[0,0,0],mat(color,.28,.18),group);face.receiveShadow=true;return group;
}
function makeVRButton(label,pos,size,action,parent,options={}){
  const group=new THREE.Group();group.position.set(...pos);parent.add(group);
  const material=new THREE.MeshStandardMaterial({color:options.color||0x302018,roughness:.28,metalness:.38,emissive:0x000000});
  const hit=box([size[0],size[1],.075],[0,0,0],material,group);
  const tex=canvasTexture(768,256);drawTextTexture(tex,{title:label,subtitle:options.subtitle||'',accent:options.accent||'#cda769',background:options.background||'#241812',center:true});
  const face=new THREE.Mesh(new THREE.PlaneGeometry(size[0]*.94,size[1]*.82),new THREE.MeshBasicMaterial({map:tex.texture,transparent:true}));face.position.z=.041;group.add(face);
  const data={group,hit,face,tex,label,action,baseScale:1,disabled:false,active:false};
  hit.userData.vrButton=data;interactive.push(hit);vrUI.buttons.push(data);return data;
}
function setVRButtonText(button,label,subtitle=''){
  button.label=label;drawTextTexture(button.tex,{title:label,subtitle,accent:button.active?'#f4ead8':'#cda769',background:button.active?'#6a4a25':'#241812',center:true});
}
function setVRButtonActive(button,active){button.active=active;button.hit.material.color.set(active?0x8d6737:0x302018);button.hit.material.emissive.set(active?0x211407:0x000000);setVRButtonText(button,button.label,active?'AUSGEWÄHLT':'')}
function makeInfoScreen(parent,pos,size){
  const tex=canvasTexture(1100,720);const mesh=new THREE.Mesh(new THREE.PlaneGeometry(...size),new THREE.MeshBasicMaterial({map:tex.texture}));mesh.position.set(...pos);mesh.position.z=.041;parent.add(mesh);return {mesh,tex};
}
function drawInfo(screen,title,kicker,lines,accent='#cda769'){
  const {canvas,ctx,texture}=screen.tex;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#100d0b';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='rgba(244,234,216,.18)';ctx.lineWidth=5;ctx.strokeRect(5,5,canvas.width-10,canvas.height-10);
  ctx.fillStyle=accent;ctx.font='700 30px Arial';ctx.fillText(kicker.toUpperCase(),54,65);
  ctx.fillStyle='#f4ead8';ctx.font='700 62px Georgia';ctx.fillText(title,54,145);
  ctx.font='34px Arial';ctx.fillStyle='#d4c8ba';let y=225;
  for(const line of lines){const words=line.split(' ');let row='';for(const word of words){const test=row?row+' '+word:word;if(ctx.measureText(test).width>canvas.width-108&&row){ctx.fillText(row,54,y);y+=48;row=word}else row=test}if(row){ctx.fillText(row,54,y);y+=48}y+=10}
  ctx.fillStyle='rgba(205,167,105,.16)';ctx.fillRect(54,canvas.height-84,canvas.width-108,2);ctx.fillStyle='#8f8376';ctx.font='700 22px Arial';ctx.fillText(`VELVET HOUR · v${GAME_VERSION}`,54,canvas.height-42);texture.needsUpdate=true;
}
function buildVRUI(){
  vrUI={root:new THREE.Group(),buttons:[],glassButtons:{},ingredientButtons:{},dialogueButtons:[],screens:{}};scene.add(vrUI.root);vrUI.root.visible=false;
  // Floating panels form a semicircle around the bartender, all comfortably reachable by ray.
  const recipePanel=makePanel([1.15,1.18],[-1.48,1.72,-.15],[0,.24,0]);
  vrUI.screens.recipe=makeInfoScreen(recipePanel,[0,.17,0],[1.05,.76]);
  const recipeNames=Object.keys(recipes);recipeNames.forEach((n,i)=>makeVRButton(n,[0,-.42+i*.22,.05],[1.02,.17],()=>{state.selectedRecipe=n;renderUI();toast(`${n} geöffnet`)},recipePanel,{subtitle:'REZEPT'}));

  const dialoguePanel=makePanel([1.25,1.18],[1.48,1.72,-.15],[0,-.24,0]);
  vrUI.screens.guest=makeInfoScreen(dialoguePanel,[0,.2,0],[1.14,.7]);
  vrUI.dialogueButtons.push(makeVRButton('Antwort A',[0,-.34,.05],[1.1,.2],()=>chooseDialogue(true),dialoguePanel,{subtitle:'CHARMANT'}));
  vrUI.dialogueButtons.push(makeVRButton('Antwort B',[0,-.58,.05],[1.1,.2],()=>chooseDialogue(false),dialoguePanel,{subtitle:'PROFESSIONELL'}));

  const stationPanel=makePanel([2.55,1.26],[0,1.18,.14],[-.1,0,0],0x15110e);
  // Glasses
  ['Highball','Coupe','Tumbler'].forEach((n,i)=>{vrUI.glassButtons[n]=makeVRButton(n,[-.83+i*.42,.42,.05],[.37,.2],()=>{state.glass=n;renderStation();updateVRUI();toast(`${n} gewählt`)},stationPanel,{subtitle:'GLAS'})});
  // Ingredients
  allIngredients.forEach((n,i)=>{const col=i%4,row=Math.floor(i/4);vrUI.ingredientButtons[n]=makeVRButton(n,[-.92+col*.61,.08-row*.25,.05],[.55,.2],()=>addIngredient(n),stationPanel,{subtitle:'ZUTAT',accent:ingredientColors[n]})});
  vrUI.iceButton=makeVRButton('Eis',[-.83,-.48,.05],[.42,.22],()=>document.getElementById('iceBtn').click(),stationPanel,{subtitle:'FINISH'});
  vrUI.shakeButton=makeVRButton('Shaken',[-.31,-.48,.05],[.52,.22],()=>document.getElementById('shakeBtn').click(),stationPanel,{subtitle:'TECHNIK'});
  vrUI.resetButton=makeVRButton('Leeren',[.31,-.48,.05],[.52,.22],resetDrink,stationPanel,{subtitle:'RESET'});
  vrUI.serveButton=makeVRButton('Servieren',[.88,-.48,.05],[.52,.22],serve,stationPanel,{subtitle:'FERTIG',color:0x8d6737});
  vrUI.screens.status=makeInfoScreen(stationPanel,[0,.75,0],[2.42,.25]);
  vrUI.resultPanel=makePanel([1.5,1.15],[0,1.8,.72],[0,0,0],0x130f0c);vrUI.resultPanel.position.z=.55;vrUI.resultPanel.visible=false;
  vrUI.screens.result=makeInfoScreen(vrUI.resultPanel,[0,.16,0],[1.38,.72]);
  vrUI.nextButton=makeVRButton('Nächster Gast',[0,-.43,.05],[1.22,.24],nextGuest,vrUI.resultPanel,{subtitle:'WEITER',color:0x8d6737});
} 
function showVRResult(total,parts){
  if(!vrUI||!renderer.xr.isPresenting)return;vrUI.resultPanel.visible=true;
  drawInfo(vrUI.screens.result,total>=90?'Außergewöhnlich':total>=65?'Sehr gelungen':'Weiter üben',`+${total} PUNKTE`,[`Glas +${parts.glass} · Zutaten ${parts.ingredients>=0?'+':''}${parts.ingredients}`,`Eis +${parts.ice} · Technik +${parts.method}`]);
}
function updateVRUI(){
  if(!vrUI)return;const guest=guests[state.guest];const recipe=recipes[state.selectedRecipe];
  drawInfo(vrUI.screens.recipe,state.selectedRecipe,'BAR BOOK',[`${recipe.glass} · ${recipe.ice}× Eis · ${recipe.method}`,recipe.ingredients.join('  ·  ')],recipe.color);
  drawInfo(vrUI.screens.guest,guest.name,`BESTELLT: ${guest.order}`,[guest.lines[state.dialogue]],guest.accent);
  const choiceSet=guest.choices[state.dialogue];setVRButtonText(vrUI.dialogueButtons[0],choiceSet[0],'CHARMANT');setVRButtonText(vrUI.dialogueButtons[1],choiceSet[1],'PROFESSIONELL');
  Object.entries(vrUI.glassButtons).forEach(([n,b])=>setVRButtonActive(b,state.glass===n));
  Object.entries(vrUI.ingredientButtons).forEach(([n,b])=>setVRButtonActive(b,state.ingredients.includes(n)));
  setVRButtonActive(vrUI.shakeButton,state.shaken);
  const content=state.ingredients.length?state.ingredients.join(' · '):'Noch leer';
  drawInfo(vrUI.screens.status,state.glass||'Arbeitsstation',`${state.ice}× EIS · ${state.shaken?'GESHAKT':'NICHT GESHAKT'}`,[content]);
}
function pulse(inputSource,strength=.35,duration=35){const actuator=inputSource?.gamepad?.hapticActuators?.[0];actuator?.pulse?.(strength,duration).catch?.(()=>{})}
function activateController(controller,event){
  tempMatrix.identity().extractRotation(controller.matrixWorld);raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);raycaster.ray.direction.set(0,0,-1).applyMatrix4(tempMatrix);
  const hit=raycaster.intersectObjects(interactive,false)[0];const data=hit?.object?.userData?.vrButton;if(!data||data.disabled)return;
  pulse(event.data?.inputSource,.55,55);data.group.scale.set(.94,.94,.94);setTimeout(()=>data.group.scale.set(1,1,1),90);data.action();
}
for(let i=0;i<2;i++){
  const c=renderer.xr.getController(i);c.userData.index=i;c.addEventListener('selectstart',e=>activateController(c,e));scene.add(c);
  const lineGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-5)]);const line=new THREE.Line(lineGeo,new THREE.LineBasicMaterial({color:0xd6b074,transparent:true,opacity:.85}));line.name='ray';c.add(line);
  const cursor=new THREE.Mesh(new THREE.RingGeometry(.008,.014,24),new THREE.MeshBasicMaterial({color:0xf4ead8,side:THREE.DoubleSide}));cursor.position.z=-4.99;cursor.rotation.x=Math.PI;line.add(cursor);
  const grip=renderer.xr.getControllerGrip(i);grip.add(cmf.createControllerModel(grip));scene.add(grip);controllers.push(c);
}
buildVRUI();updateVRUI();
renderer.xr.addEventListener('sessionstart',()=>{
  document.querySelectorAll('.game-ui').forEach(e=>e.classList.add('hidden'));document.getElementById('intro').classList.add('hidden');
  vrUI.root.visible=true;camera.position.set(0,0,1.75);camera.rotation.set(0,0,0);controls.enabled=false;
});
renderer.xr.addEventListener('sessionend',()=>{
  vrUI.root.visible=false;camera.position.copy(desktopCamera.position);controls.target.copy(desktopCamera.target);controls.enabled=true;
  if(state.started)document.querySelectorAll('.game-ui').forEach(e=>e.classList.remove('hidden'));
});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
const clock=new THREE.Clock();renderer.setAnimationLoop(()=>{
  const t=clock.getElapsedTime();controls.enabled=!renderer.xr.isPresenting;controls.update();guestRoot.position.y=Math.sin(t*1.1)*.012;guestRoot.rotation.y=Math.sin(t*.45)*.025;drinkRoot.rotation.y=Math.sin(t*.7)*.035;
  if(renderer.xr.isPresenting){
    for(const c of controllers){tempMatrix.identity().extractRotation(c.matrixWorld);raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);raycaster.ray.direction.set(0,0,-1).applyMatrix4(tempMatrix);const hit=raycaster.intersectObjects(interactive,false)[0];const hovered=hit?.object?.userData?.vrButton;
      for(const b of vrUI.buttons){const active=b===hovered;b.hit.material.emissive.set(active?0x3b260d:(b.active?0x211407:0x000000));b.group.scale.lerp(new THREE.Vector3(active?1.035:1,active?1.035:1,active?1.035:1),.22)}
      const line=c.getObjectByName('ray');if(line){line.scale.z=hit?Math.max(.12,hit.distance/5):1;line.material.color.set(hit?0xf4ead8:0xd6b074)}
    }
  }
  renderer.render(scene,camera)
});

(() => {
  "use strict";

  const VERSION = "0.6.0";
  const $ = id => document.getElementById(id);

  const recipes = [
    {
      name:"Neon Veil",
      desc:"Kühl, elektrisch und leicht bitter.",
      glass:"highball",
      ice:4,
      shake:true,
      ingredients:{"Synth Gin":45,"Blue Citrus":25,"Tonic-X":60}
    },
    {
      name:"Chrome Kiss",
      desc:"Trocken, leuchtend und elegant.",
      glass:"coupe",
      ice:2,
      shake:true,
      ingredients:{"Vodka-9":50,"Lychee Core":30,"Pulse Lime":15}
    },
    {
      name:"Black Circuit",
      desc:"Dunkel, würzig und schwer.",
      glass:"tumbler",
      ice:3,
      shake:false,
      ingredients:{"Night Rum":50,"Cola Noir":70,"Bitters":5}
    }
  ];

  const guests = [
    {name:"VALENCIA", line:"„Mach mir einen Neon Veil. Nicht zu süß.“", recipe:0},
    {name:"AKARI", line:"„Chrome Kiss. Präzise, kalt, sauber.“", recipe:1},
    {name:"MARA-7", line:"„Black Circuit. Keine Experimente.“", recipe:2}
  ];

  const ingredientColors = {
    "Synth Gin":new BABYLON.Color3(.30,.78,1),
    "Blue Citrus":new BABYLON.Color3(.06,.31,1),
    "Tonic-X":new BABYLON.Color3(.66,.94,1),
    "Vodka-9":new BABYLON.Color3(.80,.94,1),
    "Lychee Core":new BABYLON.Color3(1,.22,.64),
    "Pulse Lime":new BABYLON.Color3(.28,1,.38),
    "Night Rum":new BABYLON.Color3(.24,.025,.018),
    "Cola Noir":new BABYLON.Color3(.10,.018,.012),
    "Bitters":new BABYLON.Color3(.93,.16,.02)
  };

  let engine, scene, camera, xrHelper;
  let score = 0;
  let guestIndex = 0;
  let recipeIndex = 0;
  let busy = false;
  let selectedGlass = "highball";

  const shaker = {amounts:{}, total:0, ice:0, shaken:false};
  const glass = {amounts:{}, total:0, ice:0, type:"highball"};

  let shakerRoot, shakerBody, shakerLiquid, shakerLid;
  let glassRoot, glassLiquid, servePad;
  let pourStream, iceBin;
  let guestRoot, guestFace, guestEyeL, guestEyeR, guestMouth;
  const bottleMeshes = new Map();
  const iceMeshes = [];

  $("resultModal").hidden = true;

  function mat(name, color, metallic=.2, rough=.4, emissive=null, alpha=1){
    const m = new BABYLON.PBRMaterial(name, scene);
    m.albedoColor = color;
    m.metallic = metallic;
    m.roughness = rough;
    m.alpha = alpha;
    if(emissive) m.emissiveColor = emissive;
    return m;
  }

  function toonMaterial(name, base, shadow=.48, emission=null){
    const m = new BABYLON.ShaderMaterial(name, scene, {
      vertex:"toon", fragment:"toon"
    }, {
      attributes:["position","normal"],
      uniforms:["world","worldViewProjection","baseColor","shadowColor","lightDirection","emissionColor"]
    });
    m.setColor3("baseColor", base);
    m.setColor3("shadowColor", base.scale(shadow));
    m.setVector3("lightDirection", new BABYLON.Vector3(-.4,.8,-.3).normalize());
    m.setColor3("emissionColor", emission || BABYLON.Color3.Black());
    return m;
  }

  function createShaders(){
    BABYLON.Effect.ShadersStore["toonVertexShader"] = `
      precision highp float;
      attribute vec3 position;
      attribute vec3 normal;
      uniform mat4 world;
      uniform mat4 worldViewProjection;
      varying vec3 vNormal;
      void main(){
        gl_Position=worldViewProjection*vec4(position,1.0);
        vNormal=normalize(mat3(world)*normal);
      }`;
    BABYLON.Effect.ShadersStore["toonFragmentShader"] = `
      precision highp float;
      varying vec3 vNormal;
      uniform vec3 baseColor;
      uniform vec3 shadowColor;
      uniform vec3 lightDirection;
      uniform vec3 emissionColor;
      void main(){
        float ndl=max(dot(normalize(vNormal),normalize(lightDirection)),0.0);
        float band=step(0.42,ndl);
        vec3 c=mix(shadowColor,baseColor,band)+emissionColor;
        gl_FragColor=vec4(c,1.0);
      }`;
  }

  function weightedColor(amounts){
    const total = Object.values(amounts).reduce((a,b)=>a+b,0);
    if(total<=0) return new BABYLON.Color3(.1,.75,1);
    let c = new BABYLON.Color3(0,0,0);
    for(const [name,ml] of Object.entries(amounts)){
      c = c.add((ingredientColors[name] || BABYLON.Color3.White()).scale(ml/total));
    }
    return c;
  }

  function clearObject(obj){
    obj.amounts={};
    obj.total=0;
    obj.ice=0;
    obj.shaken=false;
  }

  function updateRecipe(){
    const r=recipes[recipeIndex];
    $("recipeName").textContent=r.name;
    $("recipeDesc").textContent=r.desc;
    $("recipePage").textContent=`${String(recipeIndex+1).padStart(2,"0")} / ${String(recipes.length).padStart(2,"0")}`;
    $("recipeIngredients").innerHTML=
      Object.entries(r.ingredients).map(([name,ml])=>`<li>${ml} ml ${name}</li>`).join("")+
      `<li>${r.ice} Eiswürfel</li>`+
      `<li>${r.shake ? "Im Shaker schütteln" : "Direkt im Glas bauen"}</li>`+
      `<li>Glas: ${r.glass}</li>`;
  }

  function updateGuest(){
    const g=guests[guestIndex];
    $("guestName").textContent=g.name;
    $("guestLine").textContent=g.line;
    guestRoot.rotation.y=0;
    animateGuestEntrance();
  }

  function updateHud(){
    $("score").textContent=String(score);
    $("shakerStatus").textContent=shaker.total ? `${Math.round(shaker.total)} ml` : "leer";
    $("glassStatus").textContent=glass.total ? `${Math.round(glass.total)} ml` : "leer";
    $("iceStatus").textContent=String(shaker.ice+glass.ice);
    $("methodStatus").textContent=shaker.shaken ? "geschüttelt" : "nicht geschüttelt";
    updateLiquidVisuals();
  }

  function updateLiquidVisuals(){
    const sf=Math.min(shaker.total/180,1);
    shakerLiquid.isVisible=shaker.total>.1;
    shakerLiquid.scaling.y=Math.max(.02,sf);
    shakerLiquid.position.y=-.13+(sf*.12);
    shakerLiquid.material.diffuseColor=weightedColor(shaker.amounts);
    shakerLiquid.material.emissiveColor=weightedColor(shaker.amounts).scale(.18);

    const gf=Math.min(glass.total/180,1);
    glassLiquid.isVisible=glass.total>.1;
    glassLiquid.scaling.y=Math.max(.02,gf);
    glassLiquid.position.y=-.12+(gf*.12);
    glassLiquid.material.diffuseColor=weightedColor(glass.amounts);
    glassLiquid.material.emissiveColor=weightedColor(glass.amounts).scale(.15);
  }

  function registerPick(mesh, label, handler){
    mesh.isPickable=true;
    mesh.metadata={...(mesh.metadata||{}), label};
    mesh.actionManager=new BABYLON.ActionManager(scene);
    mesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
      BABYLON.ActionManager.OnPickTrigger,
      () => { if(!busy) handler(); }
    ));
    mesh.actionManager.registerAction(new BABYLON.InterpolateValueAction(
      BABYLON.ActionManager.OnPointerOverTrigger, mesh, "scaling", mesh.scaling.scale(1.05), 90
    ));
    mesh.actionManager.registerAction(new BABYLON.InterpolateValueAction(
      BABYLON.ActionManager.OnPointerOutTrigger, mesh, "scaling", new BABYLON.Vector3(1,1,1), 90
    ));
  }

  function createLabel(text, width=512, height=128){
    const tex=new BABYLON.DynamicTexture("label-"+text,{width,height},scene,true);
    tex.hasAlpha=true;
    const ctx=tex.getContext();
    ctx.clearRect(0,0,width,height);
    ctx.fillStyle="rgba(6,5,15,.82)";
    ctx.fillRect(0,0,width,height);
    ctx.strokeStyle="rgba(101,234,255,.7)";
    ctx.lineWidth=5;
    ctx.strokeRect(3,3,width-6,height-6);
    ctx.font="700 38px Arial";
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.fillStyle="#f7f2ff";
    ctx.fillText(text,width/2,height/2);
    tex.update();
    const plane=BABYLON.MeshBuilder.CreatePlane("labelPlane",{width:.48,height:.12},scene);
    const m=new BABYLON.StandardMaterial("labelMat",scene);
    m.diffuseTexture=tex;
    m.emissiveTexture=tex;
    m.opacityTexture=tex;
    m.disableLighting=true;
    plane.material=m;
    return plane;
  }

  function createEnvironment(){
    const floor= BABYLON.MeshBuilder.CreateGround("floor",{width:8,height:7},scene);
    floor.material=mat("floorMat",new BABYLON.Color3(.018,.012,.028),.55,.22);
    floor.receiveShadows=true;

    const wall= BABYLON.MeshBuilder.CreateBox("wall",{width:8,height:4,depth:.12},scene);
    wall.position=new BABYLON.Vector3(0,2,2.6);
    wall.material=mat("wallMat",new BABYLON.Color3(.035,.018,.055),.25,.55);

    const counter= BABYLON.MeshBuilder.CreateBox("counter",{width:4.2,height:.85,depth:.9},scene);
    counter.position=new BABYLON.Vector3(0,.43,.12);
    counter.material=mat("counterMat",new BABYLON.Color3(.14,.035,.09),.32,.26);
    const top= BABYLON.MeshBuilder.CreateBox("counterTop",{width:4.35,height:.12,depth:1.0},scene);
    top.position=new BABYLON.Vector3(0,.91,.08);
    top.material=mat("topMat",new BABYLON.Color3(.22,.075,.15),.35,.18);

    const trim= BABYLON.MeshBuilder.CreateBox("trim",{width:4.38,height:.035,depth:1.03},scene);
    trim.position=new BABYLON.Vector3(0,.99,.08);
    trim.material=mat("trimMat",new BABYLON.Color3(.7,.1,.52),.25,.2,new BABYLON.Color3(.7,.04,.45));

    for(let i=0;i<3;i++){
      const shelf=BABYLON.MeshBuilder.CreateBox("shelf"+i,{width:3.7,height:.06,depth:.34},scene);
      shelf.position=new BABYLON.Vector3(0,1.3+i*.55,2.48);
      shelf.material=mat("shelfMat"+i,new BABYLON.Color3(.09,.1,.16),.8,.2);
    }

    const neon1=BABYLON.MeshBuilder.CreateBox("neon1",{width:3.8,height:.045,depth:.035},scene);
    neon1.position=new BABYLON.Vector3(0,2.82,2.5);
    neon1.material=mat("neonPink",new BABYLON.Color3(.8,.05,.45),.1,.1,new BABYLON.Color3(1,.05,.62));
    const neon2=neon1.clone("neon2"); neon2.position.y=2.42;
    const neon3=BABYLON.MeshBuilder.CreateTorus("ring",{diameter:1.0,thickness:.055,tessellation:48},scene);
    neon3.position=new BABYLON.Vector3(1.45,3.2,.9);
    neon3.rotation.x=Math.PI/2;
    neon3.material=mat("neonRing",new BABYLON.Color3(.9,.75,1),.1,.1,new BABYLON.Color3(.9,.7,1));

    servePad=BABYLON.MeshBuilder.CreateCylinder("servePad",{height:.035,diameter:.46,tessellation:48},scene);
    servePad.position=new BABYLON.Vector3(0,.995,.53);
    servePad.material=mat("servePadMat",new BABYLON.Color3(.03,.18,.2),.25,.24,new BABYLON.Color3(.02,.62,.7));
    registerPick(servePad,"SERVE",serveDrink);
    const serveLabel=createLabel("SERVE");
    serveLabel.position=new BABYLON.Vector3(0,1.19,.55);
    serveLabel.rotation.x=Math.PI/2;

    const pink=new BABYLON.PointLight("pink",new BABYLON.Vector3(-2,2.5,.4),scene);
    pink.diffuse=new BABYLON.Color3(1,.08,.62); pink.intensity=22; pink.range=6;
    const cyan=new BABYLON.PointLight("cyan",new BABYLON.Vector3(2,2.2,-.6),scene);
    cyan.diffuse=new BABYLON.Color3(.05,.8,1); cyan.intensity=18; cyan.range=6;
    const warm=new BABYLON.PointLight("warm",new BABYLON.Vector3(0,2.5,1.2),scene);
    warm.diffuse=new BABYLON.Color3(1,.42,.2); warm.intensity=7; warm.range=4;

    const particles=new BABYLON.ParticleSystem("dust",500,scene);
    particles.particleTexture=new BABYLON.Texture("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMTYiIGZpbGw9IndoaXRlIi8+PC9zdmc+",scene);
    particles.emitter=new BABYLON.Vector3(0,1.7,0);
    particles.minEmitBox=new BABYLON.Vector3(-3,-1,-2);
    particles.maxEmitBox=new BABYLON.Vector3(3,1.5,2);
    particles.color1=new BABYLON.Color4(.4,.8,1,.22);
    particles.color2=new BABYLON.Color4(1,.2,.7,.16);
    particles.minSize=.006; particles.maxSize=.018;
    particles.minLifeTime=3; particles.maxLifeTime=7;
    particles.emitRate=35;
    particles.direction1=new BABYLON.Vector3(-.02,.02,-.02);
    particles.direction2=new BABYLON.Vector3(.02,.08,.02);
    particles.gravity=new BABYLON.Vector3(0,.002,0);
    particles.start();
  }

  function createGuest(){
    guestRoot=new BABYLON.TransformNode("guestRoot",scene);
    guestRoot.position=new BABYLON.Vector3(0,0,1.55);

    const body=BABYLON.MeshBuilder.CreateCapsule("guestBody",{height:1.18,radius:.31,tessellation:18},scene);
    body.parent=guestRoot; body.position.y=1.04;
    body.material=toonMaterial("bodyToon",new BABYLON.Color3(.22,.05,.25),.5,new BABYLON.Color3(.05,0,.07));

    const neck=BABYLON.MeshBuilder.CreateCylinder("neck",{height:.16,diameter:.17,tessellation:18},scene);
    neck.parent=guestRoot; neck.position.y=1.63;
    neck.material=toonMaterial("skinNeck",new BABYLON.Color3(.93,.61,.73),.68);

    guestFace=BABYLON.MeshBuilder.CreateSphere("guestFace",{diameter:.48,segments:24},scene);
    guestFace.parent=guestRoot; guestFace.position.y=1.91;
    guestFace.scaling=new BABYLON.Vector3(.9,1.06,.82);
    guestFace.material=toonMaterial("skin",new BABYLON.Color3(.96,.64,.75),.68);

    const hair=BABYLON.MeshBuilder.CreateSphere("hair",{diameter:.52,segments:24,slice:.66},scene);
    hair.parent=guestRoot; hair.position=new BABYLON.Vector3(0,2.02,.015);
    hair.rotation.x=Math.PI;
    hair.scaling=new BABYLON.Vector3(.96,1.0,.9);
    hair.material=toonMaterial("hairToon",new BABYLON.Color3(.08,.035,.11),.45,new BABYLON.Color3(.04,.01,.06));

    const fringe=BABYLON.MeshBuilder.CreateBox("fringe",{width:.28,height:.38,depth:.055},scene);
    fringe.parent=guestRoot; fringe.position=new BABYLON.Vector3(-.08,2.00,-.205); fringe.rotation.z=-.18;
    fringe.material=hair.material;

    const eyeMat=mat("eyeMat",new BABYLON.Color3(.92,.05,.48),.05,.3,new BABYLON.Color3(.75,.02,.3));
    guestEyeL=BABYLON.MeshBuilder.CreateSphere("eyeL",{diameter:.058,segments:12},scene);
    guestEyeL.parent=guestRoot; guestEyeL.position=new BABYLON.Vector3(-.085,1.94,-.205); guestEyeL.scaling.z=.25; guestEyeL.material=eyeMat;
    guestEyeR=guestEyeL.clone("eyeR"); guestEyeR.parent=guestRoot; guestEyeR.position.x=.085;

    guestMouth=BABYLON.MeshBuilder.CreateBox("mouth",{width:.075,height:.012,depth:.012},scene);
    guestMouth.parent=guestRoot; guestMouth.position=new BABYLON.Vector3(0,1.82,-.216);
    guestMouth.material=mat("mouthMat",new BABYLON.Color3(.3,.015,.06),.05,.5);

    const armMat=toonMaterial("armSkin",new BABYLON.Color3(.94,.62,.74),.68);
    const armL=BABYLON.MeshBuilder.CreateCapsule("armL",{height:.66,radius:.085,tessellation:14},scene);
    armL.parent=guestRoot; armL.position=new BABYLON.Vector3(-.36,1.27,-.15); armL.rotation.z=-.6; armL.material=armMat;
    const armR=armL.clone("armR"); armR.parent=guestRoot; armR.position.x=.36; armR.rotation.z=.6;

    const cyber=BABYLON.MeshBuilder.CreateCapsule("cyberArm",{height:.65,radius:.09,tessellation:14},scene);
    cyber.parent=guestRoot; cyber.position=new BABYLON.Vector3(.36,1.27,-.15); cyber.rotation.z=.6;
    cyber.material=mat("cyberMat",new BABYLON.Color3(.22,.18,.28),.9,.16,new BABYLON.Color3(.08,.02,.12));
  }

  function animateGuestEntrance(){
    if(!guestRoot) return;
    guestRoot.position.z=2.2;
    const anim=new BABYLON.Animation("guestEnter","position.z",60,BABYLON.Animation.ANIMATIONTYPE_FLOAT,BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    anim.setKeys([{frame:0,value:2.2},{frame:45,value:1.55}]);
    guestRoot.animations=[anim];
    scene.beginAnimation(guestRoot,0,45,false);
    blinkGuest();
  }

  function blinkGuest(){
    if(!guestEyeL) return;
    const anim=new BABYLON.Animation("blink","scaling.y",60,BABYLON.Animation.ANIMATIONTYPE_FLOAT,BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    anim.setKeys([{frame:0,value:1},{frame:4,value:.08},{frame:8,value:1}]);
    guestEyeL.animations=[anim]; guestEyeR.animations=[anim.clone()];
    scene.beginAnimation(guestEyeL,0,8,false);
    scene.beginAnimation(guestEyeR,0,8,false);
    setTimeout(blinkGuest,2600+Math.random()*2400);
  }

  function createBottle(name,index){
    const x=-1.48+(index%5)*.72;
    const y=1.48+Math.floor(index/5)*.55;
    const root=new BABYLON.TransformNode("bottleRoot-"+name,scene);
    root.position=new BABYLON.Vector3(x,y,2.28);

    const body=BABYLON.MeshBuilder.CreateCylinder("bottle-"+name,{height:.42,diameter:.14,tessellation:20},scene);
    body.parent=root;
    body.material=mat("bottleMat-"+name,ingredientColors[name].scale(.5),.15,.2,ingredientColors[name].scale(.08),.88);

    const neck=BABYLON.MeshBuilder.CreateCylinder("neck-"+name,{height:.13,diameter:.065,tessellation:16},scene);
    neck.parent=root; neck.position.y=.265; neck.material=body.material;
    const cap=BABYLON.MeshBuilder.CreateCylinder("cap-"+name,{height:.065,diameter:.075,tessellation:16},scene);
    cap.parent=root; cap.position.y=.36; cap.material=mat("capMat-"+name,new BABYLON.Color3(.12,.12,.16),.85,.2);

    const label=createLabel(name,420,120);
    label.parent=root; label.position=new BABYLON.Vector3(0,-.02,-.075); label.scaling.scaleInPlace(.42);

    [body,neck,cap,label].forEach(m=>registerPick(m,name,()=>pourIngredient(name,15)));
    bottleMeshes.set(name,root);
  }

  function createStation(){
    Object.keys(ingredientColors).forEach(createBottle);

    shakerRoot=new BABYLON.TransformNode("shakerRoot",scene);
    shakerRoot.position=new BABYLON.Vector3(-.55,1.18,-.05);
    shakerBody=BABYLON.MeshBuilder.CreateCylinder("shakerBody",{height:.38,diameterTop:.23,diameterBottom:.17,tessellation:32},scene);
    shakerBody.parent=shakerRoot;
    shakerBody.material=mat("shakerMetal",new BABYLON.Color3(.22,.2,.28),.92,.14);
    shakerLiquid=BABYLON.MeshBuilder.CreateCylinder("shakerLiquid",{height:.24,diameterTop:.19,diameterBottom:.14,tessellation:30},scene);
    shakerLiquid.parent=shakerRoot;
    const slm=new BABYLON.StandardMaterial("shakerLiquidMat",scene); slm.alpha=.72; shakerLiquid.material=slm; shakerLiquid.isVisible=false;
    shakerLid=BABYLON.MeshBuilder.CreateCylinder("shakerLid",{height:.13,diameterTop:.16,diameterBottom:.22,tessellation:28},scene);
    shakerLid.parent=shakerRoot; shakerLid.position.y=.255; shakerLid.material=shakerBody.material;

    [shakerBody,shakerLid].forEach(m=>registerPick(m,"SHAKE",shakeDrink));
    const shakeLabel=createLabel("SHAKER");
    shakeLabel.position=new BABYLON.Vector3(-.55,1.55,-.05); shakeLabel.rotation.x=Math.PI/2;

    glassRoot=new BABYLON.TransformNode("glassRoot",scene);
    glassRoot.position=new BABYLON.Vector3(.55,1.17,-.05);
    const glassBody=BABYLON.MeshBuilder.CreateCylinder("glassBody",{height:.35,diameterTop:.25,diameterBottom:.17,tessellation:36},scene);
    glassBody.parent=glassRoot;
    glassBody.material=mat("glassMat",new BABYLON.Color3(.65,.86,1),.04,.05,null,.22);
    glassLiquid=BABYLON.MeshBuilder.CreateCylinder("glassLiquid",{height:.25,diameterTop:.21,diameterBottom:.145,tessellation:32},scene);
    glassLiquid.parent=glassRoot;
    const glm=new BABYLON.StandardMaterial("glassLiquidMat",scene); glm.alpha=.78; glassLiquid.material=glm; glassLiquid.isVisible=false;
    registerPick(glassBody,"POUR TO GLASS",pourToGlass);

    const glassLabel=createLabel("GLAS");
    glassLabel.position=new BABYLON.Vector3(.55,1.55,-.05); glassLabel.rotation.x=Math.PI/2;

    iceBin=BABYLON.MeshBuilder.CreateBox("iceBin",{width:.5,height:.25,depth:.42},scene);
    iceBin.position=new BABYLON.Vector3(-1.25,1.12,-.04);
    iceBin.material=mat("iceBinMat",new BABYLON.Color3(.05,.15,.2),.65,.18,new BABYLON.Color3(.02,.18,.25));
    registerPick(iceBin,"ICE",addIce);
    const iceLabel=createLabel("EIS");
    iceLabel.position=new BABYLON.Vector3(-1.25,1.4,-.04); iceLabel.rotation.x=Math.PI/2;

    pourStream=BABYLON.MeshBuilder.CreateCylinder("pourStream",{height:.75,diameter:.018,tessellation:12},scene);
    pourStream.position=new BABYLON.Vector3(0,1.42,-.05);
    pourStream.rotation.z=Math.PI/2;
    const psm=new BABYLON.StandardMaterial("streamMat",scene);
    psm.diffuseColor=new BABYLON.Color3(.2,.85,1); psm.emissiveColor=psm.diffuseColor.scale(.7); psm.alpha=.72;
    pourStream.material=psm; pourStream.isVisible=false;
  }

  function animateBottle(root, onMid){
    busy=true;
    const start=root.position.clone();
    const startRot=root.rotation.clone();
    const animPos=new BABYLON.Animation("bottlePos","position",60,BABYLON.Animation.ANIMATIONTYPE_VECTOR3,BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    animPos.setKeys([
      {frame:0,value:start},
      {frame:20,value:new BABYLON.Vector3(-.55,1.66,-.04)},
      {frame:48,value:new BABYLON.Vector3(-.55,1.66,-.04)},
      {frame:72,value:start}
    ]);
    const animRot=new BABYLON.Animation("bottleRot","rotation.z",60,BABYLON.Animation.ANIMATIONTYPE_FLOAT,BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    animRot.setKeys([{frame:0,value:0},{frame:20,value:0},{frame:30,value:-1.65},{frame:48,value:-1.65},{frame:58,value:0},{frame:72,value:0}]);
    root.animations=[animPos,animRot];
    scene.beginAnimation(root,0,72,false,1,()=>{root.position.copyFrom(start);root.rotation.copyFrom(startRot);busy=false;});
    setTimeout(onMid,500);
  }

  function pourIngredient(name, amount){
    const bottle=bottleMeshes.get(name);
    if(!bottle || busy) return;
    animateBottle(bottle,()=>{
      pourStream.position=new BABYLON.Vector3(-.55,1.45,-.04);
      pourStream.rotation.z=0;
      pourStream.scaling.y=.48;
      pourStream.material.diffuseColor=ingredientColors[name];
      pourStream.material.emissiveColor=ingredientColors[name].scale(.55);
      pourStream.isVisible=true;

      let added=0;
      const timer=setInterval(()=>{
        const step=1.5;
        shaker.amounts[name]=(shaker.amounts[name]||0)+step;
        shaker.total+=step;
        added+=step;
        updateHud();
        if(added>=amount){
          clearInterval(timer);
          pourStream.isVisible=false;
        }
      },35);
    });
  }

  function addIce(){
    if(busy) return;
    shaker.ice=Math.min(8,shaker.ice+1);
    const cube=BABYLON.MeshBuilder.CreateBox("iceCube",{size:.052},scene);
    cube.parent=shakerRoot;
    cube.position=new BABYLON.Vector3((Math.random()-.5)*.08,.13,(Math.random()-.5)*.07);
    cube.rotation=new BABYLON.Vector3(Math.random(),Math.random(),Math.random());
    cube.material=mat("iceCubeMat"+iceMeshes.length,new BABYLON.Color3(.6,.9,1),.05,.08,null,.55);
    iceMeshes.push(cube);
    const fall=new BABYLON.Animation("iceFall","position.y",60,BABYLON.Animation.ANIMATIONTYPE_FLOAT,BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    fall.setKeys([{frame:0,value:.55},{frame:20,value:.12}]);
    cube.animations=[fall];
    scene.beginAnimation(cube,0,20,false);
    updateHud();
  }

  function shakeDrink(){
    if(busy || shaker.total<=0) return;
    busy=true;
    shaker.shaken=true;
    const posAnim=new BABYLON.Animation("shakePos","position.x",60,BABYLON.Animation.ANIMATIONTYPE_FLOAT,BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
    posAnim.setKeys([{frame:0,value:-.55},{frame:5,value:-.35},{frame:10,value:-.72},{frame:15,value:-.38},{frame:20,value:-.55}]);
    const rotAnim=new BABYLON.Animation("shakeRot","rotation.z",60,BABYLON.Animation.ANIMATIONTYPE_FLOAT,BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
    rotAnim.setKeys([{frame:0,value:0},{frame:5,value:.35},{frame:10,value:-.36},{frame:15,value:.25},{frame:20,value:0}]);
    shakerRoot.animations=[posAnim,rotAnim];
    scene.beginAnimation(shakerRoot,0,20,true,1);
    setTimeout(()=>{
      scene.stopAnimation(shakerRoot);
      shakerRoot.position.x=-.55; shakerRoot.rotation.z=0;
      busy=false; updateHud();
    },1800);
    updateHud();
  }

  function pourToGlass(){
    if(busy || shaker.total<=0) return;
    busy=true;
    const source={...shaker.amounts};
    const total=shaker.total;
    const ice=shaker.ice;
    const wasShaken=shaker.shaken;
    const rotAnim=new BABYLON.Animation("pourRot","rotation.z",60,BABYLON.Animation.ANIMATIONTYPE_FLOAT,BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    rotAnim.setKeys([{frame:0,value:0},{frame:18,value:-1.1},{frame:65,value:-1.1},{frame:82,value:0}]);
    shakerRoot.animations=[rotAnim];
    scene.beginAnimation(shakerRoot,0,82,false,1,()=>{busy=false;});

    setTimeout(()=>{
      pourStream.position=new BABYLON.Vector3(0,1.38,-.05);
      pourStream.rotation.z=Math.PI/2;
      pourStream.scaling.y=.7;
      pourStream.material.diffuseColor=weightedColor(source);
      pourStream.material.emissiveColor=weightedColor(source).scale(.55);
      pourStream.isVisible=true;
      let step=0;
      const steps=55;
      const timer=setInterval(()=>{
        step++;
        for(const [name,ml] of Object.entries(source)){
          const moved=ml/steps;
          glass.amounts[name]=(glass.amounts[name]||0)+moved;
        }
        glass.total+=total/steps;
        shaker.total=Math.max(0,shaker.total-total/steps);
        updateHud();
        if(step>=steps){
          clearInterval(timer);
          pourStream.isVisible=false;
          glass.ice+=ice;
          glass.type=selectedGlass;
          glass.shaken=wasShaken;
          shaker.amounts={}; shaker.total=0; shaker.ice=0; shaker.shaken=false;
          iceMeshes.forEach(m=>m.dispose()); iceMeshes.length=0;
          for(let i=0;i<glass.ice;i++){
            const cube=BABYLON.MeshBuilder.CreateBox("glassIce",{size:.045},scene);
            cube.parent=glassRoot;
            cube.position=new BABYLON.Vector3((Math.random()-.5)*.09,-.05+Math.random()*.12,(Math.random()-.5)*.07);
            cube.rotation=new BABYLON.Vector3(Math.random(),Math.random(),Math.random());
            cube.material=mat("glassIceMat"+i,new BABYLON.Color3(.65,.92,1),.05,.08,null,.5);
          }
          updateHud();
        }
      },28);
    },320);
  }

  function scoreDrink(){
    const r=recipes[guests[guestIndex].recipe];
    let ingredientScore=60;
    const rows=[];
    for(const [name,target] of Object.entries(r.ingredients)){
      const actual=glass.amounts[name]||0;
      const diff=Math.abs(target-actual);
      const loss=Math.min(20,diff*.55);
      ingredientScore-=loss;
      rows.push([name,actual,target,diff<=8]);
    }
    for(const name of Object.keys(glass.amounts)){
      if(!(name in r.ingredients)) ingredientScore-=10;
    }
    const iceScore=Math.max(0,15-Math.abs(glass.ice-r.ice)*5);
    const methodScore=(r.shake===Boolean(glass.shaken))?15:0;
    const glassScore=(glass.type===r.glass)?10:0;
    const total=Math.max(0,Math.round(ingredientScore+iceScore+methodScore+glassScore));
    return {total,ingredientScore:Math.max(0,Math.round(ingredientScore)),iceScore,methodScore,glassScore,rows};
  }

  function serveDrink(){
    if(busy || glass.total<=0) return;
    busy=true;
    const move=new BABYLON.Animation("serveMove","position",60,BABYLON.Animation.ANIMATIONTYPE_VECTOR3,BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    const start=glassRoot.position.clone();
    move.setKeys([{frame:0,value:start},{frame:36,value:new BABYLON.Vector3(0,1.17,.52)}]);
    glassRoot.animations=[move];
    scene.beginAnimation(glassRoot,0,36,false,1,()=>{
      const result=scoreDrink();
      score+=result.total;
      $("resultTitle").textContent=`${recipes[guests[guestIndex].recipe].name}: ${result.total} Punkte`;
      $("resultText").textContent=result.total>=90
        ?"Makellos. Der Gast lächelt und gibt großzügig Trinkgeld."
        : result.total>=70
        ?"Guter Drink. Ein paar Details fehlen noch."
        :"Das Rezept wurde deutlich verfehlt.";
      $("resultBreakdown").innerHTML=
        `<div class="breakdown-row"><span>Zutaten</span><strong>${result.ingredientScore}/60</strong></div>`+
        `<div class="breakdown-row"><span>Eis</span><strong>${result.iceScore}/15</strong></div>`+
        `<div class="breakdown-row"><span>Methode</span><strong>${result.methodScore}/15</strong></div>`+
        `<div class="breakdown-row"><span>Glas</span><strong>${result.glassScore}/10</strong></div>`;
      $("resultModal").hidden=false;
      animateGuestReaction(result.total);
      updateHud();
      busy=false;
    });
  }

  function animateGuestReaction(points){
    const smile=new BABYLON.Animation("smile","scaling.x",60,BABYLON.Animation.ANIMATIONTYPE_FLOAT,BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    smile.setKeys([{frame:0,value:1},{frame:12,value:points>=70?1.55:.7},{frame:30,value:points>=70?1.55:.7}]);
    guestMouth.animations=[smile];
    scene.beginAnimation(guestMouth,0,30,false);
    const nod=new BABYLON.Animation("nod","rotation.x",60,BABYLON.Animation.ANIMATIONTYPE_FLOAT,BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    nod.setKeys([{frame:0,value:0},{frame:8,value:points>=70?.15:-.12},{frame:16,value:0},{frame:24,value:points>=70?.12:-.08},{frame:32,value:0}]);
    guestFace.animations=[nod];
    scene.beginAnimation(guestFace,0,32,false);
  }

  function resetRound(){
    glass.amounts={}; glass.total=0; glass.ice=0; glass.shaken=false; glass.type="highball";
    shaker.amounts={}; shaker.total=0; shaker.ice=0; shaker.shaken=false;
    glassRoot.getChildren().filter(m=>m.name==="glassIce").forEach(m=>m.dispose());
    glassRoot.position=new BABYLON.Vector3(.55,1.17,-.05);
    guestMouth.scaling.x=1;
    updateHud();
  }

  function nextGuest(){
    $("resultModal").hidden=true;
    guestIndex=(guestIndex+1)%guests.length;
    recipeIndex=guests[guestIndex].recipe;
    resetRound();
    updateGuest();
    updateRecipe();
  }

  async function createScene(){
    scene=new BABYLON.Scene(engine);
    createShaders();
    scene.clearColor=new BABYLON.Color4(.01,.005,.02,1);
    scene.fogMode=BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity=.028;
    scene.fogColor=new BABYLON.Color3(.025,.012,.045);

    camera=new BABYLON.UniversalCamera("camera",new BABYLON.Vector3(0,1.65,-2.75),scene);
    camera.setTarget(new BABYLON.Vector3(0,1.45,.7));
    camera.attachControl($("renderCanvas"),true);
    camera.speed=.07;
    camera.angularSensibility=3200;
    camera.minZ=.05;

    const hemi=new BABYLON.HemisphericLight("hemi",new BABYLON.Vector3(0,1,0),scene);
    hemi.intensity=.34;
    hemi.diffuse=new BABYLON.Color3(.45,.3,.65);

    createEnvironment();
    createGuest();
    createStation();

    // Desktop can start before XR detection completes.
    scene.createDefaultXRExperienceAsync({
      floorMeshes:[scene.getMeshByName("floor")],
      disableTeleportation:false,
      uiOptions:{sessionMode:"immersive-vr"}
    }).then(helper=>{
      xrHelper=helper;
      $("vrBtn").disabled=false;
      $("vrBtn").textContent="In VR starten";
      $("vrBtn").addEventListener("click",async()=>{
        try{
          await xrHelper.baseExperience.enterXRAsync("immersive-vr","local-floor");
          startGame();
        }catch(e){
          $("bootStatus").textContent="VR konnte nicht gestartet werden. Öffne die Seite direkt im Meta Quest Browser.";
        }
      },{once:true});
    }).catch(()=>{
      $("vrBtn").disabled=true;
      $("vrBtn").textContent="VR nicht verfügbar";
    });

    return scene;
  }

  function startGame(){
    $("boot").hidden=true;
    $("topHud").hidden=false;
    $("tabletHud").hidden=false;
    $("dialogue").hidden=false;
    $("livePanel").hidden=false;
    $("hint").hidden=false;
    $("renderCanvas").focus();
    updateGuest();
  }

  async function boot(){
    if(typeof BABYLON==="undefined"){
      $("bootStatus").textContent="Die 3D-Engine ist nicht verfügbar.";
      return;
    }
    $("bootStatus").textContent="Cyberpunk-Bar wird aufgebaut …";
    engine=new BABYLON.Engine($("renderCanvas"),true,{
      preserveDrawingBuffer:false,
      stencil:true,
      adaptToDeviceRatio:true,
      powerPreference:"high-performance"
    });
    await createScene();

    $("desktopBtn").disabled=false;
    $("desktopBtn").addEventListener("click",startGame,{once:true});
    $("prevRecipe").addEventListener("click",()=>{
      recipeIndex=(recipeIndex-1+recipes.length)%recipes.length;
      updateRecipe();
    });
    $("nextRecipe").addEventListener("click",()=>{
      recipeIndex=(recipeIndex+1)%recipes.length;
      updateRecipe();
    });
    $("nextGuestBtn").addEventListener("click",nextGuest);

    updateRecipe();
    updateHud();
    $("bootStatus").textContent="Bereit. Klicke Flaschen und Geräte direkt in der 3D-Bar an.";
    engine.runRenderLoop(()=>scene.render());
    addEventListener("resize",()=>engine.resize());
  }

  boot().catch(error=>{
    console.error(error);
    $("bootStatus").textContent="Startfehler: "+(error?.message||String(error));
  });
})();
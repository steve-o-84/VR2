
(() => {
  "use strict";

  const VERSION = "0.5.1";
  const recipes = [
    {
      name: "Neon Veil",
      desc: "Kühl, elektrisch und leicht bitter.",
      glass: "highball",
      ice: 4,
      shake: true,
      ingredients: { "Synth Gin": 45, "Blue Citrus": 25, "Tonic-X": 60 }
    },
    {
      name: "Chrome Kiss",
      desc: "Trocken, leuchtend und elegant.",
      glass: "coupe",
      ice: 2,
      shake: true,
      ingredients: { "Vodka-9": 50, "Lychee Core": 30, "Pulse Lime": 15 }
    },
    {
      name: "Black Circuit",
      desc: "Dunkel, würzig und schwer.",
      glass: "tumbler",
      ice: 3,
      shake: false,
      ingredients: { "Night Rum": 50, "Cola Noir": 70, "Bitters": 5 }
    }
  ];

  const ingredientColors = {
    "Synth Gin": new BABYLON.Color3(0.35,0.85,1.0),
    "Blue Citrus": new BABYLON.Color3(0.05,0.45,1.0),
    "Tonic-X": new BABYLON.Color3(0.65,0.95,1.0),
    "Vodka-9": new BABYLON.Color3(0.8,0.95,1.0),
    "Lychee Core": new BABYLON.Color3(1.0,0.35,0.72),
    "Pulse Lime": new BABYLON.Color3(0.35,1.0,0.45),
    "Night Rum": new BABYLON.Color3(0.32,0.06,0.03),
    "Cola Noir": new BABYLON.Color3(0.12,0.035,0.02),
    "Bitters": new BABYLON.Color3(0.85,0.22,0.04)
  };

  const guests = [
    ["Rin", "„Mach mir einen Neon Veil. Nicht zu süß.“", 0],
    ["Mara", "„Ein Chrome Kiss. Sauber gearbeitet.“", 1],
    ["Vale", "„Black Circuit. Und lass dir Zeit.“", 2]
  ];

  let recipeIndex = 0;
  let guestIndex = 0;
  let score = 0;
  let shaker = { amounts:{}, total:0, ice:0, shaken:false };
  let glass = { amounts:{}, total:0, ice:0, type:"highball" };
  let scene, engine, xrHelper;
  let shakerLiquid, glassLiquid, shakerMesh, glassRoot, pourStream;
  let pourAnimating = false;

  const $ = id => document.getElementById(id);

  // Reset every overlay before any asynchronous 3D initialization.
  $("resultModal").hidden = true;
  $("hud").hidden = true;

  // These handlers do not depend on Babylon and must always work.
  $("nextGuestBtn").addEventListener("click", () => {
    $("resultModal").hidden = true;
    if (scene) nextGuest();
  });

  function weightedColor(amounts){
    let total = Object.values(amounts).reduce((a,b)=>a+b,0);
    if(total <= 0) return new BABYLON.Color3(0.1,0.8,1);
    let c = new BABYLON.Color3(0,0,0);
    for(const [name,ml] of Object.entries(amounts)){
      const ic = ingredientColors[name] || new BABYLON.Color3(1,1,1);
      c = c.add(ic.scale(ml/total));
    }
    return c;
  }

  function updateRecipe(){
    const r = recipes[recipeIndex];
    $("recipeName").textContent = r.name;
    $("recipeDesc").textContent = r.desc;
    $("recipePage").textContent = `${String(recipeIndex+1).padStart(2,"0")} / ${String(recipes.length).padStart(2,"0")}`;
    $("recipeIngredients").innerHTML = Object.entries(r.ingredients)
      .map(([n,ml])=>`<li>${ml} ml ${n}</li>`).join("") +
      `<li>${r.ice} Eiswürfel</li><li>${r.shake ? "Schütteln" : "Im Glas bauen"}</li>`;
  }

  function updateGuest(){
    const [name,line,order] = guests[guestIndex];
    $("guestName").textContent = name;
    $("guestLine").textContent = line;
    $("orderBadge").textContent = recipes[order].name.toUpperCase();
  }

  function statusText(container){
    if(container.total <= 0) return "leer";
    return `${Math.round(container.total)} ml`;
  }

  function updateHud(){
    $("score").textContent = `${score} CR`;
    $("shakerStatus").textContent = statusText(shaker);
    $("glassStatus").textContent = statusText(glass);
    $("iceStatus").textContent = `${shaker.ice + glass.ice}`;
    updateLiquids();
  }

  function updateLiquids(){
    if(!shakerLiquid || !glassLiquid) return;
    const shakerFill = Math.min(shaker.total/240,1);
    const glassFill = Math.min(glass.total/220,1);
    shakerLiquid.scaling.y = Math.max(0.01,shakerFill);
    shakerLiquid.position.y = 0.88 - (1-shakerFill)*0.14;
    shakerLiquid.isVisible = shaker.total > 0.2;
    shakerLiquid.material.diffuseColor = weightedColor(shaker.amounts);
    shakerLiquid.material.emissiveColor = shakerLiquid.material.diffuseColor.scale(.22);

    glassLiquid.scaling.y = Math.max(0.01,glassFill);
    glassLiquid.position.y = 0.77 - (1-glassFill)*0.12;
    glassLiquid.isVisible = glass.total > 0.2;
    glassLiquid.material.diffuseColor = weightedColor(glass.amounts);
    glassLiquid.material.emissiveColor = glassLiquid.material.diffuseColor.scale(.18);
  }

  function addIngredient(name, ml=15){
    if(pourAnimating) return;
    shaker.amounts[name] = (shaker.amounts[name] || 0) + ml;
    shaker.total += ml;
    animateBottlePulse(name);
    updateHud();
  }

  function addIce(){
    if(pourAnimating) return;
    shaker.ice = Math.min(8, shaker.ice + 1);
    createIceCube(shakerMesh.position.add(new BABYLON.Vector3(
      (Math.random()-.5)*.08, .16 + Math.random()*.05, (Math.random()-.5)*.08
    )), shakerMesh);
    updateHud();
  }

  function shakeDrink(){
    if(shaker.total <= 0 || pourAnimating) return;
    shaker.shaken = true;
    const anim = new BABYLON.Animation("shake","rotation.z",60,BABYLON.Animation.ANIMATIONTYPE_FLOAT,BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
    anim.setKeys([
      {frame:0,value:0},{frame:5,value:.25},{frame:10,value:-.25},{frame:15,value:.2},{frame:20,value:0}
    ]);
    shakerMesh.animations=[anim];
    scene.beginAnimation(shakerMesh,0,20,false);
    updateHud();
  }

  function pourToGlass(){
    if(shaker.total <= 0 || pourAnimating) return;
    pourAnimating = true;
    pourStream.isVisible = true;
    const steps = 45;
    let i=0;
    const amountsCopy = {...shaker.amounts};
    const startTotal = shaker.total;
    const timer = setInterval(()=>{
      i++;
      const fraction = 1/steps;
      for(const [name,ml] of Object.entries(amountsCopy)){
        glass.amounts[name] = (glass.amounts[name]||0) + ml*fraction;
      }
      glass.total += startTotal*fraction;
      shaker.total = Math.max(0, shaker.total-startTotal*fraction);
      shakerMesh.rotation.z = -.8*Math.sin(Math.min(i/steps,1)*Math.PI);
      updateHud();
      if(i>=steps){
        clearInterval(timer);
        glass.ice += shaker.ice;
        shaker = {amounts:{},total:0,ice:0,shaken:false};
        shakerMesh.rotation.z=0;
        pourStream.isVisible=false;
        pourAnimating=false;
        updateHud();
      }
    },25);
  }

  function clearDrink(){
    shaker={amounts:{},total:0,ice:0,shaken:false};
    glass={amounts:{},total:0,ice:0,type:$("glassSelect").value};
    scene.meshes.filter(m=>m.metadata?.ice).forEach(m=>m.dispose());
    updateHud();
  }

  function serve(){
    if(glass.total <= 0) return;
    const recipe = recipes[guests[guestIndex][2]];
    let points = 100;
    for(const [name,target] of Object.entries(recipe.ingredients)){
      const actual = glass.amounts[name] || 0;
      points -= Math.min(30, Math.abs(target-actual)*.65);
    }
    for(const name of Object.keys(glass.amounts)){
      if(!(name in recipe.ingredients)) points -= 15;
    }
    points -= Math.abs(recipe.ice-glass.ice)*5;
    if(recipe.glass !== glass.type) points -= 15;
    if(recipe.shake && !shaker.shaken) points -= 10;
    points = Math.max(0,Math.round(points));
    score += points;
    $("resultTitle").textContent = `${recipe.name}: ${points} Punkte`;
    $("resultText").textContent = points > 84
      ? "Perfekt gemixt. Der Gast wirkt beeindruckt."
      : points > 59
      ? "Solide Arbeit, aber noch nicht makellos."
      : "Der Drink verfehlt das Rezept deutlich.";
    $("resultModal").hidden=false;
    updateHud();
  }

  function nextGuest(){
    $("resultModal").hidden=true;
    guestIndex=(guestIndex+1)%guests.length;
    clearDrink();
    updateGuest();
  }

  function createMaterial(name,color,metallic=.2,roughness=.35,emissive=null){
    const mat = new BABYLON.PBRMaterial(name,scene);
    mat.albedoColor=color;
    mat.metallic=metallic;
    mat.roughness=roughness;
    if(emissive) mat.emissiveColor=emissive;
    return mat;
  }

  function createBox(name,size,pos,mat){
    const mesh = BABYLON.MeshBuilder.CreateBox(name,{width:size.x,height:size.y,depth:size.z},scene);
    mesh.position=pos;
    mesh.material=mat;
    return mesh;
  }

  function createIceCube(pos,parent){
    const ice = BABYLON.MeshBuilder.CreateBox("ice",{size:.045},scene);
    ice.position=pos;
    if(parent) ice.parent=parent;
    ice.rotation=new BABYLON.Vector3(Math.random(),Math.random(),Math.random());
    const mat=new BABYLON.PBRMaterial("iceMat",scene);
    mat.albedoColor=new BABYLON.Color3(.7,.95,1);
    mat.alpha=.5; mat.metallic=.05; mat.roughness=.08;
    ice.material=mat; ice.metadata={ice:true};
  }

  function animateBottlePulse(name){
    const b=scene.getMeshByName("bottle-"+name);
    if(!b) return;
    const a=new BABYLON.Animation("pulse","scaling.y",60,BABYLON.Animation.ANIMATIONTYPE_FLOAT,BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    a.setKeys([{frame:0,value:1},{frame:6,value:1.12},{frame:12,value:1}]);
    b.animations=[a]; scene.beginAnimation(b,0,12,false);
  }

  async function createScene(){
    scene=new BABYLON.Scene(engine);
    scene.clearColor=new BABYLON.Color4(.015,.02,.05,1);
    scene.fogMode=BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity=.035;
    scene.fogColor=new BABYLON.Color3(.02,.03,.07);

    const camera=new BABYLON.UniversalCamera("camera",new BABYLON.Vector3(0,1.62,-2.7),scene);
    camera.setTarget(new BABYLON.Vector3(0,1.2,0));
    camera.attachControl($("renderCanvas"),true);
    camera.speed=.08;
    camera.angularSensibility=3200;

    const hemi=new BABYLON.HemisphericLight("hemi",new BABYLON.Vector3(0,1,0),scene);
    hemi.intensity=.35;
    hemi.diffuse=new BABYLON.Color3(.25,.4,.6);

    const cyan=new BABYLON.PointLight("cyan",new BABYLON.Vector3(-2,2.2,-.4),scene);
    cyan.diffuse=new BABYLON.Color3(.1,.8,1); cyan.intensity=28; cyan.range=5;
    const pink=new BABYLON.PointLight("pink",new BABYLON.Vector3(2,2.3,.8),scene);
    pink.diffuse=new BABYLON.Color3(1,.08,.65); pink.intensity=24; pink.range=5;

    const floorMat=createMaterial("floor",new BABYLON.Color3(.025,.03,.045),.55,.22);
    createBox("floor",new BABYLON.Vector3(7,.1,7),new BABYLON.Vector3(0,-.05,0),floorMat);

    const wallMat=createMaterial("wall",new BABYLON.Color3(.035,.045,.07),.2,.6);
    createBox("backwall",new BABYLON.Vector3(7,3.5,.15),new BABYLON.Vector3(0,1.7,2.2),wallMat);

    const barMat=createMaterial("bar",new BABYLON.Color3(.08,.025,.03),.35,.28);
    createBox("barTop",new BABYLON.Vector3(3.8,.14,.85),new BABYLON.Vector3(0,.9,0),barMat);
    createBox("barFront",new BABYLON.Vector3(3.8,.9,.18),new BABYLON.Vector3(0,.45,.35),barMat);

    const metal=createMaterial("metal",new BABYLON.Color3(.12,.14,.18),.92,.16);
    for(let r=0;r<3;r++){
      createBox("shelf"+r,new BABYLON.Vector3(3.4,.06,.36),new BABYLON.Vector3(0,1.25+r*.55,1.95),metal);
    }

    const names=Object.keys(ingredientColors);
    names.forEach((name,i)=>{
      const x=-1.45+(i%5)*.72;
      const y=1.42+Math.floor(i/5)*.55;
      const bottle=BABYLON.MeshBuilder.CreateCylinder("bottle-"+name,{height:.42,diameter:.13,tessellation:20},scene);
      bottle.position=new BABYLON.Vector3(x,y,1.78);
      bottle.material=createMaterial("mat-"+name,ingredientColors[name].scale(.55),.1,.18,ingredientColors[name].scale(.08));
      const cap=BABYLON.MeshBuilder.CreateCylinder("cap",{height:.08,diameter:.07,tessellation:16},scene);
      cap.parent=bottle; cap.position.y=.25; cap.material=metal;
    });

    shakerMesh=BABYLON.MeshBuilder.CreateCylinder("shaker",{height:.38,diameterTop:.2,diameterBottom:.16,tessellation:32},scene);
    shakerMesh.position=new BABYLON.Vector3(-.55,1.1,-.08);
    shakerMesh.material=metal;
    shakerLiquid=BABYLON.MeshBuilder.CreateCylinder("shakerLiquid",{height:.22,diameter:.135,tessellation:28},scene);
    shakerLiquid.parent=shakerMesh;
    shakerLiquid.position.y=-.03;
    const slm=new BABYLON.StandardMaterial("slm",scene); slm.alpha=.72; shakerLiquid.material=slm; shakerLiquid.isVisible=false;

    glassRoot=BABYLON.MeshBuilder.CreateCylinder("glass",{height:.34,diameterTop:.22,diameterBottom:.16,tessellation:32},scene);
    glassRoot.position=new BABYLON.Vector3(.58,1.08,-.08);
    const gm=new BABYLON.PBRMaterial("glassMat",scene);
    gm.albedoColor=new BABYLON.Color3(.72,.9,1); gm.alpha=.23; gm.metallic=.05; gm.roughness=.05;
    glassRoot.material=gm;
    glassLiquid=BABYLON.MeshBuilder.CreateCylinder("glassLiquid",{height:.23,diameterTop:.18,diameterBottom:.13,tessellation:28},scene);
    glassLiquid.parent=glassRoot; glassLiquid.position.y=-.02;
    const glm=new BABYLON.StandardMaterial("glm",scene); glm.alpha=.78; glassLiquid.material=glm; glassLiquid.isVisible=false;

    pourStream=BABYLON.MeshBuilder.CreateCylinder("stream",{height:.55,diameter:.018,tessellation:12},scene);
    pourStream.position=new BABYLON.Vector3(.05,1.3,-.08);
    pourStream.rotation.z=Math.PI/2;
    const psm=new BABYLON.StandardMaterial("streamMat",scene);
    psm.diffuseColor=new BABYLON.Color3(.2,.9,1); psm.emissiveColor=psm.diffuseColor.scale(.6); psm.alpha=.7;
    pourStream.material=psm; pourStream.isVisible=false;

    const signMat=createMaterial("sign",new BABYLON.Color3(.02,.06,.09),.1,.25,new BABYLON.Color3(.05,.7,1));
    const sign=createBox("sign",new BABYLON.Vector3(2.2,.55,.05),new BABYLON.Vector3(0,2.7,2.08),signMat);

    const guest=BABYLON.MeshBuilder.CreateCapsule("guest",{height:1.5,radius:.28,tessellation:16},scene);
    guest.position=new BABYLON.Vector3(0,1.1,.95);
    guest.material=createMaterial("guestMat",new BABYLON.Color3(.12,.02,.14),.35,.35,new BABYLON.Color3(.1,.01,.15));

    // Start desktop immediately. XR support is detected in parallel and can no longer block boot.
    scene.createDefaultXRExperienceAsync({
      floorMeshes:[scene.getMeshByName("floor")],
      disableTeleportation:false
    }).then(helper => {
      xrHelper=helper;
      $("vrBtn").disabled=false;
      $("vrBtn").textContent="In VR starten";
      $("vrBtn").addEventListener("click",async()=>{
        try{
          await xrHelper.baseExperience.enterXRAsync("immersive-vr","local-floor");
          startGame();
        }catch(err){
          $("bootStatus").textContent="VR konnte nicht gestartet werden. Öffne die Seite direkt im Meta Quest Browser.";
        }
      }, {once:true});
    }).catch(() => {
      $("vrBtn").disabled=true;
      $("vrBtn").textContent="VR nicht verfügbar";
    });

    return scene;
  }

  function buildIngredientButtons(){
    const wrap=$("ingredientButtons");
    for(const name of Object.keys(ingredientColors)){
      const b=document.createElement("button");
      b.className="ingredient-btn";
      b.innerHTML=`<span>${name}</span><small>+15 ml</small>`;
      b.addEventListener("click",()=>addIngredient(name,15));
      wrap.appendChild(b);
    }
  }

  function startGame(){
    $("boot").hidden=true;
    $("hud").hidden=false;
    $("renderCanvas").focus();
  }

  async function boot(){
    $("resultModal").hidden = true;
    if(typeof BABYLON==="undefined"){
      $("bootStatus").textContent="3D-Bibliothek konnte nicht geladen werden.";
      return;
    }

    $("bootStatus").textContent="Grafiksystem wird initialisiert …";
    engine=new BABYLON.Engine($("renderCanvas"),true,{
      preserveDrawingBuffer:false,
      stencil:true,
      adaptToDeviceRatio:true
    });

    await createScene();
    buildIngredientButtons();
    updateRecipe();
    updateGuest();
    updateHud();

    $("desktopBtn").disabled=false;
    $("desktopBtn").addEventListener("click",startGame);
    $("prevRecipe").addEventListener("click",()=>{recipeIndex=(recipeIndex-1+recipes.length)%recipes.length;updateRecipe()});
    $("nextRecipe").addEventListener("click",()=>{recipeIndex=(recipeIndex+1)%recipes.length;updateRecipe()});
    $("addIce").addEventListener("click",addIce);
    $("shake").addEventListener("click",shakeDrink);
    $("pourToGlass").addEventListener("click",pourToGlass);
    $("clearDrink").addEventListener("click",clearDrink);
    $("serveDrink").addEventListener("click",serve);
    $("glassSelect").addEventListener("change",e=>{glass.type=e.target.value;updateHud()});

    $("bootStatus").textContent="Bereit.";
    engine.runRenderLoop(()=>scene.render());
    addEventListener("resize",()=>engine.resize());
  }

  boot().catch(err=>{
    console.error(err);
    $("bootStatus").textContent="Startfehler: "+err.message;
  });
})();

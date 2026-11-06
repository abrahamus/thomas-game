/* Thomas's Sodor Delivery Races: original procedural cartoon models and world.
   Requires the pinned offline Three.js r170 and ThomasRaceCore. No network assets. */
(function (root) {
  'use strict';
  const T = root.THREE;
  if (!T) throw new Error('The embedded Three.js bundle is missing');
  const PI = Math.PI, TAU = PI * 2, RAIL_TOP = .30;
  const C = {outline:0x263e50,blue:0x159de0,blueDark:0x0874b5,red:0xe9453e,green:0x58ad50,cream:0xffe7a6,
    steel:0xb3c4c8,rail:0x637987,sleeper:0x7c6350,grass:0x8fc66b,grassLight:0xa7d57f,
    sky:0xb6def2,stone:0xb6b5a7,ballast:0xc0b7a0,wood:0xb27c4b,white:0xfffbef,face:0xd7dcdf};
  const matCache = new Map(), geoCache = new Map();
  function material(color, extra) {
    const key = color + ':' + JSON.stringify(extra || {});
    if (!matCache.has(key)) matCache.set(key,new T.MeshToonMaterial(Object.assign({color},extra)));
    return matCache.get(key);
  }
  function geometry(key, make) { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); }
  function mesh(geo,color,name,extra) {
    const m = new T.Mesh(geo,material(color,extra)); if(name)m.name=name;
    m.castShadow=true;m.receiveShadow=true;return m;
  }
  function add(parent,m,x=0,y=0,z=0) {m.position.set(x,y,z);parent.add(m);return m;}
  function roundedGeo(w,h,d,r=.08) {
    return geometry(['round',w,h,d,r].join(','),()=>{
      r=Math.min(r,w/3,h/3,d/3);const s=new T.Shape();
      const x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
      s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
      s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
      const g=new T.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r*.45,bevelSegments:2,steps:1,curveSegments:3});
      g.translate(0,0,-d/2+r);g.computeVertexNormals();return g;
    });
  }
  function box(p,w,h,d,color,x,y,z,name,r=.05) {return add(p,mesh(roundedGeo(w,h,d,r),color,name),x,y,z);}
  function plainBox(p,w,h,d,color,x,y,z,name) {
    return add(p,mesh(geometry(['box',w,h,d].join(','),()=>new T.BoxGeometry(w,h,d)),color,name),x,y,z);
  }
  function sphere(p,r,color,x,y,z,sx=1,sy=1,sz=1,name) {
    const m=add(p,mesh(geometry('sphere'+r,()=>new T.SphereGeometry(r,16,12)),color,name),x,y,z);m.scale.set(sx,sy,sz);return m;
  }
  function cyl(p,r,h,color,x,y,z,axis='y',name,top=r) {
    const m=add(p,mesh(geometry(['cyl',r,h,top].join(','),()=>new T.CylinderGeometry(top,r,h,20)),color,name),x,y,z);
    if(axis==='z')m.rotation.x=PI/2;if(axis==='x')m.rotation.z=PI/2;return m;
  }
  function torus(p,r,t,color,x,y,z,axis='z',name) {
    const m=add(p,mesh(geometry(['torus',r,t].join(','),()=>new T.TorusGeometry(r,t,6,24)),color,name),x,y,z);
    if(axis==='x')m.rotation.y=PI/2;if(axis==='y')m.rotation.x=PI/2;return m;
  }
  function line(p,points,r,color,name) {
    const curve=new T.CatmullRomCurve3(points.map(v=>new T.Vector3(...v)));
    const m=mesh(new T.TubeGeometry(curve,Math.max(8,points.length*3),r,6,false),color,name);p.add(m);return m;
  }
  function beam(p,a,b,r,color,name) {
    const av=new T.Vector3(...a),bv=new T.Vector3(...b),diff=bv.clone().sub(av);
    const m=mesh(new T.CylinderGeometry(r,r,diff.length(),6),color,name);m.position.copy(av.add(bv).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),diff.normalize());p.add(m);return m;
  }
  function label(p,text,w,h,color,x,y,z,side=0) {
    // Small name/number plaques use real modeled strokes, independent of fonts or image loads.
    const g=new T.Group();g.name='plaque-'+text;add(p,g,x,y,z);g.rotation.y=side;
    box(g,w,h,.025,C.blueDark,0,0,0,'plaque-border',.04);
    const patterns={1:['  #  ',' ##  ','  #  ','  #  ',' ### '],5:['#####','#    ','#### ','    #','#### '],6:[' ####','#    ','#### ','#   #',' ### '],B:['#### ','#   #','#### ','#   #','#### ']};
    const rows=patterns[text]||patterns.B;const cell=Math.min(w/6,h/6);
    rows.forEach((row,iy)=>[...row].forEach((v,ix)=>{if(v==='#')plainBox(g,cell*.93,cell*.93,.022,color,(ix-2)*cell,(2-iy)*cell,.028);}));
    return g;
  }
  function face(parent,x,y,z,r=.83) {
    const g=new T.Group();g.name='recognisable-smiling-face';add(parent,g,x,y,z);
    sphere(g,r,C.outline,0,0,-.02,1.055,1.055,.25,'face-rim');
    sphere(g,r,C.face,0,0,.015,1,1,.24,'face');
    for(const side of [-1,1]) {
      sphere(g,r*.235,C.white,side*r*.34,r*.22,r*.20,.76,1.3,.42,'eye-white');
      sphere(g,r*.122,0x30445c,side*r*.34,r*.21,r*.294,.74,1.25,.55,'eye-pupil');
      sphere(g,r*.044,0xffffff,side*r*.34-r*.026,r*.27,r*.354,.85,1,.4,'eye-highlight');
      line(g,[[side*r*.13,r*.53,r*.22],[side*r*.32,r*.61,r*.21],[side*r*.53,r*.52,r*.18]],r*.033,C.outline,'eyebrow');
      sphere(g,r*.14,0xb7c2ca,side*r*.57,-r*.2,r*.16,1.3,.45,.25,'cheek');
    }
    sphere(g,r*.15,0xb8c3ca,0,-r*.04,r*.30,.85,.72,.8,'nose');
    line(g,[[-r*.46,-r*.27,r*.20],[-r*.23,-r*.46,r*.245],[0,-r*.51,r*.26],[r*.23,-r*.46,r*.245],[r*.46,-r*.27,r*.20]],r*.032,C.outline,'smile');
    line(g,[[-r*.32,-r*.31,r*.255],[0,-r*.36,r*.28],[r*.32,-r*.31,r*.255]],r*.048,C.white,'smile-teeth');
    return g;
  }
  function makeWheel(parent,x,z,r,color) {
    const spin=new T.Group();spin.name='rolling-wheel';spin.userData.radius=r;add(parent,spin,x,r,z);
    cyl(spin,r,.13,C.outline,0,0,0,'x','wheel-tire');
    const side=Math.sign(x)||1;
    cyl(spin,r*.87,.14,color,side*.045,0,0,'x','wheel-face');
    torus(spin,r*.84,r*.044,0x79c8ef,side*.126,0,0,'x','wheel-rim');
    for(let j=0;j<8;j++) {
      const spoke=plainBox(spin,.045,r*1.55,r*.075,0xb3dbea,side*.123,0,0,'wheel-spoke');spoke.rotation.x=j*TAU/8;
    }
    cyl(spin,r*.2,.20,C.outline,side*.11,0,0,'x','wheel-hub');
    cyl(spin,r*.12,.23,C.red,side*.13,r*.48,0,'x','wheel-pin');
    return spin;
  }
  function contactShadow(parent,w,l) {
    const g=new T.CircleGeometry(1,28);const m=new T.Mesh(g,new T.MeshBasicMaterial({color:0x18313e,transparent:true,opacity:.16,depthWrite:false}));
    m.name='contact-shadow';m.rotation.x=-PI/2;m.scale.set(w,l,1);m.position.y=.018;parent.add(m);
  }
  function makeEngine(id='thomas') {
    if(['toby','spencer','emily','diesel'].includes(id))return makeNewEngine(id);
    const root=new T.Group();root.name='engine-'+id;
    const isJames=id==='james', isPercy=id==='percy';
    const color=isJames?C.red:isPercy?C.green:C.blue;
    const dark=isJames?0xa7242a:isPercy?0x327d3f:C.blueDark;
    const R=.570857142857;
    const wheelZ=isPercy?[-1.25,.9]:[-1.65,0,1.65];
    const length=isJames?6.5:isPercy?5.55:6.35;
    contactShadow(root,1.25,length*.55);
    box(root,2.32,.22,length,C.outline,0,1.06,0,'underframe',.06);
    box(root,2.38,.15,length+.12,C.red,0,1.22,0,'red-running-board',.05);
    box(root,2.04,.25,3.6,color,0,1.43,-.1,'lower-body');
    cyl(root,.86,3.5,color,0,2.23,.25,'z','rounded-boiler');
    cyl(root,.88,.74,C.outline,0,2.23,2.09,'z','smokebox');
    torus(root,.85,.055,0x253847,0,2.23,2.50,'z','smokebox-rim');
    face(root,0,2.23,2.52,.79);
    // Side tanks have contrasting lining and rounded corners.
    for(const side of [-1,1]) {
      box(root,.24,1.32,3.0,C.red,side*.91,2.12,-.2,'tank-red-lining',.07);
      box(root,.255,1.18,2.86,color,side*.928,2.12,-.2,'side-tank',.07);
      box(root,.035,.035,2.5,0x78d3fa,side*1.072,2.61,-.2,'tank-highlight',.01);
      label(root,isJames?'5':isPercy?'6':'1',1.05,.94,C.cream,side*1.077,2.13,-.25,side>0?PI/2:-PI/2);
      line(root,[[side*.79,2.72,1.49],[side*.82,2.91,.25],[side*.81,2.85,-1.43]],.035,C.cream,'boiler-hand-rail');
    }
    box(root,2.12,1.62,1.65,dark,0,2.42,-2.06,'cab');
    for(const side of [-1,1]) {
      box(root,.028,.87,1.04,C.cream,side*1.08,2.67,-2.07,'cab-window-rim',.05);
      box(root,.04,.72,.88,0x9cdded,side*1.102,2.69,-2.07,'cab-window',.05);
      box(root,.045,.05,.88,0x447c97,side*1.129,2.69,-2.07,'cab-window-bar',.01);
      line(root,[[side*1.14,1.62,-2.7],[side*1.14,2.34,-2.7],[side*1.14,2.78,-2.7]],.035,C.cream,'cab-grab-rail');
      box(root,.34,.12,.52,C.outline,side*1.06,.84,-2.62,'cab-step');
    }
    box(root,2.42,.19,1.97,C.outline,0,3.34,-2.06,'curved-cab-roof',.1);
    cyl(root,.24,1.05,C.outline,0,3.12,1.64,'y','funnel',.20);
    cyl(root,.31,.12,0x1e3143,0,3.68,1.64,'y','funnel-lip');
    cyl(root,.34,.34,color,0,3.16,-.10,'y','steam-dome');
    sphere(root,.34,color,0,3.33,-.1,1,.6,1);
    cyl(root,.07,.29,0xeab859,.50,3.43,-1.45,'y','whistle');
    for(const end of [-1,1]) {
      box(root,2.44,.31,.26,C.red,0,1.0,end*(length/2-.05),'buffer-beam');
      for(const side of [-1,1])cyl(root,.16,.27,C.outline,side*.77,1.0,end*(length/2+.14),'z','buffer');
      box(root,.14,.21,.2,C.outline,0,.82,end*(length/2+.19),'coupler');
    }
    const wheels=[];for(const side of [-1,1])for(const z of wheelZ)wheels.push(makeWheel(root,side*1.02,z,R,color));
    const rods=[];
    for(const side of [-1,1]) {
      const group=new T.Group();group.name='connecting-rod';root.add(group);
      box(group,.09,.11,wheelZ[wheelZ.length-1]-wheelZ[0],C.steel,side*1.21,R,(wheelZ[0]+wheelZ[wheelZ.length-1])/2,'rod',.035);
      for(const z of wheelZ)cyl(group,.10,.12,C.red,side*1.21,R,z,'x','crank-pin');
      rods.push(group);
    }
    if(isJames) {
      const tender=new T.Group();tender.name='james-tender';add(root,tender,0,0,-5.08);
      box(tender,2.2,.24,2.65,C.outline,0,.72,0,'tender-frame');
      box(tender,2.1,.16,2.7,C.red,0,.91,0,'tender-running-board');
      box(tender,1.9,1.28,2.4,dark,0,1.6,0,'tender-body');
      box(tender,2.02,.18,2.48,C.red,0,2.23,0,'tender-rim');
      const pile=new T.Group();pile.name='tender-coal';add(tender,pile,0,2.3,0);
      for(let i=0;i<12;i++)sphere(pile,.23,0x283940,(i%3-.9)*.5,.24+(i%2)*.08,(Math.floor(i/3)-1.5)*.47,1,.6,1,'coal-lump');
      for(const side of [-1,1])for(const z of [-.85,.85])wheels.push(makeWheel(tender,side*1.0,z,.4,color));
      contactShadow(tender,1.1,1.5);
    }
    root.userData={kind:id,wheels,rods,wheelRadius:R,wheelZ,tender:root.getObjectByName('james-tender'),steamOutlet:new T.Vector3(0,3.77,1.64)};
    return root;
  }
  function makeNewEngine(id) {
    const c=root.ThomasRaceCore.character(id),color=new T.Color(c.color).getHex(),g=new T.Group();g.name='engine-'+id;
    const toby=id==='toby',diesel=id==='diesel',emily=id==='emily',spencer=id==='spencer';
    const wheels=[],rods=[];contactShadow(g,1.25,3.5);
    box(g,2.3,.22,6.35,C.outline,0,1.0,0,'underframe');box(g,2.38,.15,6.45,C.red,0,1.18,0,'red-running-board');
    if(toby){
      box(g,2.25,1.85,5.7,color,0,2.13,0,'wooden-tram-body');
      for(const side of [-1,1]){
        for(let z=-2.6;z<=2.6;z+=.36)box(g,.045,1.75,.045,0x64452f,side*1.14,2.13,z,'wooden-panel-seam');
        for(const z of [-1.9,1.9]){box(g,.06,.72,.72,C.cream,side*1.17,2.62,z,'tram-window-rim');box(g,.065,.57,.57,0x9cdded,side*1.2,2.63,z,'cab-window');}
        box(g,.15,.64,5.55,0x69564a,side*1.17,.81,0,'tram-side-skirt');
      }
      box(g,2.55,.20,6.08,0x454b46,0,3.19,0,'tram-broad-roof');cyl(g,.19,.39,C.outline,0,3.46,1.9,'y','funnel');
      for(const end of [-1,1])for(let i=-3;i<=3;i++)beam(g,[i*.32,.42,end*3.25],[i*.32,.98,end*2.9],.045,0x53483a,'tram-cowcatcher');
      face(g,0,2.15,2.9,.74);
    }else if(diesel){
      box(g,1.85,1.3,4.2,color,0,1.96,.65,'diesel-long-hood');
      box(g,2.2,2.05,1.7,0x303a43,0,2.23,-2.08,'diesel-square-cab');box(g,2.4,.17,1.98,C.outline,0,3.34,-2.08,'diesel-flat-roof');
      for(const side of [-1,1]){
        box(g,.045,.75,.98,0x9cdded,side*1.12,2.7,-2.06,'cab-window');
        for(let i=0;i<10;i++)box(g,.045,.80,.075,0x6d7d84,side*.95,2.05,-.9+i*.3,'diesel-vent-grille');
      }
      cyl(g,.11,.25,C.outline,.45,2.74,.4,'y','diesel-exhaust-pipe');face(g,0,1.98,2.82,.73);
    }else{
      cyl(g,.88,3.6,color,0,2.23,.35,'z','rounded-boiler');
      if(spencer){
        sphere(g,1,color,0,2.22,1.85,1.02,1.08,1.05,'streamlined-silver-nose');
        for(const side of [-1,1])box(g,.18,.48,4.65,0x8497aa,side*1.05,1.43,.30,'streamlined-side-valance');
        box(g,.2,.16,3.7,0xdbe3e8,0,3.13,.4,'streamlined-top-ridge');
      }else{
        cyl(g,.89,.68,C.outline,0,2.23,2.10,'z','smokebox');cyl(g,.30,.48,0xd7b85e,0,3.18,-.15,'y','brass-dome');
        for(const side of [-1,1])beam(g,[side*.87,2.65,-1.4],[side*.87,2.65,1.5],.04,0xddc270,'brass-hand-rail');
      }
      face(g,0,2.23,2.8,.79);
      box(g,2.1,1.55,1.65,color,0,2.43,-2.07,'cab');box(g,2.42,.19,1.97,C.outline,0,3.34,-2.07,'curved-cab-roof');
      for(const side of [-1,1]){box(g,.045,.8,.95,C.cream,side*1.07,2.7,-2.07,'cab-window-rim');box(g,.055,.65,.78,0x9cdded,side*1.1,2.72,-2.07,'cab-window');}
      cyl(g,spencer?.22:.25,spencer?.48:.70,C.outline,0,3.32,1.5,'y','funnel');
    }
    const wheelSpec=emily?[[-1.9,.43],[0,.87],[1.9,.43]]:[[-1.65,.570857142857],[0,.570857142857],[1.65,.570857142857]];
    for(const side of [-1,1])for(const[z,r]of wheelSpec)wheels.push(makeWheel(g,side*1.02,z,r,diesel?0x53616b:color));
    if(!toby&&!emily)for(const side of [-1,1]){const rod=new T.Group();rod.name='connecting-rod';g.add(rod);box(rod,.09,.11,3.3,C.steel,side*1.21,.570857142857,0,'rod');rods.push(rod);}
    for(const side of [-1,1])for(const end of [-1,1])cyl(g,.16,.27,C.outline,side*.77,1,end*3.25,'z','buffer');
    let tender;
    if(c.tenderOffset){
      const source=makeEngine('james');tender=source.userData.tender;source.remove(tender);tender.name=id+'-tender';g.add(tender);
      tender.traverse(o=>{if(['tender-body','tender-running-board','tender-rim','wheel-face'].includes(o.name))o.material=material(color);});
      wheels.push(...source.userData.wheels.filter(w=>w.parent===tender));
    }
    g.userData={kind:id,wheels,rods,wheelRadius:emily?.87:.570857142857,tender,
      steamOutlet:new T.Vector3(diesel?.45:0,diesel?2.88:toby?3.67:spencer?3.59:3.73,toby?1.9:diesel?.4:1.5)};
    return g;
  }
  function makeHarold() {
    const g=new T.Group();g.name='vehicle-harold';
    sphere(g,1,0xf1eee3,0,1.55,0,1.23,1.12,2.38,'helicopter-fuselage');
    sphere(g,1,0xa9d9e4,0,2.03,1.17,1.04,.67,1.14,'helicopter-cockpit');
    face(g,0,1.54,2.29,.76);
    for(const side of [-1,1]){
      for(const z of [-1.15,-.25,.65]){box(g,.035,.64,.65,0x8fc4d2,side*1.18,1.95,z,'cabin-window');const glass=box(g,.015,.60,.61,0xaadce6,side*1.26,1.95,z,'cabin-glazing');glass.material=material(0xaadce6,{transparent:true,opacity:.18,depthWrite:false});glass.castShadow=false;}
      box(g,.055,.10,2.8,C.red,side*1.20,1.31,-.12,'harold-red-stripe');
      // Modeled H insignia reads at the game camera without a texture/font.
      for(const z of [-1.35,-.91])box(g,.06,.43,.07,C.red,side*1.19,1.45,z,'harold-letter');
      box(g,.06,.07,.48,C.red,side*1.19,1.45,-1.13,'harold-letter');
      line(g,[[side*1.25,.23,-2.2],[side*1.25,.08,-1.9],[side*1.25,.08,1.85],[side*1.25,.35,2.25]],.085,C.steel,'landing-skid');
      for(const z of [-1.25,1.15])beam(g,[side*.75,.7,z],[side*1.25,.15,z],.07,C.steel,'skid-support');
    }
    const tail=beam(g,[0,1.65,-1.85],[0,2.22,-5.65],.22,0xe6e6dc,'helicopter-tail-boom');
    box(g,.10,1.65,.96,C.white,0,2.55,-5.65,'helicopter-tail-fin');box(g,.12,.26,.98,C.red,0,3.18,-5.65,'red-tail-tip');
    box(g,2.30,.12,.70,0xe3e5de,0,2.15,-4.45,'tail-stabilizer');
    cyl(g,.13,.50,C.steel,0,2.88,0,'y','rotor-mast');
    const rotor=new T.Group();rotor.name='main-rotor';add(g,rotor,0,3.18,0);
    cyl(rotor,.28,.16,C.red,0,0,0,'y','rotor-hub');
    for(let i=0;i<4;i++){const blade=new T.Group();rotor.add(blade);blade.rotation.y=i*PI/2;box(blade,.24,.055,4.35,0x344c58,0,.04,2.32,'rotor-blade');box(blade,.26,.065,.45,C.cream,0,.04,4.28,'rotor-tip');}
    const tailRotor=new T.Group();tailRotor.name='tail-rotor';add(g,tailRotor,.28,2.52,-5.65);
    for(const a of [0,PI/2]){const blade=box(tailRotor,.07,1.65,.15,C.red,0,0,0,'tail-rotor-blade');blade.rotation.x=a;}
    const beacon=sphere(g,.12,0xffd24f,0,2.64,-.85,1,.6,1,'helicopter-beacon');
    g.userData={kind:'harold',wheels:[],rods:[],wheelRadius:1,steamOutlet:null,rotor,tailRotor,beacon};return g;
  }
  function makeFlightPayload(theme) {
    const g=new T.Group();g.name='helicopter-payload';
    const doors=[],doorThresholds=[],occupants=[];
    for(const side of [-1,1]){
      const door=new T.Group();door.name='helicopter-cabin-door';add(g,door,side*1.24,.68,1.05);
      box(door,.04,.80,.85,0xe6e4d9,0,.4,-.40,'cabin-door-panel');
      for(const z of [-.8,0])box(door,.04,.77,.045,C.white,0,1.17,z,'cabin-door-frame');
      const glass=box(door,.015,.64,.75,0xaadce6,side*.03,1.27,-.4,'cabin-door-window');glass.material=material(0xaadce6,{transparent:true,opacity:.18,depthWrite:false});glass.castShadow=false;doors.push(door);
      const threshold=new T.Object3D();threshold.position.set(side*1.27,.65,.65);g.add(threshold);doorThresholds.push(threshold);door.visible=theme==='passengers';
    }
    for(let i=0;i<3;i++){
      const pair=new T.Group();pair.name='carried-passenger-group';
      for(const side of [-1,1]){const seated=new T.Group();seated.name='seated-cabin-passenger';add(pair,seated,side*1.195,1.67,-1.15+i*.9);box(seated,.04,.19,.25,[0xb55365,0x528ea6,0xe4b951][i],0,.095,0,'passenger-shoulders');sphere(seated,.11,0xf0c399,0,.31,0,.28,1,1,'passenger-head');sphere(seated,.115,0x715543,0,.37,-.02,.28,.45,1,'passenger-hair');}
      g.add(pair);occupants.push(pair);
    }
    const container=makeContainer();container.scale.setScalar(.48);add(g,container,0,-2.55,0);container.visible=false;
    const sling=cyl(g,.028,1,C.outline,0,0,0,'y','cargo-sling-cable');
    const hook=torus(g,.10,.032,C.steel,0,-1.83,0,'z','cargo-sling-hook');
    g.userData={kind:'flight-payload',wheels:[],rods:[],wheelRadius:1,doors,doorThresholds,occupants,container,sling,hook,deliveryTheme:theme};return g;
  }
  function setCable(cable,a,b){
    const diff=b.clone().sub(a);cable.position.copy(a.clone().add(b).multiplyScalar(.5));cable.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),diff.clone().normalize());cable.scale.set(1,Math.max(.01,diff.length()),1);
  }
  function makeVehicle(id){const type=root.ThomasRaceCore.character(id).vehicleType;return type==='air'?makeHarold():type==='road'?makeBertie(id):makeEngine(id);}

  function makeBertie(id='bertie') {
    const g=new T.Group();g.name='vehicle-'+id;contactShadow(g,1.18,2.9);
    box(g,2.08,.27,5.5,C.outline,0,.68,0,'bus-chassis');
    box(g,2.18,1.25,5.5,C.red,0,1.37,0,'red-bus-body',.14);
    box(g,2.12,1.14,4.65,0xde3e35,0,2.40,-.28,'bus-upper-body',.13);
    box(g,2.25,.19,4.83,0xa72828,0,3.04,-.28,'bus-roof',.12);
    for(const side of [-1,1]) {
      for(let j=0;j<4;j++) {
        box(g,.035,.72,.78,C.cream,side*1.09,2.49,-1.8+j*1.02,'bus-window-border',.05);
        box(g,.044,.58,.65,0x9ed9e9,side*1.12,2.50,-1.8+j*1.02,'bus-window',.04);
      }
      box(g,.035,.09,5.0,C.cream,side*1.12,1.65,-.05,'bus-cream-lining');
    }
    box(g,1.8,.70,.03,0xa5dfed,0,2.49,2.08,'front-windscreen',.07);
    box(g,.07,.71,.05,C.cream,0,2.49,2.11,'windscreen-divider');
    face(g,0,1.53,2.80,.62);
    box(g,2.28,.19,.22,C.cream,0,.87,2.82,'front-bumper');
    for(const side of [-1,1])sphere(g,.14,0xffedac,side*.85,1.15,2.79,1,1,.5,'headlamp');
    const wheels=[];for(const side of [-1,1])for(const z of [-1.65,1.63]) {
      const w=new T.Group();w.name='rolling-road-wheel';w.userData.radius=.48;add(g,w,side*1.03,.48,z);
      cyl(w,.48,.22,0x263c49,0,0,0,'x','rubber-tire');
      cyl(w,.29,.25,0xb9beb7,side*.03,0,0,'x','bus-hubcap');
      cyl(w,.10,.28,0x6a7b80,side*.04,0,0,'x','bus-hub');
      for(let j=0;j<5;j++)cyl(w,.032,.29,C.cream,side*.04,Math.cos(j*TAU/5)*.18,Math.sin(j*TAU/5)*.18,'x','wheel-bolt');
      wheels.push(w);
    }
    if(id==='bulgy'){
      g.getObjectByName('bus-roof').position.y=4.08;
      box(g,2.12,1.06,4.65,0xcc3434,0,3.45,-.28,'double-decker-upper-floor');
      for(const side of [-1,1])for(let j=0;j<4;j++){
        box(g,.04,.72,.78,C.cream,side*1.09,3.57,-1.8+j*1.02,'upper-window-border');
        box(g,.05,.58,.65,0x9ed9e9,side*1.12,3.58,-1.8+j*1.02,'upper-deck-window');
      }
      box(g,1.8,.7,.05,0xa5dfed,0,3.58,2.08,'upper-front-windscreen');
    }
    g.userData={kind:id,wheels,rods:[],wheelRadius:.48,steamOutlet:null};return g;
  }

  function makeCoach(road=false) {
    const g=new T.Group();g.name=road?'bertie-coach-trailer':'railway-coach-coach';
    contactShadow(g,1.3,2.65);box(g,2.28,.22,4.95,C.outline,0,.83,0,'coach-underframe');
    box(g,2.34,.14,4.97,C.red,0,1.00,0,'coach-running-board');
    box(g,2.12,1.21,4.60,0xb83f38,0,1.69,0,'coach-coach-body',.10);
    box(g,2.19,.14,4.69,C.cream,0,2.29,0,'coach-cream-roof-lining');
    box(g,2.37,.21,4.91,0x394e5b,0,2.45,0,'coach-rounded-roof',.10);
    for(const side of [-1,1]) {
      box(g,.028,.065,4.35,C.cream,side*1.075,1.25,0,'coach-body-lining');
      box(g,.04,.99,1.17,0x983b37,side*1.082,1.72,0,'coach-sliding-door',.035);
      box(g,.07,.25,.07,0xe8d9aa,side*1.12,1.72,.40,'coach-door-handle');
    }
    for(const end of [-1,1]) {
      box(g,.14,.16,.22,C.outline,0,.82,end*2.60,'coach-coupler');
      if(!road)for(const side of [-1,1])cyl(g,.12,.22,C.outline,side*.77,.95,end*2.56,'z','coach-buffer');
    }
    const wheels=[];for(const side of [-1,1])for(const z of [-1.55,1.55]) {
      const wheel=makeWheel(g,side*1.02,z,road?.43:.40,road?0x4b5960:0xb5473f);wheels.push(wheel);
    }
    g.userData={kind:road?'road-trailer':'coach',wheels,rods:[],wheelRadius:road?.43:.40};return g;
  }
  function makePerson(color=0x4b8ea5, scale=1) {
    const g=new T.Group();g.name='friendly-passenger';g.scale.setScalar(scale);
    for(const x of [-.12,.12]){box(g,.17,.53,.23,0x3d5064,x,.34,0,'passenger-trousers');box(g,.22,.12,.34,C.outline,x,.07,.04,'passenger-shoe');}
    box(g,.56,.63,.32,color,0,.92,0,'passenger-coat',.08);
    sphere(g,.23,0xf0c399,0,1.45,0,1,1.08,1,'passenger-head');
    sphere(g,.24,0x715543,0,1.58,-.04,1,.55,1,'passenger-hair');
    for(const x of [-.074,.074])sphere(g,.022,C.outline,x,1.48,.22,1,1,.5,'passenger-eye');
    const left=beam(g,[-.26,1.14,0],[-.34,.76,0],.075,color,'passenger-arm'),right=new T.Group();right.name='passenger-waving-arm';add(g,right,.25,1.12,0);beam(right,[0,0,0],[.14,-.34,0],.075,color);sphere(right,.075,0xf0c399,.14,-.37,0);
    g.userData={waveArm:right};return g;
  }
  function makeContainer() {
    const g=new T.Group();g.name='delivery-container';box(g,1.98,1.38,3.75,0x58a79d,0,.69,0,'container-body',.07);
    for(const side of [-1,1])for(let z=-1.6;z<=1.6;z+=.4)box(g,.055,1.22,.075,0x79c2b3,side*1.02,.69,z,'container-rib',.015);
    for(const x of [-.94,.94])for(const z of [-1.80,1.80])box(g,.11,.16,.13,0xe5d6a3,x,1.31,z,'container-lifting-corner');
    for(const x of [-.5,.5]){box(g,.89,1.19,.04,0x65b3a5,x,.68,1.90,'container-door');box(g,.045,1.00,.06,C.cream,x+.20,.68,1.94,'container-lock-bar');}
    return g;
  }
  function makeDeliveryCoach(theme='passengers',road=false) {
    const g=makeCoach(road);g.userData.deliveryTheme=theme;
    const original=[];g.traverse(o=>{if(o.isMesh&&['coach-coach-body','coach-cream-roof-lining','coach-rounded-roof','coach-sliding-door','coach-door-handle','coach-body-lining'].includes(o.name))original.push(o);});
    if(theme==='cargo') {
      original.forEach(o=>o.visible=false);g.name=road?'bertie-container-trailer':'container-flat-wagon';
      box(g,2.19,.22,4.6,0xb27b48,0,1.22,0,'timber-container-deck');

      for(const side of [-1,1])for(const z of [-1.9,1.9])box(g,.16,.22,.2,0xe3bf62,side*1.06,1.42,z,'container-lock');
    } else {
      g.name=road?'bertie-passenger-trailer':'passenger-coach';
      g.traverse(o=>{if(o.name==='coach-coach-body')o.material=material(0xc98043);});
      for(const side of [-1,1])for(const z of [-1.45,1.45]) {
        box(g,.048,.61,.80,C.cream,side*1.115,1.83,z,'passenger-window-frame',.035);
        box(g,.052,.48,.65,0x85c9d9,side*1.147,1.84,z,'passenger-window',.025);
      }
    }
    const doors=[],doorThresholds=[];for(const side of [-1,1]) {
      const door=new T.Group();door.name='working-passenger-door';add(g,door,side*1.12,1.22,.55);
      box(door,.055,1.01,.95,0xa45f37,0,.51,-.48,'passenger-door-panel',.035);box(door,.06,.44,.57,0xb6e1e8,side*.02,.74,-.47,'passenger-door-glass');doors.push(door);
      const threshold=new T.Object3D();threshold.name='passenger-door-threshold';threshold.position.copy(door.position).add(new T.Vector3(0,0,-.48));g.add(threshold);doorThresholds.push(threshold);door.userData.threshold=threshold;
      door.visible=theme==='passengers';
    }
    const occupants=[];for(let i=0;i<3;i++) {
      const pair=new T.Group();pair.name='carried-passenger-group';for(const side of [-1,1]){const p=makePerson([0xa84554,0x4c95b7,0xe3b54e][i],.48);add(pair,p,side*1.18,1.30,(i-1)*1.45);p.rotation.y=side>0?PI/2:-PI/2;}g.add(pair);occupants.push(pair);
    }
    const container=makeContainer();add(g,container,0,1.36,0);container.visible=false;
    g.userData.doors=doors;g.userData.doorThresholds=doorThresholds;g.userData.occupants=occupants;g.userData.container=container;return g;
  }
  function makeMud(engine) {
    const road=root.ThomasRaceCore.character(engine.userData.kind).vehicleType==='road';
    const specs=engine.userData.kind==='harold'?[[1.28,1.85,-1.3],[1.28,1.85,-.4],[1.28,1.85,.5],[1.28,1.15,-1.3],[1.28,1.15,-.4],[1.28,1.15,.5],[.4,1.7,2.7]]:road||engine.userData.kind==='toby'?[[1.2,2.5,-2],[1.2,2.5,-.8],[1.2,2.5,.4],[1.2,2.5,1.6],[1.2,1.45,-1.5],[1.2,1.45,0],[1.2,1.45,1.5]]:[[1.10,2.0,-.8],[1.10,2.42,.5],[1.10,2.02,1.1],[1.20,2.57,-1.7],[.35,3.02,.5],[.65,1.34,2.8],[1.25,1.24,-1.3]],patches=[];
    for(let i=0;i<specs.length;i++){const [x,y,z]=specs[i],g=new T.Group();g.name='washable-mud-patch';g.userData.patchId=i;add(engine,g,x,y,z);for(let j=0;j<3;j++)sphere(g,.23,0x8b6545,(j%2)*.16,(j-1)*.12,(j%2)*.13,Math.abs(x)<.8?1:.35,1.05,1.3,'mud-splodge');patches.push(g);}const gauge=new T.Group();gauge.name='engine-water-level-gauge';add(engine,gauge,1.18,1.56,-.35);box(gauge,.06,.76,.22,C.cream,0,.38,0,'water-gauge-rim');box(gauge,.075,.64,.14,0xd2edf0,.015,.38,0,'water-gauge-glass');const level=box(gauge,.085,.54,.10,0x50b9d5,.025,.33,0,'engine-water-level');gauge.visible=false;engine.userData.waterGauge={group:gauge,level};engine.userData.mudPatches=patches;return patches;
  }
  function makeCoalBunker(engine) {
    if(root.ThomasRaceCore.character(engine.userData.kind).power!=='steam')return;
    if(engine.userData.tender){engine.userData.coalFill=engine.getObjectByName('tender-coal');return;}
    const g=new T.Group();g.name='coal-bunker';add(engine,g,.75,1.65,-2.96);
    const color=root.ThomasRaceCore.character(engine.userData.kind).color;
    for(const x of [-.85,.85])box(g,.12,.72,.65,color,x,.30,0,'bunker-side');
    box(g,1.8,.72,.1,color,0,.30,-.36,'bunker-back');
    const fill=new T.Group();fill.name='bunker-coal';add(g,fill,0,.4,0);
    for(let i=0;i<9;i++)sphere(fill,.20,0x34454c,(i%3-1)*.52,.20+Math.floor(i/3)*.09,(Math.floor(i/3)-1)*.17,1.3,.8,1,'coal-lump');
    engine.userData.coalFill=fill;
  }
  function makeCrane(parent,x,z) {
    const g=new T.Group();g.name='delivery-yard-crane';add(parent,g,x,0,z);
    box(g,2.6,1.1,2.7,0xb3b6ab,0,.25,0,'crane-foot');cyl(g,.30,6.8,0xe1b54e,0,4.2,0,'y','crane-tower');
    const height=7.6,boom=new T.Group();boom.name='crane-turning-boom';add(g,boom,0,height,0);
    box(boom,8.4,.30,.38,0xe4bb5a,-3.9,0,0,'fixed-crane-arm');beam(boom,[0,1,0],[-7.9,.15,0],.045,C.steel,'crane-stay');
    box(boom,.25,1.3,.25,0xe4bb5a,0,.5,0);box(boom,1.1,.8,1,0x647278,.85,-.22,0,'crane-counterweight');
    const trolley=new T.Group();trolley.name='pulley-carriage';boom.add(trolley);box(trolley,.6,.30,.5,C.steel,0,.18,0);
    const pulley=cyl(trolley,.19,.15,C.outline,0,0,0,'z','rope-pulley'),drum=cyl(boom,.24,.42,C.steel,0,-.55,0,'z','hoist-winding-drum');
    for(let i=0;i<5;i++)torus(boom,.25,.035,C.outline,0,-.55,(i-2)*.07);
    const palette=[0x52636b,0x94a6aa],feed=makeRope(boom,'pulley-feed-rope',.035,palette),cable=makeRope(boom,'flexible-hoist-rope',.045,palette);
    const hook=new T.Group();hook.name='crane-hook';boom.add(hook);torus(hook,.13,.04,C.steel,0,0,0);
    const crane={group:g,boom,trolley,pulley,drum,feed,cable,hook,height};poseJibCrane(crane,new T.Vector3(x-5,4,z),false,0);return crane;
  }
  function makeRope(parent,name='flexible-hoist-rope',radius=.045,palette=[0xc99f63,0xedd2a1]){
    // Reuse a small woven tube buffer; never allocate new geometry per frame.
    const rings=20,sides=8,positions=new Float32Array((rings+1)*sides*3),colors=new Float32Array(positions.length),indices=[];
    for(let i=0;i<=rings;i++)for(let j=0;j<sides;j++){
      const k=(i*sides+j)*3,c=new T.Color((i+j)%3?palette[0]:palette[1]);colors.set([c.r,c.g,c.b],k);
      if(i<rings){const a=i*sides+j,b=i*sides+(j+1)%sides;indices.push(a,b,a+sides,b,b+sides,a+sides);}
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geo.setAttribute('color',new T.BufferAttribute(colors,3));geo.setIndex(indices);
    const rope=mesh(geo,0xffffff,name,{vertexColors:true});rope.userData={rings,sides,radius};parent.add(rope);return rope;
  }
  function makeContainerLift(slot,core,course,character){
    // A fixed berth prevents a finished crane from following a departing wagon.
    const parked=new T.Object3D();transformRoute(parked,core.sampleRoute(course,slot.spec.at-character.coachOffset,slot.who==='player'?0:core.ROAD_LANE),slot.road?-.015:RAIL_TOP);parked.updateMatrixWorld(true);
    slot.group.updateMatrixWorld(true);
    slot.cargoBerth=slot.group.worldToLocal(new T.Vector3(0,1.36,0).applyMatrix4(parked.matrixWorld));
    slot.cargoBerthRotation=slot.group.getWorldQuaternion(new T.Quaternion()).invert().multiply(parked.quaternion);
    slot.cargoYard=new T.Vector3(3.8,.53,slot.cargoBerth.z+4);
    slot.crane=makeCrane(slot.group,6.2,slot.cargoBerth.z+4);
    const spreader=new T.Group();spreader.name='four-corner-container-spreader';slot.group.add(spreader);slot.spreader=spreader;slot.containerLocks=[];
    for(const x of [-.94,.94])box(spreader,.14,.14,3.6,0xe6b44e,x,0,0,'spreader-side');
    for(const z of [-1.8,1.8])box(spreader,1.88,.14,.14,0xe6b44e,0,0,z,'spreader-end');
    for(const x of [-.94,.94])for(const z of [-1.8,1.8]){
      beam(spreader,[x,.06,z],[0,.85,0],.035,C.steel,'spreader-suspension-leg');
      const pin=new T.Group();pin.name='container-twist-lock';add(spreader,pin,x,-.12,z);
      cyl(pin,.04,.16,C.outline,0,0,0);box(pin,.16,.045,.065,C.steel,0,-.065,0);slot.containerLocks.push(pin);
    }
    torus(spreader,.10,.03,C.steel,0,.85,0,'z','spreader-lifting-eye');
    slot.container=makeContainer();slot.container.position.copy(slot.cargoYard);slot.group.add(slot.container);slot.container.userData.targetId='container-1';slot.targets.push({object:slot.container,id:'container-1'});
  }
  function updateContainerLift(slot,state,t,working,done,time){
    const unloading=slot.spec.type==='cargo-unload',from=unloading?slot.cargoBerth:slot.cargoYard,to=unloading?slot.cargoYard:slot.cargoBerth;
    const yardRotation=new T.Quaternion(),fromRotation=unloading?slot.cargoBerthRotation:yardRotation,toRotation=unloading?yardRotation:slot.cargoBerthRotation;
    const ease=(a,z)=>{const u=Math.max(0,Math.min(1,(t-a)/(z-a)));return u*u*(3-2*u);},travel=done?1:working?ease(.40,.68):0,clearY=Math.max(from.y,to.y)+3;
    const load=slot.container;load.position.copy(from).lerp(to,travel);load.quaternion.slerpQuaternions(fromRotation,toRotation,travel);load.scale.setScalar(1);
    if(working)load.position.y=from.y+(clearY-from.y)*ease(.24,.40)+(to.y-clearY)*ease(.68,.82);
    load.visible=unloading?working||done:!done;
    // The frame locks all four roof corners before lifting. The container stays
    // level, moves vertically at either end, and is grounded before unlocking.
    const gap=done?2.1:working?2.1*(1-ease(0,.18)+ease(.90,1)):2.1;
    slot.spreader.quaternion.copy(load.quaternion);slot.spreader.position.copy(load.position).add(new T.Vector3(0,1.48+gap,0).applyQuaternion(load.quaternion));
    const locked=working?ease(.18,.24)*(1-ease(.82,.90)):0;
    slot.containerLocks.forEach(pin=>pin.rotation.y=locked*PI/2);
    const hook=slot.spreader.position.clone().add(new T.Vector3(0,.85,0).applyQuaternion(slot.spreader.quaternion));
    poseJibCrane(slot.crane,hook,working&&t>=.24&&t<.82,time);
    slot.crane.group.userData.liftStage=done?'parked':!working?'waiting':t<.18?'lower-frame':t<.24?'lock':t<.40?'lift':t<.68?'transfer':t<.82?'lower-load':t<.90?'unlock':'retract';
  }
  function poseRope(rope,top,bottom,slack=0){
    const pose=[...top.toArray(),...bottom.toArray(),slack];
    if(rope.userData.lastPose?.every((v,i)=>v===pose[i]))return;rope.userData.lastPose=pose;
    const {rings,sides,radius}=rope.userData,axis=bottom.clone().sub(top).normalize(),across=new T.Vector3(0,0,1).cross(axis).normalize();
    if(across.lengthSq()<.1)across.set(1,0,0);
    const other=axis.clone().cross(across).normalize(),p=rope.geometry.attributes.position,centre=new T.Vector3(),v=new T.Vector3();
    for(let i=0;i<=rings;i++){
      const u=i/rings;centre.copy(top).lerp(bottom,u).addScaledVector(across,Math.sin(u*PI)*slack);
      for(let j=0;j<sides;j++){const a=j*TAU/sides+u*TAU*2;v.copy(centre).addScaledVector(across,Math.cos(a)*radius).addScaledVector(other,Math.sin(a)*radius);p.setXYZ(i*sides+j,v.x,v.y,v.z);}
    }
    p.needsUpdate=true;rope.geometry.computeVertexNormals();rope.geometry.computeBoundingSphere();rope.geometry.computeBoundingBox();
  }
  function makeObstacleCrane(parent,x,z){
    const g=new T.Group();g.name='obstacle-sling-crane';add(parent,g,x,0,z);
    box(g,2.6,.55,2.7,0xb2b5a5,0,.1,0,'crane-foot');box(g,.44,6.2,.44,C.wood,0,3.1,0,'timber-crane-mast');
    for(const side of [-1,1])beam(g,[side*1.1,.2,0],[0,2.6,0],.12,C.wood,'mast-brace');
    const boom=new T.Group();boom.name='fixed-timber-jib';add(g,boom,0,6.2,0);
    box(boom,9,.3,.32,C.wood,-4.1,0,0,'fixed-crane-arm');beam(boom,[0,1.2,0],[-8.4,.15,0],.035,C.steel,'crane-support-wire');
    box(boom,.35,1.4,.35,C.wood,0,.6,0);box(boom,1,.8,.9,0x6a7477,.7,-.25,0,'crane-counterweight');
    const trolley=new T.Group();trolley.name='pulley-carriage';boom.add(trolley);
    box(trolley,.55,.28,.48,C.steel,0,.2,0);const pulley=cyl(trolley,.19,.14,C.outline,0,0,0,'z','rope-pulley');torus(trolley,.15,.025,C.steel,0,0,.09);
    const drum=cyl(boom,.23,.42,C.steel,0,-.55,0,'z','hoist-winding-drum');for(let i=0;i<5;i++)torus(boom,.24,.035,0xc99f63,0,-.55,(i-2)*.07);
    const feed=makeRope(boom,'pulley-feed-rope',.035),cable=makeRope(boom),hook=new T.Group();hook.name='crane-hook';boom.add(hook);
    line(hook,[[0,.06,0],[0,-.12,0],[.12,-.23,0],[.25,-.12,0],[.23,-.04,0]],.045,C.steel,'open-metal-hook');
    const crane={group:g,boom,trolley,pulley,drum,feed,cable,hook,height:6.2};poseJibCrane(crane,new T.Vector3(x-6,3.8,z),false,0);return crane;
  }
  function poseJibCrane(crane,hookPoint,attached,time){
    const dx=hookPoint.x-crane.group.position.x,dz=hookPoint.z-crane.group.position.z,r=Math.hypot(dx,dz);
    crane.boom.rotation.y=Math.atan2(dz,-dx);crane.trolley.position.set(-r,0,0);
    const bottom=new T.Vector3(-r,hookPoint.y-crane.height,0);crane.hook.position.copy(bottom);
    poseRope(crane.cable,new T.Vector3(-r,.02,0),bottom,attached?.012:.07*Math.sin(time*3));
    poseRope(crane.feed,new T.Vector3(0,-.32,.07),new T.Vector3(-r,.18,.07),.035);
    crane.drum.rotation.z=(crane.height-hookPoint.y)*3;crane.pulley.rotation.z=crane.drum.rotation.z;
  }
  function fitObstacleSling(object,branch=false){
    const g=new T.Group();g.name=branch?'branch-two-point-sling':'rock-rope-cradle';object.add(g);g.visible=false;
    const top=branch?1.25:1.12;
    if(branch)for(const x of [-1.7,1.7]){
      torus(g,.29,.045,0xd1ac76,x,.07,0,'x','branch-rope-loop');line(g,[[x,.22,0],[x*.5,.65,0],[0,top,0]],.045,0xd1ac76,'branch-sling-leg');
    }else for(const a of [0,PI/2,PI/4,-PI/4]){
      const points=[[-.87,.16],[-.70,-.56],[0,-.88],[.70,-.56],[.87,.16],[0,top]].map(([x,y])=>[Math.cos(a)*x,y,Math.sin(a)*x]);
      points.unshift([0,top,0]);line(g,points,.045,0xd1ac76,'rock-supporting-rope');
    }
    object.userData.obstacleSling=g;object.userData.slingTop=top;return g;
  }
  function addObstacleRigger(slot){
    slot.obstacleRigger=makePerson(0xe9b64f,.9);add(slot.group,slot.obstacleRigger,3.3,0,5);
    slot.dropRigger=makePerson(0xe9b64f,.9);add(slot.group,slot.dropRigger,9.7,0,16);
  }
  function updateObstacleLift(slot,state,t,working,done,time){
    const crane=slot.groundCrane||slot.crane,loads=slot.airRocks||slot.rocks||[slot.branch],branch=!!slot.branch;
    const ease=(a,z)=>{const u=Math.max(0,Math.min(1,(t-a)/(z-a)));return u*u*(3-2*u);};
    const home=new T.Vector3(crane.group.position.x-6,3.8,crane.group.position.z);let hook=home.clone(),held=false,worker=new T.Vector3(3.3,0,5),receiver=new T.Vector3(9.7,0,16),stage='waiting';
    for(const [i,load]of loads.entries()){
      const start=branch?new T.Vector3(0,.8,8):new T.Vector3(i?-1.1:1.1,slot.airRocks?.72:.65,slot.airRocks?6+i*2.6:7+i*3);
      const dx=start.x-crane.group.position.x,dz=start.z-crane.group.position.z,r=Math.hypot(dx,dz),angle=Math.atan2(dz,dx),moving=working&&(branch||state.activeUnit===i),cleared=branch?done:!!state.groups?.[i];
      // Swing ahead and away from the waiting vehicle, never back across its nose.
      const swing=cleared?1:moving?ease(.45,.70):0,a=angle-1.8*swing;
      load.position.set(crane.group.position.x+r*Math.cos(a),start.y+(moving?1.6*(ease(.30,.45)-ease(.70,.85)):0),crane.group.position.z+r*Math.sin(a));
      const suspended=moving&&t>=.30&&t<.85,settle=suspended?Math.sin(PI*(t-.30)/.55)*Math.sin(t*PI*5)*.025:0;
      load.rotation.z=settle;load.userData.obstacleSling.visible=moving&&t>=.22&&t<.90;
      if(moving){
        const top=load.position.clone().add(new T.Vector3(0,load.userData.slingTop,0).multiply(load.scale).applyEuler(load.rotation));held=t>=.30&&t<.90;
        hook=t<.22?home.clone().lerp(top,ease(0,.22)):t<.90?top:top.lerp(home,ease(.90,1));
        // Two workers stay on the ground at the pickup and drop sites; neither
        // chases a suspended rock around the crane's swinging arc.
        worker.lerp(new T.Vector3(start.x+1.6,0,start.z-.8),ease(0,.22)*(1-ease(.30,.45)));
        const end=new T.Vector3(crane.group.position.x+r*Math.cos(angle-1.8)+1.6,0,crane.group.position.z+r*Math.sin(angle-1.8)-.8);
        receiver.lerp(end,ease(.70,.85)*(1-ease(.90,1)));
        stage=t<.22?'lower-hook':t<.30?'attach':t<.45?'lift':t<.70?'swing':t<.85?'lower-load':t<.90?'detach':'retract';
      }
    }
    crane.group.userData.liftStage=stage;poseJibCrane(crane,hook,held,time);
    if(slot.obstacleRigger){slot.obstacleRigger.position.copy(worker);slot.obstacleRigger.rotation.z=stage==='attach'?-.18:0;slot.dropRigger.position.copy(receiver);slot.dropRigger.rotation.z=stage==='detach'?-.18:0;}
  }
  function makeAirClearance(slot){
    const g=slot.group,tower=new T.Group();tower.name='airfield-control-tower';add(g,tower,-6,0,-8);
    box(tower,2,3.8,2,0xe4d9b5,0,1.9,0,'tower-base');box(tower,2.7,1.2,2.7,0x8abecb,0,4.35,0,'tower-windows');box(tower,3,.22,3,C.outline,0,5.05,0,'tower-roof');
    for(const x of [-1.15,1.15])for(const z of [-1.15,1.15])box(tower,.10,1.2,.10,C.cream,x,4.35,z);
    beam(tower,[0,5.15,0],[0,6,0],.045,C.steel,'tower-aerial');
    slot.clearancePicture=new T.Group();slot.clearancePicture.name='clearance-radio-waves';add(slot.control,slot.clearancePicture,.4,1.4,0);
    for(const r of [.25,.48,.7])line(slot.clearancePicture,[[0,r,.03],[r*.65,r*.65,.03],[r,0,.03]],.04,0xffdd74,'radio-wave');
    const aircraft=new T.Group();aircraft.name='crossing-utility-helicopter';g.add(aircraft);slot.crossingAircraft=aircraft;
    sphere(aircraft,1.05,0xe4a348,0,0,0,1,.85,1.65,'utility-cabin');sphere(aircraft,.87,0x9dd4e4,0,.15,1,.9,.75,.8,'utility-windscreen');
    beam(aircraft,[0,.15,-1],[0,.4,-4],.16,0xe4a348,'utility-tail');box(aircraft,1.4,.10,.6,0xe4a348,0,.4,-3.5);
    for(const x of [-.85,.85]){beam(aircraft,[x,-.8,-1.4],[x,-.8,1.3],.06,C.steel,'utility-skid');beam(aircraft,[x,-.8,-.6],[x*.6,-.35,-.6],.055,C.steel);}
    cyl(aircraft,.08,.7,C.outline,0,1,0);const rotor=new T.Group();rotor.name='crossing-aircraft-rotor';add(aircraft,rotor,0,1.4,0);box(rotor,6,.06,.18,C.outline,0,0,0);box(rotor,.18,.06,6,C.outline,0,0,0);slot.crossingRotor=rotor;
  }
  function updateAirClearance(race,slot,state,t,working,done){
    if(!slot.crossingAircraft)return;
    const v=race[slot.who],direction=slot.who==='rival'?-1:1,near=Math.max(0,Math.min(1,(slot.spec.at-v.distance)/6500));
    const seconds=working?5*t:done?5+Math.max(0,race.elapsed-(state.completedAt??race.elapsed)):0;
    // An approaching helicopter settles at a holding point, then crosses on
    // acknowledgement. Its outward route never crosses the other racer.
    const u=Math.min(1,seconds/1.2),travel=seconds<1.2?5*1.2*(u*u*u-.5*u*u*u*u):5*(seconds-.6);
    slot.crossingAircraft.position.set(direction*(-10-28*near+travel),10.4,18);
    slot.crossingAircraft.rotation.set(0,direction*PI/2,0);slot.crossingRotor.rotation.y=race.elapsed*24;
    slot.crossingAircraft.visible=seconds<25;
    slot.clearancePicture.visible=working||done;slot.clearancePicture.scale.setScalar(working?1+Math.sin(t*PI*8)*.08:1);
    // This is a status lamp on a ground radio, not a floating traffic light.
    slot.signal.material=material(done?C.green:working?0xe6b44e:C.red);
  }
  function makeAnimal(color=0xeee5ce) {
    const g=new T.Group();g.name='farm-animal';sphere(g,.58,color,0,.84,0,1.35,.85,.7,'animal-body');sphere(g,.31,color,.73,1.02,0,1,.9,.7,'animal-head');for(const x of [-.4,.4])for(const z of [-.2,.2])cyl(g,.07,.5,0x685946,x,.31,z,'y','animal-leg');for(const z of [-.2,.2])sphere(g,.11,color,.76,1.3,z,1.2,.45,1,'animal-ear');sphere(g,.028,C.outline,.93,1.10,.18,1,1,.5,'animal-eye');return g;
  }
  function helipad(parent,x=0,z=0){
    const g=new T.Group();g.name='helipad';add(parent,g,x,0,z);
    cyl(g,4.9,.22,0x82928d,0,-.12,0,'y','helipad-concrete');torus(g,4.35,.075,0xffedaa,0,.01,0,'y','helipad-ring');
    for(const xx of [-1.1,1.1])plainBox(g,.28,.025,2.8,C.white,xx,.025,0,'helipad-H');plainBox(g,2.3,.025,.28,C.white,0,.025,0,'helipad-H');
    return g;
  }
  function makeFuelPump(slot,air=false){
    const g=slot.group,pump=new T.Group();pump.name=air?'aviation-fuel-pump':'road-fuel-pump';add(g,pump,5.7,0,0);
    box(pump,1.2,1.7,.9,0xe2bc58,0,.85,0);box(pump,.9,.5,.06,C.white,0,1.25,.48);
    slot.fuelLevel=box(pump,.75,.35,.07,0x69b56d,0,1.25,.53,air?'aviation-fuel-gauge':'road-fuel-gauge');
    slot.fuelButtons=[];for(let i=0;i<3;i++){const button=sphere(pump,.20,[0x5db3df,0x6ab872,0xe58c53][i],(i-1)*.36,.54,.53,1,1,.5,'fuel-pump-control');slot.fuelButtons.push(button);slot.targets.push({object:button,id:'coal-'+i});}
    slot.fuelHose=line(g,[[5.7,.3,0],[4,.05,1.3],[2,.07,1.8],[1.25,.95,air?.8:-1.5]],.045,C.outline,air?'helicopter-fuel-hose':'road-fuel-hose');slot.fuelHose.visible=false;
  }
  function updateFuelPump(slot,state,t,working,active){
    if(!slot.fuelLevel)return;
    const fill=Math.min(1,(state.unitsDone+(working?t:0))/3);slot.fuelLevel.scale.x=.05+.95*fill;slot.fuelHose.visible=active;
    slot.fuelButtons.forEach((button,i)=>button.material=material(state.groups[i]?0x73c87b:0x5db3df));
  }
  function makeAirServiceSlot(g,spec,who){
    const slot={group:g,spec,who,air:true,road:false,targets:[],people:[],animals:[],barriers:[]};
    if(spec.type!=='level-crossing')helipad(g);
    if(['wash','coal','water','repairs','rocks','tree'].includes(spec.type))for(const x of [-.7,.7])for(const z of [-1.1,1.1])plainBox(g,.25,.025,.25,0xf7cf6a,(who==='rival'?3:-3)+x,.03,z,'temporary-cargo-spot');
    const sign=new T.Group();add(g,sign,5.8,0,-3);box(sign,.16,2.3,.16,C.steel,0,1,0);box(sign,1.15,.9,.12,0xf6df9c,0,2.1,0,'flight-job-board');
    slot.winch=cyl(g,.026,1,C.outline,0,2,0,'y','working-helicopter-winch');slot.winch.visible=false;
    slot.hook=torus(g,.12,.035,C.steel,0,1,0,'z','working-winch-hook');slot.hook.visible=false;
    if(spec.type.startsWith('passenger')){
      for(let i=0;i<3;i++){const group=new T.Group();group.name='passenger-job-group';for(let j=0;j<2;j++)add(group,makePerson([0xb55365,0x528ea6,0xe4b951][i],.8+j*.1),(j-.5)*.55,0,0);add(g,group,5.3,0,3.8+i*1.7);slot.people.push(group);slot.targets.push({object:group,id:'passenger-'+i});}
    }else if(spec.type.startsWith('cargo')){
      slot.container=makeContainer();slot.container.scale.setScalar(.48);add(g,slot.container,0,0,0);slot.targets.push({object:slot.container,id:'container-1'});
      for(const x of [-.8,.8])for(const z of [-1.2,1.2])plainBox(g,.3,.025,.3,0xf7cf6a,x,.03,z,'marked-cargo-spot');
    }else if(spec.type==='repairs'){
      slot.packages=[];slot.workers=[];slot.handcarts=[];
      for(let i=0;i<3;i++){
        const cart=new T.Group();cart.name='ground-repair-handcart';add(g,cart,5.2+i%2*1.4,0,-1+i*2);slot.handcarts.push(cart);
        box(cart,1,.12,1,0x6c8d93,0,.25,0);for(const x of [-.5,.5])cyl(cart,.2,.12,C.outline,x,.2,0,'x','handcart-wheel');
        beam(cart,[-.4,.3,0],[-.4,.9,-.8],.035,C.steel);beam(cart,[.4,.3,0],[.4,.9,-.8],.035,C.steel);
        const crate=new T.Group();crate.name='repair-supply-package';box(crate,.6,.5,.7,0xd9ae6c,0,.25,0);for(const x of [-.18,.18])box(crate,.06,.53,.73,C.cream,x,.25,0);add(cart,crate,0,.32,0);slot.packages.push(crate);slot.targets.push({object:crate,id:'sleeper-'+i});
        const worker=makePerson(0xe9b64f,.9);add(g,worker,5.2+i%2*1.4,0,-1.85+i*2);slot.workers.push(worker);
      }
    }else if(spec.type==='rocks'){
      slot.groundCrane=makeObstacleCrane(g,6.5,8);slot.groundCrane.group.name='ground-rock-crane';addObstacleRigger(slot);
      const operator=makePerson(0xe9b64f,.9);add(g,operator,7.8,0,-4.5);slot.airRocks=[];
      for(let i=0;i<2;i++){const rock=sphere(g,.85,0x9c9e91,i?-1.1:1.1,.72,6+i*2.6,1.1,.85,.9,'heavy-ground-rock');fitObstacleSling(rock);slot.airRocks.push(rock);slot.targets.push({object:rock,id:'rock-'+i});}
    }else if(spec.type==='tree'){
      slot.airBranch=new T.Group();slot.airBranch.name='light-sling-branch';add(g,slot.airBranch,0,.3,3);beam(slot.airBranch,[-1,0,0],[1,.12,0],.11,C.wood);beam(slot.airBranch,[0,.06,0],[.4,.35,.55],.065,C.wood);slot.targets.push({object:slot.airBranch,id:'branch'});
      slot.branchSlings=new T.Group();slot.branchSlings.name='branch-supporting-sling';slot.airBranch.add(slot.branchSlings);
      for(const x of [-.65,.65]){beam(slot.branchSlings,[x,.06,0],[0,.3,0],.025,0xdba95c,'branch-sling-leg');torus(slot.airBranch,.14,.025,0xdba95c,x,.06,0,'x','branch-sling-band');}
      slot.rigger=makePerson(0xe9b64f,.9);add(g,slot.rigger,2,0,3);
      for(const x of [3.2,5.8])for(const z of [1.9,4.1])plainBox(g,.25,.025,.25,0xf7cf6a,x,.03,z,'branch-drop-marker');
    }else if(spec.type==='coal'){
      makeFuelPump(slot,true);
    }else if(spec.type==='water'){
      slot.waterStore=new T.Group();slot.waterStore.name='aviation-water-delivery';add(g,slot.waterStore,5.6,0,1);cyl(slot.waterStore,.7,1.5,0x96c7cf,0,.75,0);slot.waterLevel=box(slot.waterStore,.16,1.2,.1,0x3fa5cd,.68,.7,.3,'delivered-water-level');slot.targets.push({object:slot.waterStore,id:'water'});
      slot.waterCrate=box(g,.7,.8,.7,0x83c4d1,1.5,.4,.8,'water-delivery-drum');
    }else if(spec.type==='animals'||spec.type==='level-crossing'){
      slot.groundCrew=makePerson(0xe3b053,.95);add(g,slot.groundCrew,5.6,0,4);
      slot.control=new T.Group();slot.control.name='landing-area-radio';add(g,slot.control,5.4,0,1);box(slot.control,.8,1.1,.6,0x5f8f97,0,.55,0);cyl(slot.control,.03,.6,C.outline,0,1.4,0);slot.signal=sphere(slot.control,.16,C.red,0,.9,.33,1,1,.5,'landing-area-signal');slot.targets.push({object:slot.control,id:spec.type==='animals'?'animals':'crossing'});
      if(spec.type==='animals')for(let i=0;i<3;i++){const a=makeAnimal();add(g,a,(i-1)*1.3,0,6+i%2);slot.animals.push(a);}
      else makeAirClearance(slot);
    }else if(spec.type==='wash'){
      slot.airWash=new T.Group();slot.airWash.name='open-helicopter-wash-pad';add(g,slot.airWash,5.5,0,-2);cyl(slot.airWash,.45,1.1,0x60a8b9,0,.55,0);slot.spray=[];for(let i=0;i<10;i++)slot.spray.push(sphere(g,.07,0x9bd7e8,1.4,1+(i%4)*.35,-1.5+i%4,.7,1.5,.7,'wash-water-drop'));
    }else if(spec.type==='drawbridge'){
      makeDrawbridge(slot,true);
    }
    return slot;
  }
  function updateAirService(b,race,slot,state,t,working,done,active){
    const g=slot.group,carrier=b[slot.who+'Coach'],vehicle=b[slot.who],v=race[slot.who],e=t*t*(3-2*t),time=race.elapsed;
    // Fixture transforms may be needed before the renderer's final world update.
    g.updateMatrixWorld(true);vehicle.updateMatrixWorld(true);carrier.updateMatrixWorld(true);
    const top=g.worldToLocal(vehicle.localToWorld(new T.Vector3(0,.65,0)));let hooked=null;
    if(slot.people.length){for(let i=0;i<3;i++){
      const person=slot.people[i],unloading=slot.spec.type==='passenger-unload',finished=!!state.groups[i],moving=working&&state.activeUnit===i,door=g.worldToLocal(carrier.userData.doorThresholds[1].getWorldPosition(new T.Vector3())),yard=new T.Vector3(5.3,0,3.8+i*1.7);
      person.visible=unloading?finished||moving:!finished;person.position.copy(yard);if(moving)person.position.copy(unloading?door:yard).lerp(unloading?yard:door,e);
    }}
    if(slot.container){const unloading=slot.spec.type==='cargo-unload',from=g.worldToLocal(carrier.localToWorld(new T.Vector3(0,-2.55,0))),yard=new T.Vector3(0,0,0);
      slot.container.visible=unloading?working||done:!done;slot.container.position.copy(yard);if(working)slot.container.position.copy(unloading?from:yard).lerp(unloading?yard:from,e);if(active&&!done)hooked=slot.container.position.clone().add(new T.Vector3(0,.72,0));
    }
    if(slot.handcarts)slot.handcarts.forEach((cart,i)=>{const moving=working&&state.activeUnit===i,u=state.groups[i]?1:moving?e:0;cart.position.set(5.2+i%2*1.4+u*1.4,0,-1+i*2+u*1.4);slot.workers[i].position.copy(cart.position).add(new T.Vector3(0,0,-.85));slot.workers[i].rotation.z=moving?Math.sin(t*PI*4)*.04:0;cart.traverse(o=>{if(o.name==='handcart-wheel')o.rotation.x=u*12;});});
    if(slot.airRocks)updateObstacleLift(slot,state,t,working,done,time);
    if(slot.airBranch){
      const lift=b.core.getBranchLiftPose(done?1:working?state.progress:0);slot.airBranch.position.set(lift.load.x,lift.load.y,lift.load.z);slot.branchSlings.visible=working&&lift.attached;
      const attaching=working&&['attach','detach'].includes(lift.stage),reach=attaching?Math.sin(PI*(lift.seconds-(lift.stage==='attach'?2:9)))**2:0;slot.rigger.position.set(lift.load.x+2-.8*reach,0,3);slot.rigger.rotation.z=-.12*reach;
      if(working)hooked=new T.Vector3(lift.aircraft.x,lift.hookY,lift.aircraft.z);
    }
    updateFuelPump(slot,state,t,working,active&&['ready','working'].includes(state.phase));
    if(slot.waterStore){slot.waterLevel.scale.y=.1+.9*(done?1:working?t:0);slot.waterCrate.visible=!done;slot.waterCrate.position.set(1.5+(working?e:0)*4,.4,.8);}
    if(slot.animals.length){slot.animals.forEach((a,i)=>{a.position.x=(i-1)*1.3+8*e;});slot.groundCrew.position.z=4+Math.sin(t*PI)*2;}
    if(slot.signal)slot.signal.material=material(done?0x5fbb69:C.red);
    updateAirClearance(race,slot,state,t,working,done);
    if(slot.spray)slot.spray.forEach((drop,i)=>{drop.visible=active&&working;drop.position.y=.5+((time*2+i*.3)%2);});
    slot.winch.visible=!!hooked;slot.hook.visible=!!hooked;
    if(hooked){setCable(slot.winch,top,hooked);slot.hook.position.copy(hooked);}
  }
  function flightWorld(core,course,world,race){
    if(!race)return;
    for(const who of ['player','rival'])if(core.getCharacter(race,who).vehicleType==='air'){
      for(const distance of [0]){const p=core.sampleVehicleRoute(race,who,distance),pad=new T.Group();transformRoute(pad,p);world.add(pad);helipad(pad);}
      for(const section of core.getTravelSections(race,who).filter(s=>s.cap<1&&!s.id.startsWith('service-'))){
        if(section.type==='tunnel'){
          const cloud=new T.Group();cloud.name='flight-cloud-section';cloud.userData={corridor:who,sectionId:section.id};world.add(cloud);
          const length=(section.end-section.start)*core.WORLD_SCALE;
          for(let i=0;i<5;i++){
            const fraction=(i+.5)/5,p=core.getFlightPose(race,who,section.start+(section.end-section.start)*fraction),depth=length*(i===0||i===4?.1:.14);
            sphere(cloud,1,0xf4f8f7,p.x,p.y+1.1,p.z,4.7,4.1,depth,'cloud-body');
            for(const side of [-1,1])sphere(cloud,1,i%2?0xe6eff0:0xffffff,p.x+side*3.1,p.y+1.8+(i%2)*.5,p.z,2.5,2.9,depth*.9,'cloud-puff');
          }
          cloud.traverse(o=>{o.castShadow=false;o.receiveShadow=false;});
        }
      }
    }
  }
  function makeServiceSlot(core,course,spec,who,characterId) {
    const g=new T.Group();g.name='service-'+spec.type;g.userData={id:spec.id,type:spec.type,corridor:who};
    const p=core.sampleRoute(course,spec.at,who==='player'?0:-15);g.position.set(p.x,p.y,p.z);g.rotation.y=p.heading;
    const c=core.character(characterId),road=c.vehicleType==='road',depot=c.power!=='steam',stockZ=-c.coachOffset*core.WORLD_SCALE;
    if(c.vehicleType==='air')return makeAirServiceSlot(g,spec,who);
    const slot={group:g,spec,who,road,targets:[],stockZ,people:[],animals:[]};
    if(spec.type.startsWith('passenger')||spec.type.startsWith('cargo')) {
      box(g,4.6,.86,29.0,0xc9baa0,4.8,.10,0,'service-platform');box(g,.16,.07,29.0,0xf7e3a4,2.5,.51,0,'platform-edge');
      for(const z of [-12,13]){cyl(g,.10,3.5,C.outline,6.2,2.2,z,'y','station-lamp-post');sphere(g,.30,0xffe9ad,6.2,4,z,1,1.4,1,'station-lamp');}
      if(spec.type.startsWith('passenger')) {
        const shelter=new T.Group();shelter.name='station-shelter';add(g,shelter,7.1,.48,-8);box(shelter,2.3,2.1,4.0,0xd8cfad,0,1.05,0,'station-shelter-wall');box(shelter,2.8,.22,4.6,0xb25846,0,2.2,0,'station-canopy');
        for(let i=0;i<3;i++){const group=new T.Group();group.name='passenger-job-group';group.userData.targetId='passenger-'+i;for(let j=0;j<2;j++){const p=makePerson([0xb55365,0x528ea6,0xe4b951][i],.85+j*.10);add(group,p,(j-.5)*.70,0,0);}add(g,group,3.35,.51,4+i*2.2);slot.people.push(group);slot.targets.push({object:group,id:'passenger-'+i});}
      } else makeContainerLift(slot,core,course,c);
    } else if(spec.type==='animals') {
      const halfWidth=road?3.35:2.65,width=halfWidth*2;
      const gate=new T.Group();gate.name='opening-farm-gate';add(g,gate,0,0,6);
      for(const x of [-halfWidth,halfWidth]){box(gate,.22,1.9,.22,0xd9c998,x,.63,0,'farm-gate-post');box(gate,.55,.16,.55,0xb3ac96,x,-.26,0,'farm-gate-foundation');}
      const swing=new T.Group();swing.name='swinging-farm-gate';add(gate,swing,halfWidth,0,0);
      for(const y of [.45,.9,1.35])box(swing,width,.10,.10,0xe4d7aa,-width/2,y,0,'farm-gate-rail');
      for(const x of [-.12,-width+.12])box(swing,.12,1.1,.12,0xd1bd8d,x,.9,0,'farm-gate-stile');
      beam(swing,[-.15,.45,0],[-width+.15,1.35,0],.06,0xd1bd8d,'farm-gate-brace');
      for(const y of [.45,1.35])cyl(gate,.12,.18,C.steel,halfWidth,y,0,'y','farm-gate-hinge');slot.gate=swing;
      for(let i=0;i<3;i++){const animal=makeAnimal(i===1?0xbaa18a:0xf2e7c8);add(g,animal,(i-1)*1.3,0,8+(i%2)*1.1);slot.animals.push(animal);}
      const board=new T.Group();add(g,board,halfWidth+1.1,0,2.3);box(board,.15,2.0,.15,C.wood,0,1,0);box(board,1.3,1.0,.14,0xffe6a0,0,2.1,0,'animal-crossing-board');
    } else if(spec.type==='repairs') {
      slot.sleepers=[];slot.workers=[];
      for(let i=0;i<3;i++){
        const sleeper=road?box(g,1.2,.04,.95,0x594c3f,i%2?.85:-.85,.012,6+i*1.5,'road-pothole'):
          box(g,2.6,.20,.42,0xd9ae6c,0,.12,6+i*1.5,'repair-sleeper');slot.sleepers.push(sleeper);slot.targets.push({object:sleeper,id:`sleeper-${i}`});
        const worker=makePerson(0xe9b64f,.9);add(g,worker,3.2,-.32,6+i*1.5);slot.workers.push(worker);
        beam(worker,[.35,.85,0],[.35,1.4,.1],.045,C.steel,'repair-tool');
      }
    } else if(spec.type==='rocks') {
      slot.crane=makeObstacleCrane(g,6.5,8);slot.rocks=[];addObstacleRigger(slot);
      for(let i=0;i<2;i++){const rock=sphere(g,.85,0x9c9e91,i?-1.1:1.1,.65,7+i*3,1.2,.9,.9,'blocking-rock');fitObstacleSling(rock);slot.rocks.push(rock);slot.targets.push({object:rock,id:`rock-${i}`});}
    } else if(spec.type==='coal') {
      if(road)makeFuelPump(slot);
      else {
        // Diesel delivers coal to the depot; steam engines fill their bunkers.
        if(depot){
          const bin=new T.Group();bin.name='depot-coal-bin';add(g,bin,3.4,-.32,-5);
          box(bin,1.9,.15,1.3,C.wood,0,.1,0,'depot-bin-floor');
          for(const x of [-.9,.9])box(bin,.12,.7,1.3,C.wood,x,.45,0,'depot-bin-side');
          box(bin,1.9,.7,.12,C.wood,0,.45,-.6,'depot-bin-back');
          slot.coalFill=new T.Group();slot.coalFill.name='depot-coal';add(bin,slot.coalFill,0,.45,0);
          for(let i=0;i<9;i++)sphere(slot.coalFill,.23,0x34454c,(i%3-1)*.5,.24+(i%2)*.1,(Math.floor(i/3)-1)*.35,1,.8,1,'coal-lump');
        }
        slot.scoops=[];
        for(let i=0;i<3;i++){
          const scoop=new T.Group();scoop.name='coal-scoop';add(g,scoop,4.4,-.12,-2+i*2);
          box(scoop,1.05,.35,1.15,0xb38a51,0,0,0,'scoop-bucket');beam(scoop,[.4,0,0],[1.1,.65,0],.075,C.wood,'scoop-handle');
          for(let j=0;j<5;j++)sphere(scoop,.22,0x34454c,(j%2-.5)*.4,.3,(Math.floor(j/2)-1)*.3,1.2,.8,1,'scoop-coal');
          slot.scoops.push(scoop);slot.targets.push({object:scoop,id:`coal-${i}`});
        }
      }
    } else if(spec.type==='level-crossing') {
      slot.roadJunction=road;
      slot.barriers=[];
      if(!slot.roadJunction)for(const side of [-1,1]){
        const stand=new T.Group();stand.name='crossing-barrier-stand';add(g,stand,side*3.5,0,side<0?5.45:11.45);stand.rotation.y=side<0?0:PI;
        box(stand,.65,.35,.65,0xb0b4a8,0,-.15,0,'crossing-foundation');box(stand,.28,1.15,.28,C.outline,0,.55,0,'crossing-post');
        const arm=new T.Group();arm.name='hinged-crossing-arm';add(stand,arm,0,1.15,0);
        for(let i=0;i<8;i++)box(arm,.16,.18,.68,i%2?C.white:C.red,0,0,.34+i*.68,'crossing-arm-stripe',.025);
        cyl(stand,.20,.38,C.steel,0,1.15,0,'x','crossing-hinge');slot.barriers.push(arm);
      }
      slot.control=new T.Group();slot.control.name='crossing-control';add(g,slot.control,3.6,0,2.8);
      if(road){
        slot.control.name='traffic-light-control';
        cyl(slot.control,.09,2.6,C.outline,0,1.3,0,'y','traffic-light-pole');
        box(slot.control,.64,1.65,.46,C.outline,0,2.7,0,'traffic-light-housing');slot.trafficLights=[];
        for(let i=0;i<3;i++){
          const lamp=sphere(slot.control,.20,i===0?C.red:0x344441,0,3.2-i*.5,-.25,1,1,.5,['traffic-red','traffic-amber','traffic-green'][i]);
          lamp.userData.reverse=sphere(slot.control,.20,i===0?C.red:0x344441,0,3.2-i*.5,.25,1,1,.5,'opposite-direction-light');slot.trafficLights.push(lamp);
        }
        plainBox(g,5.5,.025,.16,C.white,0,.035,4.4,'junction-stop-line');
      }else{
        box(slot.control,.9,1.45,.65,0x668f8c,0,.4,0,'crossing-control-box');
        slot.crossingSignal=sphere(slot.control,.24,C.red,0,1.35,0,1,1,1,'railway-crossing-signal');
      }
      slot.targets.push({object:slot.control,id:'crossing'});
    } else if(spec.type==='wash') {
      slot.wash=new T.Group();slot.wash.name='working-wash-shed';add(g,slot.wash,0,0,-1.2);
      for(const x of [-2.1,2.1]){box(slot.wash,.16,.18,12,0x6da6a5,x,4.1,-1,'wash-shed-side-rail');for(const z of [-6,5])box(slot.wash,.32,4.8,.32,0x5f8d92,x,2.4,z,'wash-upright');}
      box(slot.wash,4.8,.32,12.6,0xb65346,0,4.8,-1,'wash-shed-roof');
      for(const x of [-2.1,2.1])for(const z of [-7.2,3.8])box(g,.60,.40,.60,0xb3ac96,x,-.12,z,'wash-foundation');slot.brushes=[];for(const x of [-1.75,1.75]){const brush=cyl(slot.wash,.34,2.8,0x59b7cb,x,2.1,-4.0,'y','wash-brush');slot.brushes.push(brush);}
      slot.waterDrops=[];for(let i=0;i<12;i++){const drop=sphere(slot.wash,.08,0xa6e2ed,(i%2?1:-1)*1.6,1+(i%4)*.7,-3+(i%6),.8,1.5,.8,'wash-water-drop');slot.waterDrops.push(drop);}
      const mud=new T.Group();mud.name='muddy-approach';const mp=core.sampleRoute(course,spec.mudAt||spec.at-4500,who==='player'?0:-15),local=new T.Vector3(mp.x,mp.y+.02,mp.z);g.updateMatrixWorld(true);g.worldToLocal(local);mud.position.copy(local);mud.rotation.y=mp.heading-p.heading;g.add(mud);for(let i=0;i<4;i++){const puddle=add(mud,mesh(geometry('mud-circle',()=>new T.CircleGeometry(1,18)),i%2?0x93724e:0xa78960,'muddy-puddle'),(i%2-.5)*.8,0,(i-1.5)*1.3);puddle.rotation.x=-PI/2;puddle.scale.set(1.0,1.8,1);}
      slot.hose=new T.Group();slot.hose.name='wash-hose';add(g,slot.hose,4.8,.2,0);cyl(slot.hose,.36,1.3,0x5c8491,0,.8,0,'x','hose-reel');line(slot.hose,[[0,.4,0],[-.8,.1,.2],[-1.3,.12,1.2]],.07,0x567e8a,'curved-wash-hose');
    } else if(spec.type==='water') {
      if(depot){
        const tank=new T.Group();tank.name='depot-water-store';add(g,tank,4.5,0,2);
        cyl(tank,1.1,2.2,0x77a2ad,0,.8,0,'y','depot-water-tank');
        cyl(tank,1.17,.14,0x557e8b,0,1.95,0,'y','depot-tank-rim');
        box(tank,.07,1.7,.65,C.cream,1.12,.85,0,'depot-water-gauge');
        slot.depotWater=box(tank,.085,1.5,.5,0x58bfda,1.16,.85,0,'depot-water-level');
        beam(tank,[1.8,-.3,0],[1.8,3,0],.12,0x688c91,'depot-feed-pipe');
        beam(tank,[1.8,3,0],[0,3,0],.12,0x688c91,'depot-feed-pipe');
        slot.stream=cyl(tank,.08,1,0x9bdbe6,0,2.5,0,'y','depot-water-stream');
        slot.targets.push({object:tank,id:'water'});
      }else{
      const tower=new T.Group();tower.name='water-tower';add(g,tower,5,0,.5);for(const x of [-.9,.9])for(const z of [-.9,.9])box(tower,.55,.40,.55,0xb3ac96,x,-.12,z,'water-tower-foundation');for(const x of [-.9,.9])for(const z of [-.9,.9])beam(tower,[x,0,z],[x,4,z],.12,0x8b7b65,'water-tower-leg');cyl(tower,1.5,1.8,0x77a2ad,0,4.7,0,'y','water-tank');cyl(tower,1.58,.18,0x557e8b,0,5.7,0,'y','water-tank-rim');
      const spout=new T.Group();spout.name='swinging-water-spout';add(tower,spout,0,4.9,0);beam(spout,[0,0,0],[-4.9,0,0],.14,0x4f7b88,'water-column-arm');beam(spout,[-4.9,0,0],[-4.9,-1.3,0],.16,0x4f7b88,'water-column-nozzle');slot.spout=spout;slot.waterTower=tower;slot.targets.push({object:tower,id:'water'});const gauge=new T.Group();gauge.name='water-tower-level-window';add(tower,gauge,1.53,4.05,0);box(gauge,.06,1.3,.33,C.cream,0,.65,0);slot.towerLevel=box(gauge,.08,1.05,.22,0x58bfda,.02,.62,0,'tower-water-level');slot.stream=cyl(spout,.09,1.2,0x9bdbe6,-4.9,-1.8,0,'y','refill-water-stream');
      }
    } else if(spec.type==='tree') {
      slot.crane=makeObstacleCrane(g,6.5,8);addObstacleRigger(slot);const branch=new T.Group();branch.name='fallen-branch';add(g,branch,0,.8,8);beam(branch,[-2.8,0,-.4],[2.6,.3,.4],.25,0x916c45,'fallen-tree-trunk');beam(branch,[.2,.2,0],[1.4,1.1,1],.12,0x916c45,'fallen-tree-branch');sphere(branch,.65,0x699762,1.5,1.1,1,1.7,.8,1.2,'fallen-tree-leaves');fitObstacleSling(branch,true);slot.branch=branch;slot.targets.push({object:slot.crane.group,id:'tree'});
    } else if(spec.type==='drawbridge') {
      makeDrawbridge(slot,road);
    }
    return slot;
  }

  function makeDrawbridge(slot,road) {
    const g=slot.group;
      const base=new T.Group();base.name='harbour-drawbridge-job';add(g,base,0,0,14);slot.bridgeLeaf=new T.Group();slot.bridgeLeaf.name='lowering-drawbridge-leaf';add(base,slot.bridgeLeaf,0,0,0);
      const width=road?5.8:3.6;box(slot.bridgeLeaf,width,.30,9,C.wood,0,-.15,4.5,'drawbridge-moving-deck');for(const x of [-width/2,width/2])box(slot.bridgeLeaf,.16,1.0,9,0xd4c492,x,.5,4.5,'drawbridge-railing');
      if(!road){for(const x of [-1.02,1.02])addRail(slot.bridgeLeaf,d=>({x,y:0,z:d,heading:0}),0,9,'drawbridge-running-rail');for(let z=.25;z<9;z+=.76)plainBox(slot.bridgeLeaf,2.55,.11,.20,C.sleeper,0,-.005,z,'drawbridge-sleeper');}
      else plainBox(slot.bridgeLeaf,5.5,.04,9,0x7e8b88,0,.02,4.5,'drawbridge-road');
      for(const z of [-.8,9.8])box(base,width+1.2,3.4,1.6,0xb6ad94,0,-1.7,z,'drawbridge-abutment');
      slot.signal=sphere(g,.22,0xd75547,2.3,2.5,6,1,1,.4,'drawbridge-signal');cyl(g,.09,2.3,C.outline,2.3,1.2,6,'y','drawbridge-signal-post');
      slot.targets.push({object:slot.bridgeLeaf,id:'drawbridge'});
  }
  function harbourChannelZ(x) {
    const bend=Math.max(0,Math.min(1,(Math.abs(x+7.5)-22)/25));
    return 18.5+Math.sin((x+7.5)/35)*2*bend;
  }
  function makeHarbourCorridor(core,race,spec,group,slots) {
    const base=core.sampleRoute(race.courseId,spec.at,0),level=race.courseId==='harbour'?-1.25:-2.3;
    const river=new T.Group();river.name='shared-harbour-channel';transformRoute(river,{...base,grade:0});group.add(river);
    const positions=[],indices=[];let i=0;
    for(let x=-320;x<=305;x+=5){const z=harbourChannelZ(x);positions.push(x,level-base.y,z-4.5,x,level-base.y,z+4.5);if(i){const k=(i-1)*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}i++;}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
    const water=new T.Mesh(geo,new T.MeshPhongMaterial({color:race.courseId==='harbour'?0x79bed1:0x77b9c9,shininess:55,side:T.DoubleSide}));water.name='shared-harbour-river';water.castShadow=false;water.receiveShadow=true;river.add(water);
    for(const x of [-42,-25,10,26,44])for(const side of [-1,1]){const buoy=new T.Group();add(river,buoy,x,level-base.y+.05,harbourChannelZ(x)+side*3.8);cyl(buoy,.2,.3,side<0?0xc9584a:0x65a378,0,.15,0);cyl(buoy,.035,.8,C.cream,0,.65,0);}
    for(const slot of slots){
      // Harold waits above a real service-road bridge over the same river.
      if(slot.air){const offset=slot.who==='player'?0:core.ROAD_LANE;for(const [a,z]of [[spec.at-40000,spec.at+14/core.WORLD_SCALE],[spec.at+23/core.WORLD_SCALE,spec.at+40000]])trackPath(core,race.courseId,group,d=>core.sampleRoute(race.courseId,d,offset),a,z,offset,true,'harbour-access');}
      const boat=new T.Group();boat.name='passing-drawbridge-boat';slot.group.add(boat);slot.boat=boat;slot.riverLevel=level-slot.group.position.y;
      // Separate outward lanes let the racers wait independently without a boat
      // crossing the other racer's bridge after it has already lowered.
      boat.rotation.y=slot.who==='player'?PI/2:-PI/2;
      sphere(boat,1,0x394f61,0,0,0,1.05,.4,2.2);box(boat,1.9,.2,3.7,C.cream,0,.3,0);box(boat,1.35,.8,1.3,C.white,0,.8,-.3);box(boat,1.55,.12,1.5,C.red,0,1.26,-.3);
      const mastHeight=Math.max(2.7,slot.group.position.y-level+1);
      cyl(boat,.045,mastHeight,C.wood,0,mastHeight/2,.35,'y','river-boat-mast');
      const sail=new T.BufferGeometry();sail.setAttribute('position',new T.Float32BufferAttribute([.05,1.35,.35,.05,mastHeight-.15,.35,.05,1.35,1.95],3));sail.computeVertexNormals();boat.add(mesh(sail,C.cream,'river-boat-sail',{side:T.DoubleSide}));
      const foundationHeight=slot.group.position.y-level+.9;slot.bridgeLeaf.parent.traverse(o=>{if(o.name==='drawbridge-abutment'){o.scale.y=foundationHeight/3.4;o.position.y=-foundationHeight/2;}});
    }
  }
  function updateDrawbridge(race,slot,state,t,working,done) {
    if(!slot.bridgeLeaf)return;
    const lower=working?Math.max(0,(t-2/3)*3):done?1:0;
    slot.bridgeLeaf.rotation.x=-PI*.34*(1-lower);
    const outward=slot.who==='player'?1:-1,after=done?Math.max(0,race.elapsed-(state.completedAt??race.elapsed)):0;
    const travel=working?t*24:done?24+after*4:0;
    const x=outward*(-7.5+travel),channelX=x+(slot.who==='rival'?-15:0),slope=(harbourChannelZ(channelX+.1)-harbourChannelZ(channelX-.1))/.2;
    slot.boat.position.set(x,slot.riverLevel+.16,harbourChannelZ(channelX)+(slot.who==='player'?-2.25:2.25));
    slot.boat.rotation.y=Math.atan2(outward,outward*slope);slot.boat.visible=Math.abs(channelX+7.5)<305;
    slot.signal.material=material(done?0x68b05e:0xd75547);
  }


  function route(core,course,distance,lane=0) {return core.sampleRoute(course, distance,lane);}
  function transformRoute(o,p,extraY=0) {o.position.set(p.x,p.y+extraY,p.z);o.rotation.set(-p.grade,p.heading,0,'YXZ');}
  function sampledStrip(sample,start,end,width,offset=0,step=125) {
    const positions=[],indices=[],normal=[];let i=0;
    for(let d=start;d<end+step;d+=step) {
      const dd=Math.min(d,end),p=sample(dd),cs=Math.cos(p.heading),sn=Math.sin(p.heading);
      for(const side of [-1,1]) {positions.push(p.x+side*width*.5*cs,p.y+(typeof offset==='function'?offset(dd):offset),p.z-side*width*.5*sn);normal.push(0,1,0);}
      if(i){const k=(i-1)*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}i++;if(dd===end)break;
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));g.setIndex(indices);return g;
  }
  function stripGeometry(core,course,lane,start,end,width,offset=0,step=125) {
    return sampledStrip(d=>route(core,course,d,lane),start,end,width,offset,step);
  }
  function lateralSample(sample,offset) {
    return d=>{const p=sample(d);return {...p,x:p.x+Math.cos(p.heading)*offset,z:p.z-Math.sin(p.heading)*offset};};
  }
  function addRail(parent,sample,start,end,name='running-rail',step=125) {
    // Sweep a solid steel head, narrow web and broad foot along the same route
    // as the wheels. Separate face vertices retain crisp, visible side faces.
    const profile=[[-.11,RAIL_TOP],[.11,RAIL_TOP],[.11,.22],[.045,.22],[.045,.11],[.16,.11],
      [.16,.05],[-.16,.05],[-.16,.11],[-.045,.11],[-.045,.22],[-.11,.22]];
    const stations=[];for(let d=start;d<end+step;d+=step){const at=Math.min(d,end);stations.push(sample(at));if(at===end)break;}
    const positions=[],indices=[];
    for(let edge=0;edge<profile.length;edge++){
      const a=profile[edge],b=profile[(edge+1)%profile.length],base=positions.length/3;
      stations.forEach((p,i)=>{
        for(const[x,y]of[a,b])positions.push(p.x+x*Math.cos(p.heading),p.y+y,p.z-x*Math.sin(p.heading));
        if(i){const k=base+(i-1)*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
      });
    }
    const faces=T.ShapeUtils.triangulateShape(profile.map(([x,y])=>new T.Vector2(x,y)),[]);
    for(const [index,reverse]of[[0,true],[stations.length-1,false]]){
      const p=stations[index],base=positions.length/3;
      for(const[x,y]of profile)positions.push(p.x+x*Math.cos(p.heading),p.y+y,p.z-x*Math.sin(p.heading));
      for(const face of faces){const tri=reverse?face.slice().reverse():face;indices.push(...tri.map(i=>base+i));}
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
    parent.add(mesh(geo,C.rail,name));
    parent.add(mesh(sampledStrip(sample,start,end,.18,RAIL_TOP+.001),0xd4e0e5,'rail-head-highlight'));
  }
  function groundGeometry(core,courseId,start,end,offset,rows=null) {
    const lanes=rows||[-250,-100,-40,-35,-34,-29,-25,-23,-22,-18,-15,-12,-8,-6,0,6,7,8,10,14,19,25,35,40,100,250],positions=[],indices=[];let row=0;
    for(let d=start;d<=end+125;d+=125){const dd=Math.min(d,end);for(const lane of lanes){const p=route(core,courseId,dd,lane);positions.push(p.x,(core.sampleTerrainHeight?core.sampleTerrainHeight(courseId,dd,lane):p.y)+offset(dd,lane),p.z);}
      if(row)for(let j=0;j<lanes.length-1;j++){const k=(row-1)*lanes.length+j,n=k+lanes.length;indices.push(k,n,k+1,k+1,n,n+1);}row++;if(dd===end)break;}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  function instanced(parent,geo,color,transforms,name) {
    const m=new T.InstancedMesh(geo,material(color),transforms.length);m.name=name;m.castShadow=true;m.receiveShadow=true;
    const q=new T.Quaternion(),s=new T.Vector3(1,1,1),matrix=new T.Matrix4();
    transforms.forEach((v,i)=>{q.setFromEuler(new T.Euler(v.rx||0,v.heading||0,v.rz||0,'YXZ'));s.set(v.sx||1,v.sy||1,v.sz||1);matrix.compose(new T.Vector3(v.x,v.y,v.z),q,s);m.setMatrixAt(i,matrix);});
    parent.add(m);return m;
  }
  function trackPath(core,courseId,world,sample,start,end,offset=0,road=false,corridor='player') {
    if(end<=start)return;const group=new T.Group();group.name=(road?'road':'railway')+'-path';
    group.userData={offset,start,end,corridor};world.add(group);
    if(road) {
      group.add(mesh(sampledStrip(sample,start,end,5.8,-.015),0x7e8b88,'bertie-road'));
      for(const edge of [-2.75,2.75])group.add(mesh(sampledStrip(lateralSample(sample,edge),start,end,.08,.005),0xffecb0,'road-edge'));
      const marks=[];for(let d=start;d<end;d+=600){const p=sample(d);marks.push({x:p.x,y:p.y+.01,z:p.z,heading:p.heading,rx:-p.grade});}
      instanced(group,new T.BoxGeometry(.07,.018,1.5),0xffefc8,marks,'road-centre-dashes');return;
    }
    group.add(mesh(sampledStrip(sample,start,end,2.9,-.04),C.ballast,'ballast-bed'));
    const sleepers=[];for(let d=start;d<=end;d+=95){const p=sample(d);sleepers.push({x:p.x,y:p.y-.005,z:p.z,heading:p.heading,rx:-p.grade});}
    instanced(group,new T.BoxGeometry(2.55,.11,.20),C.sleeper,sleepers,'continuous-sleepers');
    for(const rail of [-1.02,1.02]) {
      const railSample=lateralSample(sample,rail);
      addRail(group,railSample,start,end);
    }
  }
  function chunkRange(start,end,size,fn) {for(let d=start;d<end;d+=size)fn(d,Math.min(end,d+size));}
  function lakeRadius(core,d,lane) {
    const x=(lane+7.5)/28,z=(d-core.courseDistance(128600))*core.WORLD_SCALE/(27*core.COURSE_SCALE),angle=Math.atan2(z,x);
    return Math.hypot(x,z)/(1+.045*Math.sin(angle*3)+.035*Math.cos(angle*5));
  }
  function lakeGround(core,course,d,lane,playerId,opponent) {
    const base=core.sampleTerrainHeight(course,d,lane),r=lakeRadius(core,d,lane),ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
    if(r>=1.35)return base;
    let height=r<.82?-1.35:r<1.05?-1.35+1.2*ease((r-.82)/.23):-.15+(base+.15)*ease((r-1.05)/.3);
    for(const [offset,id] of [[0,playerId],[-15,opponent]])if(core.character(id).vehicleType!=='air'){
      const shoulder=core.character(id).vehicleType==='road'?3.6:2.3,weight=1-ease((Math.abs(lane-offset)-shoulder)/2);
      height=height+(core.sampleRoute(course,d,offset).y-.32-height)*weight;
    }
    return height;
  }
  function surfacePatch(core,course,d,lane,rx,rz,height,color,name,opacity=.6) {
    const positions=[],indices=[],count=40;
    const point=(at,offset)=>{const p=route(core,course,at,offset);positions.push(p.x,typeof height==='function'?height(at,offset):height,p.z);};
    point(d,lane);
    for(let i=0;i<count;i++){
      const a=TAU*i/count,r=1+.045*Math.sin(a*3)+.035*Math.cos(a*5);
      point(d+Math.sin(a)*rz*r/core.WORLD_SCALE,lane+Math.cos(a)*rx*r);
      indices.push(0,(i+1)%count+1,i+1);
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
    const m=new T.Mesh(geo,new T.MeshPhongMaterial({color,transparent:true,opacity,depthWrite:false,shininess:95,specular:0xd4eef0,side:T.DoubleSide}));m.name=name;m.castShadow=false;m.receiveShadow=false;return m;
  }
  function makeLakeside(core,course,world,playerId,opponent) {
    const frozen=course==='mountain',level=frozen?-.82:-.48,g=new T.Group();g.name=frozen?'shared-frozen-lake':'shared-flooded-lake';world.add(g);
    const bed=surfacePatch(core,course,core.courseDistance(128600),-7.5,25,24*core.COURSE_SCALE,-1.32,0x82958c,'visible-lake-bed',1);bed.material.transparent=false;bed.material.depthWrite=true;g.add(bed);
    const water=surfacePatch(core,course,core.courseDistance(128600),-7.5,28,27*core.COURSE_SCALE,level,frozen?0xc1dfdf:0x62a7b7,frozen?'lake-ice-surface':'lake-water-surface',frozen?.68:.58);g.add(water);
    const ripples=[];
    for(let i=0;i<16;i++){
      const d=core.courseDistance(126700+(i%5)*720),lane=-30+(i%4)*14,p=route(core,course,d,lane);
      if(lakeGround(core,course,d,lane,playerId,opponent)>level-.06)continue;
      if(frozen){const crack=line(g,[[p.x-1,level+.009,p.z],[p.x,level+.009,p.z+.4],[p.x+.9,level+.009,p.z+.1]],.018,0x88b2bd,'lake-ice-hairline');crack.castShadow=false;}
      else{const ring=torus(g,.65,.014,0xb3e1e5,p.x,level+.012,p.z,'y','lake-ripple');ring.castShadow=false;ring.material=material(0xb3e1e5,{transparent:true,opacity:.42,depthWrite:false});ripples.push(ring);}
    }
    for(const [lane,id,who]of [[0,playerId,'player'],[-15,opponent,'rival']]){
      const kind=core.character(id).vehicleType;if(kind==='air')continue;
      if(frozen){
        const ice=new T.Group();ice.name='surface-ice-patches';ice.userData.corridor=who;g.add(ice);
        for(let i=0;i<12;i++){
          const d=core.courseDistance(126500+i*345),offset=lane+(kind==='road'?Math.sin(i*2.1)*.9:0),width=kind==='road'?1.2+i%3*.2:.78;
          ice.add(surfacePatch(core,course,d,offset,width,1.1+(i*13%7)*.12,at=>route(core,course,at,offset).y+(kind==='road'?.018:.065),0xb8dfe5,'thin-route-ice',.40+(i%3)*.08));
        }
        if(kind==='road')for(const side of [-1.2,1.2]){const marks=mesh(stripGeometry(core,course,lane+side,core.courseDistance(126800),core.courseDistance(130400),.24,.022),0x718987,'icy-tyre-trace',{transparent:true,opacity:.3,depthWrite:false});marks.castShadow=false;ice.add(marks);}
        for(let i=0;i<16;i++)for(const sign of [-1,1]){
          const d=core.courseDistance(126300+i*300+Math.sin(i*2.3)*80),offset=lane+sign*((kind==='road'?3.5:2.3)+.15*Math.sin(i)),p=route(core,course,d,offset),bank=sphere(g,.48,0xe9f1ec,p.x,lakeGround(core,course,d,offset,playerId,opponent)+.15,p.z,.65+i%3*.12,.25+i%2*.08,1.1+i%4*.2,'uneven-snow-verge');bank.castShadow=false;
        }
      }
    }
    for(let i=0;i<18;i++){
      const a=TAU*i/18,d=core.courseDistance(128600)+Math.sin(a)*27*core.COURSE_SCALE/core.WORLD_SCALE,lane=-7.5+Math.cos(a)*28,p=route(core,course,d,lane);p.y=lakeGround(core,course,d,lane,playerId,opponent);
      if(Math.min(Math.abs(lane),Math.abs(lane+15))<5)continue;
      if(frozen){const rock=sphere(g,.4,0xd6e5df,p.x,p.y+.15,p.z,1.4,.6,1,'frosted-shore-rock');rock.castShadow=false;}
      else for(let j=0;j<3;j++){beam(g,[p.x+j*.18,p.y,p.z],[p.x+j*.18+.12,p.y+.8+j*.12,p.z],.025,0x718858,'lakeside-reed');cyl(g,.055,.25,0x947449,p.x+j*.18+.12,p.y+.9+j*.12,p.z,'y','reed-head');}
    }
    const weather=new T.Group();weather.name=frozen?'blowing-lakeside-snow':'lakeside-wind-and-rain';world.add(weather);
    const centre=route(core,course,core.courseDistance(128600),-7.5);transformRoute(weather,{...centre,y:0,grade:0});
    for(const x of [-24,24]){const clouds=new T.Group();clouds.name='weather-cloud-bank';add(weather,clouds,x,14,8*core.COURSE_SCALE);for(let i=0;i<4;i++){const puff=sphere(clouds,2.2,frozen?0xd2dfe0:0x9fb3bc,(i-1.5)*2.5,i%2*.7,i%2,1.3,.8+i%2*.2,1.4,'weather-cloud');puff.castShadow=puff.receiveShadow=false;}}
    const particles=new T.InstancedMesh(frozen?new T.SphereGeometry(.075,5,4):new T.CylinderGeometry(.015,.015,.72,4),material(frozen?0xf3fbff:0x7aafc1,{transparent:true,opacity:frozen?.8:.62,depthWrite:false}),120);particles.name=frozen?'windblown-snowflakes':'slanting-rain';particles.castShadow=false;particles.frustumCulled=false;weather.add(particles);
    const gusts=[];for(let i=0;i<7;i++){const gust=line(weather,[[-2,0,0],[0,.16,.3],[2,.1,.5]],.022,0xc2e0e6,'wind-streak');gust.castShadow=false;gusts.push(gust);}
    const sockGroup=new T.Group();sockGroup.name='lakeside-windsock';add(weather,sockGroup,18,0,-18*core.COURSE_SCALE);cyl(sockGroup,.07,4,0x879c9e,0,1.6,0);const sock=cyl(sockGroup,.32,1.8,0xe58c54,.9,3.5,0,'x','storm-windsock',.17);
    return {group:g,weather,particles,gusts,sock,ripples,frozen,level};
  }
  function updateLakeside(b,race) {
    const core=b.core,lake=b.lakeside;if(!lake)return;const t=race.elapsed||0,matrix=new T.Matrix4(),rotation=new T.Quaternion().setFromEuler(new T.Euler(0,0,-.42)),scale=new T.Vector3(1,1,1);
    lake.weather.visible=Math.abs(race.player.distance-core.courseDistance(128600))<15000||Math.abs(race.rival.distance-core.courseDistance(128600))<15000;
    for(let i=0;i<120;i++){
      const x=((i*7.31+t*(lake.frozen?1.5:3))%40)-20,y=1+((i*3.73-t*(lake.frozen?1:7))%13+13)%13,z=(((i*5.87+t*.6)%42)-21)*core.COURSE_SCALE;
      matrix.compose(new T.Vector3(x,y,z),rotation,scale);lake.particles.setMatrixAt(i,matrix);
    }lake.particles.instanceMatrix.needsUpdate=true;
    lake.gusts.forEach((g,i)=>g.position.set(((t*2+i*5)%30)-15,5+i%3*2.2,(-16+i*5)*core.COURSE_SCALE));
    lake.sock.rotation.y=.1*Math.sin(t*1.9);lake.sock.rotation.z=-PI/2+.07*Math.sin(t*2.3);
    lake.ripples.forEach((r,i)=>{const age=(t*.45+i*.27)%1;r.scale.setScalar(.6+age*.8);});
    for(const who of ['player','rival']){
      const v=race[who],g=b[who+'Splashes'],c=b.core.getCharacter(race,who);g.visible=!lake.frozen&&c.vehicleType==='road'&&v.velocity>1&&v.distance>core.courseDistance(126600)&&v.distance<core.courseDistance(130600);
      if(!g.visible)continue;
      const p=b.core.sampleVehicleRoute(race,who),cs=Math.cos(p.heading),sn=Math.sin(p.heading);
      g.children.forEach((drop,i)=>{const age=(t*2.5+i*.19)%1,side=i%2?1:-1,x=side*(c.vehicleType==='road'?1.35:1.1)+side*age*.35,z=(i%4<2?1.5:-1.5)-age*.5;drop.position.set(p.x+x*cs+z*sn,lake.level+.02+Math.sin(age*PI)*.22,p.z-x*sn+z*cs);drop.scale.setScalar(.5+age*.7);});
    }
  }
  function terrainAndTrack(core,courseId,opponent,world,services=[],playerId='thomas') {
    const course=core.COURSES[courseId],length=course.length,railStart=-6000,railEnd=length+30000;
    const channels=services.filter(s=>s.type==='drawbridge').map(s=>{const p=route(core,courseId,s.at,0);return{p,level:courseId==='harbour'?-1.25:-2.3};});
    const terrainOffset=(d,lane=0)=>{
      const p=route(core,courseId,d,lane),original=core.sampleTerrainHeight(courseId,d,lane);let height=lakeGround(core,courseId,d,lane,playerId,opponent);
      for(const channel of channels){const cs=Math.cos(channel.p.heading),sn=Math.sin(channel.p.heading),dx=p.x-channel.p.x,dz=p.z-channel.p.z,x=dx*cs-dz*sn,z=dx*sn+dz*cs;
        const edge=Math.abs(z-harbourChannelZ(x)),rim=Math.max(height,channel.level+.2);
        if(edge<4.5)height=Math.min(height,channel.level-.9*Math.min(1,(4.5-edge)/.9));
        else if(!(courseId==='harbour'&&x<-25)&&edge<14){
          if(edge<9){const u=(edge-4.5)/4.5;height=channel.level+(rim-channel.level)*u*u*(3-2*u);}
          else height+=(rim-height)*(14-edge)/5;
        }
      }return height-original;
    };
    const riverRows=[...new Set([...Array.from({length:101},(_,i)=>i*5-250),-34,-29,-23,-22,-18,-12,-8,-6,6,7,8,14,19])].sort((a,b)=>a-b);
    chunkRange(railStart,railEnd,10000,(start,end)=>{const nearRiver=services.some(s=>s.type==='drawbridge'&&s.at>start-6000&&s.at<end+6000);const ground=mesh(groundGeometry(core,courseId,start,end,terrainOffset,nearRiver?riverRows:null),C.grass,'continuous-ground');world.add(ground);ground.receiveShadow=true;});
    if(courseId==='harbour')chunkRange(6000,railEnd,10000,(start,end)=>world.add(mesh(stripGeometry(core,courseId,-77,start,end,104,d=>-1.25-route(core,courseId,d,-77).y),0x79bed1,'continuous-harbour-water')));
    for(const offset of [0,-15].filter(lane=>core.character(lane===0?playerId:opponent).vehicleType!=='air'))chunkRange(railStart,railEnd,6000,(start,end)=>world.add(mesh(stripGeometry(core,courseId,offset,start,end,4.1,d=>{const bridge=course.sections.find(s=>s.type==='bridge'&&d>=s.start&&d<=s.end);return bridge?(core.sampleTerrainHeight?core.sampleTerrainHeight(courseId,d,offset)-route(core,courseId,d,offset).y+.02:-3.5):-.09+terrainOffset(d,offset);},125),C.grassLight,'railway-verge')));
    if(core.sampleTerrainHeight)for(const rows of [[8,10,14,19],[-23,-25,-29,-34]])world.add(mesh(groundGeometry(core,courseId,core.courseDistance(77000),core.courseDistance(113000),(d,lane)=>terrainOffset(d,lane)+.025,rows),0xa99875,'exposed-hillside-earth'));
    // One player railway and one independent neighbouring route: no branchwork.
    for(const [offset,corridor,road]of [[0,'player',core.character(playerId).vehicleType==='road'],[-15,'rival',core.character(opponent).vehicleType==='road']].filter((_,i)=>core.character(i?opponent:playerId).vehicleType!=='air'))chunkRange(railStart,railEnd,6000,(start,end)=>{
      let ranges=[[start,end]];for(const spec of services.filter(s=>s.type==='drawbridge')){const a=spec.at+14/core.WORLD_SCALE,z=spec.at+23/core.WORLD_SCALE;ranges=ranges.flatMap(([l,r])=>r<=a||l>=z?[[l,r]]:[[l,Math.min(r,a)],[Math.max(l,z),r]].filter(([l,r])=>r>l));}
      for(const[a,z]of ranges)trackPath(core,courseId,world,d=>core.sampleRoute(courseId,d,offset),a,z,offset,road,corridor);
    });
    return makeLakeside(core,courseId,world,playerId,opponent);
  }
  function tree(world,p,scale=1,kind=0) {
    const g=new T.Group();g.name='tree';g.position.set(p.x,p.y,p.z);g.scale.setScalar(scale);world.add(g);
    cyl(g,.14,1.65,C.wood,0,.8,0);if(kind%3===0) {
      const m=add(g,mesh(new T.ConeGeometry(1.2,3.2,9),0x4d965f),0,2.5,0);m.receiveShadow=true;
      add(g,mesh(new T.ConeGeometry(.95,2.8,9),0x62a96b),0,3.3,0);
    } else {sphere(g,1.14,0x5b9f5d,0,2.55,0,1.1,1.3,1);sphere(g,.82,0x79b86c,.68,2.3,.1);sphere(g,.85,0x6caf63,-.62,2.6,.1);}
  }
  function house(world,p,kind=0) {
    const g=new T.Group();g.name='sodor-cottage';g.position.set(p.x,p.y,p.z);g.rotation.y=p.heading;world.add(g);
    box(g,4.8,2.8,3.7,kind%2?0xf4d99a:0xeee7c8,0,1.4,0,'cottage-walls',.09);
    const roof=new T.Shape();roof.moveTo(-2.8,0);roof.lineTo(0,1.7);roof.lineTo(2.8,0);roof.closePath();
    const roofGeo=new T.ExtrudeGeometry(roof,{depth:4.3,bevelEnabled:false});roofGeo.translate(0,2.8,-2.15);g.add(mesh(roofGeo,0xb75b48,'tiled-roof'));
    for(const x of [-1.5,1.5]){box(g,.9,1,.055,0x426c7a,x,1.7,1.87,'window-rim');box(g,.72,.82,.06,0xb4e2eb,x,1.7,1.91);box(g,.06,.82,.06,C.white,x,1.7,1.95);}
    box(g,.9,1.8,.06,0x4e8c9a,0,.9,1.91,'front-door');
    box(g,.45,1.1,.55,0xa15c49,1.4,3.9,-.4,'chimney');
  }
  function fence(core,course,world,start,end,lane) {
    const posts=[];for(let d=start;d<=end;d+=450){const p=route(core,course,d,lane);if(core.sampleTerrainHeight)p.y=core.sampleTerrainHeight(course,d,lane);posts.push({x:p.x,y:p.y+.6,z:p.z,heading:p.heading});}
    instanced(world,new T.BoxGeometry(.16,1.2,.16),0xe2d5a5,posts,'fence-posts');
    for(const y of [.45,.9])world.add(mesh(stripGeometry(core,course,lane,start,end,.06,d=>y+(core.sampleTerrainHeight?core.sampleTerrainHeight(course,d,lane)-route(core,course,d,lane).y:0)),0xdfcda0,'fence-rail'));
  }
  function makeCrossingCorridor(core,race,spec,group,slots){
    const mode=core.getCrossingMode(race),corridor=new T.Group(),base=core.sampleRoute(race.courseId,spec.at,0);
    corridor.name='crossing-corridor';corridor.userData={mode};transformRoute(corridor,base);group.add(corridor);
    const start=-300,end=285;
    const elevation=x=>core.sampleTerrainHeight(race.courseId,spec.at,x)-base.y+.32;
      const sample=x=>({x,y:elevation(x)-.015,z:8.45,heading:PI/2});
      corridor.add(mesh(sampledStrip(sample,start,end,7,-.08,2),0xb4b7a6,'crossing-road-shoulder'));
      corridor.add(mesh(sampledStrip(sample,start,end,6,0,2),0x929b96,'crossing-road'));
      for(const z of [5.65,11.25])corridor.add(mesh(sampledStrip(x=>({...sample(x),z}),start,end,.07,.012,2),C.cream,'crossing-road-edge'));
      for(let x=start+3;x<end;x+=5)plainBox(corridor,2,.018,.09,C.cream,x,elevation(x)+.002,8.45,'crossing-road-dash');
    for(const [i,slot]of slots.entries()){
      if(slot.air)continue;
      slot.crossingMode=mode;slot.crossingLane=i?10:6.9;slot.crossingDirection=i?-1:1;
      slot.crossingSurface=x=>elevation(x)-.015;
        const car=new T.Group();car.name='crossing-car';slot.group.add(car);slot.car=car;
        box(car,2,.64,1.1,0xe4b653,0,.55,0,'car-body');box(car,.95,.5,1,0xa4d7e5,-.1,1.1,0,'car-cabin');
        for(const x of [-.65,.65])for(const z of [-.55,.55])cyl(car,.26,.13,C.outline,x,.26,z,'z','car-wheel');
    }
  }
  function updateCrossingTraffic(race,slot,state,t,working,done){
    if(!slot.crossingMode)return;
    // Opposite traffic lanes head outward from the space between the racers.
    // Each can clear its own junction independently and continue beyond the
    // camera, without driving across an opponent that has already departed.
    const seconds=working?(state.duration||5)*t:done?5+Math.max(0,race.elapsed-(state.completedAt??race.elapsed)):0;
    const direction=slot.crossingDirection,travel=seconds*6.4,x=-7.5+direction*travel;
    const vehicle=slot.car,offset=slot.who==='rival'?-15:0;
    const y=slot.crossingSurface(x),slope=(slot.crossingSurface(x+.1)-slot.crossingSurface(x-.1))/.2;
    vehicle.position.set(x-offset,y,slot.crossingLane);vehicle.rotation.z=Math.atan(slope);
    vehicle.visible=x>-295&&x<280;
    if(slot.trafficLights)slot.trafficLights.forEach((lamp,i)=>{lamp.material=material(i===(done?2:working&&t>=.9?1:0)?[C.red,0xe6b44e,C.green][i]:0x344441);lamp.userData.reverse.material=lamp.material;});
    const signal=slot.crossingSignal||slot.signal;if(signal)signal.material=material(done?0x58ad50:working&&t>=.6?0xe6b44e:C.red);
  }
  function buildRaceObjects(core,world) {return {key:'',services:[],world};}
  function syncRaceObjects(b,race) {
    const services=race.services||[],key=String(race.seed)+':'+race.playerId+':'+race.opponentId+':'+race.deliveryTheme+':'+services.map(s=>s.id+':'+s.type).join('|');
    if(b.objects.key===key)return;
    const shared=new Set(geoCache.values());
    for(const bundle of b.objects.services){bundle.group.traverse(o=>{if(o.geometry&&!shared.has(o.geometry))o.geometry.dispose();});b.world.remove(bundle.group);}
    b.objects.key=key;b.objects.services=[];
    for(const spec of services){const group=new T.Group();group.name='delivery-service-event';b.world.add(group);const slots=[];
      for(const who of ['player','rival']){const slot=makeServiceSlot(b.core,b.courseId,spec,who,who==='player'?race.playerId:race.opponentId);group.add(slot.group);slots.push(slot);}
      if(spec.type==='level-crossing')makeCrossingCorridor(b.core,race,spec,group,slots);
      if(spec.type==='drawbridge')makeHarbourCorridor(b.core,race,spec,group,slots);
      b.objects.services.push({group,spec,slots});
    }
  }
  function updateRaceObjects(b,race) {syncRaceObjects(b,race);}
  function updateServices(b,race) {
    const time=race.elapsed||0;
    for(const bundle of b.objects.services){bundle.group.visible=Math.abs(bundle.spec.at-race.player.distance)<18000||Math.abs(bundle.spec.at-race.rival.distance)<18000;
      for(const slot of bundle.slots){const v=race[slot.who],state=v.serviceStates?.find(s=>s.id===slot.spec.id)||{},active=v.service?.id===slot.spec.id,working=state.phase==='working',done=state.phase==='complete'||!!state.completed||!!state.workComplete,
        duration=state.duration||1,t=working?Math.max(0,Math.min(1,1-(state.remaining||0)/duration)):done?1:0,e=t*t*(3-2*t),coach=b[slot.who+'Coach'];
        slot.group.userData.active=active;slot.group.userData.phase=state.phase||'approach';slot.group.userData.progress=t;
        updateDrawbridge(race,slot,state,t,working,done);
        if(slot.air){updateAirService(b,race,slot,state,t,working,done,active);updateCrossingTraffic(race,slot,state,t,working,done);continue;}
        if(slot.people.length){const unloading=slot.spec.type==='passenger-unload';for(let i=0;i<3;i++){
          const person=slot.people[i],finished=!!state.groups?.[i],moving=working&&state.activeUnit===i,door=coach.userData.doorThresholds[1].getWorldPosition(new T.Vector3());slot.group.worldToLocal(door);
          const platform=new T.Vector3(3.35,.51,4+i*2.2);person.position.copy(platform);person.visible=unloading?finished||moving:!finished;
          if(moving){
            // First walk beside the train to the fixed doorway, then step across
            // its threshold. Reverse the same two legs when leaving the coach.
            const pathT=unloading?1-t:t,corner=new T.Vector3(platform.x,platform.y,door.z);
            if(pathT<=.7){const u=Math.min(1,pathT/.7),a=u*u*(3-2*u);person.position.copy(platform).lerp(corner,a);person.rotation.y=unloading?0:PI;}
            else {const u=Math.min(1,(pathT-.7)/.3),a=u*u*(3-2*u);person.position.copy(corner).lerp(door,a);person.rotation.y=unloading?PI/2:-PI/2;}
            person.scale.setScalar(1-Math.sin(t*PI)*.08);
          }
          else {person.scale.setScalar(1);person.rotation.y=0;}
          person.traverse(o=>{if(o.name==='passenger-waving-arm')o.rotation.z=unloading&&finished?-.9+Math.sin(time*3+i)*.12:0;});
        }}
        if(slot.container)updateContainerLift(slot,state,t,working,done,time);
        if(slot.animals.length){
          // Sheep leave first; the gate then swings away from the waiting
          // vehicle and folds along the verge while
          // the model still holds the vehicle at the stop. It stays open.
          const walk=Math.min(1,t/.6),walkEase=walk*walk*(3-2*walk),swing=Math.max(0,Math.min(1,(t-.6)/.4));
          for(let i=0;i<slot.animals.length;i++){const animal=slot.animals[i];animal.position.x=(i-1)*1.3+7*walkEase;animal.position.y=working&&walk<1?Math.sin(walk*PI*8+i)*.035:0;animal.rotation.y=0;}
          slot.gate.rotation.y=PI/2*swing*swing*(3-2*swing);
        }
        if(slot.sleepers){slot.sleepers.forEach((sleeper,i)=>{
          const fixed=state.groups?.[i],moving=working&&state.activeUnit===i;
          sleeper.rotation.y=slot.road?0:fixed?0:moving?.22*(1-e):.22;
          sleeper.position.y=slot.road?.012:.12+(moving?Math.sin(t*PI)*.2:0);
          sleeper.material=material(slot.road?(fixed?0x7e8b88:0x594c3f):(fixed?0x8d7253:0xd9ae6c));
          const worker=slot.workers[i];worker.position.x=fixed?4.6:moving?3.2-Math.sin(t*PI)*.7:3.2;
          worker.rotation.z=moving?Math.sin(t*PI*4)*.08:0;
        });}
        if(slot.rocks||slot.branch)updateObstacleLift(slot,state,t,working,done,time);
        updateFuelPump(slot,state,t,working,active);
        if(slot.coalFill){const partial=working?t/3:0;slot.coalFill.scale.y=.2+.8*Math.min(1,v.coal+partial);}
        if(slot.scoops){slot.scoops.forEach((scoop,i)=>{
          const used=state.groups?.[i],moving=working&&state.activeUnit===i;
          scoop.visible=!used;scoop.position.set(4.4,-.12,-2+i*2);
          if(moving){const fill=b[slot.who].userData.coalFill||slot.coalFill;
            const target=fill.getWorldPosition(new T.Vector3());target.y+=.35;
            slot.group.worldToLocal(target);scoop.position.lerp(target,e);scoop.position.y+=Math.sin(t*PI)*2.2;scoop.rotation.z=-t*.5;
          }
        });}
        if(slot.barriers){
          const rear=v.distance-b.core.getCoachOffset(race,slot.who)-400;
          const passed=rear>slot.spec.at+1400;
          const opening=Math.max(0,Math.min(1,(t-.6)/.4));
          const lowered=slot.road?(done?0:working?1-opening:1):done?(passed?Math.max(0,1-(rear-slot.spec.at-1400)/600):1):working?opening:0;
          slot.barriers.forEach(arm=>arm.rotation.x=-PI/2*(1-lowered));
        }
        updateCrossingTraffic(race,slot,state,t,working,done);
        if(slot.depotWater){const fill=.1+.9*(done?1:working?t:0);slot.depotWater.scale.y=fill;slot.depotWater.position.y=.1+.75*fill;slot.stream.visible=working;}
        if(slot.wash){const cleaning=active&&working;for(const brush of slot.brushes)brush.rotation.y=active?time*2:0;slot.waterDrops.forEach((drop,i)=>{drop.visible=cleaning;drop.position.y=.8+((time*1.7+i*.27)%2.7);});}
        if(slot.spout){slot.spout.rotation.y=working||done?0:-PI/2;slot.stream.visible=working;slot.stream.scale.x=working?.8+Math.sin(time*8)*.1:1;const fill=done?1:working?t:0;slot.towerLevel.scale.y=1-fill*.35;slot.towerLevel.position.y=.62-fill*.18;const gauge=b[slot.who].userData.waterGauge;gauge.group.visible=active||done&&Math.abs(v.distance-slot.spec.at)<4000;gauge.level.scale.y=.20+.8*fill;gauge.level.position.y=.06+.27*(.20+.8*fill);}

      }
    }
  }

  function tunnel(core,course,world,section,opponent,playerId='thomas') {
    const length=(section.end-section.start)*core.WORLD_SCALE;
    for(const offset of [0,-15].filter((_,i)=>core.character(i?opponent:playerId).vehicleType!=='air')){
      const p=route(core,course,(section.start+section.end)/2,offset),g=new T.Group();
      g.name='railway-tunnel';g.userData={section,corridor:offset===0?'player':'rival'};transformRoute(g,p);world.add(g);
      // A complete, hollow masonry vault. Opaque walls and roof occlude each
      // part of the train naturally as it enters; the portals remain open.
      const shape=new T.Shape();shape.moveTo(-3.7,-.32);shape.lineTo(-3.7,3);
      shape.absarc(0,3,3.7,PI,0,true);shape.lineTo(3.7,-.32);shape.lineTo(3,-.32);shape.lineTo(3,3);
      shape.absarc(0,3,3,0,PI,false);shape.lineTo(-3,-.32);shape.closePath();
      const shell=new T.ExtrudeGeometry(shape,{depth:length,bevelEnabled:false,curveSegments:24});shell.translate(0,0,-length/2);
      g.add(mesh(shell,0x9eaa94,'tunnel-vault'));
      for(const z of [-length/2,length/2]){
        const arch=new T.Group();arch.name='tunnel-portal';add(g,arch,0,0,z);
        for(const x of [-3.35,3.35])for(let y=-.05;y<3;y+=.55)
          box(arch,.72,.51,.7,0xd5cbb2,x,y,0,'portal-stone',.025);
        for(let i=0;i<16;i++){
          const angle=(i+.5)*PI/16;
          const stone=box(arch,.64,.72,.7,i%2?0xd5cbb2:0xcac0a8,Math.cos(angle)*3.35,3+Math.sin(angle)*3.35,0,'arch-stone',.025);
          stone.rotation.z=angle-PI/2;
        }
        for(const x of [-4.25,4.25])box(arch,1.1,2.3,.8,0xa9ae97,x,.83,0,'portal-wing-wall');
      }
      // Keep the original soft train/ground shadows without casting a huge
      // structural shadow onto a train outside the portal.
      g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
    }
  }
  function harbour(core,course,world) {
    const p=route(core,course,core.COURSES[course].length*.4,-38),g=new T.Group();g.name='harbour';add(world,g,p.x,-1.25,p.z);g.rotation.y=p.heading;
    plainBox(g,34,.15,80,0x79bed1,0,0,0,'harbour-water');
    for(let z=-32;z<38;z+=9){box(g,3.4,1.4,8.2,0xb2ac94,18,.4,z,'quayside');cyl(g,.24,1.2,C.wood,17,1.4,z);}
    const ship=new T.Group();ship.name='cartoon-harbour-boat';add(g,ship,-1,.5,-7);
    sphere(ship,1,0x394f61,0,0,0,2.9,.7,7);box(ship,4.7,.35,10.2,C.cream,0,.55,0,'boat-deck');box(ship,3.3,2.1,3.7,C.white,0,1.7,-1.5);box(ship,3.6,.2,4.1,C.red,0,2.86,-1.5);cyl(ship,.38,2.0,C.outline,0,3.4,-1.8);
    for(let i=0;i<3;i++)box(ship,.65,.65,.06,0x8bc7dd,(i-1)*.9,1.9,.4,'boat-window');
    beam(g,[19,1,12],[19,12,12],.24,0xd6a94f);beam(g,[19,11.5,12],[8,11.5,12],.20,0xd6a94f);beam(g,[8,11.5,12],[8,3.5,12],.04,C.outline);
  }
  function startFinish(core,courseId,world,distance,isFinish=false) {
    const p=route(core,courseId,distance,-5.5),g=new T.Group();g.name=isFinish?'finish-gantry':'start-gantry';transformRoute(g,p);world.add(g);
    for(const x of [-16.4,16.4]){box(g,.36,6,.36,C.outline,x,3,0,'gantry-post');box(g,.68,.17,.68,0xd7c5a1,x,.1,0);}
    box(g,33,1,.25,0xffe9aa,0,5.7,0,'race-banner');
    if(isFinish)for(let i=0;i<60;i++)for(let j=0;j<2;j++)plainBox(g,.53,.43,.025,(i+j)%2?C.outline:C.white,(i-29.5)*.54,5.48+j*.44,.15,'chequered-finish');
    else for(const x of [-2,0,2]) {const lamp=sphere(g,.32,0xb95043,x,5.7,.25,1,1,.35,'start-light');lamp.userData.startLight=true;}
    return g;
  }
  // Festival props live outside the running corridors. All motion uses race /
  // presentation time, so pause and tab visibility freeze every animated mesh.
  function makeFestival(core,race,world) {
    const g=new T.Group();g.name='finish-festival-'+race.courseId;
    transformRoute(g,route(core,race.courseId,core.COURSES[race.courseId].length,0));world.add(g);
    const people=[],flags=[],awards={},ribbons={},confetti=[];
    const colors=[0xef6554,0xf4c654,0x4eabd2,0x8e6bb0,0x60ad81];
    function pennants(parent,x,z,length=12){
      for(const dz of [0,length])cyl(parent,.075,4.6,C.wood,x,2.3,z+dz,'y','festival-bunting-post');
      beam(parent,[x,4.4,z],[x,4.4,z+length],.025,C.cream,'bunting-string');
      for(let i=0;i<9;i++){
        const flag=plainBox(parent,.04,.6,.65,colors[i%colors.length],x,4.05,z+.6+i*length/9,'festival-pennant');
        flag.userData.phase=i;flags.push(flag);
      }
    }
    for(const x of [7,-23]){
      box(g,4,.8,33,race.courseId==='mountain'?0xe3edf1:0xd8c19d,x,-.35,12,'festival-platform');
      pennants(g,x+(x>0?2:-2),-2,27);
      for(let i=0;i<10;i++){
        const person=makePerson(colors[i%colors.length],1.1);person.name=race.deliveryTheme==='cargo'?'festival-dockworker':'festival-passenger';
        add(g,person,x+(i%2)*.6,.07,-1+i*3.1);person.rotation.y=x>0?-.8:.8;
        if(race.deliveryTheme==='cargo')cyl(person,.27,.16,0xf2c342,0,1.72,0,'y','worker-hard-hat');
        if(race.courseId==='mountain'){sphere(person,.26,colors[(i+2)%5],0,1.76,0,1,.7,1,'winter-hat');sphere(person,.09,C.white,0,1.98,0);}
        people.push(person);
      }
    }
    const marshal=makePerson(C.blueDark,1.3);marshal.name='finish-flag-marshal';add(g,marshal,5.9,.1,-1.3);people.push(marshal);
    const arm=marshal.userData.waveArm;
    beam(arm,[0,-.35,0],[0,-1.8,0],.035,C.wood,'chequered-flag-pole');
    for(let i=0;i<4;i++)for(let j=0;j<3;j++)plainBox(arm,.22,.21,.025,(i+j)%2?C.outline:C.white,.1+i*.22,-1.1-j*.21,0,'marshal-chequered-flag');
    // The course settings share the same readable ceremony footprint.
    if(race.courseId==='country'){
      box(g,10,1.8,10,0xb9aa91,-31,-.9,13,'station-foundation');
      box(g,9,4.5,9,0xe7c996,-31,2.1,13,'festival-station');box(g,10,.5,10,0xb55646,-31,4.6,13,'station-roof');
      for(const z of [10,13,16])box(g,.1,1.6,1.3,0x79b4c7,-26.4,2.4,z,'station-window');
      cyl(g,.85,.15,0xffedbd,-26.3,3.7,13,'x','station-clock');
      for(const z of [3,22]){box(g,3,.2,1.1,C.wood,-28,.9,z,'party-table');for(const dz of [-.3,.3])sphere(g,.18,colors[1],-28,1.2,z+dz);}
    }else if(race.courseId==='harbour'){
      // This quay meets the course's continuous harbour water.
      box(g,2,.7,110,0xae9e87,-26,-.8,14,'festival-quay-wall');
      box(g,2,.7,47,0xae9e87,-26,-.2,14,'festival-quayside');
      for(let i=0;i<3;i++){
        const boat=new T.Group();boat.name='decorated-festival-boat';add(g,boat,-34-i%2*5,-1.05,-5+i*17);
        sphere(boat,1,colors[i],0,.2,0,2,.7,4.5,'festival-boat-hull');box(boat,2,1.6,3,C.cream,0,1,0,'boat-cabin');
        cyl(boat,.07,6,C.wood,0,3,0,'y','boat-mast');for(let j=0;j<5;j++)plainBox(boat,.04,.5,.65,colors[j],0,5-j*.5,-2+j,'boat-bunting');
        flags.push(boat);boat.userData.boat=true;boat.userData.phase=i;
      }
    }else{
      box(g,14,1.8,40,0xafb4ae,-32,-.9,12,'winter-festival-platform');
      box(g,14,.10,40,0xf0f5ef,-32,.01,12,'snow-festival-ground');
      for(const z of [1,23]){
        sphere(g,1,0xf8f8ef,-29,.95,z);sphere(g,.7,0xf8f8ef,-29,2.4,z);sphere(g,.48,0xf8f8ef,-29,3.45,z);
        cyl(g,.6,.13,C.outline,-29,3.8,z);cyl(g,.37,.6,C.outline,-29,4.08,z);
        sphere(g,.12,0xea8d40,-28.5,3.45,z,1.8,1,1,'snowman-nose');
      }
      box(g,8,3,7,0x916857,-36,1.5,12,'festival-hot-chocolate-stall');box(g,9,.4,8,0xf5efe0,-36,3.2,12,'snowy-stall-roof');
    }
    for(const who of ['player','rival']){
      const c=core.getCharacter(race,who),lane=who==='player'?0:core.RIVAL_LANE,air=c.vehicleType==='air';
      if(air){
        const z=core.finishRunout(race,who)*core.WORLD_SCALE;
        cyl(g,4,.36,0x6e948a,lane,-.14,z,'y','festival-helipad');torus(g,3.4,.025,C.cream,lane,.05,z,'y','helipad-ring');
        for(const x of [-.9,.9])box(g,.18,.015,2.9,C.white,lane+x,.05,z,'helipad-H');box(g,1.8,.015,.18,C.white,lane,.05,z,'helipad-H');
      }
      const ribbon=new T.Group();ribbon.name=who+'-finish-ribbon';add(g,ribbon,lane,air?9.2:1.5,0);
      for(const side of [-1,1]){const half=plainBox(ribbon,2.7,.28,.035,0xe95554,side*1.35,0,0,'ribbon-half');half.userData.side=side;}
      ribbons[who]=ribbon;
      const award=new T.Group();award.name=who+'-festival-award';g.add(award);awards[who]=award;
      box(award,2.6,.34,1.8,C.stone,0,-.15,0,'award-foundation');
      const trophy=new T.Group();trophy.name='gold-trophy';award.add(trophy);
      box(trophy,1.5,.18,1.1,0x466577,0,.12,0,'trophy-base');cyl(trophy,.18,.65,0xe5ae38,0,.5,0);
      cyl(trophy,.42,.95,0xffd75e,0,1.25,0,'y','gold-cup',.73);
      for(const side of [-1,1])torus(trophy,.43,.09,0xffcf4e,side*.62,1.38,0,'z','trophy-handle');
      const rosette=new T.Group();rosette.name='silver-rosette';award.add(rosette);
      cyl(rosette,.06,1.5,C.wood,0,.75,0);for(const side of [-1,1]){const tail=box(rosette,.25,.8,.04,0x769ab9,side*.18,.9,0,'rosette-tail');tail.rotation.z=side*.22;}
      for(let i=0;i<12;i++)sphere(rosette,.19,0xd1dfe8,Math.sin(i*TAU/12)*.48,1.6+Math.cos(i*TAU/12)*.48,0,1,1,.3,'silver-rosette-petal');
      cyl(rosette,.36,.12,0xf1f5f7,0,1.6,.06,'z','rosette-centre');
      const first=new T.Group();first.name='first-place-flag';add(award,first,1.1,0,0);
      cyl(first,.045,3.2,C.wood,0,1.6,0);box(first,1,.65,.035,0xffd75e,.5,2.85,0,'winner-flag');box(first,.11,.42,.05,C.outline,.5,2.85,.03,'first-place-one');
      award.userData={trophy,rosette,first};award.visible=false;
      for(let i=0;i<42;i++){
        const piece=plainBox(g,.12,.2,.035,i%3===0?0xffd75e:i%3===1?c.color:C.white,0,0,0,'festival-confetti');
        piece.castShadow=false;piece.userData={who,index:i};piece.visible=false;confetti.push(piece);
      }
    }
    g.traverse(o=>{if(o.isMesh)o.castShadow=false;});
    return {group:g,people,flags,marshal,awards,ribbons,confetti};
  }
  function updateFestival(b,race,options){
    const f=b.festival,t=race.elapsed,festival=options.festival;
    const near=race.player.distance>b.core.COURSES[race.courseId].length-7000;
    f.group.visible=near;if(!near)return;
    for(let i=0;i<f.people.length;i++){
      const p=f.people[i],enthusiasm=festival?.stage==='thanks'?1:.7;
      p.userData.waveArm.rotation.z=2.5+Math.sin(t*3+i)*.28*enthusiasm;
      p.rotation.z=Math.sin(t*2+i)*.025;
    }
    for(const flag of f.flags){if(flag.userData.boat){flag.rotation.z=Math.sin(t+flag.userData.phase)*.025;}else flag.rotation.y=Math.sin(t*2+flag.userData.phase)*.22;}
    for(const who of ['player','rival']){
      const arrival=b.core.finishArrival(race,who),award=f.awards[who],ribbon=f.ribbons[who];
      const other=who==='player'?'rival':'player';
      const first=!!arrival&&(!race[other].finishEvent||race[who].finishTime<=race[other].finishTime+.05);
      ribbon.visible=!arrival||arrival.age<1.5;
      for(const half of ribbon.children){const age=arrival?Math.min(1.5,arrival.age):0;half.position.x=half.userData.side*(1.35+age*3);half.position.y=-age*.7;half.rotation.z=half.userData.side*age*.8;}
      // The computer's first-place flag appears at its crossing, even while the
      // human is still driving. The human award follows the festival's beats.
      award.visible=!!arrival&&(who==='rival'||!!festival&&(festival.elapsed>=4.5||festival.results));
      const win=race.winner==='tie'||(race.winner?race.winner===who:first);
      award.userData.trophy.visible=win;award.userData.first.visible=win;award.userData.rosette.visible=!win;
      const lane=who==='player'?0:b.core.RIVAL_LANE;
      const z=arrival?(arrival.distance-b.core.COURSES[race.courseId].length)*b.core.WORLD_SCALE:0;
      award.position.set(lane+4,0,b.core.finishRunout(race,who)*b.core.WORLD_SCALE+1);award.rotation.y=.45;
      // A single finite, deterministic burst; no new particles on Skip/resume.
      const burst=arrival?arrival.age-(who==='player'?4.5:0):-1;
      for(const piece of f.confetti.filter(p=>p.userData.who===who)){
        const i=piece.userData.index,a=i*2.39996;piece.visible=!festival?.skipped&&win&&burst>=0&&burst<2.5;
        if(piece.visible){piece.position.set(lane+Math.sin(a)*(1+burst*1.5),2.8+burst*3.2-burst*burst*1.5+(i%7)*.16,z-1+Math.cos(a)*(1+burst*1.3));piece.rotation.set(burst*3+i,burst*2+i,burst*4);}
      }
    }
  }
  function buildWorld(core,courseId,opponent,race=null) {
    const world=new T.Group();world.name='race-world-'+courseId;
    const lakeside=terrainAndTrack(core,courseId,opponent,world,race?.services||[],race?.playerId||'thomas');
    const course=core.COURSES[courseId],crossings=(race?.services||[]).filter(s=>s.type==='level-crossing'),harbours=(race?.services||[]).filter(s=>s.type==='drawbridge');
    const clearCrossing=(distance,radius)=>Math.abs((distance-core.courseDistance(128600))*core.WORLD_SCALE)>38*core.COURSE_SCALE+radius&&crossings.every(s=>Math.abs((distance-s.at)*core.WORLD_SCALE-8.45)>radius+4)&&harbours.every(s=>Math.abs((distance-s.at)*core.WORLD_SCALE-18.5)>radius+12);
    // The fixed camera looks from +lane and 80 world units ahead. Keep a clear
    // approach and working view at every shuffled job, across both corridors.
    // Relocate large scenery behind the routes instead of hiding it on arrival.
    const sceneryLane=(distance,lane,radius)=>lane+radius>-30&&(race?.services||[]).some(s=>{
      const ahead=(distance-s.at)*core.WORLD_SCALE;return ahead>-24-radius&&ahead<80+radius;
    })?Math.min(lane,-45-radius):lane;
    for(let i=0;i<Math.ceil(course.length/3200);i++){const d=-5000+i*3200,size=12+i%4;if(!clearCrossing(d,38))continue;const lane=sceneryLane(d,(i%2?-1:1)*(65+i%3*14)-6,size*2.3),p=route(core,courseId,d,lane);sphere(world,size,courseId==='harbour'?0x88b8a2:0x8db97e,p.x,p.y-7,p.z,2.2,.8,2.3,'distant-rolling-hill');}
    let k=0;
    for(let d=-3500;d<course.length+5000;d+=1500) {
      if(d>course.length-6000)continue;
      const seed=(Math.sin(d*1.923+5)*.5+.5),lane=(k%2?1:-1)*(20+seed*10)-6;
      const p=route(core,courseId,d,lane);if(core.sampleTerrainHeight)p.y=core.sampleTerrainHeight(courseId,d,lane);if(clearCrossing(d,2)&&!(courseId==='harbour'&&lane<-22&&d>6000&&d<course.length-4000)&&!course.sections.some(s=>s.type==='bridge'&&d>s.start-1200&&d<s.end+1200))tree(world,p,.8+seed*.8,k);
      if(k%5===0&&clearCrossing(d+400,4)){const lane=courseId==='harbour'?18:(k%2?22:-30),p=route(core,courseId,d+400,lane);if(core.sampleTerrainHeight)p.y=core.sampleTerrainHeight(courseId,d+400,lane);house(world,p,k);}
      k++;
    }
    for(let d=-1000;d<course.length;d+=13000){let ranges=[[d,d+7500]];for(const spec of [...crossings,...harbours]){const a=spec.at+(spec.type==='drawbridge'?8:2)/core.WORLD_SCALE,z=spec.at+(spec.type==='drawbridge'?29:15)/core.WORLD_SCALE;ranges=ranges.flatMap(([l,r])=>r<=a||l>=z?[[l,r]]:[[l,Math.min(r,a)],[Math.max(l,z),r]].filter(([l,r])=>r>l));}ranges=ranges.flatMap(([l,r])=>r<=core.courseDistance(124500)||l>=core.courseDistance(132700)?[[l,r]]:[[l,Math.min(r,core.courseDistance(124500))],[Math.max(l,core.courseDistance(132700)),r]].filter(([l,r])=>r>l));for(const [a,z]of ranges)fence(core,courseId,world,a,z,11.2);}
    for(const section of course.sections) {
      if(section.type==='tunnel')tunnel(core,courseId,world,section,opponent,race?.playerId||'thomas');
    }
    flightWorld(core,courseId,world,race);
    const objects=buildRaceObjects(core,world);
    if(courseId==='harbour')harbour(core,courseId,world);
    if(courseId==='mountain')for(let i=0;i<12;i++) {
      const d=3500+i*4300,size=8+i%4;if(!clearCrossing(d,22))continue;
      const p=route(core,courseId,d,sceneryLane(d,(i%2?-1:1)*(35+i%3*8),size*1.7));
      sphere(world,size,0x8cb394,p.x,p.y-1,p.z,1.7,1.6,1.7,'distant-mountain');
    }
    if(core.sampleTerrainHeight)for(let d=core.courseDistance(79000);d<core.courseDistance(114000);d+=core.courseDistance(2800)){if(!clearCrossing(d,2))continue;const lane=22+(Math.floor(d/core.courseDistance(2800))%3)*3,p=route(core,courseId,d,lane);p.y=core.sampleTerrainHeight(courseId,d,lane);sphere(world,.55,0x9a9b87,p.x,p.y+.25,p.z,1.5,.8,1.2,'hillside-rock');}
    const start=startFinish(core,courseId,world,-900,false);startFinish(core,courseId,world,course.length,true);
    const festival=makeFestival(core,race||core.createRace({courseId,playerId:opponent==='thomas'?'percy':'thomas',opponentId:opponent}),world);
    return {world,start,objects,lakeside,festival};
  }
  function makeSteam(kind='thomas') {
    const group=new T.Group();group.name='soft-independent-steam-'+kind;
    const bubbles=[];
    for(let i=0;i<12;i++) {
      const m=new T.Mesh(geometry('steam-sphere',()=>new T.SphereGeometry(1,8,6)),new T.MeshBasicMaterial({color:0xfffdf3,transparent:true,opacity:.4,depthWrite:false}));m.name='running-steam-puff';m.visible=false;group.add(m);bubbles.push(m);
    }
    return {group,bubbles};
  }


  function updateCoach(coach,state,b,race,who) {
    const flight=b.core.getFlightPose(race,who),p=flight||b.core.sampleCoachRoute(race,who,state.distance||0);transformRoute(coach,p,flight?0:b.core.getCharacter(race,who).vehicleType==='road'?-.015:RAIL_TOP);
    if(flight){coach.rotation.x=flight.pitch;coach.rotation.z=flight.roll;}
    const distance=(state.distance||0)-(b.core.getCoachOffset?b.core.getCoachOffset(race,who):(b.core.COACH_OFFSET||900)),travelled=distance*b.core.WORLD_SCALE;
    for(const wheel of coach.userData.wheels)wheel.rotation.x=travelled/wheel.userData.radius;
    if(coach.userData.doors){const active=state.service,open=active?.type?.startsWith('passenger')&&active.phase==='working';coach.userData.doors.forEach((door,i)=>door.rotation.y=open?(i?1:-1)*PI*.42:0);}
    if(coach.userData.occupants){const load=state.serviceStates?.find(s=>s.type==='passenger-load'),unload=state.serviceStates?.find(s=>s.type==='passenger-unload');coach.userData.occupants.forEach((group,i)=>group.visible=b.theme==='passengers'&&(load?.groups?!!load.groups[i]&&!unload?.groups?.[i]:i<(state.carried?.passengers||0))&&!(state.service?.type==='passenger-unload'&&state.service.phase==='working'&&state.service.activeUnit===i));}
    if(coach.userData.container)coach.userData.container.visible=b.theme==='cargo'&&!!(state.carried?.container||state.carried?.cargo)&&!(state.service?.type==='cargo-unload'&&state.service.phase==='working');
    if(flight){
      const load=coach.userData.container,sway=flight.cargo?0:Math.sin(race.elapsed*1.8)*.12*Math.min(1,state.velocity/b.core.CRUISE_SPEED);
      const cargo=flight.cargo||{x:flight.x+sway*Math.cos(flight.heading),y:flight.y-2.55,z:flight.z-sway*Math.sin(flight.heading),attached:true};
      coach.updateMatrixWorld(true);
      load.position.copy(coach.worldToLocal(new T.Vector3(cargo.x,cargo.y,cargo.z)));
      // Suspended and grounded loads stay upright, independently of body tilt.
      load.quaternion.copy(coach.quaternion).invert().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),flight.heading));
      const end=cargo.hook||{x:cargo.x,y:cargo.y+.72,z:cargo.z};
      const hook=coach.worldToLocal(new T.Vector3(end.x,end.y,end.z));setCable(coach.userData.sling,new T.Vector3(0,.65,0),hook);coach.userData.hook.position.copy(hook);coach.userData.sling.visible=coach.userData.hook.visible=load.visible&&(cargo.ropeVisible??cargo.attached);
    }
    return p;
  }
  function updateCoupler(coupler,engine,coach) {
    if(coach.userData.kind==='flight-payload'){coupler.visible=false;return;}
    const rear=root.ThomasRaceCore.character(engine.userData.kind).rearCoupler;
    const tender=engine.userData.tender;
    const a=tender?new T.Vector3(0,.82,-1.52).applyMatrix4(tender.matrixWorld):new T.Vector3(0,.82,rear).applyMatrix4(engine.matrixWorld),z=2.61,b=new T.Vector3(0,.82,z).applyMatrix4(coach.matrixWorld),diff=b.clone().sub(a);
    coupler.position.copy(a.add(b).multiplyScalar(.5));coupler.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),diff.clone().normalize());coupler.scale.set(1,diff.length(),1);
    coupler.visible=engine.visible||coach.visible;
  }
  function makeScene(core,courseId='country',opponent='bertie',theme='passengers',race=null) {
    const scene=new T.Scene();scene.name='Sodor-race';scene.background=new T.Color(C.sky);scene.fog=new T.Fog(C.sky,125,270);
    scene.add(new T.HemisphereLight(0xfffcdf,0x6c9774,2.1));
    const sun=new T.DirectionalLight(0xffefcc,2.3);sun.name='warm-sodor-sun';sun.position.set(30,55,35);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-36;sun.shadow.camera.right=36;sun.shadow.camera.top=40;sun.shadow.camera.bottom=-40;sun.shadow.camera.near=.5;sun.shadow.camera.far=140;sun.shadow.normalBias=.04;sun.shadow.bias=-.0002;scene.add(sun);scene.add(sun.target);
    const built=buildWorld(core,courseId,opponent,race);scene.add(built.world);built.world.updateMatrixWorld(true);
    // Static world matrices are frozen; service fixtures and vehicles stay dynamic.
    built.world.traverse(o=>{o.updateMatrix();o.matrixAutoUpdate=false;o.matrixWorldAutoUpdate=false;});
    built.festival.group.traverse(o=>{o.matrixAutoUpdate=o.matrixWorldAutoUpdate=true;});
    built.lakeside.weather.traverse(o=>{o.matrixAutoUpdate=o.matrixWorldAutoUpdate=true;});
    for(const r of built.lakeside.ripples)r.matrixAutoUpdate=r.matrixWorldAutoUpdate=true;
    const playerId=race?.playerId||'thomas',player=makeVehicle(playerId),rival=makeVehicle(opponent),playerCoach=core.character(playerId).vehicleType==='air'?makeFlightPayload(theme):makeDeliveryCoach(theme,core.character(playerId).vehicleType==='road'),rivalCoach=core.character(opponent).vehicleType==='air'?makeFlightPayload(theme):makeDeliveryCoach(theme,core.character(opponent).vehicleType==='road');makeMud(player);makeMud(rival);makeCoalBunker(player);makeCoalBunker(rival);scene.add(player,rival,playerCoach,rivalCoach);
    const playerCoupler=mesh(geometry('coach-drawbar',()=>new T.CylinderGeometry(.065,.065,1,8)),C.outline,'player-coach-drawbar'),rivalCoupler=mesh(geometry('coach-drawbar',()=>new T.CylinderGeometry(.065,.065,1,8)),C.outline,'rival-coach-drawbar');scene.add(playerCoupler,rivalCoupler);
    const steam=makeSteam(playerId),rivalSteam=makeSteam(opponent);scene.add(steam.group,rivalSteam.group);
    const playerShadow=new T.Group(),rivalShadow=new T.Group();
    for(const [shadow,id]of [[playerShadow,playerId],[rivalShadow,opponent]]){shadow.visible=core.character(id).vehicleType==='air';if(shadow.visible)contactShadow(shadow,2.3,4.8);scene.add(shadow);}
    const playerSplashes=new T.Group(),rivalSplashes=new T.Group();
    for(const g of [playerSplashes,rivalSplashes]){g.name='wheel-flood-splashes';g.visible=false;scene.add(g);for(let i=0;i<12;i++){const drop=sphere(g,.065,0xc0e3e5,0,0,0,1,1.5,1,'wheel-splash');drop.castShadow=false;}}
    const camera=new T.PerspectiveCamera(50,16/9,.2,360);camera.name='stable-three-quarter-camera';
    return {scene,camera,festival:built.festival,lakeside:built.lakeside,playerSplashes,rivalSplashes,player,rival,playerShadow,rivalShadow,playerCoach,rivalCoach,playerCoupler,rivalCoupler,world:built.world,start:built.start,objects:built.objects,sun,steam,rivalSteam,core,courseId,playerId,opponent,theme};
  }
  function poseVehicle(v,state,core,race,who) {
    const flight=core.getFlightPose(race,who);
    if(flight){transformRoute(v,flight);v.rotation.x=flight.pitch;v.rotation.z=flight.roll;const clock=race.elapsed+core.START_COUNTDOWN-race.countdown;v.userData.rotor.rotation.y=clock*37;v.userData.tailRotor.rotation.x=clock*57;return flight;}
    const p=core.sampleVehicleRoute(race,who,state.distance||0);transformRoute(v,p,core.character(v.userData.kind).vehicleType==='road'?-.015:RAIL_TOP);
    if(v.userData.tender){
      // The tender's wheelbase follows its own position on bends and hills.
      // Keeping it rigidly behind the boiler moves its wheels off the rails.
      const tp=core.sampleVehicleRoute(race,who,(state.distance||0)-core.character(v.userData.kind).tenderOffset/core.WORLD_SCALE),pose=new T.Object3D();
      transformRoute(pose,tp,RAIL_TOP);pose.updateMatrix();v.updateMatrixWorld(true);
      const local=new T.Matrix4().copy(v.matrixWorld).invert().multiply(pose.matrix);
      local.decompose(v.userData.tender.position,v.userData.tender.quaternion,v.userData.tender.scale);
    }
    const travelled=Number.isFinite(state.wheelTurns)?state.wheelTurns*TAU*core.WHEEL_RADIUS:(state.distance||0)*core.WORLD_SCALE;
    const phase=travelled/v.userData.wheelRadius;for(const wheel of v.userData.wheels)wheel.rotation.x=travelled/wheel.userData.radius;
    const y=Math.cos(phase)*v.userData.wheelRadius*.48,z=Math.sin(phase)*v.userData.wheelRadius*.48;
    for(const rod of v.userData.rods){rod.position.y=y;rod.position.z=z;}
    return p;
  }
  function updateVehicleSteam(system,vehicle,state,race,core) {
    const time=race.elapsed||0,velocity=state.velocity||0;
    const moving=velocity>1&&race.phase!=='countdown',isBus=core.character(vehicle.userData.kind).vehicleType==='road',diesel=core.character(vehicle.userData.kind).power==='diesel';
    const outlet=vehicle.userData.steamOutlet?vehicle.userData.steamOutlet.clone().applyMatrix4(vehicle.matrixWorld):new T.Vector3(0,.42,-2.85).applyMatrix4(vehicle.matrixWorld);
    const heading=vehicle.rotation.y,back=new T.Vector3(-Math.sin(heading),0,-Math.cos(heading));
    system.bubbles.forEach((m,i)=>{
      const age=(time*.5+i/12)%1,size=.17+age*.74;
      m.visible=moving&&!isBus&&core.character(vehicle.userData.kind).power!=='rotor';m.scale.setScalar(diesel?size*.45:size);
      m.position.copy(outlet).addScaledVector(back,age*(.8+velocity*core.WORLD_SCALE*.65));
      m.position.x+=Math.sin(i*2.1)*age*.3;m.position.y+=age*2.8;
      m.material.opacity=(1-age)*.33;m.material.color.setHex(diesel?0x8b999e:0xfffdf3);
    });
  }
  function updateScene(b,race,options={}) {
    const p=poseVehicle(b.player,race.player,b.core,race,'player');poseVehicle(b.rival,race.rival,b.core,race,'rival');
    updateCoach(b.playerCoach,race.player,b,race,'player');updateCoach(b.rivalCoach,race.rival,b,race,'rival');
    const frame=route(b.core,b.courseId,race.player.distance||0,0),cs=Math.cos(frame.heading),sn=Math.sin(frame.heading);
    // Preserve the stable three-quarter camera and responsive framing.
    const narrow=b.camera.aspect<1.2;
    const hasAir=[race.playerId,race.opponentId].some(id=>b.core.character(id).vehicleType==='air');
    const approach=Math.max(0,Math.min(1,(race.player.distance-b.core.COURSES[race.courseId].length+4500)/4500));
    const widen=options.festival?.5+.5*Math.min(1,options.festival.elapsed/4.5):.5*approach*approach*(3-2*approach);
    const awardAhead=Math.max(0,Math.min(12,12-(race.player.distance-b.core.COURSES[race.courseId].length)*b.core.WORLD_SCALE));
    const side=narrow?55:60,forward=80,height=(hasAir?30:25)+widen*2,focusForward=(narrow?5:30)*(1-widen)+awardAhead*widen,focusLane=(narrow?(hasAir?-3:-.9):-5)*(1-widen)-7.5*widen;
    // A modest telephoto view keeps the familiar large face and proportions while
    // moving the fixed camera ahead enough for screen-left/right to stay truthful.
    b.camera.fov=narrow?2*Math.atan(Math.tan(17*PI/360)*Math.max(1,(375/420)/b.camera.aspect))*180/PI:2*Math.atan(Math.tan(25*PI/360)*Math.max(1,1.75/b.camera.aspect))*180/PI;
    if(hasAir)b.camera.fov*=narrow?1.38:1.15;
    b.camera.fov*=1+widen*(narrow?(hasAir?.04:.22):.06);
    if(narrow&&!hasAir)b.camera.fov*=1+.17*approach;
    // Short landscape canvases need larger vehicles as well as smaller controls.
    // Ease into the closer framing; leave room for Harold's full rotor and tail.
    b.camera.fov*=1-.34*Math.min(1,Math.max(0,(b.camera.aspect-2.4)/.8));
    b.camera.updateProjectionMatrix();
    b.camera.position.set(frame.x+side*cs+forward*sn,frame.y+height,frame.z-side*sn+forward*cs);
    b.camera.lookAt(frame.x+focusLane*cs+focusForward*sn,frame.y+(hasAir?5.5:narrow?2.5:1.6),frame.z-focusLane*sn+focusForward*cs);
    b.camera.updateMatrixWorld();b.scene.updateMatrixWorld(true);
    b.sun.position.set(p.x+32,p.y+52,p.z+28);b.sun.target.position.set(p.x,p.y,p.z);
    for(const who of ['player','rival'])updateCoupler(b[who+'Coupler'],b[who],b[who+'Coach']);
    for(const who of ['player','rival']){const f=b.core.getFlightPose(race,who);if(f){const shadow=b[who+'Shadow'];shadow.position.set(f.x,f.shadowY,f.z);shadow.rotation.y=f.heading;shadow.children[0].material.opacity=.18/(1+f.altitude*.045);}}
    updateVehicleSteam(b.steam,b.player,race.player,race,b.core);
    updateVehicleSteam(b.rivalSteam,b.rival,race.rival,race,b.core);
    b.start.traverse(o=>{if(o.userData.startLight){o.material=material(race.phase==='countdown'?((race.countdown||0)<=b.core.START_COUNTDOWN/2?0xefbe50:0xca5347):0x58b85e);}});
    updateFestival(b,race,options);
    updateLakeside(b,race);updateRaceObjects(b,race);updateServices(b,race);for(const who of ['player','rival']){const v=race[who];b[who].userData.mudPatches.forEach((patch,i)=>patch.visible=!!v.mudPatches?.[i]);
      const fill=b[who].userData.coalFill;if(fill){const partial=v.service?.type==='coal'&&v.service.phase==='working'?v.service.progress/3:0;fill.scale.y=.2+.8*Math.min(1,v.coal+partial);}
      }b.scene.updateMatrixWorld(true);return b;
  }
  function visibleObject(o) {for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
  function projectTarget(b,object,width,height) {
    const bounds=new T.Box3().setFromObject(object),points=[];if(bounds.isEmpty())return null;
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(new T.Vector3(x,y,z).project(b.camera));
    return {x:(Math.min(...points.map(p=>p.x))+1)*width/2,y:(1-Math.max(...points.map(p=>p.y)))*height/2,width:(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)))*width/2,height:(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y)))*height/2};
  }
  function pickScene(b,race,x,y,width,height) {
    if(!b||!race?.player?.service||race.phase!=='racing')return null;
    const active=race.player.service;if(active.phase!=='ready')return null;const candidates=[];
    if(active.type==='wash'){b.player.userData.mudPatches.forEach((object,id)=>{if(visibleObject(object)&&race.player.mudPatches?.[id])candidates.push({object,kind:'mud',id});});}
    else {const slot=b.objects.services.find(e=>e.spec.id===active.id)?.slots.find(s=>s.who==='player');let targets=slot?.targets||[];
      if(active.type==='passenger-unload')targets=b.playerCoach.userData.occupants.map((object,i)=>({object,id:'passenger-'+i}));
      if(active.type==='cargo-unload')targets=[{object:b.playerCoach.userData.container,id:'container-1'},...(slot.crane?[{object:slot.crane.group,id:'container-1'}]:[])];if(active.type==='cargo-load'&&active.selectedContainer&&slot.crane)targets=targets.concat({object:slot.crane.group,id:'container-1'});
      for(const target of targets){if((active.type.startsWith('passenger')||['repairs','rocks','coal'].includes(active.type))&&active.groups?.[Number(target.id.split('-')[1])])continue;if(visibleObject(target.object))candidates.push({...target,kind:'service'});}}
    let nearest=null,best=Infinity;for(const target of candidates){const rect=projectTarget(b,target.object,width,height);if(!rect)continue;const cx=rect.x+rect.width/2,cy=rect.y+rect.height/2,rx=Math.max(22,rect.width/2+10),ry=Math.max(22,rect.height/2+10),score=((x-cx)/rx)**2+((y-cy)/ry)**2;if(score<=1&&score<best){best=score;nearest={kind:target.kind,id:target.id};}}
    return nearest;
  }
  function disposeScene(b) {
    // Shared primitive geometry/materials are reused across races; world-specific geometry is released.
    const shared=new Set(geoCache.values());b.scene.traverse(o=>{if(o.geometry&&!shared.has(o.geometry))o.geometry.dispose();if(o.isInstancedMesh)o.dispose();if(o.material&&(o.material.isMeshBasicMaterial||o.material.isLineBasicMaterial||o.material.isMeshPhongMaterial))o.material.dispose();});
    if(b.sun.shadow.map)b.sun.shadow.map.dispose();
  }
  function create({canvas,onUnavailable}={}) {
    const core=root.ThomasRaceCore;if(!core)throw new Error('The race model is missing');
    let renderer,built=null,key='',disposed=false,lastRace=null;
    try {
      renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
      renderer.setPixelRatio(Math.min(root.devicePixelRatio||1,1.75));renderer.outputColorSpace=T.SRGBColorSpace;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
      renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
    } catch(error) {if(onUnavailable)onUnavailable(error);return {available:false,render(){},resize(){},pick(){return null;},dispose(){disposed=true;}};}
    function resize() {
      if(disposed)return;const rect=canvas.getBoundingClientRect?canvas.getBoundingClientRect():{width:canvas.clientWidth,height:canvas.clientHeight};
      const width=Math.max(1,rect.width||canvas.clientWidth||1200),height=Math.max(1,rect.height||canvas.clientHeight||620);
      renderer.setSize(width,height,false);if(built){built.camera.aspect=width/height;built.camera.updateProjectionMatrix();}
    }
    function render(race,options={}) {
      if(disposed||!race)return;lastRace=race;
      const nextKey=race.courseId+':'+race.playerId+':'+race.opponentId+':'+race.deliveryTheme+':'+race.seed;
      if(key!==nextKey){if(built)disposeScene(built);built=makeScene(core,race.courseId,race.opponentId,race.deliveryTheme,race);key=nextKey;resize();}
      updateScene(built,race,options);renderer.render(built.scene,built.camera);
    }
    function dispose(){if(disposed)return;disposed=true;if(built)disposeScene(built);renderer.dispose();built=null;}
    function pick(clientX,clientY){if(disposed||!built||!lastRace)return null;const rect=canvas.getBoundingClientRect();return pickScene(built,lastRace,clientX-rect.left,clientY-rect.top,rect.width,rect.height);}
    resize();return {available:true,render,resize,pick,dispose};
  }
  root.ThomasRaceView={create,makeScene,updateScene,makeEngine,makeBertie,makeHarold,makeVehicle,makeCoach,makeDeliveryCoach,disposeScene,pickScene,projectTarget,palette:C,revision:'sodor-railway-challenges-2'};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.ThomasRaceView;
})(typeof globalThis!=='undefined'?globalThis:this);

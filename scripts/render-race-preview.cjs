/* Isolated CPU rasterization of the actual Three.js meshes. This does not run HTML,
   WebGL, a browser, or a substitute browser environment. It cannot verify WebGL. */
const fs=require('node:fs');
const T=require('../vendor/three-r170.js');global.THREE=T;
require('./race-model.js');const V=require('./race-renderer.js');
const sharp=require('/Users/Abraham/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const core=global.ThomasRaceCore;
const args=process.argv.slice(2),course=args[0]||'country',opponent=args[1]||'bertie',distance=Number(args[2]||0),output=args[3]||'/private/tmp/thomas-race-preview.png';
const w=Number(args[4]||1400),h=Number(args[5]||800);
let race=core.createRace({courseId:course,playerId:args[11]||'thomas',opponentId:opponent,seed:Number(args[9]||24),deliveryTheme:args[8]||'passengers'});race.phase='racing';race.elapsed=12;race.countdown=0;
const effect=args[7]||'',serviceProgress=Math.max(0,Math.min(1,Number(args[10]??.5)));
for(const [i,state]of [race.player,race.rival].entries()){state.distance=distance-(i?850:0);state.velocity=core.CRUISE_SPEED;state.wheelTurns=state.distance*core.WORLD_SCALE/(2*Math.PI*core.WHEEL_RADIUS);}
for(const state of [race.player,race.rival])if(distance>race.services[0].at&&distance<race.services.at(-1).at){if(race.deliveryTheme==='cargo'){state.carried.container='container-1';state.carried.cargo=true;}else{state.carried.passengers=3;state.serviceStates[0].groups.fill(true);}}
if(effect.startsWith('service'))for(const who of ['player','rival']){const state=race[who],job=state.serviceStates.reduce((a,s)=>Math.abs(s.at-distance)<Math.abs(a.at-distance)?s:a);state.distance=job.at;state.velocity=0;state.service=job;job.phase=effect==='service-complete'?'complete':effect==='service-working'?'working':'ready';job.duration=job.type==='repairs'?1.5:job.type==='rocks'?2:job.type==='coal'?1:job.type==='wash'?.6:job.type.startsWith('passenger')?1:job.type==='water'?4:job.type==='drawbridge'?6:job.type==='tree'?core.getBranchLiftSeconds(race):5;job.remaining=job.duration*(1-serviceProgress);job.progress=serviceProgress;job.startedAt=race.elapsed-job.duration*.5;job.activeUnit=0;job.targetId='passenger-0';if(job.type==='wash'){state.mudPatches.fill(true);state.dirt=1;}if(job.type==='passenger-unload'){state.carried.passengers=3;state.serviceStates[0].groups.fill(true);}if(job.type==='cargo-unload'){state.carried.container=effect==='service-complete'?null:'container-1';state.carried.cargo=!!state.carried.container;}if(job.type==='cargo-load'){job.selectedContainer='container-1';state.carried.container=effect==='service-complete'?'container-1':null;state.carried.cargo=!!state.carried.container;}if(effect==='service-complete'){job.completed=true;state.service=null;job.groups.fill(true);if(job.type==='coal')state.coal=1;}}
if(['service-cargo-lowering','service-cargo-lifting'].includes(effect))for(const state of [race.player,race.rival]){const job=state.service;job.phase=effect.slice(8);job.handlingProgress=serviceProgress;job.cargoHandling=true;job.workComplete=job.phase==='cargo-lifting';job.activeUnit=null;if(job.workComplete){job.groups.fill(true);state.mudPatches.fill(false);state.dirt=0;}}
let festival=null;
if(effect.startsWith('festival')){
 race.phase='complete';race.winner=effect.includes('lose')?'rival':effect.includes('tie')?'tie':'player';
 race.finishMotion={rivalVelocity:core.CRUISE_SPEED,rivalTarget:core.CRUISE_SPEED};
 for(const who of ['player','rival']){const v=race[who];v.service=null;v.serviceStates.forEach(s=>{s.completed=true;s.phase='complete';});v.carried={passengers:0,container:null,cargo:false};v.distance=core.COURSES[course].length;
  v.finishTime=who==='player'?12:race.winner==='rival'?11.3:race.winner==='tie'?12:null;
  if(v.finishTime!==null)v.finishEvent={time:v.finishTime,speed:core.CRUISE_SPEED,wheelTurns:v.wheelTurns};else v.distance-=850;
 }
 festival=core.createFinishPresentation(race);core.stepFinishPresentation(festival,Number(args[10]||0));race=festival.race;
}
const b=V.makeScene(core,course,opponent,race.deliveryTheme,race);b.camera.aspect=w/h;b.camera.updateProjectionMatrix();V.updateScene(b,race,{festival});
const rgb=new Uint8Array(w*h*3),depth=new Float32Array(w*h).fill(Infinity),bg=[182,222,242];
for(let i=0;i<w*h;i++){const y=Math.floor(i/w),light=1-.045*y/h;rgb[i*3]=bg[0]*light;rgb[i*3+1]=bg[1]*light;rgb[i*3+2]=bg[2]*light;}
const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(b.camera.projectionMatrix,b.camera.matrixWorldInverse));
const camera=b.camera,proj=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),world=new T.Matrix4(),normalMatrix=new T.Matrix3();
const light=new T.Vector3(.45,.82,.35).normalize();let triangles=0,meshes=0;
const v=new T.Vector3(),n=new T.Vector3(),a=new T.Vector3(),bb=new T.Vector3(),c=new T.Vector3();
function drawMesh(o,matrix){
 const geo=o.geometry,pos=geo.attributes.position,norm=geo.attributes.normal,idx=geo.index,material=Array.isArray(o.material)?o.material[0]:o.material;
 if(!material||material.opacity<.08)return;
 const sphere=geo.boundingSphere|| (geo.computeBoundingSphere(),geo.boundingSphere),center=sphere.center.clone().applyMatrix4(matrix).project(camera),radius=sphere.radius*matrix.getMaxScaleOnAxis();
 const worldSphere=sphere.clone().applyMatrix4(matrix);if(!frustum.intersectsSphere(worldSphere))return;
 if(center.z>1.1||center.z<-.1&&radius<3)return;
 const projected=new Float32Array(pos.count*4),clips=new Float64Array(pos.count*4),normals=new Float32Array(pos.count*3),v4=new T.Vector4();
 normalMatrix.getNormalMatrix(matrix);
 const vm=new T.Matrix4().multiplyMatrices(proj,matrix);
 for(let i=0;i<pos.count;i++){
   v4.set(pos.getX(i),pos.getY(i),pos.getZ(i),1).applyMatrix4(vm);clips.set([v4.x,v4.y,v4.z,v4.w],i*4);v.fromBufferAttribute(pos,i).applyMatrix4(vm);projected[i*4]=(v.x+1)*w/2;projected[i*4+1]=(1-v.y)*h/2;projected[i*4+2]=v.z;projected[i*4+3]=v.z<=1&&v.z>=-1?1:0;
   if(norm){n.fromBufferAttribute(norm,i).applyMatrix3(normalMatrix).normalize();normals[i*3]=n.x;normals[i*3+1]=n.y;normals[i*3+2]=n.z;}
 }
 const hex=material.color?material.color.getHex(T.SRGBColorSpace):0xffffff,color=[hex>>16&255,hex>>8&255,hex&255];
 const count=idx?idx.count:pos.count;
 for(let t=0;t<count;t+=3){
   const i0=idx?idx.getX(t):t,i1=idx?idx.getX(t+1):t+1,i2=idx?idx.getX(t+2):t+2;
   const k0=i0*4,k1=i1*4,k2=i2*4;
   let polygon=[k0,k1,k2].map(k=>({x:clips[k],y:clips[k+1],z:clips[k+2],w:clips[k+3]}));
   for(const plane of [p=>p.w+p.z,p=>p.w-p.z,p=>p.w+p.x,p=>p.w-p.x,p=>p.w+p.y,p=>p.w-p.y]){
     const clipped=[];for(let j=0;j<polygon.length;j++){
       const aa=polygon[j],bb=polygon[(j+1)%polygon.length],fa=plane(aa),fb=plane(bb);
       if(fa>=0)clipped.push(aa);if((fa>=0)!==(fb>=0)){
         const t=fa/(fa-fb);clipped.push({x:aa.x+(bb.x-aa.x)*t,y:aa.y+(bb.y-aa.y)*t,z:aa.z+(bb.z-aa.z)*t,w:aa.w+(bb.w-aa.w)*t});
       }
     }polygon=clipped;if(!polygon.length)break;
   }
   if(polygon.length<3)continue;
   let nl=.7;if(norm){n.set((normals[i0*3]+normals[i1*3]+normals[i2*3])/3,(normals[i0*3+1]+normals[i1*3+1]+normals[i2*3+1])/3,(normals[i0*3+2]+normals[i1*3+2]+normals[i2*3+2])/3);nl=n.normalize().dot(light);}
   const shade=material.isMeshBasicMaterial?1:nl>.5?1:nl>-.1?.87:.67;
   for(let fan=1;fan<polygon.length-1;fan++){
   const pp=[polygon[0],polygon[fan],polygon[fan+1]].map(p=>({x:(p.x/p.w+1)*w/2,y:(1-p.y/p.w)*h/2,z:p.z/p.w}));
   const x0=pp[0].x,y0=pp[0].y,z0=pp[0].z,x1=pp[1].x,y1=pp[1].y,z1=pp[1].z,x2=pp[2].x,y2=pp[2].y,z2=pp[2].z;
   const area=(x1-x0)*(y2-y0)-(y1-y0)*(x2-x0);
   if(Math.abs(area)<.035)continue;if(material.side!==T.DoubleSide&&area>0)continue;
   const minX=Math.max(0,Math.floor(Math.min(x0,x1,x2))),maxX=Math.min(w-1,Math.ceil(Math.max(x0,x1,x2))),minY=Math.max(0,Math.floor(Math.min(y0,y1,y2))),maxY=Math.min(h-1,Math.ceil(Math.max(y0,y1,y2)));
   if(minX>maxX||minY>maxY)continue;
   for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
     const px=x+.5,py=y+.5,a0=((x1-px)*(y2-py)-(y1-py)*(x2-px))/area,a1=((x2-px)*(y0-py)-(y2-py)*(x0-px))/area,a2=1-a0-a1;
     if(a0<-.0001||a1<-.0001||a2<-.0001)continue;
     const z=z0*a0+z1*a1+z2*a2,index=y*w+x;if(z>=depth[index])continue;
     const fade=Math.max(0,Math.min(1,(z-.996)/.004))*.7,opacity=material.transparent?material.opacity:1;
     for(let ch=0;ch<3;ch++)rgb[index*3+ch]=(color[ch]*shade*(1-fade)+bg[ch]*fade)*opacity+rgb[index*3+ch]*(1-opacity);
     if(material.depthWrite!==false)depth[index]=z;
   }
   triangles++;
   }
 }
 meshes++;
}
b.scene.traverse(o=>{if(!o.visible||!o.geometry||!o.isMesh)return;let p=o;while(p){if(!p.visible)return;p=p.parent;}if(o.isInstancedMesh){const im=new T.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,im);world.multiplyMatrices(o.matrixWorld,im);drawMesh(o,world);}}else drawMesh(o,o.matrixWorld);});
sharp(Buffer.from(rgb),{raw:{width:w,height:h,channels:3}}).png().toFile(output).then(()=>{console.log(JSON.stringify({output,meshes,triangles,width:w,height:h,course,opponent,distance}));V.disposeScene(b);});

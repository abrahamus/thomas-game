const {test}=require('node:test');
const assert=require('node:assert/strict');
const T=require('../vendor/three-r170.js');
global.THREE=T;
require('../scripts/race-model.js');
const core=global.ThomasRaceCore;
const view=require('../scripts/race-renderer.js');

function warningInView(scene,sign,width,height){
  const lettering=sign.getObjectByName('reduce-speed-lettering');
  const rect=view.projectTarget(scene,lettering,width,height);
  if(rect.x<0||rect.y<0||rect.x+rect.width>width||rect.y+rect.height>height||rect.width<25)return false;
  const direction=lettering.getWorldPosition(new T.Vector3()).sub(scene.camera.position);
  const ray=new T.Raycaster(scene.camera.position,direction.clone().normalize(),0,direction.length()-.065);
  return !ray.intersectObjects(scene.scene.children,true).some(hit=>{
    for(let item=hit.object;item;item=item.parent)if(item===sign||!item.visible)return false;
    return !hit.object.material?.transparent;
  });
}

test('each ground route has one far-side warning at every speed restriction',()=>{
  for(const courseId of Object.keys(core.COURSES))for(const [seed,playerId,opponentId] of [
    [0,'bertie','thomas'],[24,'thomas','bulgy'],[24,'harold','bertie'],[24,'thomas','harold']
  ]){
    const race=core.createRace({courseId,playerId,opponentId,seed});
    const scene=view.makeScene(core,courseId,opponentId,race.deliveryTheme,race);
    const signs=[];
    scene.world.traverse(o=>{if(o.name==='slowdown-sign')signs.push(o);});
    for(const who of ['player','rival']){
      const character=core.getCharacter(race,who);
      const sections=character.vehicleType==='air'?[]:core.getTravelSections(race,who).filter(s=>s.cap<1);
      const own=signs.filter(s=>s.userData.corridor===who);
      assert.deepEqual(own.map(s=>s.userData.sectionId).sort(),sections.map(s=>s.id).sort());
      for(const section of sections){
        const sign=own.find(s=>s.userData.sectionId===section.id);
        const route=core.sampleVehicleRoute(race,who,section.start);
        const dx=sign.position.x-route.x,dz=sign.position.z-route.z;
        assert.ok(dx*Math.cos(route.heading)-dz*Math.sin(route.heading)<-4.8);
        const setback=section.type==='tunnel'?(playerId==='harold'?36:13):0;
        assert.ok(Math.abs(dx*Math.sin(route.heading)+dz*Math.cos(route.heading)+setback)<1e-6);
        assert.equal(sign.getObjectByName('warning-triangle-red')?.material.color.getHex(),0xcb1725);
        assert.equal(sign.getObjectByName('slowdown-plate')?.material.color.getHex(),0xb91624);
        assert.ok(sign.getObjectByName('slowdown-hazard-symbol'));
        const lettering=sign.getObjectByName('reduce-speed-lettering');
        assert.equal(lettering?.userData.text,'REDUCE SPEED');
        for(const [width,height] of [[320,420],[375,420],[1400,800]]){
          scene.camera.aspect=width/height;
          const onScreen=[5200,4800,4300,3800,3300,2900,2400,1800,1400,1000,600,300,0,-300,-600].some(gap=>{
            race.player.distance=race.rival.distance=section.start-gap;
            view.updateScene(scene,race);
            return warningInView(scene,sign,width,height);
          });
          assert.ok(onScreen,`${courseId}/${playerId}/${opponentId}/${who}/${section.type}/${width}`);
        }
      }
    }
    view.disposeScene(scene);
  }
});

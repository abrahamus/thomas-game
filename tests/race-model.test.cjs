'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../scripts/race-model.js'),'utf8'),context);const R=context.ThomasRaceCore,{drive,accelerateTo}=require('./helpers/race-driver.cjs');
const json=x=>JSON.parse(JSON.stringify(x));
function rolling(options={},percent=100){const r=R.createRace(options);R.step(r,R.START_COUNTDOWN);accelerateTo(R,r,percent);return r;}
test('the race starts at rest and six separate Up presses reach top speed',()=>{
    const r=rolling({},0),v=r.player;
    R.step(r,3);
    assert.equal(v.distance,0);
    assert.equal(v.velocity,0);
    assert.equal(r.rival.targetVelocity,1500);
    for(const percent of [25,50,75,100,125,150]){
        assert.equal(R.adjustSpeed(r,1),true);
        assert.equal(v.speedPercent,percent);
    }
    assert.equal(R.adjustSpeed(r,1),false);
    assert.equal(R.adjustSpeed(r,-1),false);
    R.step(r,1);
    assert.ok(v.velocity>0&&v.velocity<1500);
    R.step(r,7.25);
    assert.ok(Math.abs(v.velocity-1500)<1e-7);
});
test('automatic braking reaches the station and clears every speed grade',()=>{
    const r=rolling({deliveryTheme:'passengers'},150),v=r.player;
    const first=v.serviceStates[0];
    v.distance=first.at-3600;
    v.velocity=1500;
    for(let i=0;i<200&&!v.service;i++)R.step(r,.05);
    assert.equal(v.service,first);
    assert.equal(v.distance,first.at);
    assert.equal(v.velocity,0);
    assert.equal(v.speedPercent,0);
    assert.equal(R.adjustSpeed(r,1),false);
});
test('terrain holds the safe speed through rear clearance and requires Up to accelerate afterward',()=>{
    const r=rolling({},150),v=r.player;
    for(const service of v.serviceStates)service.completed=true;
    const section=R.getTravelSections(r).find(s=>s.type==='wet');
    v.distance=section.start-4000;
    v.velocity=1500;
    while(v.distance<section.start)R.step(r,.05);
    assert.equal(R.adjustSpeed(r,1),false);
    R.step(r,2.5);
    const state=v.terrainStates.find(s=>s.id===section.id);
    while(!state.completed){
        assert.ok(v.velocity<=(1.5*R.CRUISE_SPEED)*section.cap+1e-5);
        R.step(r,.05);
    }
    R.step(r,2);
    assert.equal(v.speedPercent,60);
    assert.equal(v.velocity,600);
    assert.equal(R.adjustSpeed(r,1),true);
    assert.equal(v.speedPercent,75);
    R.step(r,1);
    assert.equal(v.velocity,750);
});
function arrive(r,type){r.player.service=null;const s=r.player.serviceStates.find(s=>s.type===type);assert.ok(s,`Missing ${type}`);for(const q of r.player.serviceStates)if(q.at<s.at)q.processed=q.completed=true;r.player.distance=s.at-.01;r.player.velocity=1;R.step(r,.02);assert.equal(r.player.service,s);assert.equal(r.player.velocity,0);assert.equal(r.phase,'racing');return s;}
function completePassengers(r,type){const s=arrive(r,type);for(let i=0;i<3;i++){assert.equal(R.serviceAction(r,`passenger-${i}`),true);R.step(r,1.01);}return s;}

test('three courses have eight mandatory jobs and two distinct tunnel sections',()=>{
 for(const c of Object.values(R.COURSES)){
  const r=R.createRace({courseId:c.id});assert.equal(c.length,242000);assert.equal(r.services.length,8);
  assert.equal(new Set(c.sections.map(s=>s.id)).size,c.sections.length);
  assert.equal(c.sections.filter(s=>s.type==='tunnel').length,2);assert.ok(c.sections.every(s=>s.type!=='bridge'));
  for(const job of r.services)assert.ok(Math.abs(R.sampleRoute(c.id,job.at).grade)<1e-8,'Jobs stop on level track');
 }
});
test('New rounds alternate delivery themes; exact rematches retain delivery theme and rival work',()=>{
    const lastRace={opponentId:'percy',courseId:'country',deliveryTheme:'passengers'},a=R.chooseRace({lastRace,random:()=>.25});assert.equal(a.deliveryTheme,'cargo');assert.notEqual(a.opponentId,lastRace.opponentId);assert.notEqual(a.courseId,lastRace.courseId);assert.equal(R.chooseRace({lastRace:{...lastRace,deliveryTheme:'cargo'},opponentId:'james',random:()=>.25}).deliveryTheme,'passengers');assert.ok(a.opponentId!=='thomas'&&a.opponentId!=='percy');assert.throws(()=>R.chooseRace({opponentId:'gordon'}),/Unknown/);
    const r=R.createRace(a),q=R.createRace(a);assert.deepEqual(json(r),json(q));R.step(r,50);assert.deepEqual(json(r.profile),json(q.profile));assert.deepEqual(json(r.services),json(q.services));
});


test('Climb rises8worldunits,plateaustayshighanddescentreturnsgroundwithmaximum6degreegrade',()=>{
    for(const c of Object.values(R.COURSES)){assert.equal(R.sampleRoute(c.id,R.courseDistance(72600)).y,0);assert.equal(R.sampleRoute(c.id,R.courseDistance(90600)).y,8);assert.equal(R.sampleRoute(c.id,R.courseDistance(98600)).y,8);assert.equal(R.sampleRoute(c.id,R.courseDistance(116600)).y,0);let previous=0;for(let d=R.courseDistance(72600);d<=R.courseDistance(90600);d+=100){const p=R.sampleRoute(c.id,d);assert.ok(p.y>=previous);previous=p.y;assert.ok(Math.abs(p.grade)<=Math.PI/30);}previous=8;for(let d=R.courseDistance(98600);d<=R.courseDistance(116600);d+=100){const p=R.sampleRoute(c.id,d);assert.ok(p.y<=previous);previous=p.y;assert.ok(Math.abs(p.grade)<=Math.PI/30);}assert.ok(R.sampleTerrainHeight(c.id,R.courseDistance(95000),60)<R.sampleTerrainHeight(c.id,R.courseDistance(95000),0)-7);assert.equal(R.sampleTerrainHeight(c.id,R.courseDistance(95000),0),7.68);for(const s of c.sections.filter(s=>['tunnel','bridge'].includes(s.type)))for(let d=s.start;d<s.end;d+=100)assert.equal(R.sampleRoute(c.id,d).grade,0);}
});
test('each restricted section brakes gradually from actual entry speed and allows Up to reach its rounded limit',()=>{
    for(const [type,cap,reduction=cap] of [['hill',.65],['downhill',.6],['tunnel',.5],['wet',.4],['snow',.55],['bend',.9,.1],['tight-bend',.9,.1]]){
        const courseId=type==='snow'?'mountain':'country';
        const r=rolling({courseId,opponentId:'harold'});
        R.step(r,.2);
        const sections=R.COURSES[courseId].sections.filter(s=>s.type===type);
        for(const section of sections){
            for(const v of [r.player,r.rival]){
                for(const job of v.serviceStates)job.completed=true;
                v.distance=section.start-1;
                v.velocity=R.CRUISE_SPEED;
            }
            r.player.speedPercent=150;
            R.step(r,1/120);
            const limit=Math.round(150*cap)*10;
            assert.equal(R.getView(r).safeMaxMph,limit/10);
            const entrySpeed=Math.min(limit,Math.sqrt(R.CRUISE_SPEED**2+2*R.ACCELERATION)*(1-reduction));
            for(const v of [r.player,r.rival]){
                assert.ok(v.velocity>R.CRUISE_SPEED-R.BRAKING/120,type);
                assert.ok(Math.abs(v.targetVelocity-entrySpeed)<1e-6,type);
            }
            assert.equal(R.adjustSpeed(r,1),false,type);
            const beforeBraking=r.player.velocity;
            R.step(r,.1,true);
            assert.ok(Math.abs(r.player.velocity-(beforeBraking-R.BRAKING*.1))<1e-6,type);
            R.step(r,(R.CRUISE_SPEED-entrySpeed)/R.BRAKING+.02);
            assert.ok(Math.abs(r.player.velocity-entrySpeed)<1e-6,type);
            accelerateTo(R,r,150);
            assert.ok(Math.abs(r.player.speedPercent-limit/10)<1e-6,type);
            R.step(r,(limit-entrySpeed)/R.ACCELERATION+.02);
            for(const v of [r.player,r.rival])assert.ok(Math.abs(v.velocity-limit)<1e-6,type);
        }
    }
});
test('Fully automatic braking stops exactlyatjob; earlyactionsdonotqueue; clockandrivalcontinue',()=>{
    const r=rolling({deliveryTheme:'passengers'});assert.equal(R.serviceAction(r),false);assert.equal(R.cleanMud(r,0),false);assert.equal(R.whistle(r),false);R.step(r,45);assert.equal(r.player.distance,R.JOB_DISTANCES[0]);assert.equal(r.player.velocity,0);assert.equal(r.player.service.type,'passenger-load');assert.equal(r.phase,'racing');const t=r.elapsed,p=r.rival.distance;R.step(r,15);assert.ok(r.elapsed>t);assert.ok(r.rival.distance>p);assert.equal(r.player.service.unitsDone,0);assert.equal(r.player.service.phase,'ready');assert.equal(R.getView(r).helpEnabled,true);
});
test('Passenger groups boardoneatatime,remaincarried,anddisembarkonlyatthedestination',()=>{
    const r=rolling({deliveryTheme:'passengers'}),load=arrive(r,'passenger-load');assert.equal(R.serviceAction(r,'passenger-8'),false);assert.equal(R.serviceAction(r,'passenger-0'),true);assert.equal(load.activeUnit,0);assert.equal(load.targetId,'passenger-0');assert.equal(R.serviceAction(r,'passenger-1'),false);R.step(r,1.01);assert.equal(r.player.carried.passengers,1);assert.equal(load.unitsDone,1);assert.equal(R.serviceAction(r,'passenger-0'),false);for(const n of[1,2]){R.serviceAction(r,`passenger-${n}`);R.step(r,1.01);}assert.equal(r.player.service,null);assert.equal(r.player.carried.passengers,3);assert.ok(load.completed);const unload=completePassengers(r,'passenger-unload');assert.equal(unload.unitsDone,3);assert.equal(r.player.carried.passengers,0);
});
test('Containerrequiresselectionthencrane;loadedcontainerstaysuntilunloading',()=>{
    const r=rolling({deliveryTheme:'cargo'}),s=arrive(r,'cargo-load');assert.equal(R.getView(r).taskKey,'race.service.cargo-select');assert.equal(R.serviceAction(r,'container-2'),false);assert.equal(R.serviceAction(r,'container-1'),true);assert.equal(s.selectedContainer,'container-1');assert.equal(s.phase,'ready');assert.equal(r.player.carried.container,null);assert.equal(R.getView(r).taskKey,'race.service.cargo-load');assert.equal(R.serviceAction(r),true);assert.equal(s.duration,5);assert.equal(R.serviceAction(r),false);R.step(r,4.9);assert.equal(r.player.carried.container,null);R.step(r,.11);assert.equal(r.player.carried.container,'container-1');assert.equal(r.player.carried.cargo,true);const q=arrive(r,'cargo-unload');R.serviceAction(r);R.step(r,5.01);assert.ok(q.completed);assert.equal(r.player.carried.container,null);assert.equal(r.player.carried.cargo,false);
});
test('Animalwhistlecounts onlyafterautomaticstop,andtwo-secondcrossingholdsThomas',()=>{
    const r=rolling(),s=arrive(r,'animals');assert.equal(R.getView(r).helpEnabled,false);assert.equal(R.serviceAction(r),false);assert.equal(R.whistle(r),true);assert.equal(s.phase,'working');assert.equal(R.getView(r).taskKey,'race.service.animals-wait');assert.equal(R.whistle(r),false);R.step(r,1.9);assert.equal(r.player.distance,s.at);assert.equal(r.player.velocity,0);assert.equal(s.completed,false);R.step(r,.11);assert.equal(s.completed,true);assert.equal(r.player.service,null);
});
test('Mudappearsbeforewash;pointerand600msassistsremoveactualpatcheswithoutoverlap',()=>{
    const r=rolling(),spec=r.services.find(s=>s.type==='wash');for(const q of r.player.serviceStates)if(q.at<spec.at)q.completed=true;r.player.distance=spec.mudAt-1;r.player.velocity=R.CRUISE_SPEED;R.step(r,.01);assert.equal(r.player.dirt,1);assert.equal(r.player.mudPatches.filter(Boolean).length,7);assert.equal(R.cleanMud(r,0),false);const s=arrive(r,'wash');assert.equal(R.cleanMud(r,0),true);assert.equal(R.cleanMud(r,0),false);assert.equal(r.player.dirt,6/7);assert.equal(R.serviceAction(r),true);assert.equal(s.duration,.6);assert.equal(R.serviceAction(r),false);assert.equal(R.cleanMud(r,2),false);R.step(r,.59);assert.equal(r.player.mudPatches[1],true);R.step(r,.02);assert.equal(r.player.mudPatches[1],false);for(let n=2;n<7;n++)assert.equal(R.cleanMud(r,n),true);assert.equal(r.player.service,null);assert.equal(r.player.dirt,0);assert.equal(s.unitsDone,7);
});
test('water, branch and harbour jobs wait for an action, then keep their work durations',()=>{
    for(const type of ['water','tree','drawbridge']){
        let options;for(let seed=1;seed<100;seed++){const r=R.createRace({seed});if(r.services.some(s=>s.type===type)){options={seed};break;}}
        const r=rolling(options);assert.equal(R.serviceAction(r),false,'An early action does not queue');
        const s=arrive(r,type),duration=type==='water'?4:type==='tree'?5:6;
        assert.equal(s.phase,'ready');assert.equal(R.getView(r).helpEnabled,true);
        R.step(r,8);assert.equal(s.phase,'ready');assert.equal(s.progress,0);
        if(type==='drawbridge')assert.equal(R.serviceAction(r,'wrong-control'),false);
        assert.equal(R.serviceAction(r),true);assert.equal(R.serviceAction(r),false);assert.equal(s.duration,duration);
        R.step(r,duration-.05);assert.equal(s.completed,false);R.step(r,.06);assert.equal(s.completed,true);
        R.serviceAction(r);assert.equal(r.events.filter(e=>e.type==='service-done'&&e.serviceId===s.id).length,1);
    }
});
test('the rival initiates its harbour job after its own seeded reaction while the player can wait',()=>{
    let r;for(let seed=1;seed<100;seed++){r=rolling({seed});if(r.services.some(s=>s.type==='drawbridge'))break;}
    r.elapsed=10; // This station fixture is beyond the rival's initial start delay.
    const s=arrive(r,'drawbridge'),v=r.rival,q=v.serviceStates.find(q=>q.id===s.id);
    v.service=null;v._npcNextAction=null;v.serviceStates.forEach(t=>t.completed=t.index<q.index);v.distance=q.at;v.velocity=0;
    R.step(r,.01);assert.equal(q.phase,'ready');R.step(r,.2);assert.equal(q.phase,'ready');
    R.step(r,2);assert.equal(q.phase,'working');assert.equal(s.phase,'ready');
    R.step(r,6);assert.equal(q.completed,true);assert.equal(s.phase,'ready');
});
test('Currenttask andinactivityhelpfollowstationaryjobwithoutrepeatedaudioqueues',()=>{
    const r=rolling({deliveryTheme:'cargo'}),s=arrive(r,'cargo-load');assert.equal(R.getView(r).nextTask.kind,'service');assert.equal(R.getView(r).nextTask.id,s.id);const before=r.events.filter(e=>e.type==='service-hint').length;R.step(r,7);assert.equal(r.events.filter(e=>e.type==='service-hint').length,before+1);assert.equal(R.getView(r).inactivityHintKey,'race.service.cargo-select');R.step(r,20);assert.equal(r.events.filter(e=>e.type==='service-hint').length,before+1);R.serviceAction(r);assert.equal(R.getView(r).inactivityHintKey,null);assert.equal(R.getView(r).taskKey,'race.service.cargo-load');R.step(r,7);assert.equal(r.events.filter(e=>e.type==='service-hint').length,before+2);
});






test('Coachesfollowindependentgeometryandthelargerterrainprofile',()=>{
    for(const opponentId of ['percy','james','bertie'])for(const courseId of Object.keys(R.COURSES)){const r=rolling({opponentId,courseId});r.player.distance=r.rival.distance=R.courseDistance(85000);assert.equal(R.getCoachOffset(r,'player'),900);assert.equal(R.getCoachOffset(r,'rival'),opponentId==='james'?1350:900);assert.deepEqual(json(R.sampleCoachRoute(r,'player')),json(R.sampleRoute(courseId,R.courseDistance(85000)-R.getCoachOffset(r,'player'),0)));assert.deepEqual(json(R.sampleCoachRoute(r,'rival')),json(R.sampleRoute(courseId,R.courseDistance(85000)-R.getCoachOffset(r,'rival'),-15)));assert.notEqual(R.sampleCoachRoute(r,'player').y,R.sampleVehicleRoute(r,'player').y);}
});
test('seeded rival jobs and rewards remain independent of player input',()=>{
 const a=R.createRace({seed:542}),b=R.createRace({seed:542});
 for(let i=0;i<3500;i++){
  const s=a.player.service;if(s?.phase==='ready'){if(s.type==='animals')R.whistle(a);else R.serviceAction(a);}
  R.step(a,.1);R.step(b,.1);if(a.phase==='complete')break;
  assert.deepEqual(json(a.rival),json(b.rival));assert.deepEqual(json(a.profile),json(b.profile));
 }
});
test('ordinary play completes all jobs and finishes on the longer straight',()=>{
    for(const deliveryTheme of ['passengers','cargo'])for(const reaction of [.75,1.1,1.5]){
        const r=drive(R,{deliveryTheme,reaction,washSeconds:reaction===1.5?20:14,seed:199});
        assert.equal(r.player.serviceStates.filter(s=>s.completed).length,8);
        assert.ok(['player','rival','tie'].includes(r.winner));
        assert.equal(r.player.carried.passengers,0);
        assert.equal(r.player.carried.container,null);
        assert.equal(r.player.dirt,0);
        assert.equal(r.player.distance,242000);
        const seconds=r.elapsed+R.START_COUNTDOWN;
        assert.ok(seconds>=340&&seconds<=420);
        assert.equal(r.events.filter(e=>e.type==='complete').length,1);
    }
});
test('Noinputwaitswithoutpenaltyatliveloadjobwhilerivalcontinuesitsownwork',()=>{
    const r=drive(R,{noInput:true});assert.equal(r.phase,'racing');assert.equal(r.player.distance,R.JOB_DISTANCES[0]);assert.equal(r.player.service.phase,'ready');assert.ok(r.rival.distance>r.player.distance);assert.equal(r.player.finishTime,null);
});
test('Largeupdates,60Hzand120Hzpreserveautomaticmotionandjobtimers',()=>{
    const a=R.createRace({seed:532}),b=R.createRace({seed:532}),c=R.createRace({seed:532});for(let n=0;n<60*100;n++)R.step(a,1/60);for(let n=0;n<120*100;n++)R.step(b,1/120);R.step(c,100);assert.deepEqual(json(a),json(b));assert.ok(Math.abs(a.player.distance-c.player.distance)<1e-7);assert.deepEqual(json(a.rival),json(c.rival));const p=arrive(a,'wash');a.player.mudPatches.fill(true);R.serviceAction(a);const frozen=json(a);for(const dt of[NaN,-1,0,Infinity])assert.equal(R.step(a,dt),false);assert.deepEqual(json(a),frozen);assert.equal(p.remaining,.6);R.step(a,.6);assert.equal(p.unitsDone,1);
});

test('Approaching delivery stops repeat the journey goal; arrival uses the job instruction',()=>{
    for(const deliveryTheme of ['passengers','cargo']){const r=rolling({deliveryTheme});r.player.distance=R.JOB_DISTANCES[0]-1000;assert.equal(R.getView(r).nextTask.kind,'service');assert.equal(R.getView(r).taskKey,`race.delivery.${deliveryTheme}`);arrive(r,deliveryTheme==='passengers'?'passenger-load':'cargo-load');assert.equal(R.getView(r).taskKey,deliveryTheme==='passengers'?'race.service.passenger-load':'race.service.cargo-select');}
});

test('Once-onlyfinishrecordsresultandfreezeswithoutduplicatingcompletion',()=>{
    const r=drive(R,{});const before=json(r),finish=r.player.finishTime;assert.equal(r.phase,'complete');assert.equal(R.step(r,1000),false);assert.deepEqual(json(r),before);assert.equal(r.player.finishTime,finish);assert.equal(r.events.filter(e=>e.type==='complete').length,1);
});

test('Light racers pull away together and automatically accelerate to 125 and 150 miles per hour',()=>{
    const r=R.createRace({driveMode:'light'});
    R.step(r,R.START_COUNTDOWN-.1);
    assert.equal(r.player.distance,0);
    assert.equal(r.rival.distance,0);
    R.step(r,.3);
    assert.ok(r.player.distance>0);
    assert.equal(r.player.distance,r.rival.distance);
    const speed=r.player.velocity;
    R.step(r,1);
    assert.ok(Math.abs(r.player.velocity-speed-250)<1e-6);
    assert.equal(r.player.velocity,r.rival.velocity);
    R.step(r,6);
    assert.equal(r.player.velocity,1250);
    assert.equal(r.rival.velocity,1500);
});

test('Light permits manual speed up to 150 and respects the tunnel through rear clearance',()=>{
    const r=R.createRace({driveMode:'light'}),v=r.player;
    R.step(r,R.START_COUNTDOWN+5.2);
    assert.equal(v.velocity,1250);
    assert.equal(R.adjustSpeed(r,1),true);
    R.step(r,1.05);
    assert.equal(v.velocity,1500);
    for(const job of v.serviceStates)job.completed=true;
    const tunnel=R.getTravelSections(r).find(s=>s.type==='tunnel');
    v.distance=tunnel.start-1;
    R.step(r,2.5,true);
    assert.equal(v.velocity,750);
    assert.equal(R.adjustSpeed(r,1),false);
    const status=v.terrainStates.find(s=>s.id===tunnel.id);
    for(let i=0;v.distance<=tunnel.end&&i<2400;i++)R.step(r,.025,true);
    assert.ok(v.distance>tunnel.end);
    assert.equal(status.completed,false);
    assert.equal(v.velocity,750);
    assert.equal(R.adjustSpeed(r,1),false);
    for(let i=0;!status.completed&&i<300;i++)R.step(r,.025);
    assert.equal(status.completed,true);
    R.step(r,2.1);
    assert.equal(v.velocity,1250);
});

test('Light waits for each passenger job and leaves both loading and final unloading on its own',()=>{
    const r=R.createRace({driveMode:'light',deliveryTheme:'passengers'}),v=r.player;
    R.step(r,R.START_COUNTDOWN+5.2);
    assert.equal(R.adjustSpeed(r,1),true);
    R.step(r,25);
    assert.equal(v.service.type,'passenger-load');
    const station=v.distance;
    R.step(r,10,true);
    assert.equal(v.distance,station);
    assert.equal(v.service.unitsDone,0);
    for(let i=0;i<3;i++){
        assert.equal(R.serviceAction(r,'passenger-'+i),true);
        R.step(r,1.1);
    }
    R.step(r,1);
    assert.ok(v.distance>station);
    assert.equal(v.targetVelocity,1250);
    const unload=completePassengers(r,'passenger-unload');
    R.step(r,1);
    assert.equal(v.carried.passengers,0);
    assert.ok(v.distance>unload.at);
    assert.ok(v.targetVelocity>0&&v.targetVelocity<=1250);
});

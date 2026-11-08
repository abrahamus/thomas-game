/* Deterministic Sodor Delivery Races: help, complete and deliver. */
(() => {
    'use strict';
    const CRUISE_SPEED=1000,COURSE_LENGTH=242000;
    // Keep existing landmarks at their calibrated positions. Only the finish straight grew.
    const COURSE_SCALE=214500/175500;
    const courseDistance=distance=>distance*COURSE_SCALE;
    const SPEEDS=Object.freeze([0,.25,.5,.75,1].map(fraction=>fraction*CRUISE_SPEED));
    const ACCELERATION=CRUISE_SPEED/4,BRAKING=CRUISE_SPEED/2.75,WORLD_SCALE=.008,WHEEL_RADIUS=24.975*WORLD_SCALE/.35;
    const START_COUNTDOWN=4.6,LOOK_AHEAD=courseDistance(10500),STEP=1/120,EPS=1e-8;
    const LANE_OFFSETS=Object.freeze([0]),ROAD_LANE=-15,ROAD_LANE_SPACING=0;
    const COACH_OFFSET=900;
    const SPEED_STEP_PERCENT=25,MAX_SPEED_PERCENT=150;
    const SPEED_UNIT=CRUISE_SPEED/100,TOP_SPEED=SPEED_UNIT*MAX_SPEED_PERCENT;
    const NEW_JOBS=Object.freeze(['repairs','rocks','coal','level-crossing']);
    const UNIT_JOBS=Object.freeze({repairs:{prefix:'sleeper',count:3,seconds:1.5},rocks:{prefix:'rock',count:2,seconds:2},coal:{prefix:'coal',count:3,seconds:1}});
    const JOB_DISTANCES=Object.freeze([12000,26000,52000,66600,94700,118600,143000,160600].map(courseDistance));
    const ELEVATION_RAMPS=Object.freeze([[72600,8,18000],[98600,-8,18000],[125400,-.62,1800],[130000,.62,1800]]
        .map(([start,height,width])=>Object.freeze([courseDistance(start),height,courseDistance(width)])));
    const CARGO_HANDLING_JOBS=Object.freeze(['wash','coal','water','repairs','rocks','tree']);
    const CARGO_HANDLING_SECONDS=5,CARGO_WINCH_SECONDS=3;
    const BRANCH_LIFT_SECONDS=12;
    const RIVAL_PARAMETERS=Object.freeze({version:8,startDelay:.12,paceMin:.76,paceMax:1.66,actionJitter:.15,washExtra:.4});
    const CHARACTERS=Object.freeze([
        ['thomas','Thomas','#159de0','rail','steam',0],['percy','Percy','#3baf58','rail','steam',0],
        ['james','James','#db3d3b','rail','steam',5.08],['bertie','Bertie','#cc3a35','road','diesel',0],
        ['toby','Toby','#946238','rail','steam',0],['spencer','Spencer','#aab9c7','rail','steam',5.08],
        ['emily','Emily','#226c50','rail','steam',5.08],['diesel','Diesel','#303a43','rail','diesel',0],
        ['bulgy','Bulgy','#c53232','road','diesel',0],['harold','Harold','#f1eee3','air','rotor',0]
    ].map(([id,name,color,vehicleType,power,tenderOffset])=>Object.freeze({id,name,color,vehicleType,power,
        portrait:`portrait-${id}`,tenderOffset,coachOffset:vehicleType==='air'?0:tenderOffset?1350:900,
        rearCoupler:tenderOffset?-6.6:vehicleType==='road'?-2.85:-3.37,coachRear:vehicleType==='air'?750:400,flightZoneExtension:vehicleType==='air'?550:0})));
    const OPPONENTS=CHARACTERS;
    const character=id=>CHARACTERS.find(c=>c.id===id);
    function getCharacter(race,who='player'){return character(racer(race,who)===race.player?race.playerId:race.opponentId);}
    // The shared ground corridor is a road: it crosses railways at barriers
    // and meets bus routes at traffic lights. Aircraft use separate air traffic.
    function getCrossingMode(){return 'road';}
    function getBranchLiftSeconds(race){return [race.playerId,race.opponentId].some(id=>character(id).vehicleType==='air')?BRANCH_LIFT_SECONDS:5;}
    const NARRATION=Object.freeze({
        'race.menu':'Choose your character and a friend to race.',
        'ui.radio':'Call the ground crew!','ui.horn':'Sound the horn!','ui.paused':'Let’s take a rest.',
        'race.choose.player':'Choose who you want to be.','race.choose.rival':'Choose your computer opponent.',
        'race.character.random':'A surprise character!','race.choose.unavailable':'That character is already racing.',
        ...Object.fromEntries(CHARACTERS.map(c=>[`race.character.${c.id}`,c.name+'!'])),
        'race.service.road-repairs':'Let’s help the workers fill the potholes.',
        'race.service.road-fuel':'Let’s fill our fuel tank.',
        'race.service.depot-water':'Fill the depot water store.',
        'race.service.depot-coal':'Help load coal into the depot bin.',
        'race.service.road-junction':'Ask for the green light. Wait for the traffic to clear.',
        'race.service.horn-animals':'Sound the horn so the animals can move along.',
        'race.service.horn-animals-wait':'Here they go. Let’s wait until the route is clear.',
        'race.flight.delivery.passengers':'Take our passengers to the next helipad.',
        'race.flight.delivery.cargo':'Carry our small cargo in the sling.',
        'race.flight.passenger-load':'We have landed. Welcome our passengers aboard.',
        'race.flight.passenger-unload':'We have landed. Help our passengers step out.',
        'race.flight.cargo-select':'Choose the small cargo for our sling.',
        'race.flight.cargo-load':'Use the winch to lift our cargo.',
        'race.flight.cargo-unload':'Lower our cargo onto the marked spot.',
        'race.flight.cargo-lowering':'Let’s stop and lower our cargo before we begin.',
        'race.flight.cargo-lifting':'Lift our cargo again. Then we can fly on.',
        'race.service.cargo-lowering':'Let’s stop and check our cargo before we begin.',
        'race.service.cargo-lifting':'Let’s secure our cargo before we go.',
        'race.flight.animals':'Call the farmer to clear the landing area.',
        'race.flight.animals-wait':'Let’s hover while the sheep move away.',
        'race.flight.repairs':'Help the ground crew use our repair supplies.',
        'race.flight.rocks':'Let’s ask the ground crane to clear the heavy rocks.',
        'race.flight.tree':'Let the workers attach the sling. Carry the small branch gently.',
        'race.flight.coal':'We have landed. Let’s fill Harold’s fuel tank.',
        'race.flight.water':'Deliver water to the ground crew.',
        'race.flight.wash':'We have landed. Wash the mud off Harold.',
        'race.flight.level-crossing':'Call the control tower. Wait for the aircraft to pass.',
        'race.flight.drawbridge':'Call the harbour crew to let the boat through.',
        'race.flight.terrain.tunnel':'Fly gently through the clouds.',
        'race.flight.terrain.hill':'Climb gently over the hill.',
        'race.flight.terrain.downhill':'Come down gently on the other side.',
        'race.flight.terrain.snow':'Slow down in the blowing snow above the frozen lake.',
        'race.flight.terrain.wet':'Fly steadily through the wind and rain above the lake.',
        'race.ready':'Ready.','race.steady':'Steady.','race.go':'Go! Let’s help along the way.',
        'race.cruise':'Off we go! Our next job is ahead.',
        'race.delivery.passengers':'Take our passengers to their station.','race.delivery.cargo':'Take our container to its new home.',
        'race.service.passenger-load':'Let’s welcome the passengers aboard.','race.service.passenger-unload':'We’ve arrived. Help our passengers step off.',
        'race.service.cargo-select':'Choose a container for our journey.','race.service.cargo-load':'Let’s use the crane to load our container.',
        'race.service.cargo-unload':'We’ve arrived. Lift the container onto the ground.',
        'race.service.animals':'Blow the whistle so the animals can move along.','race.service.animals-wait':'Here they go. Let’s wait until the track is clear.',
        'race.service.wash':'Let’s wash our vehicle. Wipe away the mud.','race.service.water':'Let’s fill our engine’s water tank.',
        'race.service.tree':'Call the crane to lift the branch.','race.service.drawbridge':'Let the boat through. Then the bridge can come down.',
        'race.service.repairs':'Let’s help the workers mend the track.',
        'race.service.rocks':'Use the crane to lift the rocks away.',
        'race.service.coal':'Let’s fill our engine’s coal bunker.',
        'race.service.level-crossing':'Let’s close the crossing for the cars.',
        'race.terrain.tunnel':'Through the tunnel, nice and slowly.',
        'race.terrain.hill':'Up the hill we go.',
        'race.terrain.downhill':'Gently down the hill.',
        'race.terrain.snow':'Slow down. There is ice beside the frozen lake.',
        'race.terrain.wet':'Slow down through the shallow floodwater.',
        'race.service.done':'All done! Off we go!',
        'race.complete.win':'You win! What a splendid race!','race.complete.lose':'Our friend wins! Well done. Let’s race again!',
        'race.complete.tie':'Together at the finish! What a splendid race!','race.next':'Let’s choose our players again.',
        'race.festival.arrival':'Welcome to the finish festival!',
        'race.festival.win':'First place! A golden trophy for you!',
        'race.festival.lose':'Well done! A silver rosette for finishing your journey.',
        'race.festival.tie':'A shared first place! A trophy for each of you!',
        'race.festival.passengers':'Eight jobs complete. Thank you for bringing our passengers safely!',
        'race.festival.cargo':'Eight jobs complete. Thank you for delivering our cargo!',
        'race.festival.skip':'See your race results.',
        'race.rematch':'Race the same journey again.',
        'race.choose':'Choose your players.'
    });
    const RULES=Object.freeze({bend:{name:'Bend',cap:.9,entryReduction:.1},'tight-bend':{name:'Bend',cap:.9,entryReduction:.1},hill:{name:'Climb',cap:.65},downhill:{name:'Downhill',cap:.60},tunnel:{name:'Tunnel',cap:.50},wet:{name:'Wet track',cap:.40},snow:{name:'Snow',cap:.55}});
    const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
    const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
    const smoother=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
    function seeded(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
    function randomIndex(length,random){return Math.min(length-1,Math.floor(clamp(Number(random()),0,.999999999)*length));}
    function shuffled(values,random){const out=values.slice();for(let i=out.length-1;i>0;i--){const j=randomIndex(i+1,random);[out[i],out[j]]=[out[j],out[i]];}return out;}
    function course(id,name,biome){
        const sections=[['tunnel',35000,36800],['tunnel',42800,44600],['bend',54100,57600],['hill',72600,90600],['downhill',98600,116600],[biome==='mountain'?'snow':'wet',126600,130600],['tight-bend',162600,166600]].map(([type,start,end],index)=>Object.freeze({id:`terrain-${index+1}`,type,start:courseDistance(start),end:courseDistance(end),...RULES[type]}));
        return Object.freeze({id,name,length:COURSE_LENGTH,biome,sections:Object.freeze(sections),switches:Object.freeze([]),junctions:Object.freeze([])});
    }
    const COURSES=Object.freeze({country:course('country','Countryside Sprint','country'),harbour:course('harbour','Harbour Run','harbour'),mountain:course('mountain','Mountain Challenge','mountain')});
    function chooseRace({playerId='thomas',opponentId='random',lastRace=null,random=Math.random}={}){
        if(opponentId==='surprise')opponentId='random';
        for(const id of [playerId,opponentId])if(id!=='random'&&!character(id))throw new RangeError('Unknown race character');
        let pairs=CHARACTERS.flatMap(p=>CHARACTERS.filter(o=>p.id!==o.id&&
            (playerId==='random'||p.id===playerId)&&(opponentId==='random'||o.id===opponentId)).map(o=>[p.id,o.id]));
        if(!pairs.length)throw new RangeError('Players must be different characters');
        const fresh=pairs.filter(([p,o])=>(playerId!=='random'||p!==lastRace?.playerId)&&(opponentId!=='random'||o!==lastRace?.opponentId));
        if(fresh.length)pairs=fresh;
        const [player,opponent]=pairs[randomIndex(pairs.length,random)];
        const courses=Object.keys(COURSES).filter(id=>id!==lastRace?.courseId),seed=Math.floor(clamp(Number(random()),0,.999999999)*4294967296)>>>0;
        return{playerId:player,opponentId:opponent,courseId:courses[randomIndex(courses.length,random)],seed,deliveryTheme:lastRace?.deliveryTheme==='passengers'?'cargo':lastRace?.deliveryTheme==='cargo'?'passengers':(seed&1?'cargo':'passengers')};
    }
    function routeElevation(distance){return ELEVATION_RAMPS.reduce((y,[start,height,width])=>y+height*smoother((distance-start)/width),0);}
    function routeDirection(c,distance){
        let heading=0;for(const s of c.sections){if(s.type==='bend')heading+=.32*smooth((distance-s.start)/(s.end-s.start));if(s.type==='tight-bend')heading-=.42*smooth((distance-s.start)/(s.end-s.start));}
        let derivative=0;for(const[start,height,width]of ELEVATION_RAMPS){const t=(distance-start)/width;if(t>0&&t<1)derivative+=height*30*t*t*(t-1)*(t-1)/(width*WORLD_SCALE);}
        return{heading,grade:Math.atan(derivative)};
    }
    const routeTables=new Map();
    function routeTable(c){if(routeTables.has(c.id))return routeTables.get(c.id);const spacing=125,samples=[{distance:0,x:0,z:0}];let x=0,z=0;for(let distance=spacing;distance<=c.length+15000;distance+=spacing){const d=routeDirection(c,distance-spacing/2),ds=spacing*WORLD_SCALE;x+=Math.sin(d.heading)*Math.cos(d.grade)*ds;z+=Math.cos(d.heading)*Math.cos(d.grade)*ds;samples.push({distance,x,z});}const result={spacing,samples};routeTables.set(c.id,result);return result;}
    function sampleRoute(courseId,distance,offset=0){const c=COURSES[courseId];if(!c)throw new RangeError('Unknown race course');distance=Number.isFinite(distance)?distance:0;const table=routeTable(c),base=clamp(distance,0,table.samples.at(-1).distance),i=Math.min(table.samples.length-2,Math.floor(base/table.spacing)),a=table.samples[i],b=table.samples[i+1],t=(base-a.distance)/table.spacing,d=routeDirection(c,distance),extension=(distance-base)*WORLD_SCALE;
        return{x:a.x+(b.x-a.x)*t+Math.sin(d.heading)*extension+Math.cos(d.heading)*offset,y:routeElevation(distance),z:a.z+(b.z-a.z)*t+Math.cos(d.heading)*extension-Math.sin(d.heading)*offset,heading:d.heading,grade:d.grade};}
    function sampleTerrainHeight(courseId,distance,lateral=0){
        if(!COURSES[courseId])throw new RangeError('Unknown race course');
        const y=routeElevation(distance),edge=Math.max(0,Math.min(Math.abs(lateral),Math.abs(lateral-ROAD_LANE))-7);
        return y-.32-(y+1.5)*smooth(edge/12);
    }
    function sampleLaneRoute(courseId,_lane,distance){return sampleRoute(courseId,distance,0);}
    function sampleRivalLaneRoute(courseId,_lane,distance){return sampleRoute(courseId,distance,ROAD_LANE);}
    function racer(race,who){const v=typeof who==='string'?race[who]:who;if(!v||(v!==race.player&&v!==race.rival))throw new RangeError('Unknown race vehicle');return v;}
    function getCoachOffset(race,who){return getCharacter(race,who).coachOffset;}
    function sampleVehicleRoute(race,who,distance){const v=racer(race,who);return sampleRoute(race.courseId,distance===undefined?v.distance:distance,v===race.rival?ROAD_LANE:0);}
    function sampleCoachRoute(race,who,distance){const v=racer(race,who);return sampleVehicleRoute(race,v,(distance===undefined?v.distance:distance)-getCoachOffset(race,v));}

    function getBranchLiftPose(progress){
        const seconds=clamp(progress,0,1)*BRANCH_LIFT_SECONDS;
        const approach=smoother(seconds/2),rise=smoother((seconds-3)/1.5),carry=smoother((seconds-4.5)/3),lower=smoother((seconds-7.5)/1.5),back=smoother((seconds-10)/2);
        const aircraft={x:4.5*carry*(1-back),y:6+1.5*(rise-lower),z:3*approach*(1-back)};
        const load={x:4.5*carry,y:.3+1.5*(rise-lower),z:3};
        const attached=seconds>=3&&seconds<9.5;
        const hookY=seconds<3?5.4-4.8*smoother((seconds-2)):seconds<9.5?load.y+.3:.6+4.8*smoother((seconds-9.5)/.5);
        return {aircraft,load,attached,hookY,seconds,stage:seconds<2?'approach':seconds<3?'attach':seconds<4.5?'lift':seconds<7.5?'carry':seconds<9?'lower':seconds<10?'detach':'return'};
    }
    function getFlightPose(race,who='player',distance){
        const v=racer(race,who),c=getCharacter(race,v);
        if(c.vehicleType!=='air')return null;
        const d=distance===undefined?v.distance:distance;
        let altitude=8,side=0,weather=0;
        for(const section of getTravelSections(race,v)){
            if(section.cap>=1||section.type==='level-crossing')continue;
            const t=clamp((d-section.start)/(section.end-section.start),0,1),bend=Math.sin(t*Math.PI)**2;
            if(section.type==='tunnel'){side+=5*bend;altitude+=3*bend;}
            else if(['wet','snow'].includes(section.type)){weather=bend;side+=(Math.sin(t*Math.PI*2)*.7+Math.sin(race.elapsed*1.6)*.12)*bend;}
        }
        let proximity=0,job=null;
        for(const service of v.serviceStates){
            const gap=d-service.at,near=1-smoother(Math.abs(gap)/courseDistance(gap<0?2400:1800));
            if(near<=proximity)continue;
            proximity=near;job=service;
        }
        const ground=job&&['passenger-load','passenger-unload','wash','coal','water','rocks','repairs'].includes(job.type);
        const parksLoad=job&&v.carried.container&&CARGO_HANDLING_JOBS.includes(job.type);
        const jobAltitude=ground&&!parksLoad ? .06 : 6;
        altitude=altitude*(1-proximity)+jobAltitude*proximity;side*=1-proximity;
        const departure=smoother(d/courseDistance(1800));
        // Clear the entire finish banner before descending onto the festival pad.
        const landing=smoother((d-COURSES[race.courseId].length-950)/(finishRunout(race,who)-950));
        altitude=.06+(altitude-.06)*departure*(1-landing);
        altitude+=Math.sin(race.elapsed*1.8)*.07*smooth((altitude-1)/4)*(parksLoad||['tree','level-crossing'].includes(job?.type)?1-proximity:1);
        const lane=v===race.rival?ROAD_LANE:0,cargoSide=v===race.rival?3:-3;
        const offset=lane+(lane<0?-side:side)+(parksLoad?cargoSide*proximity:0),p=sampleRoute(race.courseId,d,offset);
        let pitch=.085*clamp(v.velocity/SPEEDS[4],0,1.25)*smooth(altitude/3)*(1-proximity);
        let roll=(Math.sin(d/1400)*.035+Math.sin(race.elapsed*1.6)*.035*weather)*smooth(altitude/4)*(1-proximity),cargo=null;
        // Forward travel always follows model distance. Winching and the short
        // move onto the helipad happen only while the model holds this stop.
        if(parksLoad){
            cargo={x:p.x,y:p.y+altitude-2.55,z:p.z,attached:true,phase:'carried'};
            if(v.service===job&&Math.abs(d-job.at)<EPS){
                const pad=sampleRoute(race.courseId,job.at,lane+cargoSide),centre=sampleRoute(race.courseId,job.at,lane);
                const lowering=job.phase==='cargo-lowering',lifting=job.phase==='cargo-lifting';
                const seconds=(job.handlingProgress||0)*CARGO_HANDLING_SECONDS,transfer=CARGO_HANDLING_SECONDS-CARGO_WINCH_SECONDS;
                // Reconnect with an empty hook before raising the load. This
                // uses the same five-second pause as the other racer's check.
                const hookDrop=1,pickupStart=transfer+hookDrop;
                const lower=lowering?smoother(seconds/CARGO_WINCH_SECONDS):lifting?1-smoother((seconds-pickupStart)/(CARGO_HANDLING_SECONDS-pickupStart)):1;
                const aside=lowering?smoother((seconds-CARGO_WINCH_SECONDS)/transfer):lifting?1-smoother(seconds/transfer):1;
                p.x=pad.x+(centre.x-pad.x)*aside;p.z=pad.z+(centre.z-pad.z)*aside;p.y=pad.y;
                altitude=6+((ground ? .06 : 6)-6)*aside;pitch=roll=0;
                const attached=lowering?seconds<CARGO_WINCH_SECONDS:lifting?seconds>=pickupStart:false;
                const payingOut=lifting&&seconds>=transfer&&seconds<pickupStart;
                cargo={x:pad.x,y:pad.y+3.45*(1-lower),z:pad.z,attached,ropeVisible:attached||payingOut,phase:attached?'winching':'parked'};
                if(payingOut)cargo.hook={x:pad.x,y:pad.y+6.65-5.93*smoother((seconds-transfer)/hookDrop),z:pad.z};
            }
        }
        if(v.service?.type==='tree'&&v.service.phase==='working'&&Math.abs(d-v.service.at)<EPS){
            const lift=getBranchLiftPose(v.service.progress),centre=sampleRoute(race.courseId,d,lane),cs=Math.cos(centre.heading),sn=Math.sin(centre.heading);
            p.x=centre.x+lift.aircraft.x*cs+lift.aircraft.z*sn;p.z=centre.z-lift.aircraft.x*sn+lift.aircraft.z*cs;p.y=centre.y;
            altitude=lift.aircraft.y;pitch=roll=0;
        }
        return {...p,y:p.y+altitude,grade:0,altitude,offset,pitch,roll,cargo,jobId:job?.id,proximity,
            shadowY:Math.max(sampleTerrainHeight(race.courseId,d,offset),weather>0?(race.courseId==='mountain'?-.82:-.48):-Infinity)+.025};
    }

    function makeServices(theme,courseId,random){
        const guaranteed=shuffled(NEW_JOBS,random).slice(0,2);
        const pool=['water','tree','drawbridge',...NEW_JOBS].filter(type=>!guaranteed.includes(type));
        const middle=shuffled(['animals','wash',...guaranteed,...shuffled(pool,random).slice(0,2)],random);
        const types=[theme==='passengers'?'passenger-load':'cargo-load',...middle,theme==='passengers'?'passenger-unload':'cargo-unload'];
        return Object.freeze(types.map((type,index)=>Object.freeze({type,at:JOB_DISTANCES[index],id:`service-${index+1}`,index,mudAt:type==='wash'?JOB_DISTANCES[index]-courseDistance(4500):null})));
    }
    function vehicle(services,sections){
        return {distance:0,velocity:0,targetVelocity:0,gear:4,wheelTurns:0,finishTime:null,
            _travelledWorld:0,service:null,_npcNextAction:null,entryBrakeTarget:null,
            terrainStates:sections.filter(s=>s.cap<1).map(s=>({id:s.id,completed:false})),
            serviceStates:services.map(s=>({...s,phase:'approach',processed:false,completed:false,unitsDone:0,
                groups:[false,false,false],selectedContainer:null,activeUnit:null,targetId:null,
                remaining:0,duration:0,progress:0,startedAt:null,lastActionAt:0,hinted:false,mudTriggered:false,
                cargoHandling:false,handlingProgress:0,workComplete:false})),
            carried:{passengers:0,container:null,cargo:false},mudPatches:Array(7).fill(false),dirt:0,coal:0,fuel:0};
    }
    function makeProfile(services,random){
        // Each rematch keeps the same independent pace. Actions, rather than a
        // forced winner or catch-up speed, decide which racer reaches the line.
        const pace=RIVAL_PARAMETERS.paceMin+random()*(RIVAL_PARAMETERS.paceMax-RIVAL_PARAMETERS.paceMin);
        return Object.freeze({version:5,parametersVersion:RIVAL_PARAMETERS.version,startDelay:RIVAL_PARAMETERS.startDelay,pace,
            services:Object.freeze(services.map(s=>Object.freeze({id:s.id,actionDelays:Object.freeze(Array.from({length:10},()=>
                pace+(s.type==='wash'?RIVAL_PARAMETERS.washExtra:0)+(random()*2-1)*RIVAL_PARAMETERS.actionJitter))})))});
    }
    function createRace({courseId='country',playerId='thomas',opponentId='percy',seed=1,deliveryTheme=(seed&1?'cargo':'passengers'),driveMode='full'}={}){
        if(!COURSES[courseId]||!character(playerId)||!character(opponentId)||!['passengers','cargo'].includes(deliveryTheme))throw new RangeError('Unknown race course, opponent or delivery theme');
        if(playerId===opponentId)throw new RangeError('Players must be different characters');
        const random=seeded(seed),services=makeServices(deliveryTheme,courseId,random),sections=COURSES[courseId].sections;
        return {courseId,playerId,opponentId,seed:seed>>>0,deliveryTheme,driveMode:driveMode==='light'?'light':'full',phase:'countdown',countdown:START_COUNTDOWN,elapsed:0,
            player:{...vehicle(services,sections),speedPercent:0},rival:vehicle(services,sections),services,winner:null,rewarded:false,
            profile:makeProfile(services,random),events:[{type:'narration',key:'race.ready'}],_fixedRemainder:0};
    }
    function announce(race,v,type,key,extra={}){race.events.push({type:v===race.rival?`rival-${type}`:type,key:v===race.rival?null:key,...extra});}
    function taskKey(s,race,v=race?.player){
        if(!s)return'race.cruise';
        const c=race?getCharacter(race,v):null,road=c?.vehicleType==='road';
        if(s.phase==='cargo-lowering'||s.phase==='cargo-lifting')return`race.${c?.vehicleType==='air'?'flight':'service'}.${s.phase}`;
        if(c?.vehicleType==='air')return `race.flight.${s.type==='cargo-load'&&!s.selectedContainer?'cargo-select':s.type}${s.type==='animals'&&s.phase==='working'?'-wait':''}`;
        if(s.type==='cargo-load'&&!s.selectedContainer)return'race.service.cargo-select';
        if(s.type==='animals')return c?.power==='diesel'?`race.service.horn-animals${s.phase==='working'?'-wait':''}`:`race.service.animals${s.phase==='working'?'-wait':''}`;
        if(road&&s.type==='coal')return'race.service.road-fuel';
        if(road&&s.type==='repairs')return'race.service.road-repairs';
        if(road&&s.type==='level-crossing')return 'race.service.road-junction';
        if(c?.power==='diesel'&&['water','coal'].includes(s.type))return`race.service.depot-${s.type}`;
        return`race.service.${s.type}`;
    }
    function beginWork(race,v,s,duration,targetId=null){s.phase='working';s.duration=duration;s.remaining=duration;s.progress=0;s.startedAt=race.elapsed;s.lastActionAt=race.elapsed;s.hinted=false;s.targetId=targetId;v._npcNextAction=null;announce(race,v,'service-action',s.type==='animals'?taskKey(s,race,v):null,{serviceId:s.id,targetId});}
    function beginCargoHandling(race,v,s,phase){
        s.phase=phase;s.remaining=CARGO_HANDLING_SECONDS;s.handlingProgress=0;s.lastActionAt=race.elapsed;s.hinted=false;v._npcNextAction=null;
        announce(race,v,'cargo-handling',taskKey(s,race,v),{serviceId:s.id});
    }
    function finishService(race,v,s){
        if(s.completed)return;
        if(s.cargoHandling&&s.phase!=='cargo-lifting'){s.workComplete=true;s.activeUnit=null;s.targetId=null;beginCargoHandling(race,v,s,'cargo-lifting');return;}
        s.phase='complete';s.processed=s.completed=true;s.progress=1;s.remaining=0;s.activeUnit=null;s.targetId=null;s.completedAt=race.elapsed;v.service=null;v._npcNextAction=null;
        if(v===race.player)v.speedPercent=0;
        announce(race,v,'service-done','race.service.done',{serviceId:s.id,serviceType:s.type});
    }
    function serviceActionFor(race,v,targetId){const s=v.service;if(race.phase!=='racing'||!s||s.phase!=='ready'||v.velocity>EPS)return false;
        if(s.type==='animals'&&getCharacter(race,v).vehicleType==='air'&&(targetId==null||targetId==='animals'))return whistleFor(race,v);
        const job=UNIT_JOBS[s.type];
        if(job){
            const n=targetId==null?s.groups.slice(0,job.count).findIndex(done=>!done):Number(String(targetId).replace(new RegExp('^'+job.prefix+'-'),''));
            if(!Number.isInteger(n)||n<0||n>=job.count||s.groups[n]||(targetId!=null&&targetId!==`${job.prefix}-${n}`))return false;
            s.activeUnit=n;beginWork(race,v,s,job.seconds,`${job.prefix}-${n}`);return true;
        }
        if(s.type==='level-crossing'){
            if(targetId!=null&&targetId!=='crossing')return false;
            beginWork(race,v,s,5,'crossing');return true;
        }
        if(s.type==='drawbridge'){
            if(targetId!=null&&targetId!=='drawbridge')return false;
            beginWork(race,v,s,6,'drawbridge');return true;
        }
        if(s.type==='passenger-load'||s.type==='passenger-unload'){if(s.type==='passenger-unload'&&v.carried.passengers<=0)return false;let n=targetId===undefined||targetId===null?s.groups.findIndex(x=>!x):Number(String(targetId).replace(/^passenger-/,''));if(!Number.isInteger(n)||n<0||n>2||s.groups[n])return false;s.activeUnit=n;beginWork(race,v,s,1,`passenger-${n}`);return true;}
        if(s.type==='cargo-load'){if(!s.selectedContainer){if(targetId!==undefined&&targetId!==null&&targetId!=='container-1'&&targetId!=='container')return false;s.selectedContainer='container-1';s.lastActionAt=race.elapsed;s.hinted=false;v._npcNextAction=null;announce(race,v,'service-selected',taskKey(s,race,v),{serviceId:s.id,targetId:'container-1'});return true;}beginWork(race,v,s,5,'container-1');return true;}
        if(s.type==='cargo-unload'){if(!v.carried.container)return false;beginWork(race,v,s,5,'container-1');return true;}
        if(s.type==='wash'){const n=v.mudPatches.findIndex(Boolean);if(n<0){finishService(race,v,s);return false;}s.activeUnit=n;beginWork(race,v,s,.6,n);return true;}
        if(s.type==='water'||s.type==='tree'){beginWork(race,v,s,s.type==='water'?4:getBranchLiftSeconds(race));return true;}return false;
    }
    function serviceAction(race,targetId){return serviceActionFor(race,race.player,targetId);}
    function cleanMudFor(race,v,patchId){const s=v.service,n=Number(patchId);if(race.phase!=='racing'||!s||s.type!=='wash'||s.phase!=='ready'||!Number.isInteger(n)||n<0||n>=7||!v.mudPatches[n])return false;v.mudPatches[n]=false;s.unitsDone++;s.lastActionAt=race.elapsed;s.hinted=false;v.dirt=v.mudPatches.filter(Boolean).length/7;announce(race,v,'mud-cleaned',null,{serviceId:s.id,patchId:n});if(!v.mudPatches.some(Boolean))finishService(race,v,s);return true;}
    function cleanMud(race,patchId){return cleanMudFor(race,race.player,patchId);}
    function whistleFor(race,v){if(race.phase!=='racing')return false;const s=v.service;if(s&&s.type==='animals'&&s.phase==='ready'&&v.velocity<=EPS){beginWork(race,v,s,2);return true;}return false;}
    function whistle(race){return whistleFor(race,race.player);}
    function updateService(race,v,dt){const s=v.service;if(!s)return;
        if(s.phase==='cargo-lowering'||s.phase==='cargo-lifting'){
            s.remaining=Math.max(0,s.remaining-dt);s.handlingProgress=1-s.remaining/CARGO_HANDLING_SECONDS;
            if(s.remaining<=EPS){if(s.phase==='cargo-lifting')finishService(race,v,s);else{s.phase='ready';s.lastActionAt=race.elapsed;announce(race,v,'service-ready',taskKey(s,race,v),{serviceId:s.id});}}
            return;
        }
        if(s.phase==='working'){s.remaining=Math.max(0,s.remaining-dt);s.progress=s.duration?1-s.remaining/s.duration:1;if(s.remaining<=EPS){
                if(UNIT_JOBS[s.type]){
                    s.groups[s.activeUnit]=true;s.unitsDone++;s.activeUnit=null;s.targetId=null;
                    if(s.type==='coal')v[getCharacter(race,v).vehicleType!=='rail'?'fuel':'coal']=s.unitsDone/UNIT_JOBS.coal.count;
                    if(s.unitsDone>=UNIT_JOBS[s.type].count)finishService(race,v,s);
                    else{s.phase='ready';s.lastActionAt=race.elapsed;s.hinted=false;}
                }
                else if(s.type.startsWith('passenger-')){s.groups[s.activeUnit]=true;s.unitsDone++;v.carried.passengers+=s.type==='passenger-load'?1:-1;s.activeUnit=null;s.targetId=null;if(s.unitsDone>=3)finishService(race,v,s);else{s.phase='ready';s.lastActionAt=race.elapsed;s.hinted=false;}}
                else if(s.type==='wash'){v.mudPatches[s.activeUnit]=false;s.unitsDone++;v.dirt=v.mudPatches.filter(Boolean).length/7;announce(race,v,'mud-cleaned',null,{serviceId:s.id,patchId:s.activeUnit});s.activeUnit=null;s.targetId=null;if(v.dirt<=EPS)finishService(race,v,s);else{s.phase='ready';s.lastActionAt=race.elapsed;s.hinted=false;}}
                else{if(s.type==='cargo-load'){v.carried.container=s.selectedContainer;v.carried.cargo=true;s.unitsDone=1;}if(s.type==='cargo-unload'){v.carried.container=null;v.carried.cargo=false;s.unitsDone=1;}finishService(race,v,s);}
            }}else if(s.phase==='ready'&&!s.hinted&&race.elapsed-s.lastActionAt>=6){s.hinted=true;announce(race,v,'service-hint',taskKey(s,race,v),{serviceId:s.id});}}
    function updateRivalIntentions(race){
        const v=race.rival,s=v.service;if(!s||s.phase!=='ready')return;
        const plan=race.profile.services[s.index],n=s.type==='cargo-load'?(s.selectedContainer?1:0):s.unitsDone;
        if(v._npcNextAction===null)v._npcNextAction=race.elapsed+plan.actionDelays[n];
        if(race.elapsed+EPS>=v._npcNextAction){if(s.type==='animals')whistleFor(race,v);else serviceActionFor(race,v);v._npcNextAction=null;}
    }
    const travelSectionsCache=new WeakMap();
    function getTravelSections(race,who='player'){
        const v=racer(race,who),extra=getCharacter(race,v).flightZoneExtension;
        if(travelSectionsCache.has(v))return travelSectionsCache.get(v);
        // Flight checkpoints continue beyond the ground obstacle. The helicopter
        // stays under the speed limit until its tail clears the route.
        const sections=Object.freeze([...COURSES[race.courseId].sections,...v.serviceStates.filter(s=>s.type==='level-crossing').map(s=>({id:s.id,type:s.type,start:s.at,end:s.at+1400,cap:.5}))].map(s=>Object.freeze(extra&&s.cap<1?{...s,end:s.end+extra}:s)));
        travelSectionsCache.set(v,sections);return sections;
    }
    function activeTerrain(race,v){
        const rear=v.distance-getCoachOffset(race,v)-getCharacter(race,v).coachRear;
        return getTravelSections(race,v).find(s=>s.cap<1&&v.distance>=s.start&&rear<=s.end)||null;
    }
    function sectionSpeedLimit(section){
        const baseSpeed=section.type==='level-crossing'?CRUISE_SPEED:TOP_SPEED;
        return Math.round(baseSpeed*section.cap/SPEED_UNIT)*SPEED_UNIT;
    }
    function routeSpeedLimit(race,v){
        let limit=Infinity;
        const rear=v.distance-getCoachOffset(race,v)-getCharacter(race,v).coachRear;
        for(const s of getTravelSections(race,v)){
            if(s.cap>=1||rear>s.end)continue;
            const crossing=s.type==='level-crossing';
            if(!crossing&&v.distance<s.start)continue;
            const cap=sectionSpeedLimit(s);
            limit=Math.min(limit,v.distance>=s.start?cap:Math.sqrt(cap*cap+2*BRAKING*Math.max(0,s.start-v.distance-50)));
        }
        const next=v.serviceStates.find(s=>!s.completed);
        if(next)limit=Math.min(limit,Math.sqrt(2*BRAKING*Math.max(0,next.at-v.distance)));
        return limit;
    }
    function playerSpeedPercent(race){
        const automatic=race.driveMode==='light'?CRUISE_SPEED/SPEED_UNIT:0;
        return Math.max(race.player.speedPercent,automatic);
    }
    function nextAllowedSpeedPercent(race,v){
        const current=playerSpeedPercent(race),limit=routeSpeedLimit(race,v)/SPEED_UNIT;
        const grade=Math.floor((current+EPS)/SPEED_STEP_PERCENT)+1;
        const next=Math.min(MAX_SPEED_PERCENT,grade*SPEED_STEP_PERCENT),terrain=activeTerrain(race,v);
        if(terrain&&terrain.type!=='level-crossing')return Math.min(next,limit);
        return next<=limit+EPS?next:current;
    }
    function canSpeedUp(race){
        const v=race.player;
        return race.phase==='racing'&&!v.service&&v.entryBrakeTarget==null&&nextAllowedSpeedPercent(race,v)>playerSpeedPercent(race)+EPS;
    }
    function adjustSpeed(race,direction){
        if(direction!==1||!canSpeedUp(race))return false;
        race.player.speedPercent=nextAllowedSpeedPercent(race,race.player);
        return true;
    }
    function motion(v,target,dt){const acceleration=target>v.velocity?ACCELERATION:target<v.velocity?-BRAKING:0,reach=acceleration?Math.abs((target-v.velocity)/acceleration):Infinity,t=Math.min(dt,reach),firstDistance=v.velocity*t+acceleration*t*t/2;return{travelled:firstDistance+(dt-t)*target,velocity:acceleration?(dt>=reach?target:v.velocity+acceleration*dt):v.velocity,timeAt(distance){if(distance<=EPS)return 0;if(distance<=firstDistance+EPS)return acceleration?(Math.sqrt(Math.max(0,v.velocity*v.velocity+2*acceleration*distance))-v.velocity)/acceleration:distance/Math.max(EPS,v.velocity);return t+(distance-firstDistance)/Math.max(EPS,target);}};}
    function move(race,v,dt,accelerating=false){
        const finishedBefore=v.finishTime!==null,c=COURSES[race.courseId];
        if(finishedBefore&&v.distance>=c.length+2500){v.velocity=v.targetVelocity=0;return;}
        if(v.service){v.velocity=v.targetVelocity=0;updateService(race,v,dt);return;}
        const before=v.distance,beforeVelocity=v.velocity;
        const rivalSpeed=race.driveMode==='light'?CRUISE_SPEED:TOP_SPEED;
        const requested=v===race.rival?rivalSpeed:Math.min(TOP_SPEED,
            Math.max(playerSpeedPercent(race)*SPEED_UNIT,accelerating?v.velocity+ACCELERATION*dt:0));
        let target=Math.min(requested,routeSpeedLimit(race,v),v.entryBrakeTarget??Infinity);
        const m=motion(v,target,dt);
        v.distance+=m.travelled;
        const entry=c.sections.find(s=>s.cap<1&&before<s.start&&v.distance>=s.start);
        if(entry){
            const timeToEntry=m.timeAt(entry.start-before);
            const entryVelocity=motion(v,target,timeToEntry).velocity;
            const reduction=entry.entryReduction??entry.cap;
            target=Math.min(entryVelocity*(1-reduction),sectionSpeedLimit(entry));
            v.entryBrakeTarget=target;
            const braking=motion({velocity:entryVelocity},target,dt-timeToEntry);
            v.velocity=braking.velocity;
            v.distance=entry.start+braking.travelled;
        }else v.velocity=m.velocity;
        // Braking lowers the manual setting. Light can recover to automatic speed.
        if(v===race.player&&(accelerating||target<requested||entry))v.speedPercent=target/SPEED_UNIT;
        v.targetVelocity=target;
        if(v.entryBrakeTarget!=null&&v.velocity<=v.entryBrakeTarget+EPS)v.entryBrakeTarget=null;
        const rear=v.distance-getCoachOffset(race,v)-getCharacter(race,v).coachRear,sections=getTravelSections(race,v);
        for(const state of v.terrainStates){
            const section=sections.find(s=>s.id===state.id);
            if(!state.completed&&rear>section.end){state.completed=true;state.completedAt=race.elapsed;}
        }
        const service=v.serviceStates.find(s=>!s.completed);
        if(service&&v.distance>=service.at-.05){
            v.distance=service.at;v.velocity=v.targetVelocity=0;v.entryBrakeTarget=null;service.phase='ready';service.lastActionAt=race.elapsed;
            if(v===race.player)v.speedPercent=0;
            service.startedAt=race.elapsed;v.service=service;
            // A sling load needs time on the ground. Both roles receive the
            // same cargo checks, independent of their actions and race position.
            service.cargoHandling=Boolean(v.carried.container&&CARGO_HANDLING_JOBS.includes(service.type)&&[race.playerId,race.opponentId].some(id=>character(id).vehicleType==='air'));
            if(service.cargoHandling)beginCargoHandling(race,v,service,'cargo-lowering');
            else announce(race,v,'service-start',taskKey(service,race,v),{serviceId:service.id,serviceType:service.type});
        }
        for(const s of v.serviceStates)if(s.type==='wash'&&!s.mudTriggered&&v.distance>=s.mudAt){s.mudTriggered=true;v.mudPatches.fill(true);v.dirt=1;announce(race,v,'mud-splash',null,{serviceId:s.id});}
        if(!finishedBefore&&v.distance>=c.length-EPS){
            const crossing=clamp(m.timeAt(Math.max(0,c.length-before)),0,dt);
            v.finishTime=race.elapsed+crossing;
            const speed=beforeVelocity+Math.sign(target-beforeVelocity)*Math.min(Math.abs(target-beforeVelocity),(target>beforeVelocity?ACCELERATION:BRAKING)*crossing);
            v.finishEvent=Object.freeze({time:v.finishTime,speed,wheelTurns:(v._travelledWorld+(c.length-before)*WORLD_SCALE)/(Math.PI*2*WHEEL_RADIUS)});
            race.events.push({type:'finish',who:v===race.player?'player':'rival',...v.finishEvent});
            if(v===race.player)v.distance=c.length;
        }
        if(finishedBefore)v.distance=Math.min(v.distance,c.length+2500);
        v._travelledWorld+=Math.max(0,v.distance-before)*WORLD_SCALE;v.wheelTurns=v._travelledWorld/(Math.PI*2*WHEEL_RADIUS);
        if(v===race.player&&v.finishTime!==null)v.velocity=v.targetVelocity=0;
    }
    function tick(race,dt,accelerating){
        if(race.phase==='countdown'){
            const old=race.countdown;
            race.countdown=Math.max(0,old-dt);
            if(old>START_COUNTDOWN/2+EPS&&race.countdown<=START_COUNTDOWN/2+EPS)race.events.push({type:'narration',key:'race.steady'});
            if(race.countdown<=EPS){
                race.countdown=0;race.phase='racing';
                race.events.push({type:'narration',key:'race.go'},{type:'delivery-goal',key:`race.${getCharacter(race).vehicleType==='air'?'flight.':''}delivery.${race.deliveryTheme}`});
            }
            return;
        }
        if(race.phase!=='racing')return;
        updateRivalIntentions(race);
        const canDepart=race.elapsed>=race.profile.startDelay;
        if(canDepart||race.driveMode!=='light')move(race,race.player,dt,accelerating);
        if(canDepart)move(race,race.rival,dt);
        race.elapsed+=dt;
        if(race.player.finishTime!==null){
            const other=race.rival.finishTime;
            race.winner=other===null||race.player.finishTime<other-.05?'player':Math.abs(race.player.finishTime-other)<=.05?'tie':'rival';
            race.finishMotion={rivalVelocity:race.rival.velocity,rivalTarget:race.rival.targetVelocity};
            race.phase='complete';
            for(const v of[race.player,race.rival])v.velocity=v.targetVelocity=0;
            race.events.push({type:'complete',key:`race.complete.${race.winner==='player'?'win':race.winner==='tie'?'tie':'lose'}`});
        }
    }
    function step(race,dt,accelerating=false){if(!Number.isFinite(dt)||dt<=0||race.phase==='complete')return false;race._fixedRemainder+=dt;const ticks=Math.floor((race._fixedRemainder+EPS)/STEP);race._fixedRemainder-=ticks*STEP;if(race._fixedRemainder<0&&race._fixedRemainder>-EPS)race._fixedRemainder=0;for(let i=0;i<ticks&&race.phase!=='complete';i++)tick(race,STEP,accelerating);return true;}
    // Presentation owns its copy and clock. It may finish the rival's remaining
    // jobs, but never writes to the completed race or its persisted rewards.
    function finishRunout(race,who='player'){
        const c=getCharacter(race,who);
        return c.vehicleType==='air'?2600:Math.max(1900,c.coachOffset+c.coachRear+500);
    }
    function finishArrival(race,who='player',elapsed=race.elapsed){
        const event=racer(race,who).finishEvent;if(!event)return null;
        const age=Math.max(0,elapsed-event.time),speed=event.speed,runout=finishRunout(race,who);
        const duration=2*runout/Math.max(1,speed),u=clamp(age/duration,0,1);
        const travelled=speed*duration*(u-u*u*u+.5*u*u*u*u);
        return {age,duration,distance:COURSES[race.courseId].length+travelled,
            velocity:speed*(1-smooth(u)),wheelTurns:event.wheelTurns+travelled*WORLD_SCALE/(Math.PI*2*WHEEL_RADIUS),landed:u>=1};
    }
    function clonePresentationRace(race){
        const copy=JSON.parse(JSON.stringify(race));copy.events=[];
        for(const who of ['player','rival'])if(copy[who].service)copy[who].service=copy[who].serviceStates.find(s=>s.id===copy[who].service.id);
        return copy;
    }
    function presentFinishers(race){
        for(const who of ['player','rival']){const arrival=finishArrival(race,who);if(arrival)Object.assign(race[who],{distance:arrival.distance,velocity:arrival.velocity,wheelTurns:arrival.wheelTurns,targetVelocity:0});}
        return race;
    }
    function createFinishPresentation(race){
        if(race.phase!=='complete')throw new RangeError('The finish festival needs a completed race');
        const copy=clonePresentationRace(race);copy.phase='racing';
        if(copy.rival.finishTime===null){copy.rival.velocity=race.finishMotion.rivalVelocity;copy.rival.targetVelocity=race.finishMotion.rivalTarget;}
        return {race:presentFinishers(copy),elapsed:0,results:false,stage:'arrival',_remainder:0};
    }
    function stepFinishPresentation(p,dt){
        if(!Number.isFinite(dt)||dt<=0)return false;
        p.elapsed+=dt;p._remainder+=dt;
        const ticks=Math.floor((p._remainder+EPS)/STEP);p._remainder-=ticks*STEP;
        for(let i=0;i<ticks;i++){
            const r=p.race;
            if(r.rival.finishTime===null){updateRivalIntentions(r);move(r,r.rival,STEP);}
            r.elapsed+=STEP;r.events.length=0;
        }
        presentFinishers(p.race);
        p.stage=p.elapsed<4.5-EPS?'arrival':p.elapsed<7-EPS?'award':'thanks';
        if(p.elapsed>=9-EPS)p.results=true;
        return true;
    }
    function skipFinishPresentation(p){if(p.results)return false;p.results=true;p.skipped=true;return true;}
    function getPresentationRace(race){
        return race.player.finishEvent||race.rival.finishEvent?presentFinishers(clonePresentationRace(race)):race;
    }
    function getView(race){
        const course=COURSES[race.courseId],v=race.player,service=v.service,nextService=v.serviceStates.find(s=>!s.completed),terrain=activeTerrain(race,v);
        let nextTask=nextService?{kind:'service',type:nextService.type,id:nextService.id,at:nextService.at,index:nextService.index}:null;
        const terrainKey=type=>`race.${getCharacter(race,v).vehicleType==='air'?'flight.':''}terrain.${type}`;
        const landmark=getTravelSections(race,v).find(s=>NARRATION[terrainKey(s.type)]&&!v.terrainStates.find(t=>t.id===s.id)?.completed);
        if(!service&&landmark&&(!nextTask||landmark.start<nextTask.at))nextTask={kind:'terrain',...landmark,at:landmark.start};
        const completeKey=`race.complete.${race.winner==='player'?'win':race.winner==='tie'?'tie':'lose'}`;
        const key=race.phase==='complete'?completeKey:race.phase==='countdown'?(race.countdown>START_COUNTDOWN/2?'race.ready':'race.steady'):
            service?taskKey(service,race,v):nextTask?.kind==='terrain'?terrainKey(nextTask.type):
            nextService?.type.startsWith('passenger-')||nextService?.type.startsWith('cargo-')?`race.${getCharacter(race,v).vehicleType==='air'?'flight.':''}delivery.${race.deliveryTheme}`:nextService?taskKey(nextService,race,v):'race.cruise';
        const opponent=character(race.opponentId),player=character(race.playerId);
        return {course,player,opponent,winnerId:race.winner==='player'?race.playerId:race.winner==='rival'?race.opponentId:null,opponentName:opponent.name,deliveryTheme:race.deliveryTheme,phase:race.phase,
            services:race.services,serviceStates:v.serviceStates,currentService:service,nextTask,nextService,
            nextServiceKey:nextService?taskKey(nextService,race,v):null,
            helpEnabled:Boolean(service&&service.phase==='ready'&&service.type!=='animals'),
            carried:v.carried,mudPatches:v.mudPatches,dirt:v.dirt,terrain,inactivityHintKey:service?.hinted?taskKey(service,race,v):null,
            taskKey:key,instructionKey:key,taskText:NARRATION[key],completed:v.serviceStates.filter(s=>s.completed).length,total:race.services.length,
            progress:clamp(v.distance/course.length,0,1),rivalProgress:clamp(race.rival.distance/course.length,0,1),
            position:v.distance+EPS>=race.rival.distance?1:2,gap:v.distance-race.rival.distance,
            canSpeedUp:canSpeedUp(race),
            countdown:race.countdown,mph:v.velocity/SPEEDS[4]*100,winner:race.winner,elapsed:race.elapsed,
            guidancePhase:service?'service':'preview',safeMaxMph:terrain?sectionSpeedLimit(terrain)/SPEED_UNIT:MAX_SPEED_PERCENT};
    }
    globalThis.ThomasRaceCore=Object.freeze({CRUISE_SPEED,COURSE_SCALE,courseDistance,SPEEDS,ACCELERATION,BRAKING,WORLD_SCALE,WHEEL_RADIUS,START_COUNTDOWN,LOOK_AHEAD,
        LANE_OFFSETS,ROAD_LANE,ROAD_LANE_SPACING,RIVAL_LANE:ROAD_LANE,COACH_OFFSET,NEW_JOBS,JOB_DISTANCES,
        RIVAL_PARAMETERS,CARGO_HANDLING_SECONDS,BRANCH_LIFT_SECONDS,getBranchLiftSeconds,getBranchLiftPose,CHARACTERS,OPPONENTS,character,getCharacter,COURSES,RULES,NARRATION,chooseRace,createRace,serviceAction,cleanMud,whistle,step,getView,adjustSpeed,
        finishRunout,finishArrival,createFinishPresentation,stepFinishPresentation,skipFinishPresentation,getPresentationRace,
        sampleRoute,sampleTerrainHeight,sampleLaneRoute,sampleRivalLaneRoute,sampleVehicleRoute,sampleCoachRoute,getCoachOffset,getFlightPose,getTravelSections,getCrossingMode});
})();

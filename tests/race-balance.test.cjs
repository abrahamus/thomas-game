'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict');
const{availableParallelism}=require('node:os');
const{Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');require('../scripts/race-model.js');const R=global.ThomasRaceCore,{drive}=require('./helpers/race-driver.cjs');
function runPair(courseId,playerId,opponentId){const wins={defaultSpeed:0,ordinary:0,slower:0,all:0},computerWins={defaultSpeed:0,ordinary:0,slower:0,all:0},ties={defaultSpeed:0,ordinary:0,slower:0,all:0},times={defaultSpeed:[],ordinary:[],slower:[],all:[]},margins=[],handlingSeconds=[];
    for(let sample=0;sample<25;sample++){const reaction=.75+sample/24*.75,common={courseId,playerId,opponentId,seed:sample*997+41,reaction},ordinary={...common,washSeconds:10+sample/24*10},races={defaultSpeed:drive(R,ordinary),ordinary:drive(R,{...ordinary,topSpeed:true}),slower:drive(R,{...common,washSeconds:25,topSpeed:true}),all:drive(R,{...common,reaction:.35,washSeconds:10,topSpeed:true})};
        for(const[kind,r]of Object.entries(races)){wins[kind]+=r.winner==='player';computerWins[kind]+=r.winner==='rival';ties[kind]+=r.winner==='tie';times[kind].push(r.elapsed+R.START_COUNTDOWN);assert.equal(r.player.serviceStates.filter(s=>s.completed).length,8,'All mandatory jobs completed');assert.equal(r.player.dirt,0);assert.equal(r.player.carried.passengers,0);assert.equal(r.player.carried.container,null);assert.deepEqual(JSON.parse(JSON.stringify(r.profile)),JSON.parse(JSON.stringify(races.ordinary.profile)),'NoresponsiveAI');assert.equal(r.events.filter(e=>e.type==='complete').length,1);}
        margins.push(races.ordinary.player.distance-races.ordinary.rival.distance);handlingSeconds.push(races.ordinary.player.serviceStates.filter(s=>s.cargoHandling).length*R.CARGO_HANDLING_SECONDS*2+(races.ordinary.services.some(s=>s.type==='tree')?R.getBranchLiftSeconds(races.ordinary)-5:0));
    }
    return{wins,computerWins,ties,minSeconds:Object.fromEntries(Object.entries(times).map(([k,v])=>[k,Math.min(...v)])),maxSeconds:Object.fromEntries(Object.entries(times).map(([k,v])=>[k,Math.max(...v)])),minOrdinaryLead:Math.min(...margins),minOrdinaryBaseSeconds:Math.min(...times.ordinary.map((seconds,i)=>seconds-handlingSeconds[i])),maxOrdinaryBaseSeconds:Math.max(...times.ordinary.map((seconds,i)=>seconds-handlingSeconds[i]))};
}
if(!isMainThread&&workerData?.balancePair){try{parentPort.postMessage({result:runPair(workerData.courseId,workerData.playerId,workerData.opponentId)});}catch(error){parentPort.postMessage({error:error.stack||String(error)});}}
else test('Delivery races:90 ordered pairs × 3 courses × 25 seeds × 4 strategies (27,000 rounds)',{concurrency:Math.min(8,availableParallelism())},async t=>{
    let ordinaryWins=0,ordinaryComputerWins=0,ordinaryTies=0,defaultWins=0,defaultComputerWins=0,defaultTies=0,fastWins=0,slowerWins=0;
    const total=R.CHARACTERS.length*(R.CHARACTERS.length-1)*Object.keys(R.COURSES).length*25;
    await Promise.all(Object.keys(R.COURSES).flatMap(courseId=>R.CHARACTERS.flatMap(player=>R.CHARACTERS.filter(o=>o.id!==player.id).map(opponent=>t.test(`${courseId}/${player.id}/${opponent.id}:ordinary jobs, slow washing, and fast play`,async t=>{
        const result=await new Promise((resolve,reject)=>{const w=new Worker(__filename,{workerData:{balancePair:true,courseId,playerId:player.id,opponentId:opponent.id}});w.once('message',m=>m.error?reject(new Error(m.error)):resolve(m.result));w.once('error',reject);w.once('exit',code=>{if(code)reject(new Error(`Workerexit${code}`));});});
        ordinaryWins+=result.wins.ordinary;
        ordinaryComputerWins+=result.computerWins.ordinary;
        ordinaryTies+=result.ties.ordinary;
        defaultWins+=result.wins.defaultSpeed;
        defaultComputerWins+=result.computerWins.defaultSpeed;
        defaultTies+=result.ties.defaultSpeed;
        fastWins+=result.wins.all;
        slowerWins+=result.wins.slower;
        t.diagnostic(JSON.stringify(result));
        assert.ok(result.wins.ordinary>=result.wins.defaultSpeed,'Raising the speed cannot reduce wins');
        assert.ok(result.wins.slower<=result.wins.ordinary,'Slower washing cannot help the player win');
        assert.ok(result.wins.all>result.wins.ordinary&&result.wins.all>=22,'Fast play is rewarded with more wins');
        assert.ok(result.minOrdinaryBaseSeconds>=280&&result.maxOrdinaryBaseSeconds<=385,'Ordinary rounds include the longer finish straight and exclude cargo-handling and branch-lift allowances');
    })))));
    t.diagnostic(`Ordinary at 100%: player ${defaultWins}, computer ${defaultComputerWins}, ties ${defaultTies} (${total} races)`);
    t.diagnostic(`Ordinary at 150%: player ${ordinaryWins}, computer ${ordinaryComputerWins}, ties ${ordinaryTies} (${total} races)`);
    t.diagnostic(`Player wins by strategy: fast ${fastWins}, ordinary ${ordinaryWins}, slower washing ${slowerWins}`);
    assert.equal(ordinaryWins+ordinaryComputerWins+ordinaryTies,total);
    assert.equal(defaultWins+defaultComputerWins+defaultTies,total);
    assert.ok(ordinaryWins>defaultWins);
    assert.ok(fastWins>ordinaryWins&&ordinaryWins>slowerWins,'Faster play improves overall race results');
});

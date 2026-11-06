'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
require('../scripts/race-model.js');
const R=global.ThomasRaceCore,{drive,accelerateTo}=require('./helpers/race-driver.cjs');
const baseline=require('./fixtures/race-pacing-825.json');

test('every character reaches 1,000 cruise in 5.5 seconds and visibly covers more ground',()=>{
    for(const character of R.CHARACTERS){
        const r=R.createRace({playerId:character.id,opponentId:character.id==='thomas'?'percy':'thomas'});
        R.step(r,R.START_COUNTDOWN);
        accelerateTo(R,r,100);
        R.step(r,5.5);
        assert.ok(Math.abs(r.player.velocity-1000)<1e-7,character.id);
        const before=R.sampleVehicleRoute(r,'player');
        R.step(r,1);
        const after=R.sampleVehicleRoute(r,'player');
        assert.ok(Math.abs(Math.hypot(after.x-before.x,after.z-before.z)-8)<1e-7,'world scale is unchanged: cruise visibly covers eight world units per second');
        assert.equal(r.rival.targetVelocity,1500);
        for(let i=0;i<2;i++)assert.equal(R.adjustSpeed(r,1),true);
        R.step(r,2.75);
        assert.ok(Math.abs(r.player.velocity-1500)<1e-7,'manual top speed reaches 1,500');
    }
});

test('the finish straight stays open to speed control across characters and delivery types',t=>{
    let normalWins=0,topWins=0,totalGain=0;
    for(const reference of baseline.samples){
        const normal=drive(R,reference.options);
        const top=drive(R,{...reference.options,topSpeed:true,observe(race){
            if(race.player.serviceStates.at(-1).completed)assert.equal(race.player.speedPercent,150);
        }});
        const label=Object.values(reference.options).join('/');
        assert.deepEqual(top.services.map(s=>s.type),reference.jobs,'the same seed still chooses the same eight jobs');
        assert.equal(top.player.serviceStates.filter(s=>s.completed).length,8);
        assert.equal(top.player.distance,242000);
        const delta=top.elapsed+R.START_COUNTDOWN-reference.seconds;
        assert.ok(delta>=6&&delta<=8,`${label}: duration changed by ${delta.toFixed(3)} seconds`);
        const gain=normal.elapsed-top.elapsed;
        assert.ok(gain>35&&gain<38,label);
        normalWins+=normal.winner==='player';
        topWins+=top.winner==='player';
        totalGain+=gain;
    }
    assert.ok(topWins>normalWins);
    t.diagnostic(`${baseline.samples.length} paired races: ${normalWins} wins at 100%, ${topWins} at 150%. Average time saved: ${(totalGain/baseline.samples.length).toFixed(1)} seconds.`);
});

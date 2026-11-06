'use strict';
/* Drive with the same Up and job actions as a player. */
function accelerateTo(R,race,percent){
    while(race.player.speedPercent<percent&&R.adjustSpeed(race,1)){}
}
function drive(R,{courseId='country',playerId='thomas',opponentId='percy',seed=1,deliveryTheme,reaction=1.1,washSeconds=14,dt=.1,observe=null,noInput=false,topSpeed=false}={}){
    const race=R.createRace({courseId,playerId,opponentId,seed,...(deliveryTheme?{deliveryTheme}:{})});
    let serviceToken=null,serviceAt=Infinity,frames=0;
    while(race.phase!=='complete'&&frames++<Math.max(20000,Math.ceil(1000/dt))){
        const s=race.player.service;
        const token=s&&s.phase==='ready'?`${s.id}:${s.unitsDone}:${s.selectedContainer||''}`:null;
        if(token!==serviceToken){serviceToken=token;serviceAt=token?race.elapsed+(s.type==='wash'?washSeconds/7:reaction):Infinity;}
        if(!noInput&&token&&race.elapsed+1e-8>=serviceAt){
            if(s.type==='animals')R.whistle(race);
            else if(s.type==='wash')R.cleanMud(race,race.player.mudPatches.findIndex(Boolean));
            else R.serviceAction(race);
            serviceAt=Infinity;
        }
        accelerateTo(R,race,topSpeed?150:100);
        if(observe)observe(race,R.getView(race));
        R.step(race,dt);
        if(noInput&&race.elapsed>100)break;
    }
    if(!noInput&&race.phase!=='complete')throw new Error(`Race stalled: ${race.phase}, ${race.player.service?.type}/${race.player.service?.phase}`);
    return race;
}
module.exports={drive,accelerateTo};

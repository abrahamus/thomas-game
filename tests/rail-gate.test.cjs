const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../vendor/three-r170.js');
global.THREE = T;
require('../scripts/race-model.js');
const Core = global.ThomasRaceCore;
const View = require('../scripts/race-renderer.js');

function meshes(root, name) {
  const found = [];
  root.traverse(o => { if (o.name === name) found.push(o); });
  return found;
}

// Inspect real mesh vertices in the service's frame, including gate rotations.
function localBounds(object, frame) {
  const box = new T.Box3();
  object.traverse(o => {
    if (!o.geometry) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const point = new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      box.expandByPoint(frame.worldToLocal(point));
    }
  });
  return box;
}

function fixture(opponent = 'percy', course = 'country') {
  const race = Core.createRace({ courseId: course, opponentId: opponent, seed: 24 });
  race.phase = 'racing';
  race.countdown = 0;
  const spec = race.services.find(s => s.type === 'animals');
  for (const who of ['player', 'rival']) {
    const v = race[who], s = v.serviceStates.find(s => s.id === spec.id);
    v.distance = s.at;
    v.velocity = 0;
    v.service = s;
    s.phase = 'ready';
    for (const previous of v.serviceStates.filter(job => job.at < s.at)) {
      previous.phase = 'complete';
      previous.completed = true;
    }
  }
  const scene = View.makeScene(Core, course, opponent, race.deliveryTheme, race);
  View.updateScene(scene, race);
  return { race, scene, spec, slots: scene.objects.services.find(s => s.spec.id === spec.id).slots };
}

test('cleared sheep gates leave the entire train and road corridor unobstructed', () => {
  for (const opponent of ['percy', 'james', 'bertie']) {
    const { race, scene, slots } = fixture(opponent);
    for (const who of ['player', 'rival']) {
      race[who].service.phase = 'complete';
      race[who].service.completed = true;
      race[who].service = null;
    }
    View.updateScene(scene, race);
    for (const slot of slots) {
      const gate = localBounds(slot.gate, slot.group);
      assert.ok(gate.min.x > (slot.road ? 2.9 : 1.8), `${opponent}/${slot.who}: open gate still crosses the route at x=${gate.min.x}`);
    }
    View.disposeScene(scene);
  }
});

test('sheep gates swing progressively around a fixed hinge before the train restarts', () => {
  const { race, scene, slots } = fixture();
  const slot = slots[0], hinge = slot.gate.getWorldPosition(new T.Vector3());
  const closed = localBounds(slot.gate, slot.group);
  assert.ok(closed.min.x < -1.5 && closed.max.x > 1.5, 'closed gate must span the railway');
  assert.equal(Core.whistle(race), true);
  View.updateScene(scene, race);
  assert.ok(Math.abs(slot.gate.rotation.y) < 1e-8, 'starting work must not teleport the gate');
  Core.step(race, 1.2);
  View.updateScene(scene, race);
  assert.ok(Math.abs(slot.gate.rotation.y) < 1e-8, 'gate waits for the sheep to clear');
  for (const sheep of slot.animals) assert.ok(localBounds(sheep, slot.group).min.x > 3.35);
  Core.step(race, .1);
  View.updateScene(scene, race);
  assert.ok(slot.gate.rotation.y > 0 && slot.gate.rotation.y < Math.PI / 2, 'partway through its swing');
  assert.ok(slot.gate.getWorldPosition(new T.Vector3()).distanceTo(hinge) < 1e-8);
  const rotation = slot.gate.rotation.y;
  View.updateScene(scene, race, { paused: true });
  assert.equal(slot.gate.rotation.y, rotation);
  View.disposeScene(scene);
});

test('engines, tenders, coaches and buses pass the open sheep gate without mesh overlap', () => {
  for (const opponent of ['percy', 'james', 'bertie']) {
    const { race, scene, slots, spec } = fixture(opponent, 'mountain');
    Core.whistle(race);
    while (Math.min(race.player.distance, race.rival.distance) < spec.at + 3200) {
      while (Core.adjustSpeed(race, 1)) {}
      Core.step(race, .1);
      View.updateScene(scene, race);
      for (const slot of slots) {
        const state = race[slot.who];
        if (state.service?.type === 'animals') assert.equal(state.distance, spec.at, 'wait until sheep and gate are clear');
        const gate = localBounds(slot.gate, slot.group);
        for (const object of [scene[slot.who], scene[slot.who + 'Coach']]) {
          assert.equal(gate.intersectsBox(localBounds(object, slot.group)), false, `${opponent}/${slot.who}/${state.distance}: vehicle touches gate`);
        }
      }
      assert.ok(race.elapsed < 30, 'both racers must finish the animal stop and pass the gate');
    }
    View.disposeScene(scene);
  }
});

test('running rails have raised steel sides and heads above the wooden sleepers', () => {
  const scene = View.makeScene(Core, 'country', 'percy');
  const path = meshes(scene.world, 'railway-path')[0];
  const sleepers = meshes(path, 'continuous-sleepers')[0];
  const sleeperBox = new T.Box3().setFromObject(sleepers);
  for (const rail of meshes(path, 'running-rail')) {
    const box = new T.Box3().setFromObject(rail);
    assert.ok(box.max.y - box.min.y >= .04, 'rails need solid sides, not flat ribbons');
    assert.ok(box.max.y > sleeperBox.max.y + .15, 'steel heads must visibly stand above the timber');
    assert.ok(box.max.x - box.min.x >= .18, 'rail heads must remain legible at the game camera distance');
  }
  View.disposeScene(scene);
});

test('steel running surfaces support engine and coach wheels on flats, bends and hills', () => {
  const race = Core.createRace({ courseId: 'country', opponentId: 'james', seed: 24 });
  const scene = View.makeScene(Core, 'country', 'james', race.deliveryTheme, race);
  const rails = meshes(scene.world, 'running-rail');
  for (const distance of [3000, 55000, 82000, 105000, 164000]) {
    race.player.distance = race.rival.distance = distance;
    View.updateScene(scene, race);
    for (const vehicle of [scene.player, scene.rival, scene.playerCoach, scene.rivalCoach]) {
      for (const wheel of vehicle.userData.wheels) {
        // A rigid wheelset on a bend may touch toward an edge of its .13-wide
        // tread. Probe that real contact area, including the tender's parent.
        const gaps = [-.06, 0, .06].map(offset => {
          const contact = new T.Vector3(wheel.position.x + offset, 0, wheel.position.z);
          wheel.parent.localToWorld(contact);
          const ray = new T.Raycaster(contact.clone().add(new T.Vector3(0, 1, 0)), new T.Vector3(0, -1, 0), 0, 2);
          const hit = ray.intersectObjects(rails, false)[0];
          return hit ? Math.abs(hit.point.y - contact.y) : Infinity;
        });
        assert.ok(Math.min(...gaps) < .025, `${vehicle.name}/${distance}: wheel misses rail head by ${Math.min(...gaps)}`);
      }
    }
  }
  View.disposeScene(scene);
});

# Sodor railway challenge renderer

The editable renderer is `scripts/race-renderer.js`; its embedded copy in the standalone HTML is refreshed by `scripts/build-race-game.py`. The pinned Three.js r170 bundle and MIT license remain offline. Artwork uses procedural meshes and materials; no external textures, fonts, images, or models are requested during play.

Each course finishes at 242,000 units. The added straight extends the track, road and scenery beyond the old finish at 214,500 units. The model's `courseDistance` conversion keeps the existing job, terrain and elevation positions. The renderer uses the same conversion to place lakes, weather, hillside earth and fence clearances. Crossing and harbour structures still use their physical dimensions. Restrictions stay in effect until the whole vehicle clears the section. Audio and cargo sway use the shared cruising speed as their reference.

## Ten selectable characters

The shared model catalogue supplies identity, portrait, road/rail/air type, power and carriage spacing to both roles. Toby has wooden tram panels, skirts and cowcatchers; Spencer a silver streamlined nose and matching tender; Emily large driving wheels and brass detailing; Diesel a rectangular hood and grilles; Bulgy a double deck with two window rows. Existing Thomas, Percy, James and Bertie models remain. Harold adds a white fuselage, cockpit, cabin windows, red side markings, landing skids, a four-blade main rotor and tail rotor.

## Harold’s flight corridor

`getFlightPose` in the model supplies deterministic altitude, route offset, tilt, cargo parking and ground-shadow position. Flight sections use the shared seeded race state and include extra checkpoint distance, preserving comparable restricted travel without inventing a coach. The renderer adds open helipads, fuel and radio equipment, repair handcarts, a ground crane for rocks, a supporting sling for light branches and a harbour holding point. Two cloud banks replace the tunnel hoops. Ground crossings now extend one consistent railway or road underneath both racers, including Harold; his own control remains a radio with no ground barrier.

`makeFlightPayload` shows seated passenger heads behind cabin glazing and a smaller cargo container on a cable. Harold approaches the side cargo spot at the ordinary model speed, brakes to a stop, then lowers the load vertically for three seconds and moves onto the helipad over two seconds. The load stays fixed on the ground during work; pickup returns above it over two seconds, pays out the empty hook over one second, then lifts the load over two seconds before ordinary acceleration resumes. `cargo.hook` and `cargo.ropeVisible` keep hook motion separate from attachment, so the rope extends smoothly while the cargo remains grounded. Both racers receive equal five-second handling phases before and after the job. Flight drawing never remaps forward distance to squeeze travel into a brief animation, and heavy clearance actions keep Harold landed. Light branches use a separate twelve-second model path with slow approach, attachment, lift, carry, lowering, detachment and return; both racers receive that same work time. The hanging object stays directly below the aircraft while attached. Model-owned cargo-lowering/cargo-lifting phases freeze with pause and cannot be skipped by input. Hover-only waiting jobs retain the sling load. Working winch cables join Harold’s underside to the active object; fuel, cleaning and boarding animations use the same model timers as other racers. The rotor and slight hover motion freeze when the race clock is paused. A separate shadow group stays on the terrain below the helicopter.

A fixed camera adjustment gives flights extra vertical and horizontal room. `tests/harold-renderer.test.cjs` checks both roles and the complete aircraft, rotor and cargo envelopes at 320px, 375px, laptop and wide sizes. Shared target tests also cover Harold’s seven mud patches and every aviation job. `tests/harold-ui.test.cjs` completes six passenger/cargo races through keyboard and direct selection. Live browser verification remains required.

## Shared lakeside weather

`lakeGround`, `surfacePatch` and `makeLakeside` create a single irregular basin shared by the two corridors. The model’s gently depressed route stays continuous through it. Wet-course water is level and translucent, above sleepers and pavement but below rail heads. The mountain lake remains below the raised routes; thin irregular ice and tyre traces follow the road surface, with scattered snow at the edges. Road-wheel splashes, lake ripples, slanting rain, windblown snow and windsocks are driven only by `race.elapsed`. Weather clouds are kept clear of the racers’ sight lines and cast no shadows. All generated materials and meshes remain offline.

`getBranchLiftPose` defines the gentle aircraft/load path. Ground crane hooks support heavy rocks, and repair packages stay on wheeled handcarts. A branch remains on the ground until the sling is attached, stays beneath Harold throughout its lift and lateral transport, and touches down before detachment. Pictures and slow Ana instructions distinguish those jobs.

## Railway work

Each race has eight service stops. Loading, delivery, animals, and washing are always present; four additional jobs vary with the race seed, including at least two of repairs, rocks, coal, and a road crossing. Water, branch clearance, and the harbour drawbridge remain available. Each selected racer performs equal-duration work independently on its own railway, road or flight corridor. Road repairs replace sleepers with potholes; road water service fills a depot tank; road vehicles refuel at a pump instead of loading coal. Either bus waits for a train when racing a bus or Harold, or waits at traffic lights on a shared road junction when racing a train. Road drawbridges carry pavement instead of rails.

The model owns job state, timers, loads, and terrain completion. The renderer reads that state to animate workers and sleepers, crane hooks and loads, coal scoops and filling bunkers, moving animals and gates, washing, water, and road crossings. James, Spencer and Emily fill their own tenders. Diesel supplies depot coal and water stores. Bertie and Bulgy refill their fuel tanks and supply depot water stores; pump controls, fuel gauges, hoses, task pictures and narration agree with those roles. Nothing is advanced by wall-clock time in the renderer.

`pick(clientX, clientY)` uses the current canvas rectangle and projected objects, with a minimum 44-pixel target diameter. It returns a dirty patch ID or service target ID only during a ready job. Completed units are excluded. Keyboard/large-picture controls use the same model action path. The new target IDs are `sleeper-0..2`, `rock-0..1`, `coal-0..2`, and `crossing`.

## Connected harbour channel

`makeHarbourCorridor` creates one long, level river beneath both routes. `makeDrawbridge` builds a bridge for each corridor, including a paved harbour access bridge beneath Harold. The terrain is carved across the whole channel, with denser ground vertices around its banks; trees, hills and fences leave it clear. The harbour course shares the sea’s water level. River ends extend beyond the camera and fog.

Boats occupy separate outward lanes, so either racer can clear its own job independently. The model’s six-second wait still provides four seconds for the boat to pass and two for the bridge to lower. Boats continue moving while the deck lowers and follow the channel bends afterward. `tests/shared-harbour.test.cjs` checks continuity, exposed water, both bridge meshes, independent boat/deck clearance, pause and all four viewport sizes.

## Complete tunnels and crossing geometry

Each ground corridor has two complete hollow masonry tunnels. Harold’s flight corridor has cloud banks at those same two sections. Opaque cloud puffs hide the aircraft naturally and cast no obscuring shadows. The other terrain sections use hills and weather scenery, with no floating hoops. Both side walls and the curved roof are present, with stone arches around open entrance and exit portals. Opaque geometry hides engines, coaches, and loads progressively during passage; each part reappears naturally at the exit. No whole-train visibility toggles or artificial darkening are used. Tunnel structures cast no shadows onto approaching trains. The old cutaway shells and shared mountain arch are removed.

Each ground crossing has one continuous two-lane road extending beyond both racer corridors into the distance fog. Opposite traffic streams move outward from between the racers, so their jobs remain independent. Railway slots keep hinged barriers and a railway signal; the barriers stay down until the last coach clears. Road slots instead have a stop line and a three-lamp, two-direction traffic signal, turning green only after their five-second action completes. Harold’s slot has a nearby control tower and a directly selectable radio, with an orange utility helicopter visibly crossing ahead above his holding altitude. His cargo stays attached; there is no landing pad or ground traffic assigned to the air checkpoint. All three versions use the same five-second model action.

Rock and branch cranes use a fixed-length timber jib, pulley carriage and winding drum. A reusable woven tube mesh bends slightly when unloaded and becomes taut when supporting a load. Rock cradles and two-point branch loops attach before lifting and release after touchdown. Hooks lower, lift vertically, swing around the mast, lower the load, and retract continuously. Geometry and motion are derived from existing job progress, with unchanged action counts, work durations and rewards. Container-delivery cranes use a fixed metal jib and sliding trolley with flexible steel cable. A four-corner spreader locks onto the container roof before lifting, keeps the load level during the transfer, then unlocks after touchdown and rises empty. The fixed parking anchor matches each character’s actual coach or road trailer, so neither the delivered container nor the finished crane follows a departing racer. The five-second service duration remains unchanged. Harold’s existing winch and light-branch flight keep their separate behaviour.

The original train models, wheel/rod motion, independent coach sampling, couplings, and stable three-quarter camera remain. Sustained hills rise eight world units with a separate plateau/descent. The passenger coach and container wagon have no postal emblems or catcher hardware.

Very wide, short canvases ease into closer camera framing so vehicles remain readable in phone landscape. The camera position stays stable. Full-body, rotor, load, target and award checks cover the closer view, including Harold's tail while flying over terrain.

`full-scene-browser-portrait.jpg`, `full-scene-browser-landscape.jpg` and `full-scene-browser-desktop.jpg` show the current bottom-control layout in live WebGL. The published game was temporarily patched with the source CSS, markup and relevant UI functions for inspection; no deployment was made. The blue toolbar and cream dashboard are removed at every size. The entire scene area belongs to the canvas; the contextual job, vehicle signal, Pause and Home are below it. Layout checks covered 320×560, 393×640, 696×294, 844×320 and 1366×768 with no page overflow, and confirmed reachable controls and working menu transitions. The older `mobile-browser-*.jpg` files are historical captures from the phone-only dashboard removal. These browser captures are distinct from the CPU geometry previews below. Local-file browser navigation and physical iPhone browser-chrome checks remain outstanding.

Running rails now use a solid swept steel profile, from a foot resting on the sleepers to a raised web and bright head at 0.30 world units. The same profile is used on the drawbridge and crossing. Vehicle wheel contact follows that height, and Each tender samples the route independently. Sheep gates open only after the sheep have cleared: a smooth quarter-turn away from the waiting vehicle puts the leaf parallel to the verge before driving resumes. The open gate stays clear for the entire train and for either road racer.

## Finish festival

`makeFestival` adds a station party, harbour boats or a snowy gathering beside the routes. `updateFestival` animates people, chequered flags, ribbons, gold trophies, silver rosettes and a finite character-colour confetti burst using the race/presentation clock. Props cast no large shadows across vehicles. Trophy stands are fixed beside the final stopping positions; crowds remain outside the corridors. The harbour quay connects to the continuous course water. Routes and supporting ground continue beyond the ceremony, and Harold’s finish helipad is beyond the banner.

`tests/festival-renderer.test.cjs` checks the actual visible meshes, faces, awards, coach clearance and pause behaviour for all ten characters in both roles at 320, 375, laptop and wide viewport sizes. `tests/finish-festival.test.cjs` covers independent presentation, unchanged results, crossing speed, braking, landing, stage timing and continued seeded AI. `tests/festival-ui.test.cjs` covers result delay, Skip, both final actions, saved Random preferences, focus/pause/mute, signals and once-only rewards.

## Rewards

 The left card previews only required jobs, followed by the finish flag; terrain guidance remains spoken. Eight completion pictures appear in the finish festival, not the racing dashboard. No frame-based reward logic lives in the renderer.

## Verification and current previews

Large decorative hills and mountains near the eight job stops now sit behind both routes. Their placement reserves the fixed camera's approach and working sightlines when the scene is built, rather than removing scenery as a racer arrives. `tests/station-sightlines.test.cjs` reproduces the previously obscured mountain water/coal stops with train, bus and helicopter players in portrait, landscape and desktop views, including approaches and work animation stages. The shared harbour tests also verify that a waiting player's boat and raised bridge remain stationary until activation while the rival proceeds independently. The raised bridge is directly selectable as well as usable through Enter or the Bridge picture.

`tests/character-renderer.test.cjs` covers all ten models in either role, actual wheel contact and coupled drawbars on bends/slopes, passenger/cargo tunnel fit and gate passage, reachable and unoccluded wash targets at four viewport sizes, and independent crossing traffic in both mixed-route orders and both bus pairings. `tests/character-ui.test.cjs` completes passenger and cargo races with every player character and checks every possible computer winner. These are geometry and DOM simulations, not a live layout or animation check.

`tests/lakeside-services.test.cjs` checks water depth, exposed rail heads, thin ice, weather pause/visibility, crane support, grounded handcarts, sling attachment and clearance, and equal branch timing.

`tests/race-renderer.test.cjs` checks wheel/rail contact, loads and cranes, all direct targets, dirt visibility, tunnel occlusion against actual world meshes, train materials, crossing pivots and full clearance, visible coal growth, water levels, and drawbridge rail gaps. Narrow (320/375), laptop, and wide viewports are covered. Model, race-only shell, adapter, voice, and balance suites run separately.

`tests/rail-gate.test.cjs` reproduces the former gate clipping and flat-rail defects, checks the complete gate swing and vehicle passage against actual mesh bounds, and ray-tests wheel contact on flats, bends, climbs, and descents.

The PNGs below are **isolated CPU geometry previews** produced from the actual Three.js meshes. They do not execute the HTML or WebGL and do not verify real browser shadows, lighting, motion, input, or frame rate. Browser policy blocked the local HTML preview; a live visual pass remains required.

- `festival-country.png`, `festival-harbour-phone.png`, `festival-mountain-second.png`, `festival-tie-narrow.png`: country trophy, harbour/Harold arrival, mountain second place and shared first place. These are geometry previews, not live WebGL acceptance.
- `shared-river-bridges.png`, `shared-river-phone.png`, `shared-river-hillside.png`: continuous channel, both moving bridges, harbour sea level, and the cut through elevated terrain.
- `lakeside-flood.png`, `lakeside-ice.png`, `harold-light-branch.png`, `harold-ground-rocks.png`, `harold-repair-crew.png`: shared lake, surface flooding/ice, flight weather, and physically supported obstacle handling.
- `harold-intermediate-winch.png`, `bertie-fuel-pump.png`: vertical cargo winching and road refuelling. The winch preview now shows stationary, model-timed unloading.
- `harold-cloud-passage.png`, `shared-rail-crossing.png`, `shared-road-crossing.png`: clouds paired with a bus tunnel and continuous crossings using one transport mode.
- `harold-cargo.png`, `harold-passengers-flying.png`, `harold-rocks.png`: CPU previews of sling cargo, cabin passengers and hovering winch work.
- `toby-nine.png`, `spencer-nine.png`, `emily-nine.png`, `diesel-nine.png`, `bulgy-crossing-nine.png`: current CPU previews of the five new playable models and two independent road crossings.
- `tunnel-complete-preview.png`, `tunnel-exit-narrow.png`: complete tunnels hiding trains during passage and revealing them at the exit.
- `raised-rails-preview.png`, `sheep-gate-closed.png`, `sheep-gate-opening.png`, `sheep-gate-open.png`, `sheep-gate-narrow.png`: raised rail profiles and closed, swinging, and fully clear animal gates.
- `bertie-crossing-preview.png`, `bertie-water-preview.png`, `bertie-repairs-preview.png`: road equivalents of the shared jobs.
- `new-jobs-contact-sheet.png`: repairs, rock clearance, filled coal, and closing road barriers.
- `repairs-preview.png`, `rocks-preview.png`, `coal-preview.png`, `level-crossing-preview.png`: individual new jobs.
- `passenger-load-preview.png`, `cargo-load-preview.png`: preserved delivery interactions without mail hardware.

Other PNGs in this folder are historical previews from earlier versions; they are not embedded in the game and do not represent the current release.

```sh
node scripts/render-race-preview.cjs mountain james 35700 /private/tmp/tunnel.png 1400 800 '' '' cargo
node scripts/render-race-preview.cjs country james 94700 /private/tmp/crossing.png 1200 700 '' service-working passengers 1 .85
node scripts/render-race-preview.cjs country james 143000 /private/tmp/coal.png 1200 700 '' service-complete passengers 1
node scripts/render-race-preview.cjs country percy 175500 /private/tmp/festival.png 1366 768 '' festival-win passengers 24 6 thomas
node --test tests/race-renderer.test.cjs tests/festival-renderer.test.cjs
```

Preview arguments are course, rival, distance, output, width, height, an unused legacy slot, effect, delivery theme, seed, optional working progress (0–1), and optional player character ID (defaults to Thomas). Effects include `service-ready`, `service-working`, and `service-complete`. For `festival-win`, `festival-lose` or `festival-tie`, the working-progress argument instead specifies elapsed celebration seconds (for example `6`). Preview setup deliberately creates a diagnostic pose; it is not a gameplay driver.

`tests/cloud-crossing.test.cjs` checks the two cloud/tunnel pairs for both buses in both roles on all courses, actual cloud occlusion at four viewport sizes, continuous crossing surfaces, and mode/instruction agreement across all 90 ordered pairings. Crossing collision tests include Harold in either role.

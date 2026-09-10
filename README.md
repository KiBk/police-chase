# Police Chase — County Lines

A standalone procedural driving game derived from Suspension Lab.
Public site: https://police-chase.apps.kibk.net/

Choose one of ten imported cars. Accelerate, brake and steer along a narrow,
6.4 m two-way road with right-hand traffic. One marked patrol follows, with
flashing roof lights and an optional two-tone siren. A raised chase camera,
vertical patrol proximity indicator and small route map keep the next decision visible.
The orange dot marks you; the blue patrol dot rises towards it as the gap closes.

The road is generated continuously from a new random seed each run: smooth
bends, gentle hills, village junctions, traffic lights, hedges and fields.
Red lights stop ordinary traffic and release crossing vehicles. The rough verge
has less tyre grip and greater rolling resistance. Cones, orange barriers and
hay bales can be pushed aside. Trees, roadside posts, speed signs and traffic
lights detach and topple after a hit. Clean close passes add points; hard traffic hits
damage the car.

## Play

- Arrow keys or WASD: accelerate, brake/reverse, steer.
- Space: brake/reverse. P or Esc: pause. R: return to the garage on a new road.
- Touch controls support simultaneous steering and throttle/braking.
- Start gives a three-second countdown. Select cars in the garage with arrows.
- Stay over 160 m from the patrol for five seconds to escape.
- Stay below 4 m/s within 8 m of the patrol for three seconds to be caught.
- Four seconds overturned, or 100% damage, also ends the chase.
- Best forward distance stays in localStorage. No accounts or backend state.

## Run and check

Requires Node.js, npm and Python 3. Dependencies are pinned in package-lock.json.

```sh
npm ci
make check
make serve
```

Open http://localhost:8098/. All runtime assets are bundled locally, including
recorded audio. Modern WebGL 2 and WebAssembly support are required.

The checks cover deterministic/continuous road generation, road contact and
rebasing, two-way traffic and signals, movable blockers, capture/escape,
police overshoots, long driving runs, camera continuity, steering authority,
slide recovery, fast off-centre prop and traffic impacts, and the inherited
suspension's mass, elastic recovery, travel limits and model picking.

## Architecture and limits

`src/chase.js` owns game state, streamed actors, pursuit and collision scoring.
`src/route.js` maps any world coordinate to a seeded route without retaining an
unbounded map. Thirteen scenery chunks surround the car; expired actors and
crossing schedules are removed. `src/chase-road.js` maintains nine nearby 20 m
Rapier heightfields. Both collision heights and road layout derive from the
same route. Surface triangles are sampled at 0.5 m for physical contact.

The player retains Suspension Lab's 240 Hz linked suspension, brush tyre model,
combined-slip limit, automatic powertrain and three-section elastic chassis.
Physics shifts its origin every ~60 m. Actor bodies, terrain, rendering and the
chase camera all follow that shift. The camera's world-space position is kept
continuous and its heading remains upright through rollovers.

For a driving view, hidden bolts and cutaway-only detail are omitted from the
player rendering; wheel positions, body deformation and the main suspension
links still follow physics. Traffic models share the imported geometry and
textures. All ten source models stay cached because they coexist in a chase.
Undamaged trees and posts use instanced rendering; a hit replaces just that
instance with a moving model driven by its released physics body.

Traffic and police are guided, lightweight collision bodies, not ten complete
suspension simulations. Contact with the player releases their guidance for a
short dynamic collision response. Nearby bodies become dynamic before contact,
so their first impact also uses finite mass. Traffic uses 35% of its nominal
vehicle mass; light scenery has reduced mass and friction. Anchored props remain
upright without gravity until a real hit, then fall under gravity. These are
deliberately forgiving game collision settings. The patrol uses a continuous pursuit heading,
brakes beside a stopped player, and turns back after overshooting. These AI
controllers are intentionally simpler than the player's physical drivetrain.

Steering keeps the original full lock available at every speed. Digital turn-in
is progressive, but reversing or releasing the steering responds faster. Mild
caster-like self-alignment starts only beyond normal cornering slip, is weaker
while a steering key is held, and switches off in the air, in reverse or during
a rollover. It adds no tyre grip, yaw forces or lane following. Brake-slip
feedback reduces wheel lock-up (a simple game ABS); no engine traction control
is added. See [handling notes](docs/handling.md) for research and validation.

The 6.4 m road and shoulders are drivable. Trees, posts and signs are breakable;
buildings and hedges remain decorative. Chassis stiffness,
vehicle specifications and tyre parameters are representative choices for
fictional designs. There are no pedestrians, permanent crash deformation,
measured real-car calibration, multiplayer services or tracking.

## Assets and provenance

The simulation and adapted cars were copied from private `KiBk/suspension-lab`
commit `9efab6b637d63cf542fe3ffa55852cc0ab91890d`. Suspension Lab is unchanged.

Cars: **Generic passenger car pack**, **Comrade1280**, CC BY 4.0.
See `assets/cars/LICENSE.txt` and the public `credits.html` for links and changes.
The new patrol markings and lights are procedural additions, not a real force's
livery. Audio source files, hashes and licences are retained under
`assets/source/audio/` and `assets/audio/`; only processed loops are published.
See `assets/audio/ATTRIBUTION.md`. Rebuild loops with
`python3 scripts/prepare-audio.py` (NumPy and ffmpeg required).
Three.js is MIT; Rapier is Apache 2.0. Their licences ship with the game.
Original game code remains private; included third-party assets retain their
individual licences.

## Publish

The repository is private. Publication uses the existing stateless Hebe app
workflow and contains only the `public/` build, without credentials or repo data.

```sh
make check
make login
make push IMAGE=registry.kibk.net/apps/police-chase:release-tag
make publish IMAGE=registry.kibk.net/apps/police-chase:release-tag
make verify
make logout
```

The publisher resolves the tag to an immutable image digest. `make verify`
compares every public file byte-for-byte with the local build and checks health.
Ignored `evidence/` stores local validation/deployment logs. Do not add registry
credentials, environment files, private keys or unrelated source downloads.

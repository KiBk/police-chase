# Arcade handling and encounter pacing

The chase should reward choosing a gap and making a quick move. The original
simulation required careful steering and recovery on a narrow road; this
revision preserves the visible suspension character while making those moves
predictable on a keyboard.

## Movement

`ArcadeDriver` treats left/right as a continuously moving target offset from
the road centre. It does not snap to lanes. Maximum lateral target speed is
6 m/s, reduced near a standstill, and the target stays within 8 m of the centre.
Releasing the key holds that offset while the route bends beneath the car.
Steering follows the requested heading; bounded planar velocity and yaw
corrections remove the need for repeated countersteering.

The same rigid correction is applied to every linked body, including the
translational velocity change caused by yaw at each body's offset. Relative
suspension motion is preserved. Vertical velocities and roll/pitch angular
velocities are not corrected. Assistance stops with fewer than two contacting
tyres or when the body is substantially tilted. Gravity and landing remain
physical. This direct velocity controller deliberately changes horizontal
momentum and should not be presented as realistic tyre-only vehicle dynamics.

The physical engine, automatic transmission and ABS remain. A small forward
boost helps cars get moving; a bounded correction softens speeds above 30 m/s
(108 km/h). Cars retain different mass, powertrain and suspension behavior, but
share the predictable across-road response. The camera follows the route's
heading so a lane change does not swing the entire view sideways.

## Road and traffic

Asphalt is 9.6 m wide, with approximately 4 m of gently graded shoulder on each
side. Grass blends to 91% grip and 1.18 times rolling resistance; small bumps
exercise suspension without making the verge an immediate spin or slowdown.
Posts, signs, signals and hedges are placed beyond the main usable shoulder.

Each seeded 320 m group chooses an overtaking, one-lane barrier, alternating
barrier, crossing or central hay-bale bypass encounter. The first encounter
is always a straightforward overtake. Entry and exit chunks contain no traffic
or blockers; obstacle groups leave either the other lane or both verges open.
Cross traffic is introduced only when the junction is 90–190 m ahead. This
provides at least three seconds of approach at the nominal maximum speed;
ordinary vehicles and moving debris can still change a gap after it is created.

## Mistakes and pursuit

Props and traffic retain finite, reduced collision mass. A hard traffic impact
adds at most 14 condition damage with a one-second scoring cooldown. After a
hard hit the patrol backs off briefly and capture is disabled for 2.5 seconds.
Condition recovers at 0.65 per second after seven seconds without a hard hit.

After 0.85 seconds of severe tilt, recovery restores the rested linked-body
pose at a nearby clear candidate offset, matches wheel rotation to a reduced
forward speed and grants three seconds of capture grace. Upside-down detection
uses the body's up vector, including a complete 180-degree inversion. Recovery
adds five condition damage, capped below a wreck on recovery itself.

The patrol starts 55 m behind and follows the same verges. Its target speed
tracks the player's speed with a small gap correction; it still slows for turns
and traffic. A stopped player can be caught. A 160 m gap held for five seconds
wins, without a hidden minimum chase duration. Encounters and mistakes decide
the duration; roughly two to three minutes is a playtest target, not a guaranteed
timer. Retry immediately creates a fresh seed and starts the countdown.

## Verification

Automated tests cover lane changes at 14 and 28 m/s in compact, hatchback,
sports and pickup models, settling after release, several seconds on grass
and returning to asphalt, airborne steering, fully inverted recovery, all five
encounter types, crossing visibility, and sustained grass driving through
physics-origin shifts. They check linked-body errors and retained suspension
motion as well as positions and speed. Existing suspension, contact, pursuit,
camera and breakable-object tests remain in the full suite.

Local deterministic replay logs in ignored `evidence/` also exercise repeated
traffic avoidance on three seeds. Browser checks cover rendering, retry and
runtime errors. These checks establish predictable control and stable physics;
the balance of challenge and excitement still depends on player feedback.

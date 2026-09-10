# Keyboard handling and forgiving contacts

Historical notes for the previous simulation-oriented assist. The chase now
uses the dedicated [arcade controller](arcade-handling.md); the finite-mass
collision approach below remains in use. `driver-assist.js` and its comparison
tests are retained as a record of the earlier handling experiments.

The first assist limited steering using a target lateral acceleration divided
by speed squared, then subtracted yaw-rate feedback. In an 80 km/h hatchback
test, this reduced actual peak steering from 0.38 rad to 0.033 rad and peak
lateral acceleration from about 0.99 g to 0.37 g. That suppressed the turn the
player was asking for. The earlier test checked stability but did not check
that steering authority was preserved.

## Research

- The author of [BeamNG Advanced Steering](https://github.com/adam10603/BeamNG-Advanced-Steering/blob/release/Explanation.md)
  describes two distinct ideas: controlling excessive front tyre slip and
  emulating caster self-alignment towards the direction of travel. The latter
  can help keyboard players catch oversteer without changing tyre grip.
- [Forza's driving-assist documentation](https://support.forzamotorsport.net/hc/en-us/articles/20964254277267-Forza-Motorsport-Accessibility-Support)
  describes Normal steering as retaining driver control with damping, and
  Simulation as removing damping and steering-speed assistance. This informed
  the distinction between input response and car physics; it is not a claim
  that this game reproduces Forza's implementation. The official search index
  was accessible on 2026-09-10; the article itself redirected to their new
  support domain.
- [Rapier's rigid-body documentation](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/)
  explains that kinematic bodies ignore contact forces. Changing their mass
  alone cannot soften their contacts; they must be dynamic when impact is
  solved.

## Chosen behavior

Retain full steering range. Slow only the initial rate slightly at speed; make
countersteering and release faster. Beyond about six degrees of body slip,
apply mild self-alignment, reduced while the driver holds a steering direction.
There is no yaw-rate cancellation, speed-dependent steering-angle cap, added
grip or artificial stabilizing force. Airborne and reversing cars receive no
self-alignment correction. ABS is retained independently.

Oriented proximity bounds with a short relative-motion margin make props and
cars movable before the solver sees a collision. Their first contact therefore
uses reduced finite mass. Prop motion comes from the impact, without scripted
upward impulses. Traffic guidance stays disengaged while the player is close,
preventing a second immovable hit or a guided teleport into the player.

## Validation

The original and revised hatchback moved 3.22 m and 3.18 m sideways in the first
second of the same full-steering test at 22 m/s; the previous assist moved only
1.16 m. Peak slip remained about eight degrees with the revision. In a separate
induced sports-car slide, both versions initially slid about 15 degrees; neutral
steering recovered below two degrees of slip and 0.1 rad/s yaw in approximately
0.74 s with the new correction versus 0.90 s without it.

Regression tests compare original and revised turn authority and countersteer
response, preserve the initial slide, and hit both sides of posts, signs, trees
and traffic at 30 m/s. They also cover the existing capture logic, streaming,
suspension constraints and braking. These deterministic checks bound known
regressions; driving feel still benefits from player feedback.

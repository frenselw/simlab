"""Replay the three P1 recipes with step halving and an independent integrator."""
import hashlib
import json
from pathlib import Path
from sys import argv

import numpy as np

from lunar_flyby import (
    CAPSULE_DRY, CAPSULE_FUEL, CAPSULE_ISP, CAPSULE_THRUST, DATA, DAY, EARTH,
    ENGINE_ISPS, HERE, MOON, MOON_RADIUS, Ephemeris,
    ascent, attraction, earth_fixed, earth_frame, encounter, inertial, parts, rk4, tidal,
    utc_time,
)


def check_model(table, catalogue):
    reference = json.loads((HERE / "lunar-ephemeris-reference.json").read_text())
    assert hashlib.sha256(DATA.read_bytes()).hexdigest() == reference["sha256"]
    assert reference["checks"]["moon"]["withheld"]["maxPositionM"] <= 500
    assert reference["checks"]["moon"]["withheld"]["maxSpeedMS"] <= .05
    assert np.array_equal(tidal(np.zeros(3), table.body(DAY, 0)[:3], MOON), np.zeros(3))
    impact_time = 37*DAY
    incoming = table.body(impact_time, 0) + np.array([MOON_RADIUS+20000, 0, 0, -500, 0, 0])
    for method in ("RK4", "DOP853"):
        assert encounter(table, catalogue, impact_time, 0, incoming, 120, method)["status"] == "moon impact"

    # A period of an unperturbed circular orbit provides an analytic integrator check.
    radius = 6571000
    state = np.array([radius, 0, 0, 0, np.sqrt(EARTH/radius), 0])
    period = 2*np.pi*np.sqrt(radius**3/EARTH)
    orbit = state
    for i in range(1000):
        orbit = rk4(lambda _, q: np.r_[q[3:], -attraction(q[:3], EARTH)],
                    i*period/1000, orbit, period/1000)
    assert np.linalg.norm(orbit[:3]-state[:3]) < .1

    frames = json.loads((HERE / "lunar-frame-reference.json").read_text())
    ground = np.r_[frames["ecefM"], [0, 0, 0]]
    errors = []
    for sample in frames["samples"]:
        frame = earth_frame(sample["t"])
        q = inertial(frame, ground)
        assert np.linalg.det(frame) > 0
        assert np.linalg.norm(earth_fixed(frame, q)-ground) < .001
        errors.append(q - sample["reference"])
        distant = np.array([380e6, 55e6, -20e6, 1100, 2200, 880])
        assert np.linalg.norm(earth_fixed(frame, inertial(frame, distant))-distant) < .001
    position = np.linalg.norm(np.array(errors)[:, :3], axis=1).max()
    velocity = np.linalg.norm(np.array(errors)[:, 3:], axis=1).max()
    assert position <= 350 and velocity <= .03
    return dict(maxPositionM=position, maxSpeedMS=velocity)


def replay(table, catalogue, recipe, method, divisor=1):
    launch = recipe["launchTdbSeconds"]
    t, q, staging = ascent(
        table, catalogue, launch, np.deg2rad(recipe["azimuthDegrees"]), recipe["isp"],
        recipe["upperFuelKg"], recipe["capsuleFuelKg"], method,
        .1/divisor if method == "RK4" else 2, recipe["pitchOffsetsDegrees"],
    )
    result = encounter(table, catalogue, launch, t, q, t+10*DAY, method, divisor)
    assert result["status"] == "flyby", result
    assert 3e6 <= result["nearest"]["altitudeM"] <= 1e7, result
    assert abs(result["exit"]["altitudeM"]-8e7) < .01
    assert result["exit"]["t"] > result["nearest"]["t"] > t
    result["staging"] = staging
    result["vacuumStart"] = dict(t=t, state=q.tolist())
    return result


def differences(a, b):
    errors = dict(
        nearestAltitudeM=abs(a["nearest"]["altitudeM"]-b["nearest"]["altitudeM"]),
        nearestTimeS=abs(a["nearest"]["t"]-b["nearest"]["t"]),
        exitSpeedMS=abs(a["exit"]["relativeSpeedMS"]-b["exit"]["relativeSpeedMS"]),
    )
    assert errors["nearestAltitudeM"] <= 1000, errors
    assert errors["nearestTimeS"] <= 1, errors
    assert errors["exitSpeedMS"] <= .1, errors
    return errors


def sensitivity(table, catalogue, recipe):
    """Hold all other commands fixed when shifting launch or the last cutoff."""
    launch, isp = recipe["launchTdbSeconds"], recipe["isp"]
    azimuth = np.deg2rad(recipe["azimuthDegrees"])
    upper, capsule = recipe["upperFuelKg"], recipe["capsuleFuelKg"]
    g0 = catalogue["g0"]
    probes = [("launch", shift) for shift in (-60, -30, 30, 60)]
    probes += [("cutoff", shift) for shift in (-1, -.5, .5, 1)]
    results = []
    for event, shift in probes:
        t0, upper_fuel, capsule_fuel = launch, upper, capsule
        if event == "launch":
            t0 += shift
        elif capsule < CAPSULE_FUEL:
            capsule_fuel -= shift*CAPSULE_THRUST/(CAPSULE_ISP*g0)
        else:
            upper_fuel -= shift*catalogue["upper"]["thrust"]/(isp*g0)
        t, q, _ = ascent(table, catalogue, t0, azimuth, isp, upper_fuel, capsule_fuel,
                         pitch_offsets=recipe["pitchOffsetsDegrees"])
        result = encounter(table, catalogue, t0, t, q, t+10*DAY, "DOP853")
        nearest = result["nearest"]
        results.append(dict(event=event, shiftS=shift, status=result["status"],
                            nearestAltitudeM=nearest["altitudeM"] if nearest else None))
    return results


def main():
    table, catalogue = Ephemeris(), parts()
    report = {"model": "P1 offline 3D ascent and flight, prescribed guidance",
              "frameReference": check_model(table, catalogue), "missions": []}
    recipes = json.loads(Path(__file__).with_name("lunar-flyby-recipes.json").read_text())
    assert tuple(recipe["isp"] for recipe in recipes) == ENGINE_ISPS
    for recipe in recipes:
        print(f"Replaying {recipe['isp']} s", flush=True)
        nominal = replay(table, catalogue, recipe, "RK4")
        fine = replay(table, catalogue, recipe, "RK4", 2)
        reference = replay(table, catalogue, recipe, "DOP853")
        fuel = recipe["capsuleFuelKg"]
        reserve = CAPSULE_ISP*catalogue["g0"]*np.log1p(fuel/CAPSULE_DRY)
        assert reserve >= 100
        report["missions"].append({
            **recipe,
            "launchUtc": utc_time(recipe["launchTdbSeconds"]),
            "capsuleReserveMS": reserve,
            "nominal": nominal,
            "stepHalving": differences(nominal, fine),
            "independentDOP853": differences(nominal, reference),
            "sensitivity": sensitivity(table, catalogue, recipe),
        })
    path = Path(argv[1]) if len(argv) > 1 else Path("output/reports/rocket-lunar-p1.json")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(path)


if __name__ == "__main__":
    main()

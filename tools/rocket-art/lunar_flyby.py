"""Offline P1 model. SI units, geocentric ICRF axes, TDB seconds from START_JD."""
import gzip
import json
from datetime import datetime, timedelta, timezone
from math import cos, sin, pi
from pathlib import Path
from subprocess import check_output

import numpy as np
from scipy.integrate import solve_ivp


HERE = Path(__file__).resolve().parent
DATA = HERE.parents[1] / "sim/rocket-side-booster-lab/assets/lunar-ephemeris.bin.gz"
START_JD, STEP, COUNT = 2461041.5, 21600, 1545
EPOCH = datetime(2026, 1, 1, tzinfo=timezone.utc)
DAY = 86400
EARTH, MOON, SUN = 3.986004418e14, 4.902800118e12, 1.32712440041279419e20
MOON_RADIUS, OMEGA = 1737400, 7.2921158553e-5
LAT, LON = 0.605629, -2.101376
CAPSULE_DRY, CAPSULE_FUEL, CAPSULE_THRUST, CAPSULE_ISP = 180, 30, 3000, 300
ENGINE_ISPS = (340, 370, 380)
PITCH_TIME = [0, 2.4, 10, 20, 30, 45, 60, 75, 90, 105, 120, 145, 180, 230, 306]
PITCH_ANGLE = [0, 8.1, 16.54, 21.5, 33.98, 52.43, 67.88, 74.41, 80.34, 81.78,
               86.91, 87.41, 88.41, 90.01, 89.41]


def parts():
    # Use the production part catalogue; upgrade only the proposed engine values.
    root = Path(__file__).resolve().parents[2]
    script = """
    const p=require('./sim/rocket-side-booster-lab/parts.js');
    const lower={engine:0,large:4,small:0},upper={engine:1,medium:1,small:1,large:0};
    console.log(JSON.stringify({
      radius:p.R,g0:p.G0,drag:p.CORE_DRAG_AREA,booster:p.BOOSTER,
      lower:{...p.ENGINES[0],dry:p.dry(lower),fuel:p.capacity(lower)},
      upper:{...p.ENGINES[1],dry:p.dry(upper),fuel:p.capacity(upper)}
    }));
    """
    return json.loads(check_output(["node", "-e", script], cwd=root))


class Ephemeris:
    def __init__(self, raw=None):
        if raw is None:
            raw = gzip.decompress(DATA.read_bytes())
        self.vectors = np.frombuffer(raw, dtype="<i4").reshape(2, COUNT, 6).astype(float)
        self.vectors[1, :, :3] *= 100
        self.vectors[:, :, 3:] /= 10000

    def body(self, t, index):
        if not 0 <= t <= (COUNT - 1) * STEP:
            raise ValueError("Outside the P1 ephemeris date range")
        i = min(int(t / STEP), COUNT - 2)
        u = t / STEP - i
        left, right = self.vectors[index, i:i+2]
        r0, v0 = left[:3], left[3:]
        r1, v1 = right[:3], right[3:]
        delta = r1 - r0
        position = r0 + u*u*(3-2*u)*delta + STEP*u*(1-u)*((1-u)*v0-u*v1)
        velocity = (6*u*(1-u)/STEP)*delta + (1-u)*(1-3*u)*v0 + u*(3*u-2)*v1
        return np.concatenate((position, velocity))


def tt_minus_tdb(tt_seconds):
    # Leading geocentric periodic terms. The 32.184 s TT offset is exact.
    anomaly = np.deg2rad(357.53 + 0.9856003 * (START_JD - 2451545 + tt_seconds / DAY))
    return -0.001657 * sin(anomaly) - 0.000022 * sin(2 * anomaly)


def utc_seconds(tdb):
    # TAI-UTC = 37 s across this data window.
    return tdb + tt_minus_tdb(tdb) - 69.184


def utc_time(tdb):
    return (EPOCH + timedelta(seconds=utc_seconds(tdb))).isoformat(timespec="milliseconds")


def rotate_z(angle):
    c, s = cos(angle), sin(angle)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def earth_frame(tdb):
    """ECEF to ICRF. Mean equator, IAU 1976 precession, GMST, UT1≈UTC."""
    ut_days = START_JD - 2451545 + utc_seconds(tdb) / DAY
    centuries = (START_JD - 2451545 + (tdb + tt_minus_tdb(tdb)) / DAY) / 36525
    arcsec = pi / (180 * 3600)
    zeta = arcsec * np.polynomial.polynomial.polyval(centuries, [0, 2306.2181, .30188, .017998])
    z = arcsec * np.polynomial.polynomial.polyval(centuries, [0, 2306.2181, 1.09468, .018203])
    theta = arcsec * np.polynomial.polynomial.polyval(centuries, [0, 2004.3109, -.42665, -.041833])
    tilt = np.array([[cos(theta), 0, -sin(theta)], [0, 1, 0], [sin(theta), 0, cos(theta)]])
    precession = rotate_z(z) @ tilt @ rotate_z(zeta)
    gmst = (280.46061837 + 360.98564736629*ut_days + .000387933*centuries**2
            - centuries**3/38710000)
    return precession.T @ rotate_z(np.deg2rad(gmst % 360))


def spin_velocity(pole, position):
    return OMEGA * np.cross(pole, position)


def inertial(frame, state):
    position = frame @ state[:3]
    return np.r_[position, frame @ state[3:] + spin_velocity(frame[:, 2], position)]


def earth_fixed(frame, state):
    return np.r_[frame.T @ state[:3],
                 frame.T @ (state[3:] - spin_velocity(frame[:, 2], state[:3]))]


def attraction(position, mu):
    return mu * position / np.linalg.norm(position)**3


def tidal(position, body, mu):
    return attraction(body - position, mu) - attraction(body, mu)


def gravity(table, t, position):
    return (-attraction(position, EARTH) + tidal(position, table.body(t, 0)[:3], MOON)
            + tidal(position, table.body(t, 1)[:3], SUN))


def atmosphere(height):
    fade = np.clip((height - 80000) / 40000, 0, 1)
    return 1.225 * np.exp(-max(height, 0)/8500) * (1 - fade*fade*(3-2*fade))


def rk4(derivative, time, state, step):
    a = derivative(time, state)
    b = derivative(time + step/2, state + a*step/2)
    c = derivative(time + step/2, state + b*step/2)
    d = derivative(time + step, state + c*step)
    return state + step/6*(a + 2*b + 2*c + d)


def advance(derivative, t0, t1, state, max_step, method):
    if method == "DOP853":
        solution = solve_ivp(derivative, (t0, t1), state, method=method,
                             rtol=2e-12, atol=1e-8, max_step=max_step)
        if not solution.success:
            raise ValueError(solution.message)
        return solution.y[:, -1]
    count = int(np.ceil((t1-t0)/max_step))
    step = (t1-t0)/count
    for index in range(count):
        state = rk4(derivative, t0 + step*index, state, step)
    return state


def ascent(table, catalogue, launch, azimuth, isp, upper_fuel, capsule_fuel,
           method="DOP853", powered_step=2, pitch_offsets=(0, 0)):
    """Search model: commanded pitch/bearing is followed directly; discarded stages are dropped."""
    radius, g0 = catalogue["radius"], catalogue["g0"]
    frame = earth_frame(launch)
    pole = frame[:, 2]
    up = np.array([cos(LAT)*cos(LON), cos(LAT)*sin(LON), sin(LAT)])
    east = np.array([-sin(LON), cos(LON), 0])
    north = np.cross(up, east)
    state = inertial(frame, np.r_[radius*up, np.zeros(3)])
    boost, lower, upper = (catalogue[k] for k in ("booster", "lower", "upper"))
    upper_dry = upper["dry"] + (0 if isp == upper["isp"] else 25)
    lower_flow = lower["thrust"]/(lower["isp"]*g0)
    upper_flow = upper["thrust"]/(isp*g0)
    boost_flow = 4*boost["thrust"]/(boost["isp"]*g0)
    drop = 4*boost["fuel"]/boost_flow
    stage = lower["fuel"]/lower_flow
    cutoff = stage + (upper["fuel"] - upper_fuel)/upper_flow
    stack = upper_dry + CAPSULE_DRY + CAPSULE_FUEL
    records = []
    if not 0 <= upper_fuel < upper["fuel"] or not 0 <= capsule_fuel <= CAPSULE_FUEL:
        raise ValueError("Unreachable commanded fuel reserve")

    for start, end, attached, first, name in (
        (0, drop, True, True, "booster jettison"),
        (drop, stage, False, True, "core separation"),
        (stage, cutoff, False, False, "upper cutoff"),
    ):
        thrust = lower["thrust"] if first else upper["thrust"]
        drag_area = catalogue["drag"] + (.35*4*pi*.65**2 if attached else 0)

        def derivative(t, q):
            position, velocity = q[:3], q[3:]
            r = np.linalg.norm(position)
            vertical = position/r
            local_east = np.cross(pole, vertical)
            local_east /= np.linalg.norm(local_east)
            forward = cos(azimuth)*np.cross(vertical, local_east) + sin(azimuth)*local_east
            offset = np.interp(t, [0, 60, 120, 230], [0, pitch_offsets[0], pitch_offsets[1], 0])
            pitch = np.deg2rad(np.interp(t, PITCH_TIME, PITCH_ANGLE) + offset)
            axis = cos(pitch)*vertical + sin(pitch)*forward
            mass = stack + upper["fuel"]
            if first:
                mass += lower["dry"] + 60 + max(0, lower["fuel"]-lower_flow*t)
            else:
                mass -= upper_flow*(t-stage)
            force = thrust
            if attached:
                force += 4*boost["thrust"]
                mass += 4*boost["dry"] + max(0, 4*boost["fuel"]-boost_flow*t)
            air = velocity - spin_velocity(pole, position)
            drag = .5*atmosphere(r-radius)*drag_area*np.linalg.norm(air)*air
            return np.r_[velocity, gravity(table, launch+t, position) + (force*axis-drag)/mass]

        # Split at each pitch knot so both integrators see the same piecewise-smooth input.
        knots = [start, *[t for t in PITCH_TIME if start < t < end], end]
        for left, right in zip(knots, knots[1:]):
            state = advance(derivative, left, right, state, powered_step, method)
            if np.linalg.norm(state[:3]) < radius:
                raise ValueError("Ascent hit the spherical Earth")
        records.append(dict(event=name, t=end,
                            altitudeM=np.linalg.norm(state[:3])-radius,
                            inertialSpeedMS=np.linalg.norm(state[3:])))

    # The capsule release is a physical gap and a 1 m/s relative spring impulse.
    vertical = state[:3]/np.linalg.norm(state[:3])
    local_east = np.cross(pole, vertical)
    local_east /= np.linalg.norm(local_east)
    forward = cos(azimuth)*np.cross(vertical, local_east) + sin(azimuth)*local_east
    offset = np.interp(cutoff, [0, 60, 120, 230], [0, *pitch_offsets, 0])
    pitch = np.deg2rad(np.interp(cutoff, PITCH_TIME, PITCH_ANGLE) + offset)
    axis = cos(pitch)*vertical + sin(pitch)*forward
    mass_upper = upper_dry + upper_fuel
    state += np.r_[7.95*axis, axis*mass_upper/(mass_upper+CAPSULE_DRY+CAPSULE_FUEL)]
    records.append(dict(event="capsule separation", t=cutoff))
    t = cutoff
    if np.linalg.norm(state[:3])-radius < 120000 or state[:3] @ state[3:] <= 0:
        raise ValueError("P1 vacuum propagation needs an outbound state above the atmosphere")
    if capsule_fuel < CAPSULE_FUEL:
        t += 12
        state = advance(coast_derivative(table, launch), cutoff, t, state, powered_step, method)
        flow = CAPSULE_THRUST/(CAPSULE_ISP*g0)
        burn_start = t

        def burn(time, q):
            mass = CAPSULE_DRY+CAPSULE_FUEL-flow*(time-burn_start)
            acceleration = CAPSULE_THRUST/mass * q[3:]/np.linalg.norm(q[3:])
            return np.r_[q[3:], gravity(table, launch+time, q[:3])+acceleration]

        t += (CAPSULE_FUEL-capsule_fuel)/flow
        state = advance(burn, burn_start, t, state, powered_step, method)
        records.append(dict(event="capsule prograde cutoff", t=t, burnStart=burn_start))
    if np.linalg.norm(state[:3])-radius < 120000 or state[:3] @ state[3:] <= 0:
        raise ValueError("P1 vacuum propagation needs an outbound state above the atmosphere")
    return t, state, records


def lunar_relative(table, time, state):
    relative = state - table.body(time, 0)
    distance = np.linalg.norm(relative[:3])
    return distance-MOON_RADIUS, relative[:3] @ relative[3:]/distance


def coast_derivative(table, launch):
    def derivative(t, q):
        return np.r_[q[3:], gravity(table, launch+t, q[:3])]
    return derivative


def encounter(table, catalogue, launch, start, state, end, method, divisor=1):
    """Follow the flyby until 80,000 km outbound, locating events within integration steps."""
    from scipy.optimize import brentq

    derivative = coast_derivative(table, launch)

    def moon_height(t, q):
        return lunar_relative(table, launch+t, q)[0]

    def periapsis(t, q):
        return lunar_relative(table, launch+t, q)[1]

    def moon_exit(t, q):
        return moon_height(t, q)-80000000

    def earth_entry(t, q):
        return np.linalg.norm(q[:3])-catalogue["radius"]-120000

    events = [periapsis, moon_height, moon_exit, earth_entry]
    directions = [1, -1, 1, -1]
    hits = [[] for _ in events]
    if method == "DOP853":
        for event, direction in zip(events, directions):
            event.direction = direction
            event.terminal = event != periapsis
        result = solve_ivp(derivative, (start, end), state, method=method,
                           rtol=2e-12, atol=1e-8, max_step=900, events=events)
        if not result.success:
            raise ValueError(result.message)
        hits = [list(zip(times, states)) for times, states in zip(result.t_events, result.y_events)]
    else:
        time = start
        values = [f(time, state) for f in events]
        done = False
        while time < end and not done:
            if np.linalg.norm(state[:3]) <= 20000000:
                max_step = 2
            else:
                max_step = 5 if values[1] <= 80000000 else 60
            step = min(max_step/divisor, end-time)
            next_state = rk4(derivative, time, state, step)
            next_values = [f(time+step, next_state) for f in events]
            for i, (a, b, direction) in enumerate(zip(values, next_values, directions)):
                if direction*a < 0 <= direction*b:
                    def residual(dt):
                        return events[i](time+dt, rk4(derivative, time, state, dt))
                    dt = brentq(residual, 0, step, xtol=1e-7)
                    hits[i].append((time+dt, rk4(derivative, time, state, dt)))
                    done |= i != 0
            state, time, values = next_state, time+step, next_values

    def summarize(hit):
        time, q = hit
        moon = table.body(launch+time, 0)
        return dict(t=time, utc=utc_time(launch+time), altitudeM=moon_height(time, q),
                    relativeSpeedMS=np.linalg.norm(q[3:]-moon[3:]),
                    inertialSpeedMS=np.linalg.norm(q[3:]),
                    earthAltitudeM=np.linalg.norm(q[:3])-catalogue["radius"])

    periselene = min(hits[0], key=lambda hit: moon_height(*hit), default=None)
    if hits[1]:
        status = "moon impact"
    elif hits[3]:
        status = "earth atmosphere"
    elif hits[2]:
        status = "flyby" if periselene is not None else "moon exit without measured minimum"
    else:
        status = "no encounter within propagation window"
    return dict(status=status, nearest=summarize(periselene) if periselene is not None else None,
                exit=summarize(hits[2][0]) if hits[2] else None)

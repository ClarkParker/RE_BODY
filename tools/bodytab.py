#!/usr/bin/env python3
"""bodytab.py - RE.BODY recipe compiler.

Reads bodies/*.json (one recipe per morph anchor, schema rebody.recipe/1, see
docs/dev/03_RECIPES.md) and writes

  src/dsp/10_tables.cmajor   flat Cmajor tables, namespace rebody::tables (docs/dev/00_P1_CONTRACTS.md)
  plugin/bodies.json         UI mirror (anchors, labels, depth zTable, slot-mode identities, physics map)
  tests/tables_data.cmajor   namespace-form copy for tests/tables.cmajtest (always namespace form)

Emission form (the DSP worker's experiment decides, docs/dev/01_TABLE_EMISSION.md):
  --emit namespace   const float[N] name = (...);        (default)
  --emit main        struct Tables + float[N] makeName() literal functions + void load (Tables&)
  --emit external    external float[N] name;  + manifest "externals" JSON block (trailing comment,
                     or --externals-json FILE)

Python 3, standard library only; output is deterministic (sorted JSON keys, %.6g floats, no clock).

  python3 tools/bodytab.py --emit namespace --check
"""
import argparse
import hashlib
import json
import math
import os
import sys

GENERATOR = "bodytab 1.0.0"
SCHEMA = "rebody.recipe/1"

NUM_BODIES = 11
GRID_POLES = 96
FEATURE_STRIDE = 8
FOLLOW_STRIDE = 10
GRID_LO_HZ = 60.0
GRID_HI_HZ = 8000.0
LN1000 = math.log(1000.0)
SAMPLE_RATES = (44100, 48000, 96000, 192000)
GAIN_LIN_MAX = 4.0          # |gain| sanity bound (about +12 dB)
T60_MIN, T60_MAX = 0.001, 120.0
FEATURE_HZ_MIN, FEATURE_HZ_MAX = 20.0, 20000.0
NYQUIST_FRAC_44 = 0.45 * 44100.0
LINE_KINDS = {"none": 0, "cylinder": 1, "cone": 2, "string": 3, "string_pair": 4}
ROOT_LAWS = {"drum": 0, "note": 1}
HYBRID_UKE, HYBRID_OBOE, HYBRID_SAX = 5, 8, 9
DEFAULT_ROOT_NOTE_MAX = 72
FILLER_FEATURE_HZ, FILLER_FEATURE_T60 = 1000.0, 0.01     # benign values for unused slots (gain 0)

# first zeros j_mn of the Bessel functions J_m (ideal circular membrane); gains of drum modes are J_m(j_mn * r), r = Position
BESSEL_ZERO = {(0, 1): 2.404826, (1, 1): 3.831706, (2, 1): 5.135622, (3, 1): 6.380162,
               (4, 1): 7.588342, (5, 1): 8.771484, (0, 2): 5.520078}
BESSEL_TOL = 0.012

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ---------------------------------------------------------------------------
# small helpers
# ---------------------------------------------------------------------------
class RecipeError(Exception):
    pass


def sig6(x):
    """Round to 6 significant digits (deterministic)."""
    if x == 0 or not math.isfinite(x):
        return float(x)
    return float("%.6g" % x)


def cf(x):
    """Cmajor float literal with 6 significant digits."""
    x = float(x)
    if not math.isfinite(x):
        raise RecipeError("non-finite value in table")
    if x == 0.0:
        return "0.0f"
    s = "%.6g" % x
    if "e" in s:
        m, e = s.split("e")
        if "." not in m:
            m += ".0"
        return "%se%df" % (m, int(e))
    if "." not in s:
        s += ".0"
    return s + "f"


def ci(x):
    return str(int(x))


def log2(x):
    return math.log(x) / math.log(2.0)


def pw_log(points, key_hz, key_val, f):
    """Piecewise-linear interpolation in log2(f), held outside the first/last point."""
    if not points:
        return 0.0
    pts = sorted(((p[key_hz], p[key_val]) for p in points), key=lambda t: t[0])
    if f <= pts[0][0]:
        return pts[0][1]
    if f >= pts[-1][0]:
        return pts[-1][1]
    for (f0, v0), (f1, v1) in zip(pts, pts[1:]):
        if f0 <= f <= f1:
            if f1 == f0:
                return v1
            t = (log2(f) - log2(f0)) / (log2(f1) - log2(f0))
            return v0 + (v1 - v0) * t
    return pts[-1][1]


def db_to_lin(db):
    return 10.0 ** (db / 20.0)


def lr_from(gain_db, sign, pan):
    """Pan law of the recipes: L = A (1 - p), R = A (1 + p); A = 10^(dB/20); mean (L+R)/2 = A."""
    a = db_to_lin(gain_db)
    p = max(-1.0, min(1.0, pan))
    s = -1.0 if sign < 0 else 1.0
    return s * a * (1.0 - p), s * a * (1.0 + p)


def bessel_j(m, x):
    """J_m(x) by its power series (x < 12 here)."""
    half = x / 2.0
    term = half ** m / math.factorial(m)
    total = term
    for k in range(60):
        term *= -(half * half) / ((k + 1) * (k + 1 + m))
        total += term
    return total


def t60_law(alpha_g, alpha_r, f):
    return LN1000 / (alpha_g + alpha_r * 2.0 * math.pi * f)


def pole_radius(sr, t60):
    return math.exp(-6.907755 / (sr * t60))


def default_root_hz(rec):
    return float(rec["anchor"]["default_root_hz"])


def file_hash(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


# ---------------------------------------------------------------------------
# loading and validation
# ---------------------------------------------------------------------------
def load_spec(root):
    path = os.path.join(root, "plugin", "spec.json")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_recipes(bodies_dir):
    names = sorted(n for n in os.listdir(bodies_dir) if n.endswith(".json"))
    recs, hashes = [], {}
    for n in names:
        p = os.path.join(bodies_dir, n)
        with open(p, encoding="utf-8") as f:
            try:
                r = json.load(f)
            except ValueError as e:
                raise RecipeError("%s: invalid JSON: %s" % (n, e))
        r["_file"] = n
        recs.append(r)
        hashes[n] = file_hash(p)
    return recs, hashes


def need(cond, rec, msg, errs):
    if not cond:
        errs.append("%s: %s" % (rec.get("_file", "?"), msg))
    return cond


def is_num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def validate_structure(recs, spec):
    errs = []
    if len(recs) != NUM_BODIES:
        errs.append("expected %d recipes in bodies/, found %d" % (NUM_BODIES, len(recs)))
        return errs
    for i, r in enumerate(recs):
        f = r["_file"]
        need(r.get("schema") == SCHEMA, r, "schema must be %r" % SCHEMA, errs)
        need(r.get("anchor_index") == i, r, "anchor_index %r != file order %d" % (r.get("anchor_index"), i), errs)
        need(f.startswith("%02d_" % i), r, "file name must start with %02d_" % i, errs)
        need(r.get("name") == spec["anchors"][i], r, "name %r != spec anchors[%d] %r" % (r.get("name"), i, spec["anchors"][i]), errs)
        u = r.get("ui", {})
        need(u.get("label") == spec["anchorLabels"][i], r, "ui.label %r != spec anchorLabels %r" % (u.get("label"), spec["anchorLabels"][i]), errs)
        need(u.get("label_long") == spec["anchorLabelsLong"][i], r, "ui.label_long %r != spec anchorLabelsLong %r" % (u.get("label_long"), spec["anchorLabelsLong"][i]), errs)
        depth = u.get("depth", {}).get("z") if isinstance(u.get("depth"), dict) else None
        need(isinstance(depth, list) and len(depth) == 10 and all(is_num(z) for z in depth), r, "ui.depth.z must be 10 numbers (paths 0..9)", errs)
        for key in ("generator", "anchor", "material", "grid_profile", "feature_modes", "following_modes", "damping",
                    "decay", "contact", "line", "calibration", "physics_map", "ui"):
            need(key in r, r, "missing key %r" % key, errs)
        if any(k not in r for k in ("generator", "anchor", "grid_profile", "feature_modes", "following_modes",
                                    "damping", "decay", "contact", "line", "calibration", "physics_map", "ui")):
            continue
        an = r["anchor"]
        need(an.get("root_law") in ROOT_LAWS, r, "anchor.root_law must be drum|note", errs)
        need(is_num(an.get("default_root_hz")) and an["default_root_hz"] > 0, r, "anchor.default_root_hz must be > 0", errs)
        need(len(r["feature_modes"]) <= FEATURE_STRIDE, r, "%d feature modes > %d" % (len(r["feature_modes"]), FEATURE_STRIDE), errs)
        need(len(r["following_modes"]) <= FOLLOW_STRIDE, r, "%d following modes > %d" % (len(r["following_modes"]), FOLLOW_STRIDE), errs)
        for k in ("stiffness", "coupling", "air", "reed", "excite"):
            need(isinstance(r["physics_map"].get(k), str) and r["physics_map"][k], r, "physics_map.%s missing" % k, errs)
        need(r["line"].get("kind") in LINE_KINDS, r, "line.kind must be one of %s" % sorted(LINE_KINDS), errs)
        for k in ("loop_lowpass_hz", "radiation_hz", "beta", "dispersion"):
            need(is_num(r["line"].get(k)), r, "line.%s must be a number" % k, errs)
        for k in ("out_gain", "energy_target"):
            need(is_num(r["calibration"].get(k)) and r["calibration"][k] > 0, r, "calibration.%s must be > 0" % k, errs)
        for j, m in enumerate(r["feature_modes"]):
            tag = "feature_modes[%d]" % j
            need(is_num(m.get("hz")), r, "%s.hz missing" % tag, errs)
            n_t60 = sum(1 for k in ("t60", "q", "t60_law") if k in m)
            need(n_t60 == 1, r, "%s needs exactly one of t60 | q | t60_law" % tag, errs)
            need(is_num(m.get("gain_db")) and m.get("sign") in (-1, 1) and is_num(m.get("pan")), r,
                 "%s needs gain_db, sign (+-1), pan" % tag, errs)
        for j, m in enumerate(r["following_modes"]):
            tag = "following_modes[%d]" % j
            need(is_num(m.get("ratio")), r, "%s.ratio missing" % tag, errs)
            n_t60 = sum(1 for k in ("t60_mult", "t60_rel", "t60_abs") if k in m)
            need(n_t60 == 1, r, "%s needs exactly one of t60_mult | t60_rel | t60_abs" % tag, errs)
            need(is_num(m.get("gain_db")) and m.get("sign") in (-1, 1) and is_num(m.get("pan")), r,
                 "%s needs gain_db, sign (+-1), pan" % tag, errs)
            if "mn" in m:
                need(isinstance(m["mn"], list) and len(m["mn"]) == 2 and tuple(m["mn"]) in BESSEL_ZERO, r,
                     "%s.mn must be one of %s" % (tag, sorted(BESSEL_ZERO)), errs)
        gp = r["grid_profile"]
        if not gp.get("from_constituents"):
            need(is_num(gp.get("floor_db")), r, "grid_profile.floor_db missing", errs)
            need(gp.get("sign") in ("positive", "alternating"), r, "grid_profile.sign must be positive|alternating", errs)
            for j, b in enumerate(gp.get("bumps", [])):
                need(all(is_num(b.get(k)) for k in ("hz_center", "width_oct", "gain_db")) and b.get("width_oct", 0) > 0,
                     r, "grid_profile.bumps[%d] needs hz_center, width_oct > 0, gain_db" % j, errs)
                need(is_num(b.get("hz_center")) and GRID_LO_HZ / 2 <= b["hz_center"] <= GRID_HI_HZ, r,
                     "grid_profile.bumps[%d].hz_center outside the 30 Hz..8 kHz grid range" % j, errs)
        for k in ("root_base_hz", "root_size_oct", "onset_glide_oct"):
            need(is_num(an.get(k)), r, "anchor.%s must be a number" % k, errs)
        ds = r["damping"].get("decay_scale")
        need(isinstance(ds, dict) and is_num(ds.get("lo")) and is_num(ds.get("hi")), r, "damping.decay_scale needs lo and hi", errs)
        if r["damping"].get("derive") != "constituents":
            need(is_num(r["damping"].get("alphaG")) and is_num(r["damping"].get("alphaR")), r, "damping needs alphaG and alphaR", errs)
        if r["decay"].get("derive") != "constituents":
            need(is_num(r["decay"].get("base")) and is_num(r["decay"].get("ratio")), r, "decay needs base and ratio", errs)
        ct = r["contact"]
        if ct.get("derive") != "constituents":
            need(is_num(ct.get("sustain")), r, "contact.sustain missing", errs)
        need(is_num(ct.get("position")) and is_num(ct.get("body_default")), r, "contact needs position and body_default", errs)
        for k in ("engine_gain", "body_gain"):
            need(is_num(r["calibration"].get(k)) and r["calibration"][k] >= 0, r, "calibration.%s must be >= 0" % k, errs)
        if i == NUM_BODIES - 1:
            need(isinstance(r.get("constituents"), list) and len(r["constituents"]) == 3, r, "needs three constituents", errs)
            hy = r.get("hybrid", {})
            need(isinstance(hy.get("constants"), list) and len(hy["constants"]) >= 11 and all(is_num(c.get("value")) and c.get("name") for c in hy["constants"]),
                 r, "hybrid.constants needs the 11+ named BODY constants", errs)
            pr = hy.get("pairs", {})
            need(all(isinstance(pr.get(k), list) and len(pr[k]) == 4 for k in ("centres", "splits_hz")), r, "hybrid.pairs needs 4 centres and 4 splits_hz", errs)
    return errs


# ---------------------------------------------------------------------------
# computation
# ---------------------------------------------------------------------------
def grid_hz():
    return [GRID_LO_HZ * (GRID_HI_HZ / GRID_LO_HZ) ** (k / float(GRID_POLES - 1)) for k in range(GRID_POLES)]


def grid_vectors(gp, ghz):
    """Per-pole (L, R) signed gains from a grid_profile."""
    floor = gp["floor_db"]
    env = gp.get("envelope", [])
    bumps = gp.get("bumps", [])
    lr = gp.get("lr", [])
    alt = gp.get("sign") == "alternating"
    gl, gr = [], []
    for k, f in enumerate(ghz):
        db = floor + pw_log(env, "hz", "db", f)
        pan = pw_log(lr, "hz", "pan", f)
        for b in bumps:
            x = log2(f / b["hz_center"]) / b["width_oct"]
            w = math.exp(-4.0 * math.log(2.0) * x * x)       # FWHM = width_oct (dB-domain gaussian in log2 f)
            db += b["gain_db"] * w
            pan += b.get("pan", 0.0) * w
        sign = -1 if (alt and (k % 2 == 1)) else 1
        l, r = lr_from(db, sign, pan)
        gl.append(l)
        gr.append(r)
    return gl, gr


def rho_of(ag, ar):
    return t60_law(ag, ar, 2000.0) / t60_law(ag, ar, 200.0)


def resolve(recs):
    """Compute one table row per body (derived values for the Obosaxolele included)."""
    ghz = grid_hz()
    by_id = {}
    for r in recs:
        by_id[r["_file"][:-5]] = r
    rows = []
    for i, r in enumerate(recs):
        rows.append({"rec": r, "i": i})
    # direct bodies first
    for row in rows:
        r = row["rec"]
        if r["grid_profile"].get("from_constituents"):
            continue
        row["gl"], row["gr"] = grid_vectors(r["grid_profile"], ghz)
    hyb = rows[NUM_BODIES - 1]["rec"]
    cons = []
    for c in hyb["constituents"]:
        key = c["recipe"]
        if key not in by_id:
            raise RecipeError("%s: constituent %r not found" % (hyb["_file"], key))
        idx = by_id[key]["anchor_index"]
        cons.append((idx, float(c["weight"])))
    wsum = sum(w for _, w in cons)
    for row in rows:
        r = row["rec"]
        d, dc = r["damping"], r["decay"]
        ct = r["contact"]
        derived = bool(d.get("derive") == "constituents")
        if derived:
            # the DSP blends a shared law as log-blended T60 and weight-blended rho (20 s4); invert 22 s0:
            # s = (1/rho - 1)/9, alphaG = (1-s) ln1000/T200, alphaR = s ln1000/(T200 * w200)
            t200 = math.exp(sum(w * math.log(t60_law(rows[ix]["rec"]["damping"]["alphaG"], rows[ix]["rec"]["damping"]["alphaR"], 200.0))
                                for ix, w in cons) / wsum)
            rho = sum(w * rho_of(rows[ix]["rec"]["damping"]["alphaG"], rows[ix]["rec"]["damping"]["alphaR"]) for ix, w in cons) / wsum
            share = (1.0 / rho - 1.0) / 9.0
            row["alphaG"] = (1.0 - share) * LN1000 / t200
            row["alphaR"] = share * LN1000 / (t200 * 2.0 * math.pi * 200.0)
        else:
            row["alphaG"] = float(d["alphaG"])
            row["alphaR"] = float(d["alphaR"])
        if dc.get("derive") == "constituents":
            row["decayBase"] = math.exp(sum(w * math.log(rows[ix]["rec"]["decay"]["base"]) for ix, w in cons) / wsum)
            row["decayRatio"] = math.exp(sum(w * math.log(rows[ix]["rec"]["decay"]["ratio"]) for ix, w in cons) / wsum)
        else:
            row["decayBase"] = float(dc["base"])
            row["decayRatio"] = float(dc["ratio"])
        if ct.get("derive") == "constituents":
            row["sustain"] = sum(w * rows[ix]["rec"]["contact"]["sustain"] for ix, w in cons) / wsum
        else:
            row["sustain"] = float(ct["sustain"])
    for row in rows:
        r = row["rec"]
        if r["grid_profile"].get("from_constituents"):
            gl = [0.0] * GRID_POLES
            gr = [0.0] * GRID_POLES
            for ix, w in cons:
                for k in range(GRID_POLES):
                    gl[k] += w * rows[ix]["gl"][k]
                    gr[k] += w * rows[ix]["gr"][k]
            row["gl"], row["gr"] = gl, gr
    # slot modes
    for row in rows:
        r = row["rec"]
        ag, ar = row["alphaG"], row["alphaR"]
        fts = []
        for m in r["feature_modes"]:
            hz = float(m["hz"])
            if "t60" in m:
                t60 = float(m["t60"])
            elif "q" in m:
                t60 = LN1000 * float(m["q"]) / (math.pi * hz)
            else:
                t60 = t60_law(ag, ar, hz)
            gl, gr = lr_from(m["gain_db"], m["sign"], m["pan"])
            fts.append({"hz": hz, "t60": t60, "gl": gl, "gr": gr, "label": m.get("label", "")})
        row["features"] = fts
        flw = []
        root = default_root_hz(r)
        secs50 = row["decayBase"] * math.sqrt(row["decayRatio"])
        for m in r["following_modes"]:
            ratio = float(m["ratio"])
            law = t60_law(ag, ar, ratio * root)
            if "t60_mult" in m:
                mult = float(m["t60_mult"])
            elif "t60_rel" in m:
                mult = float(m["t60_rel"]) * secs50 / law
            else:
                mult = float(m["t60_abs"]) / law
            gl, gr = lr_from(m["gain_db"], m["sign"], m["pan"])
            mn = tuple(m["mn"]) if "mn" in m else None
            flw.append({"ratio": ratio, "mult": mult, "gl": gl, "gr": gr, "label": m.get("label", ""),
                        "bm": mn[0] if mn else -1, "bz": BESSEL_ZERO[mn] if mn else 0.0})
        row["following"] = flw
    return ghz, rows, cons


def validate_values(rows, ghz):
    errs, warns = [], []
    for k in range(1, GRID_POLES):
        if not ghz[k] > ghz[k - 1]:
            errs.append("gridHz not strictly increasing at %d" % k)
    if abs(ghz[0] - GRID_LO_HZ) > 1e-6 or abs(ghz[-1] - GRID_HI_HZ) > 1e-3:
        errs.append("gridHz must span 60 Hz .. 8 kHz")
    spacing = max(log2(ghz[k] / ghz[k - 1]) for k in range(1, GRID_POLES))
    if spacing > 1.0 / 12.0:
        errs.append("grid spacing %.4f oct > 1/12 oct" % spacing)
    for row in rows:
        r = row["rec"]
        f = r["_file"]
        for k in range(GRID_POLES):
            for v in (row["gl"][k], row["gr"][k]):
                if not math.isfinite(v) or abs(v) > GAIN_LIN_MAX:
                    errs.append("%s: grid gain %.4g out of range at pole %d" % (f, v, k))
                    break
        ag, ar = row["alphaG"], row["alphaR"]
        if ag < 0 or ar < 0 or (ag == 0 and ar == 0):
            errs.append("%s: alphaG/alphaR must be >= 0 and not both 0" % f)
            continue
        rho = rho_of(ag, ar)
        if not (0.1 - 1e-9 <= rho <= 1.0 + 1e-9):
            errs.append("%s: rho %.4f outside [0.1, 1]" % (f, rho))
        d = r["damping"]
        if d.get("rho_ref") is not None and abs(rho - d["rho_ref"]) > 0.03 * d["rho_ref"]:
            errs.append("%s: rho %.4f differs from rho_ref %.4f by more than 3 %%" % (f, rho, d["rho_ref"]))
        t200 = t60_law(ag, ar, 200.0)
        if d.get("t200_ref") is not None and abs(t200 - d["t200_ref"]) > 0.03 * d["t200_ref"]:
            errs.append("%s: T200 %.4f s differs from t200_ref %.4f s by more than 3 %%" % (f, t200, d["t200_ref"]))
        eta = r["material"].get("eta")
        if eta is not None and (ag != 0 or abs(ar - eta / 2.0) > 0.01 * (eta / 2.0)):
            errs.append("%s: material.eta %.4g requires alphaG 0 and alphaR = eta/2 = %.5g" % (f, eta, eta / 2.0))
        if not (row["decayBase"] > 0 and row["decayRatio"] >= 1.0):
            errs.append("%s: decay base > 0 and ratio >= 1 required" % f)
        if not (0.0 <= row["sustain"] <= 1.0):
            errs.append("%s: sustain outside 0..1" % f)
        if r["contact"].get("novelty_power", 1.0) <= 0:
            errs.append("%s: novelty_power must be > 0" % f)
        ln = r["line"]
        if ln["loop_lowpass_hz"] < 0 or ln["radiation_hz"] < 0 or ln["beta"] < 0:
            errs.append("%s: line low-pass/radiation/beta must be >= 0" % f)
        for hzv in (ln["loop_lowpass_hz"], ln["radiation_hz"]):
            if hzv > NYQUIST_FRAC_44:
                errs.append("%s: line cutoff %.0f Hz above 0.45 * 44.1 kHz" % (f, hzv))
        if abs(ln["dispersion"]) >= 1.0 or abs(ln.get("dispersion_b", 0.0)) >= 1.0:
            errs.append("%s: |dispersion| must be < 1" % f)
        if r["decay"].get("base") is not None and r["anchor"]["root_law"] == "drum":
            root = default_root_hz(r)
            ratio = t60_law(ag, ar, root) / (row["decayBase"] * math.sqrt(row["decayRatio"]))
            if abs(ratio - 1.0) > 0.03:
                warns.append("%s: T60(root %.1f Hz) differs from Decay-50 seconds by %.1f %%" % (f, root, 100 * (ratio - 1)))
        # slot modes
        if len(row["features"]) > FEATURE_STRIDE or len(row["following"]) > FOLLOW_STRIDE:
            errs.append("%s: too many slot modes" % f)
        root_max = {"drum": 310.0, "note": 440.0 * 2.0 ** ((DEFAULT_ROOT_NOTE_MAX - 69) / 12.0)}[r["anchor"]["root_law"]]
        clamp = r["anchor"].get("tune_clamp_midi")
        if clamp:
            root_max = 440.0 * 2.0 ** ((clamp[1] - 69) / 12.0)
        for j, m in enumerate(row["features"]):
            tag = "%s feature %d" % (f, j)
            if not (FEATURE_HZ_MIN < m["hz"] < FEATURE_HZ_MAX) or m["hz"] > NYQUIST_FRAC_44:
                errs.append("%s: hz %.1f outside 20 Hz .. 0.45 fs(44.1k)" % (tag, m["hz"]))
            if not (T60_MIN <= m["t60"] <= T60_MAX):
                errs.append("%s: T60 %.4g s outside %.3g..%.0f s" % (tag, m["t60"], T60_MIN, T60_MAX))
            for v in (m["gl"], m["gr"]):
                if abs(v) > GAIN_LIN_MAX:
                    errs.append("%s: |gain| %.3g > %.1f" % (tag, v, GAIN_LIN_MAX))
            for sr in SAMPLE_RATES:
                rad = pole_radius(sr, m["t60"])
                if not (0.0 < rad < 1.0):
                    errs.append("%s: pole radius %.9g at %d Hz not in (0,1)" % (tag, rad, sr))
        for j, m in enumerate(row["following"]):
            tag = "%s follow %d" % (f, j)
            if not (0.05 < m["ratio"] < 20.0):
                errs.append("%s: ratio %.3f outside 0.05..20" % (tag, m["ratio"]))
            if m["ratio"] * root_max > NYQUIST_FRAC_44:
                errs.append("%s: ratio %.3f x highest root %.0f Hz above 0.45 fs(44.1k)" % (tag, m["ratio"], root_max))
            if not (m["mult"] > 0):
                errs.append("%s: t60 multiplier must be > 0" % tag)
            for v in (m["gl"], m["gr"]):
                if abs(v) > GAIN_LIN_MAX:
                    errs.append("%s: |gain| %.3g > %.1f" % (tag, v, GAIN_LIN_MAX))
            if m["bm"] >= 0:
                j = bessel_j(m["bm"], m["bz"] * r["contact"]["position"])
                a = (abs(m["gl"]) + abs(m["gr"])) / 2.0
                if abs(a - j) > BESSEL_TOL:
                    errs.append("%s: mean gain %.4f differs from J_%d(j r) = %.4f at Position %.2f by more than %.3f"
                                % (tag, a, m["bm"], j, r["contact"]["position"], BESSEL_TOL))
            t60 = m["mult"] * t60_law(ag, ar, m["ratio"] * default_root_hz(r))
            if not (T60_MIN <= t60 <= T60_MAX):
                errs.append("%s: T60 at default Tune %.4g s outside %.3g..%.0f s" % (tag, t60, T60_MIN, T60_MAX))
            for sr in SAMPLE_RATES:
                rad = pole_radius(sr, t60)
                if not (0.0 < rad < 1.0):
                    errs.append("%s: pole radius %.9g at %d Hz not in (0,1)" % (tag, rad, sr))
    return errs, warns


# ---------------------------------------------------------------------------
# table registry
# ---------------------------------------------------------------------------
def pad(vals, n, filler):
    vals = list(vals)[:n]
    return vals + [filler] * (n - len(vals))


def build_tables(ghz, rows, cons):
    """Returns (constants, arrays). arrays: list of dict(name, type, values, doc, group)."""
    A = []

    def add(name, typ, values, doc, group, row_len=None):
        A.append({"name": name, "type": typ, "values": list(values), "doc": doc, "group": group, "row_len": row_len})

    add("gridHz", "float", [sig6(v) for v in ghz], "log-spaced 60 Hz .. 8 kHz, shared by all bodies", "contract")
    gl, gr = [], []
    for row in rows:
        gl += row["gl"]
        gr += row["gr"]
    add("gridGainL", "float", gl, "[body*96 + pole] signed gains, left", "contract", GRID_POLES)
    add("gridGainR", "float", gr, "[body*96 + pole] signed gains, right", "contract", GRID_POLES)
    add("featureCount", "int", [len(r["features"]) for r in rows], "feature modes per body (<= 8)", "contract")
    fh, ft, fl, fr = [], [], [], []
    for row in rows:
        fs = row["features"]
        fh += pad([m["hz"] for m in fs], FEATURE_STRIDE, FILLER_FEATURE_HZ)
        ft += pad([m["t60"] for m in fs], FEATURE_STRIDE, FILLER_FEATURE_T60)
        fl += pad([m["gl"] for m in fs], FEATURE_STRIDE, 0.0)
        fr += pad([m["gr"] for m in fs], FEATURE_STRIDE, 0.0)
    add("featureHz", "float", fh, "[body*8 + i] Hz (fixed, follows Size not Tune); unused slots 1000 Hz with gain 0", "contract", FEATURE_STRIDE)
    add("featureT60", "float", ft, "[body*8 + i] seconds at Material 50 / Decay 50 (T60 = ln1000/(pi Hz) * Q, or law); unused 0.01", "contract", FEATURE_STRIDE)
    add("featureGainL", "float", fl, "[body*8 + i] signed gain left; unused 0", "contract", FEATURE_STRIDE)
    add("featureGainR", "float", fr, "[body*8 + i] signed gain right; unused 0", "contract", FEATURE_STRIDE)
    add("followCount", "int", [len(r["following"]) for r in rows], "Tune-following modes per body (<= 10)", "contract")
    wr, wm, wl, wr_ = [], [], [], []
    for row in rows:
        fs = row["following"]
        wr += pad([m["ratio"] for m in fs], FOLLOW_STRIDE, 1.0)
        wm += pad([m["mult"] for m in fs], FOLLOW_STRIDE, 1.0)
        wl += pad([m["gl"] for m in fs], FOLLOW_STRIDE, 0.0)
        wr_ += pad([m["gr"] for m in fs], FOLLOW_STRIDE, 0.0)
    add("followRatio", "float", wr, "[body*10 + i] ratio to the root; unused 1", "contract", FOLLOW_STRIDE)
    add("followT60Mult", "float", wm, "[body*10 + i] multiplier on the damping-law T60 at ratio*root (20 s4); unused 1", "contract", FOLLOW_STRIDE)
    add("followGainL", "float", wl, "[body*10 + i] signed gain left at the recipe Position; unused 0", "contract", FOLLOW_STRIDE)
    add("followGainR", "float", wr_, "[body*10 + i] signed gain right; unused 0", "contract", FOLLOW_STRIDE)
    bo, bz = [], []
    for row in rows:
        fs = row["following"]
        bo += pad([m["bm"] for m in fs], FOLLOW_STRIDE, -1)
        bz += pad([m["bz"] for m in fs], FOLLOW_STRIDE, 0.0)
    add("alphaG", "float", [row["alphaG"] for row in rows], "damping law at Material 50: alphaG [1/s] (T60 = ln1000/(alphaG + alphaR*2*pi*f))", "contract")
    add("alphaR", "float", [row["alphaR"] for row in rows], "damping law at Material 50: alphaR [s] (22 lists it x1e-3)", "contract")
    add("decayBase", "float", [row["decayBase"] for row in rows], "seconds = base * ratio^decay, decay = param/100 (22 s0)", "contract")
    add("decayRatio", "float", [row["decayRatio"] for row in rows], "see decayBase", "contract")
    add("sustain", "float", [row["sustain"] for row in rows], "contact sustain default (Touch 50)", "contract")
    add("rootLaw", "int", [ROOT_LAWS[row["rec"]["anchor"]["root_law"]] for row in rows], "0 = drum size law, 1 = note law (also: 0 = unpitched for pitchedWeight)", "contract")
    add("lineKind", "int", [LINE_KINDS[row["rec"]["line"]["kind"]] for row in rows], "0 none, 1 cylinder, 2 cone, 3 string, 4 string pair", "contract")
    add("loopLowpassHz", "float", [row["rec"]["line"]["loop_lowpass_hz"] for row in rows], "in-loop low-pass, BODY default (0 = none)", "contract")
    add("radiationHz", "float", [row["rec"]["line"]["radiation_hz"] for row in rows], "radiation one-pole outside the loop on the pickup (0 = none)", "contract")
    add("beta", "float", [row["rec"]["line"]["beta"] for row in rows], "pick/pickup position (fraction of the delay or period)", "contract")
    add("dispersion", "float", [row["rec"]["line"]["dispersion"] for row in rows], "string/bore dispersion allpass coefficient (BODY:70)", "contract")
    add("outGain", "float", [row["rec"]["calibration"]["out_gain"] for row in rows], "per-body output calibration (BODY:831-856 starting points)", "contract")
    add("energyTarget", "float", [row["rec"]["calibration"]["energy_target"] for row in rows], "slot energy-normalisation target (BODY:427 law at the default root)", "contract")
    # ---- extensions (not in the P1 contract; consumers may ignore) ----
    ext = "extension"
    add("rootBaseHz", "float", [row["rec"]["anchor"]["root_base_hz"] for row in rows], "drum law base Hz at size 1 (BODY:177-178), 0 for note-law bodies", ext)
    add("rootSizeOct", "float", [row["rec"]["anchor"]["root_size_oct"] for row in rows], "drum law: root = base * 2^(sizeOct * (1 - size))", ext)
    add("tuneMinNote", "int", [(row["rec"]["anchor"].get("tune_clamp_midi") or [36, DEFAULT_ROOT_NOTE_MAX])[0] for row in rows], "note law lowest MIDI note (BODY:179 = C2)", ext)
    add("tuneMaxNote", "int", [(row["rec"]["anchor"].get("tune_clamp_midi") or [36, DEFAULT_ROOT_NOTE_MAX])[1] for row in rows], "note law highest MIDI note (C5; timpani clamp C4, D15)", ext)
    add("onsetGlideOct", "float", [row["rec"]["anchor"]["onset_glide_oct"] for row in rows], "onset pitch tightening in octaves x onset x feed (BODY:308)", ext)
    add("positionDefault", "float", [row["rec"]["contact"]["position"] for row in rows], "Position knob 50 maps to this (drum radius, pick or pickup point)", ext)
    add("bodyDefault", "float", [row["rec"]["contact"]["body_default"] for row in rows], "Body knob 50 maps to this line<->modal balance (0..1)", ext)
    add("decayScaleLo", "float", [row["rec"]["damping"]["decay_scale"]["lo"] for row in rows], "Decay factor at Decay 0 for bodies behind a loop (0 = use anchor seconds law)", ext)
    add("decayScaleHi", "float", [row["rec"]["damping"]["decay_scale"]["hi"] for row in rows], "Decay factor at Decay 100 for bodies behind a loop (0 = use anchor seconds law)", ext)
    add("dispersionB", "float", [row["rec"]["line"].get("dispersion_b", 0.0) for row in rows], "second string dispersion (piano pair BODY:70), 0 otherwise", ext)
    add("engineGain", "float", [row["rec"]["calibration"]["engine_gain"] for row in rows], "line-engine term inside the BODY calibration bracket (0 = none)", ext)
    add("bodyGain", "float", [row["rec"]["calibration"]["body_gain"] for row in rows], "modal-body term inside the BODY calibration bracket (0 = none)", ext)
    hyb = rows[NUM_BODIES - 1]["rec"]["hybrid"]
    add("followBesselOrder", "int", bo, "[body*10 + i] Bessel order m of a drum mode (gain = J_m(j_mn r), r = Position), -1 = no Position law", ext, FOLLOW_STRIDE)
    add("followBesselZero", "float", bz, "[body*10 + i] first zero j_mn of J_m for that mode, 0 = none", ext, FOLLOW_STRIDE)
    add("hybridConst", "float", [c["value"] for c in hyb["constants"]],
        "Obosaxolele coupling constants, order: " + ", ".join(c["name"] for c in hyb["constants"]), ext)
    add("hybridCentre", "float", hyb["pairs"]["centres"], "beating-pair centre ratios (BODY:105)", ext)
    add("hybridSplitHz", "float", hyb["pairs"]["splits_hz"], "beating-pair splits in Hz, capped at 0.045 * centre (BODY:106)", ext)
    consts = [
        ("numBodies", NUM_BODIES),
        ("gridPoles", GRID_POLES),
        ("featureStride", FEATURE_STRIDE),
        ("followStride", FOLLOW_STRIDE),
        ("hybridBodyUke", HYBRID_UKE),
        ("hybridBodyOboe", HYBRID_OBOE),
        ("hybridBodySax", HYBRID_SAX),
    ]
    return consts, A


def expected_len(name):
    sizes = {"gridHz": GRID_POLES, "gridGainL": NUM_BODIES * GRID_POLES, "gridGainR": NUM_BODIES * GRID_POLES,
             "featureHz": NUM_BODIES * FEATURE_STRIDE, "featureT60": NUM_BODIES * FEATURE_STRIDE,
             "featureGainL": NUM_BODIES * FEATURE_STRIDE, "featureGainR": NUM_BODIES * FEATURE_STRIDE,
             "followRatio": NUM_BODIES * FOLLOW_STRIDE, "followT60Mult": NUM_BODIES * FOLLOW_STRIDE,
             "followGainL": NUM_BODIES * FOLLOW_STRIDE, "followGainR": NUM_BODIES * FOLLOW_STRIDE,
             "followBesselOrder": NUM_BODIES * FOLLOW_STRIDE, "followBesselZero": NUM_BODIES * FOLLOW_STRIDE}
    return sizes.get(name, NUM_BODIES)


# ---------------------------------------------------------------------------
# Cmajor emission
# ---------------------------------------------------------------------------
def literal_lines(arr, indent, names):
    """Parenthesised literal, wrapped; one row (body) per group when row_len is set."""
    fmt = cf if arr["type"] == "float" else ci
    vals = [fmt(v) for v in arr["values"]]
    rl = arr["row_len"]
    out = []
    if rl:
        rows = [vals[k:k + rl] for k in range(0, len(vals), rl)]
        for b, row in enumerate(rows):
            tag = "// %d %s" % (b, names[b]) if b < len(names) else ""
            chunks = [", ".join(row[k:k + 8]) for k in range(0, len(row), 8)]
            if tag:
                out.append(indent + tag)
            for c, ch in enumerate(chunks):
                last = (b == len(rows) - 1 and c == len(chunks) - 1)
                out.append(indent + ch + ("" if last else ","))
    else:
        chunks = [", ".join(vals[k:k + 8]) for k in range(0, len(vals), 8)]
        for c, ch in enumerate(chunks):
            out.append(indent + ch + ("" if c == len(chunks) - 1 else ","))
    return out


def header(hashes, form, names, tests_copy=False):
    h = hashlib.sha256()
    for k in sorted(hashes):
        h.update(("%s:%s\n" % (k, hashes[k])).encode())
    if tests_copy:
        first = "// GENERATED by tools/bodytab.py (namespace-form copy for tests/tables.cmajtest) - do not edit. Regenerate: python3 tools/bodytab.py"
    else:
        first = "// GENERATED by tools/bodytab.py - do not edit. Regenerate: python3 tools/bodytab.py --emit %s" % form
    lines = [
        first,
        "// generator: %s   schema: %s   emission form: %s" % (GENERATOR, SCHEMA, form),
        "// source recipes (sha256, first 12 hex):",
    ]
    for k in sorted(hashes):
        lines.append("//   %-24s %s" % (k, hashes[k][:12]))
    lines.append("//   combined                 %s" % h.hexdigest()[:12])
    lines += [
        "//",
        "// Table API (docs/dev/00_P1_CONTRACTS.md): flat arrays indexed [body * stride + i], body 0..10 in anchor order",
        "// (%s)," % ", ".join(names),
        "// strides: grid 96, feature 8, follow 10. Counts and codes are int, everything else float.",
        "// Units: Hz, seconds, linear signed gains (L = A (1 - pan), R = A (1 + pan)); alphaG [1/s], alphaR [s]",
        "// (22_BODIES lists alphaR x1e-3): T60(f) = ln(1000) / (alphaG + alphaR * 2 pi f), Material 50, Decay 50.",
        "// Unused slots hold benign values (feature 1000 Hz / 0.01 s, follow ratio 1 / mult 1) with gain 0, so a lane",
        "// that is stepped without a mask stays finite. rootLaw 0 = drum size law (unpitched), 1 = note law (pitched).",
        "// Groups: 'contract' arrays are the P1 contract; 'extensions' are optional extras documented in",
        "// docs/dev/03_RECIPES.md.",
    ]
    return lines


def emit_namespace(consts, arrays, hashes, names, tests_copy=False):
    L = header(hashes, "namespace", names, tests_copy)
    L.append("")
    L.append("namespace rebody::tables")
    L.append("{")
    for n, v in consts:
        L.append("    const int %s = %d;" % (n, v))
    group = None
    for a in arrays:
        if a["group"] != group:
            group = a["group"]
            L.append("")
            L.append("    // ---- %s ----" % ("P1 contract tables" if group == "contract" else "extensions (beyond the P1 contract)"))
        L.append("")
        L.append("    // %s" % a["doc"])
        L.append("    const %s[%d] %s =" % (a["type"], len(a["values"]), a["name"]))
        L.append("    (")
        L += literal_lines(a, "        ", names)
        L.append("    );")
    L.append("}")
    return "\n".join(L) + "\n"


def emit_main(consts, arrays, hashes, names):
    L = header(hashes, "main", names)
    L += [
        "//",
        "// Form 'main': a struct of all tables plus literal-returning functions and one loader. Usage in the processor:",
        "//     rebody::tables::Tables tables;                       // processor member",
        "//     ... main() { rebody::tables::load (tables); loop { ... tables.gridGainL.at (b * 96 + k) ... } }",
    ]
    L.append("")
    L.append("namespace rebody::tables")
    L.append("{")
    for n, v in consts:
        L.append("    const int %s = %d;" % (n, v))
    L.append("")
    L.append("    struct Tables")
    L.append("    {")
    for a in arrays:
        L.append("        %s[%d] %s;" % (a["type"], len(a["values"]), a["name"]))
    L.append("    }")
    for a in arrays:
        fn = "make" + a["name"][0].upper() + a["name"][1:]
        L.append("")
        L.append("    // %s" % a["doc"])
        L.append("    %s[%d] %s()" % (a["type"], len(a["values"]), fn))
        L.append("    {")
        L.append("        return (")
        L += literal_lines(a, "            ", names)
        L.append("        );")
        L.append("    }")
    L.append("")
    L.append("    void load (Tables& t)")
    L.append("    {")
    for a in arrays:
        fn = "make" + a["name"][0].upper() + a["name"][1:]
        L.append("        t.%s = %s();" % (a["name"], fn))
    L.append("    }")
    L.append("}")
    return "\n".join(L) + "\n"


def externals_dict(arrays):
    d = {}
    for a in arrays:
        key = "rebody::tables::" + a["name"]
        if a["type"] == "float":
            d[key] = [sig6(v) for v in a["values"]]
        else:
            d[key] = [int(v) for v in a["values"]]
    return d


def emit_external(consts, arrays, hashes, names):
    L = header(hashes, "external", names)
    L += [
        "//",
        "// Form 'external': declarations only; the values live in the manifest (.cmajorpatch) under \"externals\".",
        "// The JSON block between the markers at the end of this file is that object; extract it with",
        "//     python3 tools/bodytab.py --emit external --externals-json plugin/tables.externals.json",
    ]
    L.append("")
    L.append("namespace rebody::tables")
    L.append("{")
    for n, v in consts:
        L.append("    const int %s = %d;" % (n, v))
    group = None
    for a in arrays:
        if a["group"] != group:
            group = a["group"]
            L.append("")
            L.append("    // ---- %s ----" % ("P1 contract tables" if group == "contract" else "extensions (beyond the P1 contract)"))
        L.append("    external %s[%d] %s;      // %s" % (a["type"], len(a["values"]), a["name"], a["doc"]))
    L.append("}")
    L.append("")
    L.append("/* EXTERNALS-JSON-BEGIN")
    L.append(externals_json(arrays))
    L.append("EXTERNALS-JSON-END */")
    return "\n".join(L) + "\n"


def externals_json(arrays):
    d = externals_dict(arrays)
    lines = ["{", "  \"externals\": {"]
    keys = sorted(d)
    for n, k in enumerate(keys):
        vals = d[k]
        body = ", ".join(("%.6g" % v) if isinstance(v, float) else str(v) for v in vals)
        lines.append("    %s: [%s]%s" % (json.dumps(k), body, "," if n < len(keys) - 1 else ""))
    lines.append("  }")
    lines.append("}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# bodies.json (UI mirror)
# ---------------------------------------------------------------------------
def jround(o):
    if isinstance(o, float):
        return sig6(o)
    if isinstance(o, dict):
        return {k: jround(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [jround(v) for v in o]
    return o


def jdump(o, ind=0):
    """Deterministic JSON: sorted keys, compact leaf lists, floats already sig6."""
    pad = "  " * ind
    if isinstance(o, dict):
        if not o:
            return "{}"
        items = []
        for k in sorted(o):
            items.append("%s  %s: %s" % (pad, json.dumps(k, ensure_ascii=False), jdump(o[k], ind + 1)))
        return "{\n" + ",\n".join(items) + "\n" + pad + "}"
    if isinstance(o, list):
        if all(not isinstance(x, (dict, list)) for x in o):
            return "[" + ", ".join(json.dumps(x, ensure_ascii=False) for x in o) + "]"
        if all(isinstance(x, list) and all(not isinstance(y, (dict, list)) for y in x) for x in o):
            return "[\n" + ",\n".join("%s  %s" % (pad, jdump(x, ind + 1)) for x in o) + "\n" + pad + "]"
        return "[\n" + ",\n".join("%s  %s" % (pad, jdump(x, ind + 1)) for x in o) + "\n" + pad + "]"
    return json.dumps(o, ensure_ascii=False)


def build_ui_json(spec, rows, cons, hashes):
    bodies = []
    z_table = []
    for row in rows:
        r = row["rec"]
        ag, ar = row["alphaG"], row["alphaR"]
        modes = [None] * 16
        for j, m in enumerate(row["features"]):
            if j < FEATURE_STRIDE:
                modes[j] = {"slot": j, "kind": "feature", "index": j, "label": m["label"], "hz": m["hz"]}
        for j, m in enumerate(row["following"]):
            slot = FEATURE_STRIDE + j
            if slot < 16:
                modes[slot] = {"slot": slot, "kind": "following", "index": j, "label": m["label"], "ratio": m["ratio"]}
        compact = [m for m in modes[:FEATURE_STRIDE] if m is not None] + [m for m in modes[FEATURE_STRIDE:] if m is not None]
        compact = [dict(m, slot=n) for n, m in enumerate(compact[:16])]
        compact += [None] * (16 - len(compact))
        z = r["ui"]["depth"]["z"]
        z_table.append(z)
        secs50 = row["decayBase"] * math.sqrt(row["decayRatio"])
        bodies.append({
            "index": row["i"],
            "id": r["id"],
            "name": r["name"],
            "label": r["ui"]["label"],
            "labelLong": r["ui"]["label_long"],
            "generator": r["generator"],
            "rootLaw": r["anchor"]["root_law"],
            "defaultRootHz": r["anchor"]["default_root_hz"],
            "rootBaseHz": r["anchor"]["root_base_hz"],
            "rootSizeOct": r["anchor"]["root_size_oct"],
            "tuneNoteRange": list(r["anchor"].get("tune_clamp_midi") or [36, DEFAULT_ROOT_NOTE_MAX]),
            "decay": {"base": row["decayBase"], "ratio": row["decayRatio"], "secondsAt50": secs50},
            "sustain": row["sustain"],
            "damping": {"alphaG": ag, "alphaR": ar, "rho": rho_of(ag, ar), "t200": t60_law(ag, ar, 200.0),
                        "t60Root": t60_law(ag, ar, r["anchor"]["default_root_hz"])},
            "featureCount": len(row["features"]),
            "followCount": len(row["following"]),
            "line": {"kind": r["line"]["kind"], "loopLowpassHz": r["line"]["loop_lowpass_hz"],
                     "radiationHz": r["line"]["radiation_hz"], "beta": r["line"]["beta"]},
            "positionDefault": r["contact"]["position"],
            "bodyDefault": r["contact"]["body_default"],
            "zTable": z,
            "depthNote": r["ui"]["depth"].get("src", ""),
            "modes": modes,
            "modesCompact": compact,
            "physicsMap": r["physics_map"],
            "constituents": [{"index": ix, "weight": w} for ix, w in cons] if row["i"] == NUM_BODIES - 1 else [],
        })
    ui = {
        "generator": GENERATOR,
        "schema": "rebody.bodies/1",
        "sources": {k: hashes[k][:12] for k in sorted(hashes)},
        "numBodies": NUM_BODIES,
        "anchors": spec["anchors"],
        "labels": spec["anchorLabels"],
        "labelsLong": spec["anchorLabelsLong"],
        "zTable": z_table,
        "slotLayout": "modes[k] (padded): k 0-7 = feature slot k, k 8-15 = following slot k-8, the first 16 of the 18 slots in fixed recipe index order, null = unused slot; modesCompact[k]: the same modes packed without gaps (features first, then following), for a telemetry that packs densely",
        "bodies": bodies,
    }
    return jround(ui)


# ---------------------------------------------------------------------------
# --check summary
# ---------------------------------------------------------------------------
def check_table(rows, warns):
    out = []
    out.append("%-2s %-12s %4s %4s %9s %9s %10s %6s %8s %9s %s" %
               ("#", "body", "feat", "foll", "gridE", "alphaG", "alphaR e-3", "rho", "T200 s", "dec50 s", "line"))
    for row in rows:
        r = row["rec"]
        ag, ar = row["alphaG"], row["alphaR"]
        e = sum(row["gl"][k] ** 2 + row["gr"][k] ** 2 for k in range(GRID_POLES)) / 2.0
        out.append("%-2d %-12s %4d %4d %9.4f %9.3f %10.3f %6.3f %8.4f %9.4f %s" % (
            row["i"], r["name"], len(row["features"]), len(row["following"]), e, ag, ar * 1000.0, rho_of(ag, ar),
            t60_law(ag, ar, 200.0), row["decayBase"] * math.sqrt(row["decayRatio"]), r["line"]["kind"]))
    for w in warns:
        out.append("warning: " + w)
    return "\n".join(out)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def write_if_changed(path, text):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    old = None
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            old = f.read()
    if old != text:
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
        return True
    return False


def main(argv=None):
    ap = argparse.ArgumentParser(description="RE.BODY recipe compiler: bodies/*.json -> Cmajor tables + bodies.json")
    ap.add_argument("--emit", choices=("namespace", "main", "external"), default="namespace", help="Cmajor emission form (default namespace)")
    ap.add_argument("--check", action="store_true", help="validate, print the per-body summary table and report whether the outputs are up to date; writes nothing unless --write is given")
    ap.add_argument("--write", action="store_true", help="with --check: also (re)write the outputs")
    ap.add_argument("--strict", action="store_true", help="with --check: exit 1 when an output is stale or missing")
    ap.add_argument("--root", default=REPO, help="repository root (default: parent of tools/)")
    ap.add_argument("--out", default=None, help="tables output (default src/dsp/10_tables.cmajor)")
    ap.add_argument("--bodies-json", default=None, help="UI json output (default plugin/bodies.json)")
    ap.add_argument("--tests-data", default=None, help="namespace-form copy for the cmajtest (default tests/tables_data.cmajor)")
    ap.add_argument("--no-tests-data", action="store_true", help="do not write the tests data copy")
    ap.add_argument("--externals-json", default=None, help="write the manifest externals object to this file")
    ap.add_argument("--stdout", action="store_true", help="print the Cmajor tables to stdout instead of writing files")
    args = ap.parse_args(argv)

    root = os.path.abspath(args.root)
    spec = load_spec(root)
    try:
        recs, hashes = load_recipes(os.path.join(root, "bodies"))
    except (OSError, RecipeError) as e:
        print("bodytab: %s" % e, file=sys.stderr)
        return 2
    errs = validate_structure(recs, spec)
    if errs:
        for e in errs:
            print("error: " + e, file=sys.stderr)
        return 1
    try:
        ghz, rows, cons = resolve(recs)
    except (RecipeError, KeyError) as e:
        print("bodytab: %s" % e, file=sys.stderr)
        return 1
    verrs, warns = validate_values(rows, ghz)
    if verrs:
        for e in verrs:
            print("error: " + e, file=sys.stderr)
        return 1
    consts, arrays = build_tables(ghz, rows, cons)
    for a in arrays:
        if len(a["values"]) != expected_len(a["name"]) and not a["name"].startswith("hybrid"):
            print("error: internal: table %s has %d values" % (a["name"], len(a["values"])), file=sys.stderr)
            return 1
    names = spec["anchors"]

    if args.emit == "namespace":
        text = emit_namespace(consts, arrays, hashes, names)
    elif args.emit == "main":
        text = emit_main(consts, arrays, hashes, names)
    else:
        text = emit_external(consts, arrays, hashes, names)

    out = args.out or os.path.join(root, "src", "dsp", "10_tables.cmajor")
    ui_path = args.bodies_json or os.path.join(root, "plugin", "bodies.json")
    td = args.tests_data or os.path.join(root, "tests", "tables_data.cmajor")
    ui_text = jdump(build_ui_json(spec, rows, cons, hashes)) + "\n"
    ns_text = emit_namespace(consts, arrays, hashes, names, tests_copy=True) if args.emit != "namespace" else text
    if args.emit == "namespace":
        ns_text = emit_namespace(consts, arrays, hashes, names, tests_copy=True)
    outputs = [(out, text)]
    outputs.append((ui_path, ui_text))
    if not args.no_tests_data:
        outputs.append((td, ns_text))

    if args.check:
        print(check_table(rows, warns))
        stale = []
        for path, txt in outputs:
            cur = None
            if os.path.exists(path):
                with open(path, encoding="utf-8") as f:
                    cur = f.read()
            state = "up to date" if cur == txt else ("MISSING" if cur is None else "STALE")
            if cur != txt:
                stale.append(path)
            print("  %-28s %s" % (os.path.relpath(path, root), state))
        print("ok: %d recipes, schema %s, generator %s, emit form %s" % (len(recs), SCHEMA, GENERATOR, args.emit))
        if not args.write:
            if stale:
                print("note: outputs differ from the recipes; run without --check (or with --check --write) to regenerate"
                      + (" [--strict: failing]" if args.strict else ""))
                return 1 if args.strict else 0
            return 0
    if args.stdout:
        sys.stdout.write(text)
        return 0
    changed = [write_if_changed(path, txt) for path, txt in outputs]
    if args.externals_json:
        write_if_changed(args.externals_json, externals_json(arrays) + "\n")
    print("bodytab: %s (%s)" % (", ".join(os.path.relpath(p, root) for p, _ in outputs), "updated" if any(changed) else "unchanged"))
    return 0


if __name__ == "__main__":
    sys.exit(main())

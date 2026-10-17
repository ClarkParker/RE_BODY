#!/usr/bin/env python3
"""render_ci.py - render-and-measure CI for RE-BODY (Python 3, numpy, stdlib only).

Ported from PHYSIFY tools/golden_ci.py + plugin/analyze.py (init-patching trick, f0 by
autocorrelation, BS.1770 LUFS, T60) and extended with body metrics (impulse-response
peaks, octave-band T60 from the energy decay curve, DC, stereo correlation).

Run from the repo root (paths are resolved from this file, so any cwd works):

  python3 tools/render_ci.py golden-original [--rates 44100,48000,96000]
      render the ORIGINAL BODY (reference/body_original/BODY.cmajorpatch) for its 8 anchors
      (Morph 0..7, Decay 50, Mix 100) -> tools/golden/body_original.json (+ doc tables)
  python3 tools/render_ci.py run [--anchors 0..10] [--rates ...] [--quick] [--set "A Touch=60"]
      render plugin/RE_BODY.cmajorpatch for the 11 anchors (Line A only, Decay 50,
      Material 50, Mix 100) -> tools/golden/re_body_latest.json + docs/dev/04_RENDER_CI.md
  python3 tools/render_ci.py compare [--gate] [--allow-silent]
      RE-BODY anchors vs the original's mapped anchors (0>0 1>1 3>2 5>3 7>4 8>5 9>6 10>7):
      D44 gates: f0 +-5 ct, LUFS (pink) +-1 dB; new anchors 2,4,6 LUFS within +-3 dB of the mapped mean;
      band T60 is only reported; --gate exits 1 on any failure
  python3 tools/render_ci.py check three-line-protector|hold-stability|split-complementary [--gate]
      the plan's extra gates (P3/P4b), see docs/dev/04_RENDER_CI.md
  python3 tools/render_ci.py selftest
      numpy-only checks of the measurement code itself (LUFS vs EBU, T60, f0, peaks)

Environment: CMAJ = path of the cmaj binary (default below); RENDER_CI_WORK = scratch dir for
generated stimuli, patched patch copies, renders and the metrics cache (default
<tmp>/render_ci). Audio never goes into the repo: only JSON metrics and markdown are written.

Exact render command (one per stimulus x anchor x rate):
  cmaj render --input=<stim.wav> --output=<out.wav> --rate=<sr> <patched-copy>/<Name>.cmajorpatch
(`--name value` with a space is NOT accepted by cmaj 1.0.3175, only `--name=value`.)

Renderer pre-roll (measured, docs/dev/04_RENDER_CI.md): `cmaj render` discards the first 20480
frames of the INPUT at every sample rate (output is zero there, nothing rings in later; not a
time shift, later frames stay aligned). Every stimulus therefore gets LEAD_SECONDS = 0.5 s of
digital silence in front (>= 20480 frames at 44.1/48/96 kHz), the lead is stripped from the
output before analysis, and `calibrate_preroll` re-measures the pre-roll with an impulse train
through the original BODY at Bypass = 1 (exact pass-through) and refuses to run if the lead is
too short.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import datetime
import hashlib
import json
import math
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

import numpy as np

# --------------------------------------------------------------------------------------
# Paths and constants
# --------------------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CMAJ = "/root/.cache/cmaj/1.0.3175/cmaj-bin/linux/x64/cmaj"
CMAJ = os.environ.get("CMAJ") or DEFAULT_CMAJ
WORK = Path(os.environ.get("RENDER_CI_WORK") or (Path(tempfile.gettempdir()) / "render_ci"))
GOLDEN_DIR = ROOT / "tools" / "golden"
ORIG_JSON = GOLDEN_DIR / "body_original.json"
RE_JSON = GOLDEN_DIR / "re_body_latest.json"
CHECKS_JSON = GOLDEN_DIR / "re_body_checks.json"
DOC = ROOT / "docs" / "dev" / "04_RENDER_CI.md"

METRICS_VERSION = 2          # bump when a metric definition changes (invalidates the cache)
SEED = 20261017
RATES = (44100, 48000, 96000)
STIMULI = ("silence", "impulse", "pink", "sine", "bursts")
QUICK_STIMULI = ("silence", "impulse", "pink", "sine")
IR_SECONDS = 4.0             # impulse stimulus length (impulse at 0.5 s)
IMPULSE_AT = 0.5
LEAD_SECONDS = 0.5           # digital silence prepended to every stimulus (renderer pre-roll, see below)
LEAD_MARGIN = 1024           # frames of safety between the measured pre-roll and the stimulus start
BAND_CENTRES = (125, 250, 500, 1000, 2000, 4000, 8000)
SILENT_DB = -90.0            # "silent" / "silence in -> silence out" threshold (dBFS RMS)
DC_LIMIT = 0.01
# D44: hard gates = pink LUFS and ring/sine f0. Band T60 is reported against t60_rel (flag only, never a gate).
# New anchors (no BODY counterpart) must sit within lufs_new_db of the mean LUFS of the mapped anchors.
TOL = {"f0_ct": 5.0, "t60_rel": 0.15, "lufs_db": 1.0, "lufs_new_db": 3.0}
BAND_MIN_REL_DB = -40.0      # compare ignores bands more than 40 dB below the total energy
F0_IR_MIN_CONF = 0.75        # compare checks the impulse-ring pitch only if the original is this periodic
                             # (and its own ring pitch is stable across the rendered rates within F0_TOL ct)

RE_ANCHORS = ["Bass Drum", "Snare", "Timpani", "Piano", "Guitar", "Ukulele", "Fiddle",
              "Clarinet", "Oboe", "Sax", "Obosaxolele"]
ORIG_ANCHORS = ["Bass Drum", "Snare", "Piano", "Ukulele", "Clarinet", "Oboe", "Sax", "Obosaxolele"]
# RE-BODY anchor -> original Morph index (the original's series is 0,1,3,6,2,4,5 + hybrid)
ANCHOR_MAP = {0: 0, 1: 1, 3: 2, 5: 3, 7: 4, 8: 5, 9: 6, 10: 7}
NEW_ANCHORS = (2, 4, 6)      # Timpani, Guitar, Fiddle: no counterpart in BODY (D44: LUFS vs the mapped mean)

DEFAULT_SETTINGS = dict(decay=50.0, mix=100.0, bypass=0.0, material=50.0,
                        enableA=1.0, enableB=0.0, enableC=0.0, hold=0.0)
OPTIONAL_KEYS = {"enableA", "enableB", "enableC", "hold"}   # skipped if the plugin has no such name

TARGETS = {
    "original": dict(
        patch="reference/body_original/BODY.cmajorpatch",
        params=dict(morph="Morph", decay="Decay", mix="Mix", bypass="Bypass"),
    ),
    "rebody": dict(
        patch="plugin/RE_BODY.cmajorpatch",
        params=dict(morph="A Morph", decay="A Decay", material="A Material", mix="Mix",
                    bypass="Bypass", enableA="A Enable", enableB="B Enable",
                    enableC="C Enable", hold="A Hold"),
    ),
}

_lock = threading.Lock()
_cmaj_version_cache: list[str] = []


class RenderError(RuntimeError):
    pass


# --------------------------------------------------------------------------------------
# WAV I/O (RIFF chunk parser: handles JUNK chunks, WAVE_FORMAT_EXTENSIBLE, PCM 16/24/32, float)
# --------------------------------------------------------------------------------------
def write_wav24(path: Path, x: np.ndarray, sr: int) -> None:
    """x: [n, ch] float in [-1, 1) -> 24-bit PCM WAV."""
    x = np.atleast_2d(x.T).T if x.ndim == 1 else x
    ch = x.shape[1]
    i = np.clip(np.round(x * 8388608.0), -8388608, 8388607).astype(np.int64)
    b = np.zeros((i.shape[0], ch, 3), dtype=np.uint8)
    b[..., 0] = i & 255
    b[..., 1] = (i >> 8) & 255
    b[..., 2] = (i >> 16) & 255
    data = b.tobytes()
    hdr = (b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVEfmt "
           + struct.pack("<IHHIIHH", 16, 1, ch, sr, sr * ch * 3, ch * 3, 24)
           + b"data" + struct.pack("<I", len(data)))
    path.write_bytes(hdr + data)


def read_wav(path: Path) -> tuple[np.ndarray, int]:
    """-> ([n, ch] float64, sample rate)."""
    d = Path(path).read_bytes()
    if d[:4] != b"RIFF" or d[8:12] != b"WAVE":
        raise RenderError(f"{path}: not a RIFF/WAVE file")
    p, fmt, data = 12, None, None
    while p + 8 <= len(d):
        cid, sz = d[p:p + 4], struct.unpack("<I", d[p + 4:p + 8])[0]
        body = d[p + 8:p + 8 + sz]
        if cid == b"fmt ":
            tag, ch, sr, _, _, bits = struct.unpack("<HHIIHH", body[:16])
            if tag == 0xFFFE and len(body) >= 26:          # WAVE_FORMAT_EXTENSIBLE
                tag = struct.unpack("<H", body[24:26])[0]
            fmt = (tag, ch, sr, bits)
        elif cid == b"data":
            data = body
        p += 8 + sz + (sz & 1)
    if fmt is None or data is None:
        raise RenderError(f"{path}: missing fmt/data chunk")
    tag, ch, sr, bits = fmt
    if tag == 3 and bits == 32:
        v = np.frombuffer(data, dtype="<f4").astype(np.float64)
    elif tag == 3 and bits == 64:
        v = np.frombuffer(data, dtype="<f8").astype(np.float64)
    elif tag == 1 and bits == 16:
        v = np.frombuffer(data, dtype="<i2").astype(np.float64) / 32768.0
    elif tag == 1 and bits == 24:
        n = len(data) // 3
        b = np.frombuffer(data[:n * 3], dtype=np.uint8).reshape(n, 3).astype(np.int32)
        i = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
        i = np.where(i >= 1 << 23, i - (1 << 24), i)
        v = i.astype(np.float64) / 8388608.0
    elif tag == 1 and bits == 32:
        v = np.frombuffer(data, dtype="<i4").astype(np.float64) / 2147483648.0
    else:
        raise RenderError(f"{path}: unsupported WAV format tag={tag} bits={bits}")
    v = v[: (len(v) // ch) * ch]
    return v.reshape(-1, ch), sr


# --------------------------------------------------------------------------------------
# Stimuli (all dual-mono, 24-bit, deterministic)
# --------------------------------------------------------------------------------------
def _fade(n: int, sr: int, ms: float = 5.0) -> np.ndarray:
    k = max(1, int(sr * ms / 1000.0))
    w = np.ones(n)
    ramp = 0.5 - 0.5 * np.cos(np.pi * np.arange(k) / k)
    w[:k] = ramp
    w[-k:] = ramp[::-1]
    return w


def pink_noise(n: int, sr: int, rng: np.random.Generator) -> np.ndarray:
    """1/f power spectrum from 20 Hz up (FFT shaping of white noise)."""
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1.0 / sr)
    shape = np.zeros_like(f)
    m = f >= 20.0
    shape[m] = 1.0 / np.sqrt(f[m])
    return np.fft.irfft(X * shape, n)


def burst_times() -> list[float]:
    return [0.2 + 0.3 * k for k in range(5)]


def make_stimulus(name: str, sr: int, ir_seconds: float = IR_SECONDS) -> np.ndarray:
    """-> [n, 2] float64. silence 2 s | impulse (unit, at 0.5 s) | pink -20 dBFS RMS 2 s + 2 s
    silence | 440 Hz sine -12 dBFS peak 2 s | 5 noise-burst clicks (-6 dBFS peak) 0.3 s apart."""
    rng = np.random.default_rng(SEED)
    if name == "silence":
        m = np.zeros(int(2.0 * sr))
    elif name == "impulse":
        m = np.zeros(int(round(ir_seconds * sr)))
        m[int(round(IMPULSE_AT * sr))] = 1.0
    elif name == "pink":
        n = int(2.0 * sr)
        p = pink_noise(n, sr, rng) * _fade(n, sr)
        p *= 10 ** (-20.0 / 20.0) / np.sqrt(np.mean(p ** 2))
        m = np.concatenate([p, np.zeros(int(2.0 * sr))])
    elif name == "sine":
        n = int(2.0 * sr)
        t = np.arange(n) / sr
        m = 10 ** (-12.0 / 20.0) * np.sin(2 * np.pi * 440.0 * t) * _fade(n, sr)
    elif name == "bursts":
        m = np.zeros(int(round(2.5 * sr)))
        k = int(0.004 * sr)
        noise = rng.standard_normal(k)
        env = np.exp(-np.arange(k) / (0.001 * sr))
        b = noise * env
        b *= 10 ** (-6.0 / 20.0) / np.max(np.abs(b))
        for t in burst_times():
            i = int(round(t * sr))
            m[i:i + k] = b
    else:
        raise ValueError(f"unknown stimulus {name}")
    return np.stack([m, m], axis=1)


def lead_frames(sr: int) -> int:
    return int(round(LEAD_SECONDS * sr))


def with_lead(x: np.ndarray, sr: int) -> np.ndarray:
    return np.concatenate([np.zeros((lead_frames(sr), x.shape[1])), x])


def ensure_stimulus(name: str, sr: int, ir_seconds: float = IR_SECONDS) -> Path:
    """WAV of lead-in silence + stimulus (cached in the work dir)."""
    d = WORK / "stim"
    path = d / f"{name}_{sr}_{ir_seconds:g}_L{lead_frames(sr)}.wav"
    with _lock:
        if not path.exists():
            d.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(".tmp")
            write_wav24(tmp, with_lead(make_stimulus(name, sr, ir_seconds), sr), sr)
            tmp.replace(path)
    return path


# --------------------------------------------------------------------------------------
# Patch preparation (init-patching) and rendering
# --------------------------------------------------------------------------------------
def set_init(src: str, pname: str, val: float) -> tuple[str, bool]:
    """Replace the `init:` number of the annotation whose name is exactly `pname`."""
    pat = r'(name:\s*"' + re.escape(pname) + r'"[^\]]*?init:\s*)[-+0-9.eE]+'
    s, n = re.subn(pat, lambda m: m.group(1) + repr(float(val)), src, count=1)
    return s, n == 1


def tree_hash(folder: Path) -> str:
    h = hashlib.sha1()
    for p in sorted(folder.rglob("*")):
        if p.is_file() and "__pycache__" not in p.parts:
            h.update(str(p.relative_to(folder)).encode())
            h.update(p.read_bytes())
    return h.hexdigest()


def prepare_patch(target: str, values: dict[str, float], optional: set[str], dest: Path) -> Path:
    """Copy the patch folder to `dest`, patch init values; returns the manifest path."""
    manifest_src = ROOT / TARGETS[target]["patch"]
    shutil.copytree(manifest_src.parent, dest)
    manifest = dest / manifest_src.name
    mj = json.loads(manifest.read_text(encoding="utf-8"))
    sources = mj.get("source")
    sources = [sources] if isinstance(sources, str) else list(sources or [])
    texts = {s: (dest / s).read_text(encoding="utf-8") for s in sources}
    for pname, val in values.items():
        done = False
        for s in sources:
            texts[s], ok = set_init(texts[s], pname, val)
            if ok:
                done = True
                break
        if not done and pname not in optional:
            raise RenderError(f"parameter {pname!r} not found in the DSP source of {target}")
    for s, t in texts.items():
        (dest / s).write_text(t, encoding="utf-8")
    return manifest


def cmaj_version() -> str:
    with _lock:
        if not _cmaj_version_cache:
            try:
                r = subprocess.run([CMAJ, "version"], capture_output=True, text=True, timeout=60)
                m = re.search(r"Cmajor Version:\s*([\w.\-]+)", r.stdout + r.stderr) \
                    or re.search(r"(\d+\.\d+\.\d+)", r.stdout + r.stderr)
                _cmaj_version_cache.append(m.group(1) if m else "unknown")
            except OSError:
                _cmaj_version_cache.append("missing")
        return _cmaj_version_cache[0]


def render_audio(target: str, values: dict[str, float], optional: set[str], wav_in: Path,
                 sr: int, lead: int = 0, n_expected: int | None = None,
                 channels: int | None = None, keep: bool = False,
                 patch_override: Path | None = None, timeout: int = 1800) -> np.ndarray:
    """Patch + run `cmaj render` + strip the `lead` frames. Returns the aligned output [n, ch]."""
    runs = WORK / "runs"
    runs.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix="r_", dir=runs))
    try:
        if patch_override is not None:
            dest = tmp / "patch"
            shutil.copytree(patch_override.parent, dest)
            manifest = dest / patch_override.name
        else:
            manifest = prepare_patch(target, values, optional, tmp / "patch")
        out = tmp / "out.wav"
        cmd = [CMAJ, "render", f"--input={wav_in}", f"--output={out}", f"--rate={sr}"]
        if channels:
            cmd.append(f"--channels={channels}")
        cmd.append(str(manifest))
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        if r.returncode != 0 or not out.exists():
            tail = (r.stdout + r.stderr).strip()[-600:]
            raise RenderError(f"cmaj render failed (rc={r.returncode}): {tail}")
        x, _ = read_wav(out)
    finally:
        if not keep:
            shutil.rmtree(tmp, ignore_errors=True)
    if lead:
        x = x[lead:]
    if n_expected is not None:
        if len(x) < n_expected:
            x = np.concatenate([x, np.zeros((n_expected - len(x), x.shape[1]))])
        x = x[:n_expected]
    return x


def calibrate_preroll(sr: int) -> int:
    """Renderer pre-roll in frames: an impulse train (one frame in 8, from frame 0) goes through
    the ORIGINAL BODY at Bypass = 1 (exact pass-through, result = dry); the first non-zero output
    frame is the number of leading frames the renderer discards (20480 in cmaj 1.0.3175 at every
    rate). Raises if the stimulus lead-in would be shorter than that plus LEAD_MARGIN."""
    cache = WORK / f"preroll_v2_{sr}_{cmaj_version()}.json"
    try:
        frames = int(json.loads(cache.read_text())["frames"])
    except (OSError, ValueError, KeyError):
        x = np.zeros((int(0.8 * sr), 2))
        x[::8] = 0.5
        wav = WORK / "stim" / f"preroll_train_{sr}.wav"
        wav.parent.mkdir(parents=True, exist_ok=True)
        write_wav24(wav, x, sr)
        y = render_audio("original", {"Morph": 0.0, "Mix": 100.0, "Bypass": 1.0}, set(), wav, sr)
        nz = np.nonzero(np.abs(y).max(axis=1) > 0.0)[0]
        if len(nz) == 0:
            raise RenderError("pre-roll calibration: bypass render is silent")
        frames = int(nz[0])
        cache.write_text(json.dumps({"frames": frames}))
    if frames + LEAD_MARGIN > lead_frames(sr):
        raise RenderError(f"renderer pre-roll {frames} frames at {sr} Hz exceeds the stimulus lead-in "
                          f"({lead_frames(sr)} frames); raise LEAD_SECONDS")
    return frames


# --------------------------------------------------------------------------------------
# Measurement DSP (numpy only)
# --------------------------------------------------------------------------------------
def db(v: float, floor: float = -200.0) -> float:
    return float(max(floor, 20.0 * math.log10(max(float(v), 1e-30))))


def next_fast_len(n: int) -> int:
    while True:
        m = n
        for p in (2, 3, 5):
            while m % p == 0:
                m //= p
        if m == 1:
            return n
        n += 1


def _biquad_hp(f0, fs, q):
    w = 2 * math.pi * f0 / fs
    c, a = math.cos(w), math.sin(w) / (2 * q)
    a0 = 1 + a
    return ((1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, -2 * c / a0, (1 - a) / a0)


def _biquad_lp(f0, fs, q):
    w = 2 * math.pi * f0 / fs
    c, a = math.cos(w), math.sin(w) / (2 * q)
    a0 = 1 + a
    return ((1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0, -2 * c / a0, (1 - a) / a0)


def octave_band_sos(fc: float, fs: float):
    """8th-order Butterworth band-pass (two 4th-order skirts) from fc/sqrt2 to fc*sqrt2."""
    q1, q2 = 0.5411961001461970, 1.3065629648763766
    lo, hi = fc / math.sqrt(2.0), min(fc * math.sqrt(2.0), 0.45 * fs)
    return [_biquad_hp(lo, fs, q1), _biquad_hp(lo, fs, q2), _biquad_lp(hi, fs, q1), _biquad_lp(hi, fs, q2)]


def k_weight_sos(fs: float):
    """BS.1770 K-weighting (stage 1 high shelf, stage 2 RLB high-pass) for any sample rate."""
    g, q, fc = 3.999843853973347, 0.7071752369554196, 1681.9744509555319
    k = math.tan(math.pi * fc / fs)
    vh = 10 ** (g / 20.0)
    vb = vh ** 0.4996667741545416
    a0 = 1 + k / q + k * k
    s1 = ((vh + vb * k / q + k * k) / a0, 2 * (k * k - vh) / a0, (vh - vb * k / q + k * k) / a0,
          2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0)
    q, fc = 0.5003270373238773, 38.13547087602444
    k = math.tan(math.pi * fc / fs)
    a0 = 1 + k / q + k * k
    s2 = (1.0, -2.0, 1.0, 2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0)
    return [s1, s2]


def fft_filter(x: np.ndarray, sos, pad: int) -> np.ndarray:
    """Causal IIR cascade applied through the exact digital frequency response (zero padding
    `pad` frames absorbs the filter tail, no wrap-around error). x: [n] or [n, ch]."""
    n = x.shape[0]
    big = next_fast_len(n + pad)
    X = np.fft.rfft(x, big, axis=0)
    z1 = np.exp(-1j * 2 * np.pi * np.arange(big // 2 + 1) / big)
    z2 = z1 * z1
    H = np.ones_like(z1)
    for b0, b1, b2, a1, a2 in sos:
        H = H * (b0 + b1 * z1 + b2 * z2) / (1.0 + a1 * z1 + a2 * z2)
    if x.ndim == 2:
        H = H[:, None]
    return np.fft.irfft(X * H, big, axis=0)[:n]


def lufs_integrated(x: np.ndarray, sr: int) -> float | None:
    """ITU-R BS.1770 integrated loudness: K-weighting, 400 ms blocks, 75 % overlap, absolute
    gate -70 LUFS, relative gate -10 LU, channel weights 1.0. None if gated away (-inf)."""
    n = x.shape[0]
    block, hop = int(round(0.4 * sr)), int(round(0.1 * sr))
    if n < block:
        return None
    y = fft_filter(x, k_weight_sos(sr), pad=int(0.5 * sr))
    cs = np.concatenate([np.zeros((1, y.shape[1])), np.cumsum(y * y, axis=0)])
    starts = np.arange(0, n - block + 1, hop)
    z = ((cs[starts + block] - cs[starts]) / block).sum(axis=1)
    lb = -0.691 + 10 * np.log10(z + 1e-30)
    m = lb > -70.0
    if not m.any():
        return None
    rel = -0.691 + 10 * math.log10(float(z[m].mean())) - 10.0
    m &= lb > rel
    if not m.any():
        return None
    return float(-0.691 + 10 * math.log10(float(z[m].mean())))


def f0_autocorr(x: np.ndarray, sr: int, fmin: float = 30.0, fmax: float = 2000.0):
    """Normalised autocorrelation (both channels summed), first strong peak after the first zero
    crossing (>= 0.9 x max of the lag range: avoids octave-down picks), parabolic lag
    interpolation. -> (f0 | None, conf); None when conf <= 0.3 or no period is found."""
    seg = x - x.mean(axis=0, keepdims=True)
    if math.sqrt(float((seg ** 2).mean())) < 1e-5:
        return None, 0.0
    n = seg.shape[0]
    big = next_fast_len(2 * n)
    S = np.fft.rfft(seg, big, axis=0)
    ac = np.fft.irfft((np.abs(S) ** 2).sum(axis=1), big)[:n]
    ac = ac / ac[0]
    lo, hi = max(2, int(sr / fmax)), min(int(sr / fmin), n - 2)
    if hi <= lo + 2:
        return None, 0.0
    # start the peak search after the first zero crossing: a smooth low-frequency signal
    # correlates strongly at tiny lags, which is not a period
    neg = np.nonzero(ac[1:hi + 1] < 0)[0]
    if len(neg) == 0:
        return None, 0.0
    lo = max(lo, int(neg[0]) + 1)
    if hi <= lo + 2:
        return None, 0.0
    s = ac[lo:hi + 1]
    mx = float(s.max())
    k = None
    for i in range(1, len(s) - 1):
        if s[i] > s[i - 1] and s[i] >= s[i + 1] and s[i] >= 0.9 * mx:
            k = lo + i
            break
    if k is None:
        k = lo + int(np.argmax(s))
    y0, y1, y2 = ac[k - 1], ac[k], ac[k + 1]
    den = y0 - 2 * y1 + y2
    delta = 0.5 * (y0 - y2) / den if den != 0 else 0.0
    lag = k + max(-1.0, min(1.0, delta))
    conf = float(y1)
    return (sr / lag if conf > 0.3 else None), conf


def spectral_peaks(ir: np.ndarray, sr: int, nmax: int = 12, seconds: float = 1.0):
    """Top peaks of the impulse response: FFT of the first `seconds` with a falling half-Hann
    window (1 at the strike -> 0 at the end; a full Hann would zero the first 0.5 s and bury
    short-lived modes), 4x zero padding, power sum of both channels, parabolic interpolation.
    -> (list of [Hz, dB re strongest peak], dB of the strongest peak re full-scale amplitude)."""
    n = int(seconds * sr)
    seg = ir[:n]
    if len(seg) < n:
        seg = np.concatenate([seg, np.zeros((n - len(seg), seg.shape[1]))])
    w = 0.5 * (1 + np.cos(np.pi * np.arange(n) / n))
    nfft = 1 << int(math.ceil(math.log2(n * 4)))
    X = np.fft.rfft(seg * w[:, None], nfft, axis=0)
    amp = np.sqrt((np.abs(X) ** 2).sum(axis=1)) * 2.0 / w.sum()
    d = 20 * np.log10(amp + 1e-20)
    df = sr / nfft
    lo, hi = int(30.0 / df), int(min(20000.0, 0.45 * sr) / df)
    s = d[lo:hi]
    loc = np.nonzero((s[1:-1] > s[:-2]) & (s[1:-1] >= s[2:]))[0] + 1
    if len(loc) == 0:
        return [], None
    order = loc[np.argsort(-s[loc])]
    top = float(s[order[0]])
    acc: list[tuple[float, float]] = []
    for k in order:
        if s[k] < top - 70.0:
            break
        fk = (lo + k) * df
        if any(abs(fk - fa) < max(4.0, 0.02 * fa) for fa, _ in acc):
            continue
        y0, y1, y2 = s[k - 1], s[k], s[k + 1]
        den = y0 - 2 * y1 + y2
        delta = 0.5 * (y0 - y2) / den if den != 0 else 0.0
        acc.append(((lo + k + delta) * df, float(y1 - 0.25 * (y0 - y2) * delta)))
        if len(acc) >= nmax:
            break
    return [[round(float(f), 1), round(float(v - top), 1)] for f, v in acc], round(float(top), 2)


def t60_from_energy(e: np.ndarray, sr: int):
    """Schroeder backward integration of the per-sample energy `e` (starting at the impulse),
    linear fit of the decay curve between -5 and -35 dB, T60 = -60 / slope.
    -> (T60 seconds | None, truncated flag). truncated = the band is still more than 40 dB
    above silence in the last 100 ms, so the integral was cut short (T60 biased low)."""
    if e.size < 16 or float(e.sum()) <= 1e-24:
        return None, False
    edc = np.cumsum(e[::-1])[::-1]
    edb = 10 * np.log10(np.maximum(edc / edc[0], 1e-30))
    i5 = int(np.argmax(edb <= -5.0))
    i35 = int(np.argmax(edb <= -35.0))
    if edb[i5] > -5.0 or edb[i35] > -35.0 or i35 - i5 < 8:
        return None, False
    t = np.arange(i5, i35 + 1) / sr
    slope = float(np.polyfit(t, edb[i5:i35 + 1], 1)[0])
    if slope >= 0:
        return None, False
    k = max(1, int(0.01 * sr))
    sm = np.convolve(e, np.ones(k) / k, mode="valid")
    tail = float(e[-max(1, int(0.1 * sr)):].mean())
    trunc = bool(tail > 1e-4 * float(sm.max()))
    return -60.0 / slope, trunc


def band_t60(ir: np.ndarray, sr: int):
    """Octave bands 125 Hz .. 8 kHz. -> (t60 list, band energy re total dB list, truncated idx)."""
    total = float((ir ** 2).sum())
    t60s, rel, trunc = [], [], []
    for i, fc in enumerate(BAND_CENTRES):
        y = fft_filter(ir, octave_band_sos(fc, sr), pad=int(0.5 * sr))
        e = (y ** 2).sum(axis=1)
        rel.append(round(10 * math.log10(max(float(e.sum()) / max(total, 1e-30), 1e-30)), 1))
        t, tr = t60_from_energy(e, sr)
        t60s.append(None if t is None else round(t, 4))
        if tr:
            trunc.append(i)
    return t60s, rel, trunc


# --------------------------------------------------------------------------------------
# Per-render metrics
# --------------------------------------------------------------------------------------
def r3(v, nd=3):
    return None if v is None else round(float(v), nd) + 0.0      # + 0.0 turns -0.0 into 0.0


def analyze(stim: str, x: np.ndarray, sr: int, ir_seconds: float = IR_SECONDS) -> dict:
    flags: list[str] = []
    fin = bool(np.isfinite(x).all())
    if not fin:
        flags.append("nonfinite")
        x = np.nan_to_num(x, nan=0.0, posinf=0.0, neginf=0.0)
    peak = float(np.abs(x).max()) if x.size else 0.0
    rms = math.sqrt(float((x ** 2).mean())) if x.size else 0.0
    dc = float(np.abs(x.mean(axis=0)).max())
    corr = None
    if x.shape[1] >= 2 and x[:, 0].std() > 1e-9 and x[:, 1].std() > 1e-9:
        corr = float(np.corrcoef(x[:, 0], x[:, 1])[0, 1])
    m = {"fin": fin, "peak": r3(db(peak), 2), "rms": r3(db(rms), 2), "dc": float(f"{dc:.3g}"),
         "corr": r3(corr, 4)}
    if stim == "silence":
        if db(rms) >= SILENT_DB:
            flags.append("silence-leak")
    else:
        if db(rms) < SILENT_DB and stim != "impulse":
            flags.append("silent")
    if dc > DC_LIMIT:
        flags.append("dc>0.01")
    if peak >= 1.0:
        flags.append("clip")

    if stim != "silence" and (db(rms) >= SILENT_DB or stim == "impulse"):
        m["lufs"] = r3(lufs_integrated(x, sr), 2)
    else:
        m["lufs"] = None

    if stim == "impulse":
        t0 = int(round(IMPULSE_AT * sr))
        ir = x[t0:]
        ipeak = float(np.abs(ir).max()) if ir.size else 0.0
        if db(ipeak) < SILENT_DB:
            flags.append("silent")
            m.update(onset_ms=None, peaks=[], peak_abs=None, t60=[None] * len(BAND_CENTRES),
                     band_db=[None] * len(BAND_CENTRES))
        else:
            thr = ipeak * 10 ** (-60.0 / 20.0)
            nz = np.nonzero(np.abs(ir).max(axis=1) > thr)[0]
            m["onset_ms"] = r3(1000.0 * nz[0] / sr, 3) if len(nz) else None
            peaks, pabs = spectral_peaks(ir, sr)
            t60s, rel, trunc = band_t60(ir, sr)
            m.update(peaks=peaks, peak_abs=pabs, t60=t60s, band_db=rel)
            if trunc:
                m["t60_trunc"] = trunc
            e_all = (ir ** 2).sum(axis=1)
            tb, _ = t60_from_energy(e_all, sr)
            m["t60_bb"] = r3(tb, 4)
            fi, ci = f0_autocorr(ir[int(0.02 * sr):int(0.5 * sr)], sr)   # ring pitch of tuned bodies
            m["f0_ir"] = r3(fi, 3)
            m["f0_ir_conf"] = r3(ci, 3)
    elif stim == "pink":
        n2 = int(2.0 * sr)
        m["rms_active"] = r3(db(math.sqrt(float((x[:n2] ** 2).mean()))), 2)
        m["rms_tail"] = r3(db(math.sqrt(float((x[int(2.5 * sr):] ** 2).mean()))), 2)
        lin = lufs_integrated(make_stimulus("pink", sr), sr)
        m["lufs_in"] = r3(lin, 2)
        if m["lufs"] is not None and lin is not None:
            m["gain_lufs"] = r3(m["lufs"] - lin, 2)
        if m["rms_active"] < SILENT_DB and "silent" not in flags:
            flags.append("silent")
    elif stim == "sine":
        seg = x[int(0.5 * sr):int(1.9 * sr)]
        f0, conf = f0_autocorr(seg, sr)
        m["f0"] = r3(f0, 3)
        m["f0_conf"] = r3(conf, 3)
        m["rms_active"] = r3(db(math.sqrt(float((x[:int(2.0 * sr)] ** 2).mean()))), 2)
    elif stim == "bursts":
        w = int(0.3 * sr)
        m["click_peaks"] = [r3(db(float(np.abs(x[int(round(t * sr)):int(round(t * sr)) + w]).max())), 1)
                            for t in burst_times()]
    if flags:
        m["flags"] = sorted(set(flags))
    return m


# --------------------------------------------------------------------------------------
# Job execution (threads: the heavy part is the cmaj subprocess)
# --------------------------------------------------------------------------------------
def build_params(target: str, anchor: int | None, settings: dict, extra: dict | None = None):
    """-> ({actual param name: value}, set of optional names)."""
    names = TARGETS[target]["params"]
    s = dict(DEFAULT_SETTINGS)
    s.update(settings or {})
    vals: dict[str, float] = {}
    opt: set[str] = set()
    for key, pname in names.items():
        if key == "morph":
            if anchor is None:
                continue
            vals[pname] = float(anchor)
        elif key in s:
            vals[pname] = float(s[key])
        if key in OPTIONAL_KEYS:
            opt.add(pname)
    for k, v in (extra or {}).items():
        vals[k] = float(v)
    return vals, opt


def metrics_for(target: str, thash: str, anchor: int, stim: str, sr: int, settings: dict,
                extra: dict, ir_seconds: float, use_cache: bool, keep: bool) -> dict:
    values, optional = build_params(target, anchor, settings, extra)
    key = hashlib.sha1(json.dumps([METRICS_VERSION, cmaj_version(), thash, sorted(values.items()),
                                   stim, sr, ir_seconds, lead_frames(sr)]).encode()).hexdigest()[:20]
    cpath = WORK / "cache" / f"{key}.json"
    if use_cache and cpath.exists():
        try:
            return json.loads(cpath.read_text())
        except ValueError:
            pass
    wav = ensure_stimulus(stim, sr, ir_seconds)
    n = make_stimulus(stim, sr, ir_seconds).shape[0]
    try:
        x = render_audio(target, values, optional, wav, sr, lead=lead_frames(sr), n_expected=n, keep=keep)
        res = analyze(stim, x, sr, ir_seconds)
    except RenderError as e:
        return {"error": str(e)[:400]}
    except Exception as e:  # a bug in the analysis must not abort the whole matrix
        import traceback
        traceback.print_exc()
        return {"error": f"{type(e).__name__}: {e}"[:400]}
    if use_cache:
        cpath.parent.mkdir(parents=True, exist_ok=True)
        cpath.write_text(json.dumps(res))
    return res


def collect(target: str, anchors, rates, stimuli, settings, extra, jobs, use_cache, keep,
            ir_seconds=IR_SECONDS, label="") -> tuple[dict, dict]:
    """Render every (anchor, rate, stimulus). -> (results[anchor][rate][stim], preroll per rate)."""
    thash = tree_hash((ROOT / TARGETS[target]["patch"]).parent)
    prerolls = {sr: calibrate_preroll(sr) for sr in rates}
    for sr in rates:
        for st in stimuli:
            ensure_stimulus(st, sr, ir_seconds)
    tasks = [(a, sr, st) for a in anchors for sr in rates for st in stimuli]
    results: dict = {}
    done = [0]
    t_start = time.time()

    def work(t):
        a, sr, st = t
        r = metrics_for(target, thash, a, st, sr, settings, extra, ir_seconds, use_cache, keep)
        with _lock:
            done[0] += 1
            print(f"[{done[0]:>3}/{len(tasks)}] {label}anchor {a:>2} {sr:>5} Hz {st:<8}"
                  f"{' ERROR ' + r['error'][:80] if 'error' in r else ''}", file=sys.stderr)
        return t, r

    with cf.ThreadPoolExecutor(max_workers=max(1, jobs)) as ex:
        for (a, sr, st), r in ex.map(work, tasks):
            results.setdefault(str(a), {}).setdefault(str(sr), {})[st] = r
    print(f"{len(tasks)} renders in {time.time() - t_start:.1f} s", file=sys.stderr)
    return results, prerolls


# --------------------------------------------------------------------------------------
# Interpretation helpers
# --------------------------------------------------------------------------------------
def entry_silent(e: dict) -> bool:
    """True when the wet path of this (anchor, rate) entry is silent: no stimulus produces
    output above -90 dBFS (silence excluded)."""
    vals = []
    for st, m in e.items():
        if st == "silence" or "error" in m:
            continue
        r = m.get("rms_active") if st in ("pink", "sine") else m.get("rms")
        if st == "impulse":
            r = m.get("peak")
        if r is not None:
            vals.append(r)
    return bool(vals) and max(vals) < SILENT_DB


def entry_flags(e: dict) -> list[str]:
    fl: set[str] = set()
    for st, m in e.items():
        if "error" in m:
            fl.add("render error")
            continue
        for f in m.get("flags", []):
            if f == "silent":
                continue
            fl.add(f)
    if entry_silent(e):
        fl.add("wet silent")
    return sorted(fl)


def fmt(v, nd=1, none="-"):
    return none if v is None else f"{v:.{nd}f}"


def fmt_t60(v):
    if v is None:
        return "-"
    return f"{v:.3f}" if v < 1 else f"{v:.2f}"


# --------------------------------------------------------------------------------------
# JSON output
# --------------------------------------------------------------------------------------
def dump_json(obj, path: Path, depth: int = 4) -> None:
    """Dicts expanded one entry per line down to `depth`, deeper levels compact."""
    def enc(o, level):
        if isinstance(o, dict) and level < depth:
            if not o:
                return "{}"
            items = [f'{" " * (level + 1)}{json.dumps(str(k))}: {enc(v, level + 1)}' for k, v in o.items()]
            return "{\n" + ",\n".join(items) + "\n" + " " * level + "}"
        return json.dumps(o, separators=(",", ":"), allow_nan=False, ensure_ascii=False)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(enc(obj, 0) + "\n", encoding="utf-8")


def make_meta(target, settings, rates, stimuli, prerolls, ir_seconds, extra=None) -> dict:
    return {
        "tool": "tools/render_ci.py", "metrics_version": METRICS_VERSION, "target": target,
        "patch": TARGETS[target]["patch"], "cmaj": cmaj_version(),
        "generated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "settings": {k: v for k, v in settings.items() if k in TARGETS[target]["params"] and k != "morph"},
        "extra_params": extra or {}, "rates": list(rates), "stimuli": list(stimuli),
        "preroll_frames": {str(k): v for k, v in prerolls.items()},
        "lead_frames": {str(k): lead_frames(k) for k in prerolls},
        "ir_seconds": ir_seconds, "lead_seconds": LEAD_SECONDS,
        "cmd": "cmaj render --input=<lead-in + stimulus.wav> --output=<out.wav> --rate=<sr> <patched copy>/<patch>.cmajorpatch",
        "bands_hz": list(BAND_CENTRES),
        "notes": "dual-mono stimuli; peak/rms dBFS; lufs BS.1770; t60 seconds (EDC -5..-35 dB); "
                 "peaks [Hz, dB re strongest]; band_db = octave band energy re total; f0 Hz",
    }


# --------------------------------------------------------------------------------------
# Markdown (generated blocks inside docs/dev/04_RENDER_CI.md)
# --------------------------------------------------------------------------------------
def replace_block(text: str, name: str, content: str) -> str:
    b, e = f"<!-- BEGIN GENERATED: {name} -->", f"<!-- END GENERATED: {name} -->"
    block = f"{b}\n{content.rstrip()}\n{e}"
    if b in text and e in text:
        i, j = text.index(b), text.index(e) + len(e)
        return text[:i] + block + text[j:]
    return text.rstrip() + f"\n\n## Generated: {name}\n\n{block}\n"


def update_doc(blocks: dict[str, str]) -> None:
    DOC.parent.mkdir(parents=True, exist_ok=True)
    text = DOC.read_text(encoding="utf-8") if DOC.exists() else "# 04 - Render CI\n"
    for name, content in blocks.items():
        text = replace_block(text, name, content)
    DOC.write_text(text, encoding="utf-8")


def peaks_str(peaks, n=3):
    if not peaks:
        return "-"
    return "; ".join(f"{hz:g} ({d:+.1f})" for hz, d in peaks[:n])


def ring_str(imp: dict) -> str:
    f = imp.get("f0_ir")
    return "-" if f is None else f"{f:.1f} ({imp.get('f0_ir_conf', 0):.2f})"


def golden_block(j: dict) -> str:
    meta = j["meta"]
    lines = [f"Generated by `golden-original` on {meta['generated']} with cmaj {meta['cmaj']} "
             f"(Decay {meta['settings'].get('decay'):g}, Mix {meta['settings'].get('mix'):g}, "
             f"renderer pre-roll {', '.join(sorted({str(v) for v in meta['preroll_frames'].values()}))} frames, "
             f"lead-in {meta.get('lead_seconds', 0):g} s). Peaks: Hz (dB re strongest peak) of the impulse "
             f"response; T60 in seconds; f0 sine = autocorrelation f0 of the 440 Hz sine response, f0 ring = of the impulse response "
             f"(20-500 ms after the strike) with its confidence.", "",
             "| Morph | Anchor | SR | LUFS pink | top 3 peaks (Hz, dB) | T60 250 Hz | T60 1 kHz | T60 4 kHz | f0 sine (Hz) | f0 ring (Hz, conf) |",
             "|---|---|---|---|---|---|---|---|---|---|"]
    for a in sorted(j["results"], key=int):
        for sr in sorted(j["results"][a], key=int):
            e = j["results"][a][sr]
            imp, pink, sine = e.get("impulse", {}), e.get("pink", {}), e.get("sine", {})
            t = imp.get("t60") or [None] * 7
            lines.append(f"| {a} | {ORIG_ANCHORS[int(a)]} | {int(sr) // 1000 if int(sr) % 1000 == 0 else int(sr) / 1000:g} k | "
                         f"{fmt(pink.get('lufs'), 1)} | {peaks_str(imp.get('peaks'))} | {fmt_t60(t[1])} | "
                         f"{fmt_t60(t[3])} | {fmt_t60(t[5])} | {fmt(sine.get('f0'), 1)} | "
                         f"{ring_str(imp)} |")
    return "\n".join(lines)


def run_block(j: dict) -> str:
    meta = j["meta"]
    s = meta["settings"]
    lines = [f"Generated by `run` on {meta['generated']} with cmaj {meta['cmaj']}; "
             f"settings {json.dumps(s)}; extra {json.dumps(meta.get('extra_params') or {})}; "
             f"stimuli {', '.join(meta['stimuli'])}. Peak = worst case over the stimuli, DC = largest "
             f"|mean| over the stimuli, LUFS = pink noise, peaks/T60/f0 as in the golden table "
             f"(T60 bands 125 / 250 / 500 / 1k / 2k / 4k / 8k Hz).", "",
             "| Anchor | SR | peak dBFS | LUFS pink | DC | top 3 peaks (Hz, dB) | band T60 s | f0 sine (Hz) | f0 ring | flags |",
             "|---|---|---|---|---|---|---|---|---|---|"]
    for a in sorted(j["results"], key=int):
        for sr in sorted(j["results"][a], key=int):
            e = j["results"][a][sr]
            ok = {st: m for st, m in e.items() if "error" not in m}
            peaks = [m["peak"] for st, m in ok.items() if st != "silence" and m.get("peak") is not None]
            dcs = [m["dc"] for m in ok.values() if m.get("dc") is not None]
            imp, pink, sine = e.get("impulse", {}), e.get("pink", {}), e.get("sine", {})
            t = imp.get("t60") or [None] * 7
            fl = ", ".join(entry_flags(e)) or "ok"
            lines.append(f"| {a} {RE_ANCHORS[int(a)]} | {int(sr) // 1000 if int(sr) % 1000 == 0 else int(sr) / 1000:g} k | "
                         f"{fmt(max(peaks) if peaks else None, 1)} | {fmt(pink.get('lufs'), 1)} | "
                         f"{('%.1e' % max(dcs)) if dcs else '-'} | {peaks_str(imp.get('peaks'))} | "
                         f"{' / '.join(fmt_t60(v) for v in t)} | {fmt(sine.get('f0'), 1)} | {ring_str(imp)} | {fl} |")
    return "\n".join(lines)


def mapping_block() -> str:
    lines = ["| RE-BODY anchor (A Morph) | RE-BODY body | original Morph | original body |", "|---|---|---|---|"]
    for ra, oa in ANCHOR_MAP.items():
        lines.append(f"| {ra} | {RE_ANCHORS[ra]} | {oa} | {ORIG_ANCHORS[oa]} |")
    lines.append("")
    lines.append("Not compared (no counterpart in BODY): 2 Timpani, 4 Guitar, 6 Fiddle.")
    return "\n".join(lines)


# --------------------------------------------------------------------------------------
# Argument helpers
# --------------------------------------------------------------------------------------
def parse_ints(spec: str, lo: int, hi: int) -> list[int]:
    out: list[int] = []
    for tok in spec.split(","):
        tok = tok.strip()
        if not tok:
            continue
        if ".." in tok:
            a, b = tok.split("..", 1)
            out.extend(range(int(a), int(b) + 1))
        else:
            out.append(int(tok))
    bad = [v for v in out if not lo <= v <= hi]
    if bad:
        raise SystemExit(f"values out of range {lo}..{hi}: {bad}")
    return sorted(set(out))


def parse_rates(spec: str) -> list[int]:
    return [int(round(float(t) * (1000 if float(t) < 1000 else 1))) for t in spec.split(",") if t.strip()]


def parse_set(items) -> dict:
    out = {}
    for it in items or []:
        if "=" not in it:
            raise SystemExit(f"--set expects 'Name=value', got {it!r}")
        k, v = it.rsplit("=", 1)
        out[k.strip()] = float(v)
    return out


def default_jobs() -> int:
    return max(1, min(4, os.cpu_count() or 1))


def check_env() -> None:
    if not Path(CMAJ).exists():
        raise SystemExit(f"cmaj binary not found: {CMAJ} (set CMAJ=<path>)")


# --------------------------------------------------------------------------------------
# Modes
# --------------------------------------------------------------------------------------
def cmd_golden_original(args) -> int:
    check_env()
    rates = parse_rates(args.rates) if args.rates else list(RATES)
    settings = dict(decay=args.decay, mix=100.0)
    stimuli = list(STIMULI)
    results, prerolls = collect("original", list(range(8)), rates, stimuli, settings, {}, args.jobs,
                                not args.no_cache, args.keep, args.ir_seconds, label="orig ")
    out = {"meta": make_meta("original", dict(DEFAULT_SETTINGS, **settings), rates, stimuli, prerolls,
                             args.ir_seconds), "results": results}
    dump_json(out, ORIG_JSON)
    print(f"wrote {ORIG_JSON} ({ORIG_JSON.stat().st_size / 1000:.1f} kB)")
    errs = sum(1 for a in results.values() for r in a.values() for m in r.values() if "error" in m)
    update_doc({"golden-summary": golden_block(out), "mapping": mapping_block()})
    print(f"updated {DOC}")
    return 2 if errs else 0


def cmd_run(args) -> int:
    check_env()
    anchors = parse_ints(args.anchors, 0, 10)
    rates = parse_rates(args.rates) if args.rates else ([48000] if args.quick else list(RATES))
    stimuli = list(QUICK_STIMULI if args.quick else STIMULI)
    settings = dict(decay=args.decay, mix=100.0, material=args.material)
    extra = parse_set(args.set)
    results, prerolls = collect("rebody", anchors, rates, stimuli, settings, extra, args.jobs,
                                not args.no_cache, args.keep, args.ir_seconds, label="re   ")
    meta = make_meta("rebody", dict(DEFAULT_SETTINGS, **settings), rates, stimuli, prerolls,
                     args.ir_seconds, extra)
    out = {"meta": meta, "results": results}
    target_json = Path(args.out) if args.out else RE_JSON
    dump_json(out, target_json)
    print(f"wrote {target_json} ({target_json.stat().st_size / 1000:.1f} kB)")
    if not args.no_doc:
        update_doc({"run-report": run_block(out), "mapping": mapping_block()})
        print(f"updated {DOC}")
    for a in sorted(results, key=int):
        for sr in sorted(results[a], key=int):
            fl = entry_flags(results[a][sr])
            print(f"anchor {a:>2} {RE_ANCHORS[int(a)]:<12} {sr:>6} Hz: {', '.join(fl) if fl else 'ok'}")
    errs = sum(1 for a in results.values() for r in a.values() for m in r.values() if "error" in m)
    return 2 if errs else 0


def load_json(path: Path) -> dict:
    if not path.exists():
        raise SystemExit(f"missing {path} - run the matching mode first")
    return json.loads(path.read_text(encoding="utf-8"))


def ring_pitch_reliable(o_all: dict | None, o: dict) -> bool:
    """The original's impulse-ring pitch is a usable reference: confident at this rate and the
    same (within the f0 tolerance) at every rate that was rendered."""
    io = o.get("impulse", {})
    if io.get("f0_ir") is None or (io.get("f0_ir_conf") or 0) < F0_IR_MIN_CONF:
        return False
    vals = [e.get("impulse", {}).get("f0_ir") for e in (o_all or {}).values()]
    if any(v is None for v in vals):
        return False
    return not vals or 1200 * math.log2(max(vals) / min(vals)) <= TOL["f0_ct"]


def compare_entry(o: dict, r: dict, allow_silent: bool, o_all: dict | None = None,
                  stats: dict | None = None) -> tuple[str, list[str]]:
    """-> (status PASS|FAIL|SKIP, reasons) for one (anchor, rate). `o_all` = all rates of the
    original's anchor (for the ring-pitch reliability test); `stats` (optional dict) receives the
    measured deviations: lufs_db, f0_ct, ring_ct, t60_max_rel."""
    stats = stats if stats is not None else {}
    stats["t60_notes"] = []
    if any("error" in m for m in r.values()):
        return "FAIL", ["render error"]
    if entry_silent(r):
        return ("SKIP", ["wet silent"]) if allow_silent else ("FAIL", ["wet silent"])
    why: list[str] = []
    # f0 (sine response)
    fo, fr = o.get("sine", {}).get("f0"), r.get("sine", {}).get("f0")
    if fo is not None or fr is not None:
        if fo is None or fr is None:
            why.append(f"f0 {fr} vs {fo}")
        else:
            ct = 1200 * math.log2(fr / fo)
            stats["f0_ct"] = ct
            if abs(ct) > TOL["f0_ct"]:
                why.append(f"f0 {fr:.1f} vs {fo:.1f} Hz ({ct:+.1f} ct)")
    # ring pitch of the impulse response, only where the original is clearly pitched
    io, ir_ = o.get("impulse", {}), r.get("impulse", {})
    if ring_pitch_reliable(o_all, o):
        if ir_.get("f0_ir") is None:
            why.append(f"f0(IR) none vs {io['f0_ir']:.1f} Hz")
        else:
            ct = 1200 * math.log2(ir_["f0_ir"] / io["f0_ir"])
            stats["ring_ct"] = ct
            if abs(ct) > TOL["f0_ct"]:
                why.append(f"f0(IR) {ir_['f0_ir']:.1f} vs {io['f0_ir']:.1f} Hz ({ct:+.1f} ct)")
    # band T60
    to, tr = o.get("impulse", {}).get("t60"), r.get("impulse", {}).get("t60")
    bo = o.get("impulse", {}).get("band_db")
    if to and tr:
        for i, fc in enumerate(BAND_CENTRES):
            if to[i] is None or (bo and bo[i] is not None and bo[i] < BAND_MIN_REL_DB):
                continue
            if tr[i] is None:
                stats["t60_notes"].append(f"T60@{fc} none vs {to[i]:.3f}")
                continue
            rel = tr[i] / to[i] - 1.0
            if abs(rel) > abs(stats.get("t60_max_rel", 0.0)):
                stats["t60_max_rel"] = rel
            if abs(rel) > TOL["t60_rel"]:
                stats["t60_notes"].append(f"T60@{fc} {tr[i]:.3f} vs {to[i]:.3f} s ({rel * 100:+.0f} %)")
    elif to:
        stats["t60_notes"].append("no impulse T60")
    # LUFS on pink
    lo, lr = o.get("pink", {}).get("lufs"), r.get("pink", {}).get("lufs")
    if lo is not None or lr is not None:
        if lo is None or lr is None:
            why.append(f"LUFS {lr} vs {lo}")
        else:
            stats["lufs_db"] = lr - lo
            if abs(lr - lo) > TOL["lufs_db"]:
                why.append(f"LUFS {lr:.1f} vs {lo:.1f} ({lr - lo:+.1f} dB)")
    return ("FAIL" if why else "PASS"), why


def cmd_compare(args) -> int:
    orig = load_json(Path(args.orig_json) if args.orig_json else ORIG_JSON)
    re_ = load_json(Path(args.re_json) if args.re_json else RE_JSON)
    fails = 0
    only = parse_ints(args.anchors, 0, 10) if args.anchors else None
    rate_filter = set(parse_rates(args.rates)) if args.rates else None
    print(f"D44 gates: f0 +-{TOL['f0_ct']} ct (sine, and ring where the original is a usable reference), "
          f"LUFS (pink) +-{TOL['lufs_db']} dB per mapped anchor, new anchors {list(NEW_ANCHORS)} within "
          f"+-{TOL['lufs_new_db']} dB of the mapped mean. Band T60 is reported, not gated: deviations over "
          f"{TOL['t60_rel'] * 100:.0f} %, bands {BAND_CENTRES} Hz (bands < {BAND_MIN_REL_DB:g} dB re total "
          f"in the original are ignored)")
    for ra, oa in ANCHOR_MAP.items():
        if only is not None and ra not in only:
            continue
        rr, orr = re_["results"].get(str(ra)), orig["results"].get(str(oa))
        label = f"RE anchor {ra:>2} {RE_ANCHORS[ra]:<10} vs original Morph {oa} {ORIG_ANCHORS[oa]:<12}"
        if rr is None:
            print(f"{label}: NOT RENDERED (run --anchors {ra})")
            fails += 1
            continue
        statuses, notes = [], []
        for sr in sorted(rr, key=int):
            if rate_filter and int(sr) not in rate_filter:
                continue
            if orr is None or sr not in orr:
                notes.append(f"{sr}: no golden")
                continue
            stats: dict = {}
            st, why = compare_entry(orr[sr], rr[sr], args.allow_silent, orr, stats)
            statuses.append(st)
            nums = []
            if "lufs_db" in stats:
                nums.append(f"dLUFS {stats['lufs_db']:+.2f} dB")
            if "f0_ct" in stats:
                nums.append(f"df0 {stats['f0_ct']:+.1f} ct")
            if "ring_ct" in stats:
                nums.append(f"dring {stats['ring_ct']:+.1f} ct")
            if "t60_max_rel" in stats:
                nums.append(f"max dT60 {stats['t60_max_rel'] * 100:+.0f} %")
            notes.append(f"{sr}: {st}" + (f" ({', '.join(nums)})" if nums else "")
                         + (f" [{'; '.join(why)}]" if why else "")
                         + (f" | T60 reported, not gated: {'; '.join(stats['t60_notes'])}" if stats.get("t60_notes") else ""))
        if not statuses:
            verdict = "FAIL"
        elif "FAIL" in statuses:
            verdict = "FAIL"
        elif all(s == "SKIP" for s in statuses):
            verdict = "SKIP"
        else:
            verdict = "PASS"
        fails += verdict == "FAIL"
        print(f"{label}: {verdict}")
        for n in notes:
            print(f"    {n}")
    fails += compare_new_anchors(orig, re_, only, rate_filter, args.allow_silent)
    print(f"compare: {'FAIL' if fails else 'ok'} ({fails} failing anchor(s))")
    return 1 if (args.gate and fails) else 0


def mapped_mean_lufs(orig: dict, sr: str) -> float | None:
    """Mean pink LUFS of the original's mapped anchors at one rate (reference of the new anchors, D44)."""
    vals = []
    for oa in ANCHOR_MAP.values():
        v = orig["results"].get(str(oa), {}).get(sr, {}).get("pink", {}).get("lufs")
        if v is not None:
            vals.append(v)
    return sum(vals) / len(vals) if len(vals) == len(ANCHOR_MAP) else None


def compare_new_anchors(orig: dict, re_: dict, only, rate_filter, allow_silent: bool) -> int:
    """D44: Timpani, Guitar and Fiddle have no BODY counterpart; their pink LUFS must be within
    TOL['lufs_new_db'] of the mean of the original's mapped anchors (same rate). Returns failing anchors."""
    fails = 0
    for ra in NEW_ANCHORS:
        if only is not None and ra not in only:
            continue
        rr = re_["results"].get(str(ra))
        label = f"RE anchor {ra:>2} {RE_ANCHORS[ra]:<10} (new, no BODY counterpart; LUFS vs mapped mean)"
        if rr is None:
            print(f"{label}: NOT RENDERED (run --anchors {ra})")
            fails += 1
            continue
        statuses, notes = [], []
        for sr in sorted(rr, key=int):
            if rate_filter and int(sr) not in rate_filter:
                continue
            mean = mapped_mean_lufs(orig, sr)
            if mean is None:
                notes.append(f"{sr}: no golden mean")
                continue
            if any("error" in m for m in rr[sr].values()):
                statuses.append("FAIL")
                notes.append(f"{sr}: FAIL (render error)")
                continue
            if entry_silent(rr[sr]):
                statuses.append("SKIP" if allow_silent else "FAIL")
                notes.append(f"{sr}: {statuses[-1]} (wet silent)")
                continue
            lufs = rr[sr].get("pink", {}).get("lufs")
            if lufs is None:
                statuses.append("FAIL")
                notes.append(f"{sr}: FAIL (no LUFS)")
                continue
            d = lufs - mean
            st = "PASS" if abs(d) <= TOL["lufs_new_db"] else "FAIL"
            statuses.append(st)
            notes.append(f"{sr}: {st} (LUFS {lufs:.1f} vs mean {mean:.1f}, d {d:+.2f} dB)")
        verdict = "FAIL" if (not statuses or "FAIL" in statuses) else ("SKIP" if all(x == "SKIP" for x in statuses) else "PASS")
        fails += verdict == "FAIL"
        print(f"{label}: {verdict}")
        for n in notes:
            print(f"    {n}")
    return fails


# --------------------------------------------------------------------------------------
# Named gate checks (P3 / P4b can enable these)
# --------------------------------------------------------------------------------------
def _render_custom(settings_over: dict, anchor: int | None, x: np.ndarray, sr: int, tag: str,
                   extra: dict | None = None, keep=False) -> np.ndarray:
    values, optional = build_params("rebody", anchor, dict(decay=50.0, mix=100.0, **settings_over), extra)
    wav = WORK / "stim" / f"custom_{tag}_{sr}.wav"
    wav.parent.mkdir(parents=True, exist_ok=True)
    write_wav24(wav, with_lead(x, sr), sr)
    calibrate_preroll(sr)
    return render_audio("rebody", values, optional, wav, sr, lead=lead_frames(sr), n_expected=len(x), keep=keep)


def check_three_line_protector(args) -> dict:
    """B and C Enable init 1 (everything else default) vs Line A alone, pink noise.
    Peak: protector keeps the sum at/below the input peak. Reduction estimate: power sum of the
    single-line renders (A, B, C each alone) minus the measured three-line RMS; gate < 3 dB (T2)."""
    sr = args.rate
    x = make_stimulus("pink", sr)
    in_peak = db(float(np.abs(x).max()))
    n2 = int(2.0 * sr)
    cases = {"A": dict(enableA=1, enableB=0, enableC=0), "B": dict(enableA=0, enableB=1, enableC=0),
             "C": dict(enableA=0, enableB=0, enableC=1), "ABC": dict(enableA=1, enableB=1, enableC=1)}
    res: dict = {}
    for k, over in cases.items():
        y = _render_custom(dict(over, material=50.0), args.anchor, x, sr, f"prot_{k}")
        res[k] = {"peak": round(db(float(np.abs(y).max())), 2),
                  "rms": round(db(math.sqrt(float((y[:n2] ** 2).mean()))), 2),
                  "lufs": r3(lufs_integrated(y, sr), 2)}
    out = {"name": "three-line-protector", "rate": sr, "anchor_A": args.anchor, "input_peak_db": round(in_peak, 2),
           "renders": res}
    if max(res["A"]["rms"], res["ABC"]["rms"]) < SILENT_DB:
        out.update(status="wet silent", ok=False)
        return out
    p_sum = sum(10 ** (res[k]["rms"] / 10.0) for k in "ABC" if res[k]["rms"] > SILENT_DB)
    out["delta_peak_db"] = round(res["ABC"]["peak"] - res["A"]["peak"], 2)
    out["reduction_est_db"] = round(10 * math.log10(max(p_sum, 1e-30)) - res["ABC"]["rms"], 2)
    problems = []
    if out["reduction_est_db"] >= args.max_reduction:
        problems.append(f"estimated protector reduction {out['reduction_est_db']:.2f} dB >= {args.max_reduction:g}")
    if res["ABC"]["peak"] > in_peak + 0.1:
        problems.append(f"three-line peak {res['ABC']['peak']:.2f} dBFS above input peak {in_peak:.2f}")
    out.update(status="fail" if problems else "pass", ok=not problems, problems=problems)
    return out


def check_hold_stability(args) -> dict:
    """A Hold init 1; 2 s pink, then silence up to `seconds` (default 62 s). Level in 10 s windows
    after the pink: drift < 0.5 dB per 10 s, modal T60 (level fit) >= 30 s, abs(DC) < 0.01."""
    sr = args.rate
    total = int(args.seconds * sr)
    pink = make_stimulus("pink", sr)
    x = np.zeros((total, 2))
    x[:len(pink)] = pink
    win = int(10.0 * sr)
    start = int(2.0 * sr)
    calibrate_preroll(sr)
    combos = [(a, m) for a in parse_ints(args.anchors, 0, 10) for m in parse_ints(args.materials, 0, 100)]

    def one(combo):
        anchor, mat = combo
        return _render_custom(dict(hold=1, material=float(mat)), anchor, x, sr, f"hold_{anchor}_{mat}")

    with cf.ThreadPoolExecutor(max_workers=max(1, args.jobs)) as ex:
        renders = list(ex.map(one, combos))
    results = []
    for (anchor, mat), y in zip(combos, renders):
        levels, dcs = [], []
        for i in range((total - start) // win):
            seg = y[start + i * win:start + (i + 1) * win]
            levels.append(db(math.sqrt(float((seg ** 2).mean()))))
            dcs.append(float(np.abs(seg.mean(axis=0)).max()))
        row = {"anchor": anchor, "material": mat, "levels_db": [round(v, 2) for v in levels],
               "dc_max": float(f"{max(dcs):.3g}") if dcs else None, "finite": bool(np.isfinite(y).all())}
        if not levels or levels[0] < SILENT_DB:
            row.update(status="wet silent", ok=False)
        else:
            drift = max(abs(levels[i + 1] - levels[i]) for i in range(len(levels) - 1)) if len(levels) > 1 else 0.0
            slope = float(np.polyfit(np.arange(len(levels)) * 10.0, levels, 1)[0]) if len(levels) > 1 else 0.0
            t60 = float("inf") if slope >= -1e-9 else -60.0 / slope
            problems = []
            if drift >= 0.5:
                problems.append(f"drift {drift:.2f} dB per 10 s >= 0.5")
            if t60 < 30.0:
                problems.append(f"modal T60 {t60:.1f} s < 30")
            if row["dc_max"] is not None and row["dc_max"] >= DC_LIMIT:
                problems.append(f"DC {row['dc_max']:.3g} >= 0.01")
            if not row["finite"]:
                problems.append("non-finite output")
            row.update(drift_db_per_10s=round(drift, 3), t60_s=None if math.isinf(t60) else round(t60, 1),
                       status="fail" if problems else "pass", ok=not problems, problems=problems)
        results.append(row)
    status = ("wet silent" if all(r["status"] == "wet silent" for r in results)
              else "fail" if any(not r["ok"] for r in results) else "pass")
    return {"name": "hold-stability", "rate": sr, "seconds": args.seconds, "status": status,
            "ok": status == "pass", "rows": results}


SPLIT_CANDIDATES = ("plugin/debug/RE_BODY_SPLIT.cmajorpatch", "tests/debug/RE_BODY_SPLIT.cmajorpatch")


def check_split_complementary(args) -> dict:
    """Hook for P4b (needs a debug patch, not shipped yet). Contract of the debug patch, which
    is a normal patch with `input stream float<2> in` and `output stream float<4> out`:
        out[0..1] = transient + sustain bus (L, R)      -> must equal the input within -100 dB
        out[2..3] = low + mid + high bus (L, R)         -> magnitude flat within +-0.2 dB (allpass)
    Path: --debug-patch or env RE_BODY_SPLIT_PATCH or one of SPLIT_CANDIDATES. Rendered with
    `cmaj render --channels=4` on pink noise (residual) and the unit impulse (magnitude)."""
    cand = args.debug_patch or os.environ.get("RE_BODY_SPLIT_PATCH")
    path = Path(cand) if cand else next((ROOT / c for c in SPLIT_CANDIDATES if (ROOT / c).exists()), None)
    if path is None or not Path(path).exists():
        return {"name": "split-complementary", "status": "skipped", "ok": True,
                "reason": "no debug patch (see docs/dev/04_RENDER_CI.md, hook contract)"}
    sr = args.rate
    res: dict = {"name": "split-complementary", "patch": str(path), "rate": sr}
    problems: list[str] = []
    x = make_stimulus("pink", sr)
    wav = WORK / "stim" / f"split_pink_{sr}.wav"
    wav.parent.mkdir(parents=True, exist_ok=True)
    calibrate_preroll(sr)
    lead = lead_frames(sr)
    write_wav24(wav, with_lead(x, sr), sr)
    y = render_audio("rebody", {}, set(), wav, sr, lead=lead, channels=4, patch_override=Path(path),
                     n_expected=len(x))
    best = None
    for lag in range(-256, 257):             # tolerate a fixed analysis latency (reported)
        a = np.roll(y[:, 0], -lag)[300:-300]
        r = float(np.sqrt(np.mean((a - x[300:-300, 0]) ** 2)))
        if best is None or r < best[0]:
            best = (r, lag)
    ref = float(np.sqrt(np.mean(x[:, 0] ** 2)))
    resid = db(best[0] / ref)
    res.update(ts_residual_db=round(resid, 1), ts_lag_frames=best[1])
    if resid > -100.0:
        problems.append(f"transient+sustain residual {resid:.1f} dB > -100")
    imp = make_stimulus("impulse", sr)
    wav2 = WORK / "stim" / f"split_imp_{sr}.wav"
    write_wav24(wav2, with_lead(imp, sr), sr)
    z = render_audio("rebody", {}, set(), wav2, sr, lead=lead, channels=4, patch_override=Path(path),
                     n_expected=len(imp))
    h = np.abs(np.fft.rfft(z[int(IMPULSE_AT * sr):, 2]))
    f = np.fft.rfftfreq(len(z) - int(IMPULSE_AT * sr), 1.0 / sr)
    m = (f >= 20) & (f <= 20000)
    hd = 20 * np.log10(h[m] + 1e-20)
    flat = float(hd.max() - hd.min())
    res.update(lmh_flatness_db=round(flat, 3))
    if flat > 0.4:                            # +-0.2 dB = 0.4 dB peak to peak
        problems.append(f"low+mid+high magnitude ripple {flat:.2f} dB p-p > 0.4")
    res.update(status="fail" if problems else "pass", ok=not problems, problems=problems)
    return res


CHECKS = {"three-line-protector": check_three_line_protector, "hold-stability": check_hold_stability,
          "split-complementary": check_split_complementary}


def cmd_check(args) -> int:
    check_env()
    names = list(CHECKS) if args.name == "all" else [args.name]
    out = {}
    target_json = Path(args.out) if args.out else CHECKS_JSON
    if target_json.exists():
        try:
            out = json.loads(target_json.read_text(encoding="utf-8"))
        except ValueError:
            out = {}
    bad = 0
    for n in names:
        r = CHECKS[n](args)
        r["generated"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
        out[n] = r
        st = r["status"]
        print(f"check {n}: {st.upper()}")
        for p in r.get("problems", []):
            print(f"    {p}")
        for k in ("reduction_est_db", "delta_peak_db", "ts_residual_db", "lmh_flatness_db", "reason"):
            if k in r:
                print(f"    {k}: {r[k]}")
        for row in r.get("rows", []):
            print(f"    anchor {row['anchor']} material {row['material']}: {row['status']}"
                  f" levels {row['levels_db']} drift {row.get('drift_db_per_10s')} T60 {row.get('t60_s')} DC {row['dc_max']}"
                  + "".join(f"\n        {p}" for p in row.get("problems", [])))
        if st == "fail" or (st == "wet silent" and not args.allow_silent):
            bad += 1
    dump_json(out, target_json, depth=2)
    print(f"wrote {target_json}")
    return 1 if (args.gate and bad) else 0


# --------------------------------------------------------------------------------------
# Self-test of the measurement code (no cmaj needed)
# --------------------------------------------------------------------------------------
def cmd_selftest(_args) -> int:
    ok = True

    def check(name, cond, info=""):
        nonlocal ok
        ok &= bool(cond)
        print(f"{'PASS' if cond else 'FAIL'}  {name} {info}")

    # K-weighting constants at 48 kHz equal the ITU table (as used by PHYSIFY analyze.py)
    s1, s2 = k_weight_sos(48000)
    ref1 = (1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585)
    ref2 = (1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621)
    check("K-weighting 48 kHz = ITU constants",
          max(abs(a - b) for a, b in zip(s1 + s2, ref1 + ref2)) < 2e-6)
    # EBU Tech 3341: stereo 1 kHz sine at -23 dBFS -> -23.0 LUFS
    for sr in RATES:
        t = np.arange(10 * sr) / sr
        s = 10 ** (-23 / 20) * np.sin(2 * np.pi * 1000 * t)
        v = lufs_integrated(np.stack([s, s], 1), sr)
        check(f"LUFS 1 kHz -23 dBFS stereo @ {sr}", v is not None and abs(v + 23.0) < 0.1, f"= {v:.3f}")
    # T60 estimate on synthetic decays (noise x exponential), octave band filtering included
    rng = np.random.default_rng(1)
    for sr in (48000, 96000):
        for t60 in (0.15, 0.6, 1.5):
            n = int(4.0 * sr)
            t = np.arange(n) / sr
            env = 10 ** (-3.0 * t / t60)
            x = np.stack([rng.standard_normal(n) * env, rng.standard_normal(n) * env], 1)
            tb, rel, tr = band_t60(x, sr)
            good = [v for v in tb[1:6] if v is not None]
            err = max(abs(v / t60 - 1) for v in good) if good else 9
            check(f"band T60 {t60} s @ {sr}", len(good) == 5 and err < 0.12, f"max err {err * 100:.1f} %")
    # f0
    for sr in (44100, 96000):
        t = np.arange(int(1.4 * sr)) / sr
        x = np.stack([np.sin(2 * np.pi * 220.0 * t) + 0.5 * np.sin(2 * np.pi * 440.0 * t)] * 2, 1)
        f0, conf = f0_autocorr(x, sr)
        ct = 1200 * math.log2(f0 / 220.0) if f0 else 999
        check(f"f0 220 Hz @ {sr}", f0 is not None and abs(ct) < 1.0, f"{f0:.3f} Hz conf {conf:.2f}")
    # spectral peaks of a synthetic modal IR
    sr = 48000
    t = np.arange(int(2.0 * sr)) / sr
    modes = [(73.6, 0.35, 1.0), (117.0, 0.35, 0.5), (156.5, 0.20, 0.35), (310.0, 0.1, 0.2)]
    ir = sum(a * np.exp(-6.9078 * t / t60) * np.sin(2 * np.pi * f * t) for f, t60, a in modes)
    pk, _ = spectral_peaks(np.stack([ir, ir], 1), sr)
    got = sorted(float(f) for f, _ in pk[:4])
    # a mode with T60 0.1 s has a ~11 Hz wide line: its peak is biased by about 2 Hz
    check("spectral peaks", all(abs(g - m[0]) < (1.5 if m[1] >= 0.2 else 3.5)
                                for g, m in zip(got, sorted(modes))), f"{got}")
    # compare logic: identical passes, each tolerance violation fails, quiet bands are ignored
    o = {"sine": {"f0": 440.0}, "pink": {"lufs": -27.0, "rms_active": -30.0},
         "impulse": {"peak": -20.0, "f0_ir": 220.0, "f0_ir_conf": 0.9,
                     "t60": [0.5, 0.4, 0.3, 0.2, 0.1, 0.05, 0.02], "band_db": [-3, -5, -9, -12, -20, -30, -60]}}
    import copy
    def variant(f):
        r = copy.deepcopy(o)
        f(r)
        return compare_entry(o, r, False, {"48000": o})[0]
    check("compare identical -> PASS", variant(lambda r: None) == "PASS")
    check("compare f0 +10 ct -> FAIL", variant(lambda r: r["sine"].update(f0=440.0 * 2 ** (10 / 1200))) == "FAIL")
    check("compare f0 +4 ct -> PASS", variant(lambda r: r["sine"].update(f0=440.0 * 2 ** (4 / 1200))) == "PASS")
    check("compare ring f0 +10 ct -> FAIL", variant(lambda r: r["impulse"].update(f0_ir=220.0 * 2 ** (10 / 1200))) == "FAIL")
    check("compare T60 +20 % -> PASS (D44: reported, not gated)", variant(lambda r: r["impulse"]["t60"].__setitem__(3, 0.24)) == "PASS")
    st_t60: dict = {}
    r_t60 = copy.deepcopy(o)
    r_t60["impulse"]["t60"][3] = 0.24
    compare_entry(o, r_t60, False, {"48000": o}, st_t60)
    check("compare T60 +20 % is reported", len(st_t60.get("t60_notes", [])) == 1, f"{st_t60.get('t60_notes')}")
    check("compare T60 +10 % -> PASS", variant(lambda r: r["impulse"]["t60"].__setitem__(3, 0.22)) == "PASS")
    check("compare quiet band ignored", variant(lambda r: r["impulse"]["t60"].__setitem__(6, 0.2)) == "PASS")
    fake_orig = {"results": {str(oa): {"48000": {"pink": {"lufs": -27.0}}} for oa in ANCHOR_MAP.values()}}
    check("mapped mean LUFS", abs((mapped_mean_lufs(fake_orig, "48000") or 0) + 27.0) < 1e-9)
    def new_anchor(lufs):
        e = {"pink": {"lufs": lufs, "rms_active": -30.0}, "impulse": {"peak": -20.0}, "sine": {"rms_active": -30.0}}
        import contextlib, io
        with contextlib.redirect_stdout(io.StringIO()):
            return compare_new_anchors(fake_orig, {"results": {str(a): {"48000": e} for a in NEW_ANCHORS}}, None, None, False)
    check("new anchors within 3 dB -> pass", new_anchor(-29.5) == 0)
    check("new anchors 3.5 dB off -> fail", new_anchor(-30.5) == len(NEW_ANCHORS))
    check("compare LUFS +1.5 dB -> FAIL", variant(lambda r: r["pink"].update(lufs=-25.5)) == "FAIL")
    check("compare wet silent -> FAIL", variant(lambda r: (r["pink"].update(rms_active=-120.0),
                                                           r["impulse"].update(peak=-120.0),
                                                           r["sine"].update(rms_active=-120.0))) == "FAIL")
    check("wet silent allowed -> SKIP", compare_entry(o, {"pink": {"rms_active": -120.0}}, True)[0] == "SKIP")
    # WAV round trip
    p = WORK / "selftest.wav"
    p.parent.mkdir(parents=True, exist_ok=True)
    a = np.stack([np.linspace(-0.9, 0.9, 1000), np.linspace(0.5, -0.5, 1000)], 1)
    write_wav24(p, a, 48000)
    b, r = read_wav(p)
    check("WAV24 round trip", r == 48000 and np.abs(a - b).max() < 2e-7)
    # init patching
    src = 'input event float p1 [[ name: "A Morph", min: 0.0, max: 10.0, init: 7.0, step: 0.001 ]];\n' \
          'input event float p2 [[ name: "Morph", min: 0.0, max: 7.0, step: 0.001, init: 4.0 ]];'
    s, o1 = set_init(src, "Morph", 2)
    check("init patch exact name", o1 and "init: 7.0" in s and "init: 2.0" in s)
    s, o2 = set_init(src, "A Morph", 3)
    check("init patch prefixed name", o2 and "init: 3.0" in s and "init: 4.0" in s)
    return 0 if ok else 1


# --------------------------------------------------------------------------------------
def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="mode", required=True)

    def common(p):
        p.add_argument("--rates", help="comma list, e.g. 44100,48000,96000 or 48 (kHz shorthand)")
        p.add_argument("--jobs", type=int, default=default_jobs(), help="parallel cmaj processes")
        p.add_argument("--decay", type=float, default=50.0)
        p.add_argument("--no-cache", action="store_true", help="ignore the metrics cache in the work dir")
        p.add_argument("--keep", action="store_true", help="keep patched copies and renders in the work dir")
        p.add_argument("--ir-seconds", type=float, default=IR_SECONDS, help="impulse stimulus length")

    g = sub.add_parser("golden-original", help="render the original BODY, write tools/golden/body_original.json")
    common(g)
    g.set_defaults(fn=cmd_golden_original)

    r = sub.add_parser("run", help="render RE-BODY, write tools/golden/re_body_latest.json + report")
    common(r)
    r.add_argument("--anchors", default="0..10", help="e.g. 0..10, 0,3,7")
    r.add_argument("--quick", action="store_true", help="48 kHz only, no burst train")
    r.add_argument("--material", type=float, default=50.0)
    r.add_argument("--patch", help="render this .cmajorpatch instead of plugin/RE_BODY.cmajorpatch "
                                   "(experimental builds; parameter names must match)")
    r.add_argument("--out", help="write the metrics JSON here instead of tools/golden/re_body_latest.json")
    r.add_argument("--no-doc", action="store_true", help="do not touch docs/dev/04_RENDER_CI.md")
    r.add_argument("--set", action="append", metavar="'Name=value'", help="patch any parameter init by exact name")
    r.set_defaults(fn=cmd_run)

    c = sub.add_parser("compare", help="RE-BODY vs golden original (mapped anchors)")
    c.add_argument("--gate", action="store_true", help="exit 1 on failure")
    c.add_argument("--allow-silent", action="store_true", help="silent wet = SKIP instead of FAIL")
    c.add_argument("--anchors", help="RE-BODY anchors to compare (default: all mapped)")
    c.add_argument("--rates")
    c.add_argument("--re-json", help="metrics JSON of the RE-BODY run (default tools/golden/re_body_latest.json)")
    c.add_argument("--orig-json", help="golden JSON of the original (default tools/golden/body_original.json)")
    c.set_defaults(fn=cmd_compare)

    k = sub.add_parser("check", help="named gates: " + ", ".join(CHECKS) + ", all")
    k.add_argument("name", choices=list(CHECKS) + ["all"])
    k.add_argument("--gate", action="store_true", help="exit 1 on failure")
    k.add_argument("--allow-silent", action="store_true", help="silent wet does not fail the gate")
    k.add_argument("--patch", help="render this .cmajorpatch instead of plugin/RE_BODY.cmajorpatch")
    k.add_argument("--out", help="write the check results JSON here instead of tools/golden/re_body_checks.json")
    k.add_argument("--rate", type=int, default=48000)
    k.add_argument("--jobs", type=int, default=default_jobs(), help="hold-stability: parallel renders")
    k.add_argument("--anchor", type=int, default=7, help="three-line-protector: Line A morph")
    k.add_argument("--max-reduction", type=float, default=3.0, help="three-line-protector gate in dB")
    k.add_argument("--anchors", default="0,2,8", help="hold-stability anchors")
    k.add_argument("--materials", default="0,50,100", help="hold-stability Material values")
    k.add_argument("--seconds", type=float, default=62.0, help="hold-stability render length")
    k.add_argument("--debug-patch", help="split-complementary debug patch manifest")
    k.set_defaults(fn=cmd_check)

    s = sub.add_parser("selftest", help="numpy-only self checks of the measurement code")
    s.set_defaults(fn=cmd_selftest)
    return ap


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    if getattr(args, "patch", None):
        TARGETS["rebody"]["patch"] = str(Path(args.patch).resolve())
    try:
        return args.fn(args)
    except RenderError as e:
        print(f"render_ci: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())

"""Score — 省心投 BI 30s brand film.

    cd brand-film && .venv/Scripts/python.exe audio/score.py

Measurements read off the rendered picture (30s, 120 BPM → BEAT 0.5):
  ACT1 散落    0.0–6.0   缓慢、单一动机，节奏未进入
  ACT2 聚合    6.0–12.0  节奏进入，仪表盘聚合，每拍一事件
  ACT3 双漏斗 12.0–19.0  转折，鼓点突出，瓶颈状态切换
  ACT4 四端   19.0–25.0  收束/回馈，逐字打字，最亮
  ACT5 锁屏   25.0–30.0  落版，留白后重拍一击

Typing ticks line up with the on-screen typed line "Web · 桌面 · 安卓 · PWA"
(19.7s→21.7s, 19 characters). Boom lands on the logo downbeat (~26.0s).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import score_lib as sl  # noqa: E402

# ==========================================================================
# MEASUREMENTS
# ==========================================================================
DUR = 30.0                # film length, seconds
BEAT = 0.5                # seconds per beat → 120 BPM
KEY = 'G'                 # tonic. G major / E minor.
SEED = 31                 # deterministic noise

# Act boundaries copied from the picture timeline.
ACT1, ACT2, ACT3, ACT4, ACT5 = 0.0, 6.0, 12.0, 19.0, 25.0

S = sl.Score(dur=DUR, seed=SEED)
B = BEAT


# ==========================================================================
# ACT 1 — the hook. Slow, one idea, nothing rhythmic yet.
# Picture: 渠道徽章散落、S 符号汇聚，hook 句落下。
# ==========================================================================
S.place(S.pad([f'{KEY}2', 'D3', 'B3', 'F#4', 'A4'], 5.6, att=1.0, rel=0.6, bright=0.8),
        ACT1, send=0.55)
S.place(S.marimba(sl.hz('D5'), vel=0.55), ACT1 + 0.2, pan=0.2, send=0.5)

# A rising melodic figure under the scattered badges, then the hook + send.
for t0, n in [(0.8, 'B4'), (1.6, 'D5'), (2.4, 'A4'), (3.2, 'G4'), (4.0, 'A4')]:
    S.place(S.marimba(sl.hz(n), vel=0.55), t0, pan=0.3, send=0.5)
S.place(S.bell(sl.hz('B5'), d=1.4, vel=0.9), 4.6, pan=0.2, send=0.6)
S.place(S.riser(0.6, 400, 8000, vel=0.7), 5.0, send=0.3)


# ==========================================================================
# ACT 2 — development. Rhythm enters, one event per beat.
# Picture: 仪表盘聚合，卡片 3D 飞入、热力图、数字 count-up。
# ==========================================================================
S.place(S.pad(['E2', 'B2', 'G3', 'D4', 'F#4'], 3.0, att=0.05, rel=0.4, bright=1.2),
        ACT2, send=0.4)
S.place(S.pad(['C3', 'G3', 'B3', 'E4', 'G4'], 3.0, att=0.05, rel=0.4, bright=1.2),
        ACT2 + 3.0, send=0.4)
S.place(S.sub(sl.hz('E2'), 5.8, vel=0.8), ACT2)          # floor under the pad

N_EVENTS = 12                                             # 6s / 0.5s beat
for k in range(N_EVENTS):
    t0 = ACT2 + k * B
    S.place(S.kick(vel=0.9), t0, send=0.03)               # dry kick stays close
    S.place(S.hat(vel=0.8), t0 + 0.25, pan=0.3, send=0.08)
    if k % 2 == 1:
        S.place(S.clap(vel=0.9), t0, pan=-0.1, send=0.25)

# Ascending figure so the listener hears progress: one per beat, 0.35s after.
for k, n in enumerate(['G4', 'A4', 'B4', 'D5', 'E5', 'G5', 'A5', 'B5', 'D6', 'E6', 'G6', 'A6']):
    S.place(S.pluck(sl.hz(n), vel=0.95), ACT2 + k * B + 0.35, pan=0.25, send=0.35)
    S.place(S.marimba(sl.hz(n) * 2, vel=0.35), ACT2 + k * B + 0.35, pan=-0.3, send=0.4)
S.place(S.riser(0.5, 600, 9000, vel=0.6), ACT2 + 5.5, send=0.25)


# ==========================================================================
# ACT 3 — the turn. THE DRUMS COME OUT HERE. Double funnel builds.
# Picture: 双漏斗逐条生长、瓶颈标记脉冲、S 曲线连接。
# ==========================================================================
S.place(S.pad(['A2', 'E3', 'G3', 'C4', 'E4'], 3.4, att=0.1, rel=0.5, bright=0.7),
        ACT3, send=0.6)
S.place(S.pad(['F2', 'C3', 'A3', 'E4', 'G4'], 3.6, att=0.3, rel=0.6, bright=0.7),
        ACT3 + 3.2, send=0.6)
S.place(S.sub(sl.hz('A1'), 6.8, vel=0.7), ACT3)

# A single close sound for the bottleneck state change (~14.2s), then nothing.
S.place(S.thud(vel=1.0), ACT3 + 2.2, send=0.2)
for k in range(7):                                        # hats only, no kick
    S.place(S.hat(vel=0.55), ACT3 + k * B + 0.25, pan=0.4, send=0.1)

# Time passing: ticks that accelerate. Shrinking the gap is the effect.
t, gap = ACT3 + 1.4, 0.18
while t < ACT3 + 6.6:
    S.place(S.tick(vel=0.5), t, pan=-0.45, send=0.2)
    gap = max(0.05, gap * 0.9)
    t += gap

# One mallet per funnel, panned progressively outward.
S.place(S.bell(sl.hz('E5'), vel=0.7), ACT3 + 1.0, pan=0.1, send=0.7)
S.place(S.marimba(sl.hz('G5'), vel=0.7), ACT3 + 2.0, pan=0.4, send=0.5)
S.place(S.marimba(sl.hz('C6'), vel=0.7), ACT3 + 3.0, pan=0.5, send=0.5)
S.place(S.riser(0.6, 300, 9000, vel=0.9), ACT3 + 6.4, send=0.3)


# ==========================================================================
# ACT 4 — payoff. Everything comes back, brightest of the film.
# Picture: 四端设备 3D 飞入、逐字打字、连接线、同步进度。
# ==========================================================================
S.place(S.pad(['C3', 'G3', 'B3', 'E4', 'D5'], 3.0, att=0.02, rel=0.4, bright=1.4),
        ACT4, send=0.45)
S.place(S.pad(['D3', 'A3', 'C4', 'F#4', 'E5'], 3.0, att=0.02, rel=0.4, bright=1.4),
        ACT4 + 3.0, send=0.45)
S.place(S.sub(sl.hz('C2'), 5.8, vel=0.85), ACT4)
for k in range(11):                                       # ~5.5s of beats
    t0 = ACT4 + k * B
    S.place(S.kick(vel=0.95 if k == 0 else 0.85), t0, send=0.03)
    S.place(S.hat(vel=0.85), t0 + 0.25, pan=0.3, send=0.08)
    S.place(S.hat(vel=0.45), t0 + 0.375, pan=-0.3, send=0.08)
    if k % 2 == 1:
        S.place(S.clap(vel=0.9), t0, send=0.25)
for t0, n in [(ACT4, 'E5'), (ACT4 + 0.5, 'G5'), (ACT4 + 1.0, 'B5')]:
    S.place(S.pluck(sl.hz(n), vel=0.9), t0, pan=0.2, send=0.35)
S.place(S.bell(sl.hz('D6'), d=1.2, vel=0.7), ACT4 + 1.5, pan=0.3, send=0.6)

# Typing: one tick per character, aligned to the on-screen typing animation.
TYPING_START, TYPING_END, N_CHARS = 19.7, 21.7, 19
step = (TYPING_END - TYPING_START) / N_CHARS
for i in range(N_CHARS):
    if i % 2 == 0:                                        # every other key
        S.place(S.tick(vel=0.6 + 0.4 * ((i * 7) % 5) / 5),
                TYPING_START + i * step + (i % 3) * 0.004,
                pan=-0.2 + 0.4 * ((i * 3) % 7) / 7, send=0.15)
S.place(S.swell(['G3', 'B3', 'D4', 'A4'], 0.5, vel=0.9), ACT4 + 2.5, send=0.4)
S.place(S.riser(0.6, 200, 6000, vel=0.8), ACT4 + 5.4, send=0.3)


# ==========================================================================
# ACT 5 — landing. Bar 1 is nearly empty, then the hit.
# 90% of the perceived production value is in these last two seconds.
# ==========================================================================
STAMP = ACT5 + 1.0                                        # ~26.0s — logo lockup downbeat
S.place(S.pad(['E3', 'B3', 'D4', 'G4'], 1.2, att=0.05, rel=0.3, bright=0.6, vel=0.8),
        ACT5, send=0.6)
S.place(S.riser(0.9, 200, 6000, vel=0.8), ACT5 + 0.1, send=0.3)
S.place(S.swell(['D3', 'A3', 'C4', 'F#4'], 0.85, vel=1.0), ACT5 + 0.15, send=0.4)
S.place(S.boom(vel=1.0, d=2.4), STAMP, send=0.35)
S.place(S.thud(vel=1.0), STAMP, send=0.1)
S.place(S.pad(['G2', 'D3', 'B3', 'F#4', 'A4', 'D5'], 3.5,
              att=0.01, rel=0.9, bright=1.4, vel=1.15), STAMP, send=0.7)
for t0, n, v in [(STAMP, 'G4', 0.8), (STAMP, 'B4', 0.6), (STAMP, 'D5', 0.6),
                 (STAMP + 0.5, 'F#5', 0.6), (STAMP + 0.75, 'A5', 0.55)]:
    S.place(S.felt_piano(sl.hz(n), vel=v), t0, send=0.6)
S.place(S.bell(sl.hz('B5'), d=1.2, vel=0.6), STAMP + 0.5, pan=0.3, send=0.8)


# ==========================================================================
# OUTPUT
# loudnorm happens in the ffmpeg mix step, not here — see references/scoring.md
# ==========================================================================
S.write(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'score.wav'))

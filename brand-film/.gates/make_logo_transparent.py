"""make_logo_transparent.py — brand lockup white background -> alpha.

The repo lockup (icon/logo-竖版.png) ships on an opaque white canvas; on the
film's light base (#F4F4F6) it reads as a white slab. This rebuilds
film/assets/logo-vertical.png with the near-white background converted to
transparency:

  * alpha ramp  (250 - gray) / 16  ->  pure white transparent, <=234 opaque
  * un-premultiply against white so anti-aliased edges keep their real colour
    instead of fading to a pale halo

Idempotent: always rebuilt from the repo source, never edited in place.
Run after any logo refresh:  .venv/Scripts/python.exe .gates/make_logo_transparent.py
"""
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '..', 'icon', 'logo-竖版.png')
DST = os.path.join(ROOT, 'film', 'assets', 'logo-vertical.png')

WHITE = 255.0
HI, RAMP = 250.0, 16.0          # gray >= 250 -> alpha 0 ; gray <= 234 -> alpha 1


def main():
    im = Image.open(SRC).convert('RGB')
    a = np.asarray(im).astype(np.float32)
    gray = a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114
    alpha = np.clip((HI - gray) / RAMP, 0.0, 1.0)

    # un-premultiply the white background out of the edge pixels
    keep = np.maximum(alpha, 1e-6)[..., None]
    rgb = np.clip((a - (1.0 - alpha[..., None]) * WHITE) / keep, 0.0, 255.0)

    rgba = np.dstack([rgb, alpha * 255.0]).astype(np.uint8)
    # quantise alpha to ~24 steps: the smooth ramp is pure PNG entropy and the
    # banding is invisible at film scale
    rgba[..., 3] = (rgba[..., 3] // 11) * 11
    os.makedirs(os.path.dirname(DST), exist_ok=True)
    Image.fromarray(rgba, 'RGBA').save(DST, optimize=True)

    transparent = float((alpha < 0.02).mean())
    print(f'{os.path.getsize(DST) / 1024:.1f} KB  {os.path.relpath(DST, ROOT)}')
    print(f'fully transparent pixels: {transparent * 100:.1f}%  '
          f'(was 0% — opaque white canvas)')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Generate the Little Luxe PWA icons as real PNGs (no image libraries).

Design: dark rounded square (#0A0A0A) with a hairline gold border, a soft gold
glow and a gold "LL" monogram. Rendered with 1px analytic antialiasing via
coverage ramps, so no supersampling pass is needed.
"""

import math
import os
import struct
import zlib

GOLD = (0xD4, 0xAF, 0x37)
DARK = (0x0A, 0x0A, 0x0A)
OUT_DIR = "public/icons"

# ---------------------------------------------------------------- helpers


def ramp(v, lo, hi):
    """1 inside [lo, hi], 0 outside, linear 1px edge."""
    return max(0.0, min(1.0, min(v - lo, hi - v) + 0.5))


def rect_cov(x, y, x0, y0, x1, y1):
    return ramp(x, x0, x1) * ramp(y, y0, y1)


def rounded_rect_sdf(x, y, cx, cy, hw, hh, r):
    dx = abs(x - cx) - (hw - r)
    dy = abs(y - cy) - (hh - r)
    outside = math.hypot(max(dx, 0.0), max(dy, 0.0))
    return min(max(dx, dy), 0.0) + outside - r


def rr_cov(x, y, cx, cy, hw, hh, r):
    sdf = rounded_rect_sdf(x, y, cx, cy, hw, hh, r)
    return max(0.0, min(1.0, 0.5 - sdf))


def over(dst, src, alpha):
    if alpha <= 0:
        return dst
    return tuple(d + (s - d) * alpha for d, s in zip(dst, src))


def scale_rgb(rgb):
    return tuple(c / 255.0 for c in rgb)


def to_bytes(color):
    return bytes(min(255, max(0, int(round(c * 255)))) for c in color)


# ---------------------------------------------------------------- art


def render(size, maskable=False):
    """Return raw RGBA rows for one icon at `size` px."""
    S = float(size)
    k = S / 512.0  # design is authored at 512
    cx = S / 2.0
    cy = S / 2.0

    bg = scale_rgb(DARK)
    gold = scale_rgb(GOLD)

    # Monogram geometry (authored at 512, then scaled). Maskable art sits in
    # the 80% safe zone so Android can crop it into any shape.
    art = 0.72 if maskable else 0.88
    stroke = 30.0 * k * art
    bar_h = 126.0 * k * art
    foot_w = 84.0 * k * art
    gap = 26.0 * k * art
    total_w = stroke * 2 + foot_w + gap
    left = cx - total_w / 2.0
    top = cy - bar_h / 2.0 - 6.0 * k
    radius = 112.0 * k if not maskable else 0.0
    inset = 4.0 * k

    rows = []
    for py in range(size):
        y = py + 0.5
        row = bytearray()
        for px in range(size):
            x = px + 0.5
            color = (0.0, 0.0, 0.0)
            alpha = 0.0

            # ---- panel -------------------------------------------------
            panel = (
                1.0
                if maskable
                else rr_cov(x, y, cx, cy, S / 2 - inset, S / 2 - inset, radius)
            )
            if panel > 0:
                # soft gold glow behind the monogram
                dist = math.hypot(x - cx, y - cy - S * 0.04) / (S * 0.46)
                glow = max(0.0, 1.0 - dist) ** 2 * 0.16
                body = over(bg, gold, glow)
                color = over(color, body, panel)
                alpha = panel

                # hairline gold border (skipped when maskable)
                if not maskable:
                    sdf = rounded_rect_sdf(x, y, cx, cy, S / 2 - inset, S / 2 - inset, radius)
                    ring = max(0.0, min(1.0, 0.5 - (abs(sdf) - 3.0 * k) / 1.0))
                    if ring > 0:
                        color = over(color, gold, ring * panel)
                        alpha = max(alpha, ring * panel)

            # ---- L L monogram ------------------------------------------
            if panel > 0:
                for index in (0, 1):
                    bx = left + index * (stroke + foot_w + gap)
                    stem = rect_cov(x, y, bx, top, bx + stroke, top + bar_h)
                    foot = rect_cov(
                        x, y, bx, top + bar_h - stroke, bx + stroke + foot_w, top + bar_h
                    )
                    cov = max(stem, foot)
                    if cov > 0:
                        color = over(color, gold, cov)

            row += to_bytes((color[0], color[1], color[2], alpha))
        rows.append(bytes(row))
    return rows


# ---------------------------------------------------------------- png


def write_png(path, size, rows):
    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as handle:
        handle.write(png)
    return len(png)


TARGETS = [
    ("icon-512.png", 512, False),
    ("icon-192.png", 192, False),
    ("apple-touch-icon.png", 180, False),
    ("icon-512-maskable.png", 512, True),
]

for name, size, maskable in TARGETS:
    rows = render(size, maskable=maskable)
    written = write_png(os.path.join(OUT_DIR, name), size, rows)
    print(f"{name}: {size}x{size}, {written} bytes")

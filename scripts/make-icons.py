#!/usr/bin/env python3
"""make-icons.py — regenerate the app's full home-screen icon set from a church logo.

This is the exact pipeline that produced Shiloh's shipped icons from
assets/media/shiloh-logo-stacked.jpg, packaged so any church that forks this
app can point it at THEIR logo:

    python3 scripts/make-icons.py path/to/logo.jpg
    python3 scripts/make-icons.py path/to/logo.png --mark-crop none
    python3 scripts/make-icons.py path/to/logo.jpg --out /tmp/preview-icons

What it does, in order:

1.  Flattens the logo onto white (transparent PNGs welcome) and trims the
    white margins so the artwork itself — not the file's padding — is what
    gets sized.
2.  Looks for the quiet horizontal gap that stacked logos have between the
    mark (the picture) and the wordmark (the church name underneath). If it
    finds one, the mark alone becomes the favicon, because at 32 pixels a
    full stacked logo is an unreadable smudge. If there is no gap — or you
    pass --mark-crop none — it quietly uses the whole logo instead.
3.  Writes the five files the app actually references, all on a white
    canvas, each with the content fraction that shipped for Shiloh:

        icon-512.png          512x512   logo at 80% of the canvas
        icon-192.png          192x192   logo at 80%
        icon-maskable-512.png 512x512   logo at 62% — inside Android's
                                        maskable safe zone, so circular
                                        home-screen crops don't clip it
        apple-touch-icon.png  180x180   logo at 82%
        favicon-32.png        32x32     the MARK alone at 94% (or the full
                                        logo at 94% if no mark was split)

By default it writes straight into assets/icons/, replacing the shipped
Shiloh set. Use --out to write somewhere else first if you want to look
before you leap. After replacing icons for real, bump CACHE_VERSION in
sw.js so phones that already installed the app fetch the new artwork.

Requires Pillow:  python3 -m pip install Pillow
"""

import argparse
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("This script needs Pillow. Install it with:  python3 -m pip install Pillow")

# Pixels lighter than this count as "white margin" when trimming,
# and rows made only of pixels lighter than GAP_THRESHOLD count as "quiet"
# when hunting for the mark/wordmark gap. Tuned on Shiloh's JPEG logo,
# where compression noise means "white" is never exactly 255.
TRIM_THRESHOLD = 245
GAP_THRESHOLD = 235

# The five outputs: (filename, canvas px, content fraction, use mark alone?)
OUTPUTS = [
    ("icon-512.png",          512, 0.80, False),
    ("icon-192.png",          192, 0.80, False),
    ("icon-maskable-512.png", 512, 0.62, False),  # Android maskable safe zone
    ("apple-touch-icon.png",  180, 0.82, False),
    ("favicon-32.png",         32, 0.94, True),
]


def flatten_to_white(im):
    """Return an RGB image with any transparency composited onto white."""
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        rgba = im.convert("RGBA")
        canvas = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        canvas.alpha_composite(rgba)
        return canvas.convert("RGB")
    return im.convert("RGB")


def trim_white(im, threshold=TRIM_THRESHOLD):
    """Crop away the near-white margins. Returns the cropped image, or None
    if the image has no content darker than the threshold at all."""
    gray = im.convert("L")
    mask = gray.point(lambda p: 255 if p < threshold else 0)
    bbox = mask.getbbox()
    if bbox is None:
        return None
    return im.crop(bbox)


def find_mark(trimmed):
    """Split a stacked logo into (mark, gap_rows) by finding the widest quiet
    horizontal band — a run of rows with (almost) no ink — in the lower part
    of the artwork, where the space between picture and wordmark lives.

    Returns (mark_image, (gap_start, gap_end)) on success, (None, None) when
    the logo doesn't split cleanly (single-piece logos, side-by-side logos,
    or anything else without a clean horizontal gap).
    """
    gray = trimmed.convert("L")
    w, h = gray.size
    if w < 8 or h < 8:
        return None, None
    px = gray.load()

    # A row is "quiet" if at most a sliver of it (JPEG noise) is dark.
    allowed_noise = max(1, int(round(w * 0.004)))
    quiet = []
    for y in range(h):
        dark = 0
        for x in range(w):
            if px[x, y] < GAP_THRESHOLD:
                dark += 1
                if dark > allowed_noise:
                    break
        quiet.append(dark <= allowed_noise)

    # Group consecutive quiet rows into bands; ignore bands touching the
    # top or bottom edge (those are just leftover margin, not a gap).
    bands = []
    start = None
    for y, q in enumerate(quiet):
        if q and start is None:
            start = y
        elif not q and start is not None:
            bands.append((start, y - 1))
            start = None
    if start is not None:
        bands.append((start, h - 1))
    bands = [b for b in bands if b[0] > 0 and b[1] < h - 1]

    # The mark/wordmark gap sits below the mark, so only consider bands whose
    # center falls in the lower two thirds of the artwork; take the widest.
    candidates = [b for b in bands if 0.35 * h <= (b[0] + b[1]) / 2.0 <= 0.95 * h]
    if not candidates:
        return None, None
    gap = max(candidates, key=lambda b: b[1] - b[0])

    mark = trim_white(trimmed.crop((0, 0, w, gap[0])))
    if mark is None:
        return None, None
    mw, mh = mark.size
    # Sanity: the mark should be a real chunk of the logo, not a stray speck.
    if mh < 0.30 * h or mw < 0.10 * w:
        return None, None
    return mark, gap


def render_icon(content, canvas_px, fraction):
    """Scale `content` so its longer side is `fraction` of the canvas,
    center it on white, return the canvas."""
    w, h = content.size
    long_side = max(w, h)
    target = int(round(canvas_px * fraction))
    scale = target / float(long_side)
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    resized = content.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGB", (canvas_px, canvas_px), (255, 255, 255))
    canvas.paste(resized, ((canvas_px - nw) // 2, (canvas_px - nh) // 2))
    return canvas


def main():
    default_out = os.path.normpath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "icons")
    )
    ap = argparse.ArgumentParser(
        description="Generate the app's five home-screen icons from a church logo.",
        epilog="Example: python3 scripts/make-icons.py assets/media/shiloh-logo-stacked.jpg",
    )
    ap.add_argument("logo", help="path to the church's logo (JPG or PNG, any size)")
    ap.add_argument(
        "--mark-crop", choices=["auto", "none"], default="auto",
        help="auto (default): try to split a stacked logo's mark from its wordmark "
             "for the favicon; none: always use the full logo",
    )
    ap.add_argument(
        "--out", default=default_out,
        help="output directory (default: the app's assets/icons/)",
    )
    args = ap.parse_args()

    if not os.path.isfile(args.logo):
        sys.exit("Can't find a file at: %s" % args.logo)

    logo = flatten_to_white(Image.open(args.logo))
    trimmed = trim_white(logo)
    if trimmed is None:
        sys.exit("That image looks entirely white/blank — nothing to make an icon from.")
    print("Logo: %s  %dx%d -> trimmed to %dx%d"
          % (args.logo, logo.size[0], logo.size[1], trimmed.size[0], trimmed.size[1]))

    mark = None
    if args.mark_crop == "auto":
        mark, gap = find_mark(trimmed)
        if mark is not None:
            print("Mark found: quiet gap at rows %d-%d of %d — the favicon will use "
                  "the mark alone (%dx%d)."
                  % (gap[0], gap[1], trimmed.size[1], mark.size[0], mark.size[1]))
        else:
            print("No clean mark/wordmark gap found — the favicon will use the full logo.")
    else:
        print("--mark-crop none: the favicon will use the full logo.")

    os.makedirs(args.out, exist_ok=True)
    for name, canvas_px, fraction, wants_mark in OUTPUTS:
        content = mark if (wants_mark and mark is not None) else trimmed
        icon = render_icon(content, canvas_px, fraction)
        path = os.path.join(args.out, name)
        icon.save(path, "PNG")
        print("  wrote %s  %dx%d  %d bytes  (content at %d%%%s)"
              % (path, canvas_px, canvas_px, os.path.getsize(path),
                 round(fraction * 100),
                 ", mark alone" if (wants_mark and mark is not None) else ""))

    if os.path.normpath(args.out) == default_out:
        print("Done. These replaced the live icons — bump CACHE_VERSION in sw.js "
              "so installed phones pick them up.")
    else:
        print("Done. Wrote to %s — copy into assets/icons/ when they look right, "
              "then bump CACHE_VERSION in sw.js." % args.out)


if __name__ == "__main__":
    main()

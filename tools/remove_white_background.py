#!/usr/bin/env python3
"""Remove an edge-connected white background from an image.

Only near-white pixels connected to the outer image edges become transparent.
Near-white details enclosed by the subject are intentionally preserved.
"""

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Remove an edge-connected white/near-white background and write a transparent PNG."
    )
    parser.add_argument("input", type=Path, help="source sprite sheet or image")
    parser.add_argument("output", type=Path, help="destination PNG path")
    parser.add_argument(
        "--threshold",
        type=int,
        default=240,
        choices=range(0, 256),
        metavar="0-255",
        help="minimum value required for every RGB channel to count as background (default: 240)",
    )
    return parser.parse_args()


def remove_edge_connected_white(image: Image.Image, threshold: int = 240) -> Image.Image:
    """Return an RGBA copy with edge-connected near-white pixels made transparent."""
    result = image.convert("RGBA")
    pixels = result.load()
    width, height = result.size
    visited = bytearray(width * height)
    pending: deque[tuple[int, int]] = deque()

    def is_near_white(x: int, y: int) -> bool:
        red, green, blue, alpha = pixels[x, y]
        return alpha > 0 and red >= threshold and green >= threshold and blue >= threshold

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if not visited[index] and is_near_white(x, y):
            visited[index] = 1
            pending.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while pending:
        x, y = pending.popleft()
        red, green, blue, _ = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
        if x > 0:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y > 0:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    return result


def main() -> None:
    args = parse_args()
    if args.output.suffix.lower() != ".png":
        raise SystemExit("Output path must use the .png extension so transparency is preserved.")
    if args.input.resolve() == args.output.resolve():
        raise SystemExit("Input and output paths must be different; the source image will not be overwritten.")

    with Image.open(args.input) as source:
        original_size = source.size
        result = remove_edge_connected_white(source, args.threshold)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    result.save(args.output, format="PNG")
    print(f"Wrote {args.output} ({original_size[0]}x{original_size[1]}) with edge-connected background removed.")


if __name__ == "__main__":
    main()

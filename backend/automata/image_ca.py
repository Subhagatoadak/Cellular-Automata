import numpy as np
from typing import List, Tuple

_MOORE = [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]

# ─── Palette definitions ───────────────────────────────────────────────────────
PALETTES = {
    "cosmic": [
        [5, 2, 18], [12, 0, 40], [30, 5, 80], [60, 10, 140],
        [100, 30, 200], [160, 70, 240], [200, 130, 255], [230, 190, 255],
        [255, 240, 255], [255, 255, 255],
    ],
    "fire": [
        [0, 0, 0], [20, 0, 0], [60, 5, 0], [120, 20, 0],
        [200, 60, 0], [240, 120, 0], [255, 200, 0], [255, 240, 80],
        [255, 255, 200], [255, 255, 255],
    ],
    "ocean": [
        [0, 5, 20], [0, 15, 50], [0, 40, 90], [0, 80, 140],
        [0, 130, 190], [30, 180, 220], [80, 220, 240], [150, 240, 255],
        [210, 250, 255], [255, 255, 255],
    ],
    "forest": [
        [2, 8, 2], [5, 20, 5], [10, 45, 10], [20, 80, 20],
        [40, 120, 30], [80, 160, 50], [140, 200, 80], [190, 230, 130],
        [220, 245, 180], [250, 255, 230],
    ],
    "neon": [
        [5, 0, 20], [20, 0, 60], [60, 0, 120], [120, 0, 180],
        [0, 200, 200], [0, 255, 200], [100, 255, 100], [200, 255, 50],
        [255, 220, 0], [255, 255, 255],
    ],
    "magma": [
        [0, 0, 4], [10, 5, 30], [40, 10, 70], [90, 20, 100],
        [150, 40, 100], [210, 60, 80], [250, 110, 50], [255, 180, 30],
        [255, 240, 100], [252, 253, 191],
    ],
}

def _apply_rule_to_grid(
    grid: np.ndarray,
    rule_fn,
    num_states: int,
    rng,
) -> np.ndarray:
    height, width = grid.shape
    new_grid = np.zeros_like(grid)
    neighbors = np.zeros((height, width), dtype=np.float32)
    for di, dj in _MOORE:
        neighbors += np.roll(np.roll(grid.astype(np.float32), di, 0), dj, 1)
    new_grid = rule_fn(grid, neighbors, num_states, rng)
    return new_grid.clip(0, num_states - 1).astype(np.uint8)


def _smooth_life_rule(grid, neighbors, num_states, rng):
    """Weighted smooth-life producing organic blobs."""
    avg = neighbors / 8.0
    new = grid.copy().astype(np.float32)
    alive = grid > num_states // 2
    # Birth
    new[~alive] = np.where(
        (avg[~alive] > 0.35) & (avg[~alive] < 0.65),
        grid[~alive] + 1,
        np.maximum(grid[~alive].astype(int) - 1, 0)
    )
    # Survive
    new[alive] = np.where(
        (avg[alive] > 0.25) & (avg[alive] < 0.75),
        np.minimum(grid[alive] + 1, num_states - 1),
        np.maximum(grid[alive] - 1, 0)
    )
    return new


def _cyclic_color_rule(grid, neighbors, num_states, rng):
    """Cyclic CA — neighbor advances state → creates spirals."""
    successor = (grid + 1) % num_states
    count = np.zeros_like(grid, dtype=np.int8)
    # Recompute per-state counts
    g = grid.astype(np.int16)
    for di, dj in _MOORE:
        nb = np.roll(np.roll(g, di, 0), dj, 1)
        count += (nb == successor).astype(np.int8)
    new = grid.copy()
    new[count >= 1] = successor[count >= 1]
    return new


def _diffusion_rule(grid, neighbors, num_states, rng):
    """Reaction-diffusion-like: each cell drifts toward average of neighbors."""
    avg = neighbors / 8.0
    new = (grid.astype(np.float32) * 0.6 + avg * 0.4)
    new += rng.standard_normal(grid.shape).astype(np.float32) * 0.4
    return new


def _turing_pattern_rule(grid, neighbors, num_states, rng):
    """Activator-inhibitor Turing pattern (simplified Gray-Scott)."""
    u = grid.astype(np.float32) / (num_states - 1)
    laplacian = neighbors / 8.0 - u
    # Gray-Scott inspired F=0.055, k=0.062
    du = 0.14 * laplacian + 0.055 * (1 - u) - (0.055 + 0.062) * u * u
    u2 = (u + du).clip(0, 1)
    return (u2 * (num_states - 1)).astype(np.float32)


def compute_image_ca(
    width: int,
    height: int,
    generations: int,
    palette_name: str = "cosmic",
    rule_type: str = "cyclic",
    num_states: int = 10,
    seed_type: str = "random",
) -> dict:
    """
    Multi-color image formation via cellular automaton.

    Each cell holds a state 0..num_states-1.
    States map to a continuous color palette producing stunning images.

    Rule types:
      cyclic      — spiraling color waves
      smooth_life — organic blobs and membranes
      diffusion   — ink-drop diffusion patterns
      turing      — reaction-diffusion Turing spots/stripes
    """
    palette = PALETTES.get(palette_name, PALETTES["cosmic"])
    rng = np.random.default_rng()

    # Initial seeding
    if seed_type == "random":
        grid = rng.integers(0, num_states, (height, width), dtype=np.uint8)
    elif seed_type == "center_burst":
        grid = np.zeros((height, width), dtype=np.uint8)
        cr, cc = height // 2, width // 2
        for r in range(height):
            for c in range(width):
                d = int(np.hypot(r - cr, c - cc))
                grid[r, c] = d % num_states
    elif seed_type == "gradient":
        xs = np.linspace(0, num_states - 1, width)
        ys = np.linspace(0, num_states - 1, height)
        gx, gy = np.meshgrid(xs, ys)
        grid = ((gx + gy) / 2 % num_states).astype(np.uint8)
    elif seed_type == "stripes":
        grid = np.zeros((height, width), dtype=np.uint8)
        for c in range(width):
            grid[:, c] = (c * num_states // width) % num_states
    else:
        grid = rng.integers(0, num_states, (height, width), dtype=np.uint8)

    rule_map = {
        "cyclic":      _cyclic_color_rule,
        "smooth_life": _smooth_life_rule,
        "diffusion":   _diffusion_rule,
        "turing":      _turing_pattern_rule,
    }
    rule_fn = rule_map.get(rule_type, _cyclic_color_rule)

    states = []
    for _ in range(generations):
        # Return RGB image per generation as flat list-of-rows-of-[r,g,b]
        rgb = _state_to_rgb(grid, palette, num_states)
        states.append(rgb.tolist())
        grid = _apply_rule_to_grid(grid, rule_fn, num_states, rng)

    return {
        "states": states,
        "palette": palette,
        "num_states": num_states,
        "rule_type": rule_type,
        "palette_name": palette_name,
        "is_rgb": True,
    }


def _state_to_rgb(grid: np.ndarray, palette: list, num_states: int) -> np.ndarray:
    """Interpolate state value → RGB using palette as a color gradient."""
    H, W = grid.shape
    n = len(palette)
    pal = np.array(palette, dtype=np.float32)
    t = grid.astype(np.float32) / max(num_states - 1, 1) * (n - 1)
    lo = np.floor(t).astype(np.int32).clip(0, n - 2)
    hi = lo + 1
    frac = (t - lo)[..., None]  # fractional part for interpolation
    rgb = pal[lo] * (1 - frac) + pal[hi] * frac
    return rgb.clip(0, 255).astype(np.uint8)

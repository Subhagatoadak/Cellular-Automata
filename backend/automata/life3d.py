import numpy as np
from typing import List

# 3D Moore neighborhood: 26 neighbors (all 3x3x3 minus center)
_OFFSETS_3D = [
    (di, dj, dk)
    for di in (-1, 0, 1)
    for dj in (-1, 0, 1)
    for dk in (-1, 0, 1)
    if not (di == 0 and dj == 0 and dk == 0)
]

# Well-known 3D GoL rules (B/S notation, neighbor count in 3D = 0..26)
RULES_3D = {
    "445":  {"born": {4},       "survive": {4, 5}},           # Classic sparse
    "5766": {"born": {5, 6},    "survive": {6, 7, 8}},        # Dense structures
    "B5S45": {"born": {5},      "survive": {4, 5}},           # Life-like growth
    "amoeba": {"born": {3,4,5}, "survive": {4,5,6,7,8}},     # Amoeba-like blobs
    "crystal": {"born": {6},    "survive": {5,6,7}},          # Crystal growth
    "pyroclastic": {"born": {4,5,6,7}, "survive": {6,7,8,9}},# Pyroclastic
}


def compute_life3d(
    size: int = 20,
    generations: int = 80,
    rule_name: str = "445",
    density: float = 0.10,
) -> dict:
    """
    3D Game of Life on a cubic grid.

    Returns dict with:
      - states: list of alive cell positions [[x,y,z],...] per generation
      - population: alive count per generation
      - born_count / died_count per generation
      - grid_size, rule_name
    """
    rule = RULES_3D.get(rule_name, RULES_3D["445"])
    born_set    = rule["born"]
    survive_set = rule["survive"]

    rng = np.random.default_rng()
    # Use uint8 grid
    grid = (rng.random((size, size, size)) < density).astype(np.uint8)

    states       = []
    populations  = []
    born_counts  = []
    died_counts  = []

    for _ in range(generations):
        alive_positions = list(zip(*np.where(grid)))
        states.append([[int(x), int(y), int(z)] for x, y, z in alive_positions])
        populations.append(len(alive_positions))

        # Count neighbors efficiently with roll
        neighbor_count = np.zeros((size, size, size), dtype=np.int8)
        for di, dj, dk in _OFFSETS_3D:
            neighbor_count += np.roll(np.roll(np.roll(grid, di, 0), dj, 1), dk, 2)

        new_grid = np.zeros_like(grid)
        for n in born_set:
            new_grid[(grid == 0) & (neighbor_count == n)] = 1
        for n in survive_set:
            new_grid[(grid == 1) & (neighbor_count == n)] = 1

        born_counts.append(int(np.sum((grid == 0) & (new_grid == 1))))
        died_counts.append(int(np.sum((grid == 1) & (new_grid == 0))))

        grid = new_grid

    return {
        "states":      states,
        "populations": populations,
        "born_counts": born_counts,
        "died_counts": died_counts,
        "grid_size":   size,
        "rule_name":   rule_name,
    }

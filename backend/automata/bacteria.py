import numpy as np
from typing import List

_MOORE = [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]
_VON_NEUMANN = [(0,1),(0,-1),(1,0),(-1,0)]

# Cell states
EMPTY      = 0
BACTERIA_A = 1   # strain A (fast spreading)
BACTERIA_B = 2   # strain B (nutrient-dependent)
BACTERIA_C = 3   # strain C (resistant)
NUTRIENT   = 4   # nutrient patch
DEAD       = 5   # dead / consumed cell


def compute_bacteria(
    width: int,
    height: int,
    generations: int,
    num_strains: int = 3,
    spread_rate: float = 0.55,
    death_rate: float = 0.08,
    nutrient_density: float = 0.15,
    initial_density: float = 0.04,
) -> List[List[List[int]]]:
    """
    Realistic bacteria colony spread simulation.

    - Multiple competing strains (A, B, C) with different behaviors
    - Nutrient patches (state 4) accelerate growth nearby
    - Strain A: fast, spreads aggressively into empty space
    - Strain B: slower but feeds on nutrients, grows into nutrient patches
    - Strain C: slowest spread, but highly resistant — survives death events
    - Dead cells (state 5) decay back to empty after a few steps
    - Strains compete: each will colonize neighbors of other strains (weakly)
    """
    rng = np.random.default_rng()
    grid = np.zeros((height, width), dtype=np.int8)
    dead_timer = np.zeros((height, width), dtype=np.int8)

    # Place nutrient patches
    grid[rng.random((height, width)) < nutrient_density] = NUTRIENT

    # Seed each strain in a different cluster
    centers = [
        (height // 4,     width // 4),
        (3 * height // 4, width // 4),
        (height // 2,     3 * width // 4),
    ]
    strains = [BACTERIA_A, BACTERIA_B, BACTERIA_C][:num_strains]
    for i, strain in enumerate(strains):
        cr, cc = centers[i]
        for dr in range(-3, 4):
            for dc in range(-3, 4):
                r, c = (cr + dr) % height, (cc + dc) % width
                if rng.random() < initial_density * 5 and grid[r, c] == EMPTY:
                    grid[r, c] = strain

    states = []
    for _ in range(generations):
        states.append(grid.tolist())
        new_grid = grid.copy()

        for r in range(height):
            for c in range(width):
                cell = grid[r, c]

                # Dead cells decay back to empty
                if cell == DEAD:
                    dead_timer[r, c] += 1
                    if dead_timer[r, c] >= 4:
                        new_grid[r, c] = EMPTY
                        dead_timer[r, c] = 0
                    continue

                if cell == EMPTY or cell == NUTRIENT:
                    # Count bacteria neighbors
                    for di, dj in _MOORE:
                        nr, nc = (r + di) % height, (c + dj) % width
                        nb = grid[nr, nc]
                        if nb not in (BACTERIA_A, BACTERIA_B, BACTERIA_C):
                            continue
                        rate = spread_rate
                        # Strain B spreads faster into nutrient cells
                        if nb == BACTERIA_B and cell == NUTRIENT:
                            rate = min(0.95, spread_rate + 0.3)
                        # Strain A spreads faster into empty
                        if nb == BACTERIA_A and cell == EMPTY:
                            rate = min(0.90, spread_rate + 0.15)
                        if rng.random() < rate / 8:
                            new_grid[r, c] = nb
                            break

                elif cell in (BACTERIA_A, BACTERIA_B, BACTERIA_C):
                    # Death: strain C resists
                    dr_ = death_rate if cell != BACTERIA_C else death_rate * 0.3
                    if rng.random() < dr_:
                        new_grid[r, c] = DEAD
                        dead_timer[r, c] = 0
                        continue

                    # Weak competition — can be displaced by a neighboring different strain
                    if rng.random() < 0.012:
                        for di, dj in _VON_NEUMANN:
                            nr2, nc2 = (r + di) % height, (c + dj) % width
                            other = grid[nr2, nc2]
                            if other in (BACTERIA_A, BACTERIA_B, BACTERIA_C) and other != cell:
                                # Strain C wins competitions
                                if cell == BACTERIA_C:
                                    pass
                                elif other == BACTERIA_C:
                                    new_grid[r, c] = DEAD
                                else:
                                    new_grid[r, c] = other
                                break

        grid = new_grid

    return states

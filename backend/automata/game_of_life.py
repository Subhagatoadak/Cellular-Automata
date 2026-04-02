import numpy as np
from typing import List


_NEIGHBOR_OFFSETS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def compute_game_of_life(
    width: int,
    height: int,
    generations: int,
    initial_state: str = "random",
    density: float = 0.3,
) -> List[List[List[int]]]:
    """
    Compute Conway's Game of Life.
    Returns a list of generations, each generation is a 2D list (height × width).
    Cell values: 0=dead, 1=alive.
    """
    rng = np.random.default_rng()

    if initial_state == "random":
        current = (rng.random((height, width)) < density).astype(np.int8)
    else:
        current = np.zeros((height, width), dtype=np.int8)

    states = []
    for _ in range(generations):
        states.append(current.tolist())

        neighbors = np.zeros_like(current, dtype=np.int8)
        for di, dj in _NEIGHBOR_OFFSETS:
            neighbors += np.roll(np.roll(current, di, axis=0), dj, axis=1)

        new = np.zeros_like(current)
        new[(current == 1) & ((neighbors == 2) | (neighbors == 3))] = 1
        new[(current == 0) & (neighbors == 3)] = 1
        current = new

    return states

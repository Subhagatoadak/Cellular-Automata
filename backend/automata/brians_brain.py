import numpy as np
from typing import List


_NEIGHBOR_OFFSETS = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def compute_brians_brain(
    width: int,
    height: int,
    generations: int,
    initial_state: str = "random",
    density: float = 0.2,
) -> List[List[List[int]]]:
    """
    Compute Brian's Brain cellular automaton.
    States: 0=dead, 1=firing (ON), 2=refractory (dying).
    Returns a list of generations, each generation is a 2D list (height × width).
    """
    rng = np.random.default_rng()

    if initial_state == "random":
        current = np.zeros((height, width), dtype=np.int8)
        current[rng.random((height, width)) < density] = 1
    else:
        current = np.zeros((height, width), dtype=np.int8)

    states = []
    for _ in range(generations):
        states.append(current.tolist())

        firing = (current == 1).astype(np.int8)
        neighbors = np.zeros_like(current, dtype=np.int8)
        for di, dj in _NEIGHBOR_OFFSETS:
            neighbors += np.roll(np.roll(firing, di, axis=0), dj, axis=1)

        new = np.zeros_like(current)
        # Dead cell with exactly 2 firing neighbors → fires
        new[(current == 0) & (neighbors == 2)] = 1
        # Firing → refractory
        new[current == 1] = 2
        # Refractory → dead (already 0)
        current = new

    return states

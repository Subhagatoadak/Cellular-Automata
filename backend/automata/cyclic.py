import numpy as np
from typing import List

_MOORE = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
_VON_NEUMANN = [(0, 1), (0, -1), (1, 0), (-1, 0)]


def compute_cyclic(
    width: int,
    height: int,
    generations: int,
    num_states: int = 8,
    threshold: int = 1,
    neighborhood: str = "moore",
) -> List[List[List[int]]]:
    """
    Cyclic cellular automaton.
    A cell advances to state (s+1) % num_states if it has >= threshold neighbors in state (s+1).
    Creates stunning rotating spiral / wave patterns.
    """
    offsets = _MOORE if neighborhood == "moore" else _VON_NEUMANN
    rng = np.random.default_rng()
    current = rng.integers(0, num_states, (height, width), dtype=np.int16)

    states = []
    for _ in range(generations):
        states.append(current.tolist())
        successor = (current + 1) % num_states

        count = np.zeros((height, width), dtype=np.int8)
        for di, dj in offsets:
            neighbor = np.roll(np.roll(current, di, axis=0), dj, axis=1)
            count += (neighbor == successor).astype(np.int8)

        new = current.copy()
        mask = count >= threshold
        new[mask] = successor[mask]
        current = new

    return states

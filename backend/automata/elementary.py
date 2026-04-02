import numpy as np
from typing import List


def compute_elementary(
    rule_number: int,
    width: int,
    generations: int,
    initial_state: str = "single_cell",
    density: float = 0.3,
) -> List[List[int]]:
    """
    Compute 1D elementary cellular automaton.
    Returns a list of generations, each generation is a 1D list of cell values (0 or 1).
    """
    # Build lookup table: rule_table[pattern_index] = output_bit
    # pattern_index = left*4 + center*2 + right
    rule_table = np.array([(rule_number >> i) & 1 for i in range(8)], dtype=np.int8)

    current = np.zeros(width, dtype=np.int8)
    rng = np.random.default_rng()

    if initial_state == "single_cell":
        current[width // 2] = 1
    elif initial_state == "random":
        current = (rng.random(width) < density).astype(np.int8)
    elif initial_state == "alternating":
        current = np.arange(width, dtype=np.int8) % 2
    elif initial_state == "two_cells":
        current[width // 2 - 1] = 1
        current[width // 2 + 1] = 1

    states = []
    for _ in range(generations):
        states.append(current.tolist())
        left = np.roll(current, 1)
        right = np.roll(current, -1)
        idx = (left * 4 + current * 2 + right).astype(np.uint8)
        current = rule_table[idx]

    return states

import numpy as np
from typing import List, Tuple

_MOORE = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def parse_bs_rule(rule_str: str) -> Tuple[List[int], List[int]]:
    """
    Parse B/S notation like 'B3/S23', 'B36/S23', 'b2s' etc.
    Returns (birth_counts, survival_counts).
    """
    s = rule_str.upper().replace(" ", "")
    birth, survival = [], []

    # Handle B.../S... format
    if "/" in s:
        parts = s.split("/")
        for part in parts:
            if part.startswith("B"):
                birth = [int(c) for c in part[1:] if c.isdigit()]
            elif part.startswith("S"):
                survival = [int(c) for c in part[1:] if c.isdigit()]
    else:
        # Handle compact format like 'B23S3' or '23/3'
        bi = s.find("B")
        si = s.find("S")
        if bi != -1 and si != -1:
            b_part = s[bi + 1 : si]
            s_part = s[si + 1 :]
            birth = [int(c) for c in b_part if c.isdigit()]
            survival = [int(c) for c in s_part if c.isdigit()]

    return sorted(set(birth)), sorted(set(survival))


def compute_custom_2d(
    width: int,
    height: int,
    generations: int,
    bs_rule: str = "B3/S23",
    initial_state: str = "random",
    density: float = 0.3,
) -> Tuple[List[List[List[int]]], str, List[int], List[int]]:
    """
    Compute 2D outer-totalistic CA with arbitrary B/S rule.
    Returns (states, canonical_rule_str, birth_counts, survival_counts).
    """
    birth_counts, survival_counts = parse_bs_rule(bs_rule)
    canonical = f"B{''.join(map(str,birth_counts))}/S{''.join(map(str,survival_counts))}"

    rng = np.random.default_rng()
    if initial_state == "random":
        current = (rng.random((height, width)) < density).astype(np.int8)
    else:
        current = np.zeros((height, width), dtype=np.int8)
        current[height // 2, width // 2] = 1

    states = []
    birth_set = set(birth_counts)
    survival_set = set(survival_counts)

    for _ in range(generations):
        states.append(current.tolist())

        neighbors = np.zeros_like(current, dtype=np.int8)
        for di, dj in _MOORE:
            neighbors += np.roll(np.roll(current, di, axis=0), dj, axis=1)

        new = np.zeros_like(current)
        for n in birth_set:
            new[(current == 0) & (neighbors == n)] = 1
        for n in survival_set:
            new[(current == 1) & (neighbors == n)] = 1
        current = new

    return states, canonical, birth_counts, survival_counts

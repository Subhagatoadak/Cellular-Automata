import numpy as np
from typing import List

# Directions: 0=UP 1=RIGHT 2=DOWN 3=LEFT
_DR = [-1, 0, 1, 0]
_DC = [0, 1, 0, -1]


def compute_langtons_ant(
    width: int,
    height: int,
    generations: int,
    num_ants: int = 1,
) -> List[List[List[int]]]:
    """
    Langton's Ant: 2-state Turing machine on a grid.
    Cell values returned:
      0 = white cell
      1 = black cell
      2 = ant on white cell
      3 = ant on black cell

    After ~10,000 steps the ant enters a periodic "highway" that extends indefinitely.
    Multiple ants create complex, unpredictable interaction patterns.
    """
    grid = np.zeros((height, width), dtype=np.int8)

    # Place ants evenly spaced
    ants = []
    for i in range(num_ants):
        r = height // 2 + (i - num_ants // 2) * 6
        c = width // 2 + (i - num_ants // 2) * 6
        r = max(0, min(r, height - 1))
        c = max(0, min(c, width - 1))
        ants.append([r, c, 0])  # [row, col, direction]

    states = []
    for _ in range(generations):
        # Build display state: mark ant positions
        display = grid.copy()
        for r, c, _ in ants:
            display[r, c] += 2  # 0→2 (ant on white), 1→3 (ant on black)
        states.append(display.tolist())

        for ant in ants:
            r, c, d = ant
            cell = grid[r, c]
            if cell == 0:  # white → turn right, flip to black
                ant[2] = (d + 1) % 4
                grid[r, c] = 1
            else:          # black → turn left, flip to white
                ant[2] = (d - 1) % 4
                grid[r, c] = 0
            ant[0] = (r + _DR[ant[2]]) % height
            ant[1] = (c + _DC[ant[2]]) % width

    return states

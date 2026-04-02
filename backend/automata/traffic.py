import numpy as np
from typing import List

# Cell states in traffic grid
ROAD_EMPTY   = 0
CAR_SLOW     = 1   # car, velocity 1
CAR_MEDIUM   = 2   # car, velocity 2
CAR_FAST     = 3   # car, velocity 3
INTERSECTION = 4   # intersection / junction (light)
BLOCKED      = 5   # traffic jam / accident

# Lane types (encoded in metadata, not cell value)
HORIZONTAL = 0
VERTICAL   = 1


def compute_traffic(
    width: int,
    height: int,
    generations: int,
    num_lanes: int = 4,
    car_density: float = 0.25,
    max_speed: int = 3,
    brake_prob: float = 0.15,
    light_period: int = 12,
) -> dict:
    """
    Nagel-Schreckenberg traffic flow model on a multi-lane grid.

    Returns states + metadata about lane layout and traffic stats per generation.

    Rules (per lane, each row/col):
      1. Accelerate: v → min(v+1, max_speed) if space ahead ≥ v+1
      2. Brake for gap: v → gap if gap < v
      3. Random slow: v → v-1 with prob brake_prob (models human behaviour)
      4. Move: advance car by v cells

    Intersections (every ~width//num_lanes cells) have traffic lights that
    alternately block H and V traffic on a period.

    Cell values returned:
      0  = empty road
      1  = slow car  (v=1)
      2  = medium car (v=2)
      3  = fast car  (v=3)
      4  = intersection (green for H)
      5  = intersection (green for V)
    """
    rng = np.random.default_rng()

    # Build road network
    grid = np.zeros((height, width), dtype=np.int8)
    # Horizontal lanes every (height // num_lanes) rows
    lane_spacing_h = max(3, height // num_lanes)
    lane_spacing_v = max(3, width  // num_lanes)
    h_lanes = list(range(0, height, lane_spacing_h))[:num_lanes]
    v_lanes = list(range(0, width,  lane_spacing_v))[:num_lanes]

    # Place intersections
    intersections = set()
    for r in h_lanes:
        for c in v_lanes:
            intersections.add((r, c))

    # Seed cars on lanes
    cars_h = {}  # row → list of (col, vel)
    cars_v = {}  # col → list of (row, vel)

    for r in h_lanes:
        cars_h[r] = []
        for c in range(width):
            if (r, c) not in intersections and rng.random() < car_density:
                v = rng.integers(1, max_speed + 1)
                cars_h[r].append([c, int(v)])

    for c in v_lanes:
        cars_v[c] = []
        for r in range(height):
            if (r, c) not in intersections and rng.random() < car_density:
                v = rng.integers(1, max_speed + 1)
                cars_v[c].append([r, int(v)])

    states = []
    traffic_stats = []  # avg speed per gen

    for gen in range(generations):
        # Render current state
        grid[:] = 0
        light_phase = (gen // light_period) % 2  # 0=H green, 1=V green

        for r, c in intersections:
            grid[r, c] = 4 if light_phase == 0 else 5

        for r, car_list in cars_h.items():
            for pos, vel in car_list:
                if 0 <= pos < width:
                    grid[r, pos] = min(3, max(1, vel))

        for c, car_list in cars_v.items():
            for pos, vel in car_list:
                if 0 <= pos < height:
                    grid[pos, c] = min(3, max(1, vel))

        states.append(grid.tolist())

        # Track avg speed
        all_vels = [vel for cl in cars_h.values() for _, vel in cl] + \
                   [vel for cl in cars_v.values() for _, vel in cl]
        avg_speed = float(np.mean(all_vels)) if all_vels else 0.0
        traffic_stats.append(round(avg_speed, 2))

        # Update horizontal lanes
        for r, car_list in cars_h.items():
            # Build occupancy
            occ = set(pos for pos, _ in car_list)
            new_list = []
            for car in car_list:
                pos, vel = car
                # Check intersection light
                at_intersection = any((r, (pos + d) % width) in intersections for d in range(1, vel + 2))
                if light_phase == 1 and at_intersection:
                    vel = max(0, vel - 1)

                # Gap ahead
                gap = width  # default large
                for d in range(1, width):
                    ahead = (pos + d) % width
                    if ahead in occ and ahead != pos:
                        gap = d - 1
                        break

                # NS rules
                vel = min(vel + 1, max_speed)          # 1. accelerate
                vel = min(vel, gap)                    # 2. brake for gap
                if vel > 0 and rng.random() < brake_prob:
                    vel = max(0, vel - 1)              # 3. random slow

                new_pos = (pos + vel) % width
                new_list.append([new_pos, vel])

            cars_h[r] = new_list

        # Update vertical lanes
        for c, car_list in cars_v.items():
            occ = set(pos for pos, _ in car_list)
            new_list = []
            for car in car_list:
                pos, vel = car
                at_intersection = any(((pos + d) % height, c) in intersections for d in range(1, vel + 2))
                if light_phase == 0 and at_intersection:
                    vel = max(0, vel - 1)

                gap = height
                for d in range(1, height):
                    ahead = (pos + d) % height
                    if ahead in occ and ahead != pos:
                        gap = d - 1
                        break

                vel = min(vel + 1, max_speed)
                vel = min(vel, gap)
                if vel > 0 and rng.random() < brake_prob:
                    vel = max(0, vel - 1)

                new_pos = (pos + vel) % height
                new_list.append([new_pos, vel])

            cars_v[c] = new_list

    return {
        "states": states,
        "traffic_stats": traffic_stats,
        "h_lanes": h_lanes,
        "v_lanes": v_lanes,
        "light_period": light_period,
    }

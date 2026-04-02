from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Literal

from automata.elementary import compute_elementary
from automata.game_of_life import compute_game_of_life
from automata.brians_brain import compute_brians_brain
from automata.cyclic import compute_cyclic
from automata.langtons_ant import compute_langtons_ant
from automata.custom_2d import compute_custom_2d
from automata.bacteria import compute_bacteria
from automata.traffic import compute_traffic
from automata.image_ca import compute_image_ca
from automata.life3d import compute_life3d
from automata.epidemic import compute_epidemic

app = FastAPI(title="Cellular Automata API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ComputeRequest(BaseModel):
    automata_type: Literal[
        "elementary", "game_of_life", "brians_brain", "cyclic",
        "langtons_ant", "custom_2d", "bacteria", "traffic", "image_ca",
        "life_3d", "epidemic"
    ] = "elementary"
    # Elementary CA
    rule: int = Field(110, ge=0, le=255)
    # Grid dims
    width: int = Field(120, ge=10, le=300)
    height: int = Field(80, ge=10, le=200)
    generations: int = Field(150, ge=1, le=600)
    # Seeding
    initial_state: Literal["single_cell", "random", "alternating", "two_cells"] = "single_cell"
    density: float = Field(0.3, ge=0.01, le=0.99)
    # Cyclic CA
    num_states: int = Field(8, ge=3, le=24)
    threshold: int = Field(1, ge=1, le=8)
    neighborhood: Literal["moore", "vonneumann"] = "moore"
    # Langton's Ant
    num_ants: int = Field(1, ge=1, le=8)
    # Custom 2D
    bs_rule: str = Field("B3/S23", max_length=30)
    # Bacteria
    num_strains: int = Field(3, ge=1, le=3)
    spread_rate: float = Field(0.55, ge=0.1, le=0.95)
    death_rate: float = Field(0.08, ge=0.0, le=0.5)
    nutrient_density: float = Field(0.15, ge=0.0, le=0.5)
    # Traffic
    num_lanes: int = Field(4, ge=2, le=8)
    car_density: float = Field(0.25, ge=0.05, le=0.8)
    max_speed: int = Field(3, ge=1, le=5)
    brake_prob: float = Field(0.15, ge=0.0, le=0.5)
    light_period: int = Field(12, ge=4, le=40)
    # Image CA
    palette_name: Literal["cosmic", "fire", "ocean", "forest", "neon", "magma"] = "cosmic"
    image_rule: Literal["cyclic", "smooth_life", "diffusion", "turing"] = "cyclic"
    seed_type: Literal["random", "center_burst", "gradient", "stripes"] = "random"
    # 3D Game of Life
    grid_size: int = Field(18, ge=8, le=28)
    rule_3d: Literal["445", "5766", "B5S45", "amoeba", "crystal", "pyroclastic"] = "445"
    # Epidemic
    forecast_weeks: int = Field(0, ge=0, le=52)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/rules")
def get_rules():
    return {
        "automata_types": [
            {"id": "elementary",   "name": "Elementary CA",   "label": "1D",  "category": "classic",
             "description": "Wolfram's 256 one-dimensional rules. From simple stripes to Turing-complete chaos."},
            {"id": "game_of_life", "name": "Game of Life",    "label": "2D",  "category": "classic",
             "description": "Conway's B3/S23 — the most famous CA. Gliders, oscillators and emergent complexity."},
            {"id": "brians_brain", "name": "Brian's Brain",   "label": "2D",  "category": "classic",
             "description": "Three-state automaton (firing → refractory → dead). Self-replicating glider storms."},
            {"id": "cyclic",       "name": "Cyclic CA",       "label": "2D",  "category": "classic",
             "description": "States cycle 0→1→…→N→0 when enough neighbors are one step ahead. Creates stunning spirals."},
            {"id": "langtons_ant", "name": "Langton's Ant",   "label": "2D",  "category": "classic",
             "description": "A Turing machine on a 2D grid. Chaotic early, then builds an infinite periodic highway."},
            {"id": "custom_2d",    "name": "Custom B/S Rule", "label": "2D",  "category": "classic",
             "description": "Design your own 2D CA using Birth/Survival notation. Infinite rule space."},
            {"id": "bacteria",     "name": "Bacteria Spread", "label": "BIO", "category": "applied",
             "description": "Multi-strain bacterial colony competition with nutrients, death, and resistance dynamics."},
            {"id": "traffic",      "name": "Traffic Flow",    "label": "SIM", "category": "applied",
             "description": "Nagel-Schreckenberg multi-lane traffic with traffic lights, jams, and speed dynamics."},
            {"id": "image_ca",     "name": "Color Image CA",  "label": "ART", "category": "art",
             "description": "Multi-color image formation via CA rules — cyclic spirals, Turing patterns, diffusion art."},
            {"id": "life_3d",      "name": "3D Game of Life", "label": "3D",  "category": "3d",
             "description": "True 3D cellular automaton in a cubic grid. Six rule variants produce wildly different structures."},
            {"id": "epidemic",     "name": "COVID-19 Forecast","label": "GEO", "category": "applied",
             "description": "SEIR-CA world epidemic model using real COVID-19 data. Historic spread → endemic → 2-year forecast."},
        ],
        "presets": {
            "elementary": [
                {"name": "Rule 110 — Turing Complete", "rule": 110, "initial_state": "single_cell"},
                {"name": "Rule 30 — Chaotic / RNG",   "rule": 30,  "initial_state": "single_cell"},
                {"name": "Rule 90 — Sierpiński",       "rule": 90,  "initial_state": "single_cell"},
                {"name": "Rule 184 — Traffic Flow",    "rule": 184, "initial_state": "random"},
                {"name": "Rule 126 — Complex",         "rule": 126, "initial_state": "single_cell"},
                {"name": "Rule 45 — Class 3 Chaos",    "rule": 45,  "initial_state": "random"},
                {"name": "Rule 150 — Sierpiński v2",   "rule": 150, "initial_state": "single_cell"},
                {"name": "Rule 54 — Complex",          "rule": 54,  "initial_state": "single_cell"},
            ],
            "game_of_life": [
                {"name": "Sparse (20%)",   "density": 0.20},
                {"name": "Standard (35%)", "density": 0.35},
                {"name": "Dense (55%)",    "density": 0.55},
            ],
            "brians_brain": [
                {"name": "Sparse (15%)",   "density": 0.15},
                {"name": "Standard (25%)", "density": 0.25},
                {"name": "Dense (40%)",    "density": 0.40},
            ],
            "cyclic": [
                {"name": "4 States — Fast spirals",  "num_states": 4,  "threshold": 1},
                {"name": "8 States — Classic",       "num_states": 8,  "threshold": 1},
                {"name": "14 States — Slow",         "num_states": 14, "threshold": 1},
                {"name": "16 States — Complex",      "num_states": 16, "threshold": 2},
            ],
            "langtons_ant": [
                {"name": "Single Ant",        "num_ants": 1},
                {"name": "Two Ants",          "num_ants": 2},
                {"name": "Four Ants",         "num_ants": 4},
                {"name": "Eight Ants",        "num_ants": 8},
            ],
            "custom_2d": [
                {"name": "Conway Life",    "bs_rule": "B3/S23",     "density": 0.35},
                {"name": "HighLife",       "bs_rule": "B36/S23",    "density": 0.35},
                {"name": "Seeds",          "bs_rule": "B2/S",       "density": 0.05},
                {"name": "Maze",           "bs_rule": "B3/S12345",  "density": 0.05},
                {"name": "Day & Night",    "bs_rule": "B3678/S34678","density": 0.5},
                {"name": "Diamoeba",       "bs_rule": "B35678/S5678","density": 0.5},
                {"name": "Morley",         "bs_rule": "B368/S245",  "density": 0.35},
                {"name": "Replicator",     "bs_rule": "B1357/S1357","density": 0.05},
            ],
            "bacteria": [
                {"name": "3 Strains, Balanced",    "num_strains": 3, "spread_rate": 0.55, "death_rate": 0.08, "nutrient_density": 0.15},
                {"name": "Aggressive Spread",      "num_strains": 3, "spread_rate": 0.80, "death_rate": 0.04, "nutrient_density": 0.20},
                {"name": "High Competition",       "num_strains": 3, "spread_rate": 0.60, "death_rate": 0.15, "nutrient_density": 0.10},
                {"name": "Nutrient-rich Medium",   "num_strains": 2, "spread_rate": 0.50, "death_rate": 0.05, "nutrient_density": 0.35},
                {"name": "Single Strain Growth",   "num_strains": 1, "spread_rate": 0.65, "death_rate": 0.06, "nutrient_density": 0.20},
            ],
            "traffic": [
                {"name": "Light Traffic (20%)",    "car_density": 0.20, "num_lanes": 4, "brake_prob": 0.10},
                {"name": "Rush Hour (40%)",        "car_density": 0.40, "num_lanes": 4, "brake_prob": 0.20},
                {"name": "Gridlock (65%)",         "car_density": 0.65, "num_lanes": 4, "brake_prob": 0.30},
                {"name": "Highway (6 lanes)",      "car_density": 0.30, "num_lanes": 6, "brake_prob": 0.12},
                {"name": "Aggressive Drivers",     "car_density": 0.35, "num_lanes": 4, "brake_prob": 0.05, "max_speed": 5},
            ],
            "image_ca": [
                {"name": "Cosmic Cyclic Spirals",  "palette_name": "cosmic",  "image_rule": "cyclic",      "seed_type": "random"},
                {"name": "Fire Diffusion",          "palette_name": "fire",    "image_rule": "diffusion",   "seed_type": "random"},
                {"name": "Ocean Smooth Life",       "palette_name": "ocean",   "image_rule": "smooth_life", "seed_type": "random"},
                {"name": "Turing Spots (Magma)",    "palette_name": "magma",   "image_rule": "turing",      "seed_type": "random"},
                {"name": "Neon Burst Spirals",      "palette_name": "neon",    "image_rule": "cyclic",      "seed_type": "center_burst"},
                {"name": "Forest Gradient Turing",  "palette_name": "forest",  "image_rule": "turing",      "seed_type": "gradient"},
            ],
            "life_3d": [
                {"name": "445 — Classic sparse",      "rule_3d": "445",        "grid_size": 18, "density": 0.10},
                {"name": "5766 — Dense structures",   "rule_3d": "5766",       "grid_size": 16, "density": 0.08},
                {"name": "Amoeba blobs",              "rule_3d": "amoeba",     "grid_size": 16, "density": 0.12},
                {"name": "Crystal growth",            "rule_3d": "crystal",    "grid_size": 18, "density": 0.06},
                {"name": "B5/S45 Life-like",          "rule_3d": "B5S45",      "grid_size": 18, "density": 0.09},
                {"name": "Pyroclastic",               "rule_3d": "pyroclastic","grid_size": 16, "density": 0.15},
            ],
            "epidemic": [
                {"name": "Full COVID Story (2019–2026)", "generations": 320},
                {"name": "Historic Only (2019–2023)",    "generations": 200},
                {"name": "Waves Focus (2020–2022)",      "generations": 130},
            ],
        },
    }


@app.post("/api/compute")
def compute(req: ComputeRequest):
    try:
        if req.automata_type == "elementary":
            states = compute_elementary(
                rule_number=req.rule, width=req.width,
                generations=req.generations, initial_state=req.initial_state, density=req.density,
            )
            return {"automata_type": req.automata_type, "rule": req.rule, "width": req.width,
                    "height": 1, "total_generations": len(states), "states": states}

        elif req.automata_type == "game_of_life":
            states = compute_game_of_life(
                width=req.width, height=req.height,
                generations=req.generations, initial_state=req.initial_state, density=req.density,
            )
            return {"automata_type": req.automata_type, "rule": None,
                    "width": req.width, "height": req.height,
                    "total_generations": len(states), "states": states}

        elif req.automata_type == "brians_brain":
            states = compute_brians_brain(
                width=req.width, height=req.height,
                generations=req.generations, initial_state=req.initial_state, density=req.density,
            )
            return {"automata_type": req.automata_type, "rule": None,
                    "width": req.width, "height": req.height,
                    "total_generations": len(states), "states": states}

        elif req.automata_type == "cyclic":
            states = compute_cyclic(
                width=req.width, height=req.height, generations=req.generations,
                num_states=req.num_states, threshold=req.threshold, neighborhood=req.neighborhood,
            )
            return {"automata_type": req.automata_type, "rule": None,
                    "width": req.width, "height": req.height,
                    "total_generations": len(states), "num_states": req.num_states, "states": states}

        elif req.automata_type == "langtons_ant":
            states = compute_langtons_ant(
                width=req.width, height=req.height,
                generations=req.generations, num_ants=req.num_ants,
            )
            return {"automata_type": req.automata_type, "rule": None,
                    "width": req.width, "height": req.height,
                    "total_generations": len(states), "num_ants": req.num_ants, "states": states}

        elif req.automata_type == "custom_2d":
            states, canonical, birth_counts, survival_counts = compute_custom_2d(
                width=req.width, height=req.height, generations=req.generations,
                bs_rule=req.bs_rule, initial_state=req.initial_state, density=req.density,
            )
            return {"automata_type": req.automata_type, "rule": canonical,
                    "width": req.width, "height": req.height,
                    "total_generations": len(states),
                    "birth_counts": birth_counts, "survival_counts": survival_counts, "states": states}

        elif req.automata_type == "bacteria":
            states = compute_bacteria(
                width=req.width, height=req.height, generations=req.generations,
                num_strains=req.num_strains, spread_rate=req.spread_rate,
                death_rate=req.death_rate, nutrient_density=req.nutrient_density,
                initial_density=req.density,
            )
            return {"automata_type": req.automata_type, "rule": None,
                    "width": req.width, "height": req.height,
                    "total_generations": len(states),
                    "num_strains": req.num_strains, "states": states}

        elif req.automata_type == "traffic":
            result = compute_traffic(
                width=req.width, height=req.height, generations=req.generations,
                num_lanes=req.num_lanes, car_density=req.car_density,
                max_speed=req.max_speed, brake_prob=req.brake_prob,
                light_period=req.light_period,
            )
            return {"automata_type": req.automata_type, "rule": None,
                    "width": req.width, "height": req.height,
                    "total_generations": len(result["states"]),
                    "states": result["states"],
                    "traffic_stats": result["traffic_stats"],
                    "h_lanes": result["h_lanes"], "v_lanes": result["v_lanes"],
                    "light_period": result["light_period"]}

        elif req.automata_type == "image_ca":
            result = compute_image_ca(
                width=req.width, height=req.height, generations=req.generations,
                palette_name=req.palette_name, rule_type=req.image_rule,
                num_states=req.num_states, seed_type=req.seed_type,
            )
            return {"automata_type": req.automata_type, "rule": req.image_rule,
                    "width": req.width, "height": req.height,
                    "total_generations": len(result["states"]),
                    "palette_name": result["palette_name"],
                    "num_states": result["num_states"],
                    "is_rgb": True,
                    "states": result["states"]}

        elif req.automata_type == "life_3d":
            result = compute_life3d(
                size=req.grid_size,
                generations=req.generations,
                rule_name=req.rule_3d,
                density=req.density,
            )
            return {
                "automata_type": req.automata_type,
                "rule": req.rule_3d,
                "grid_size": result["grid_size"],
                "total_generations": len(result["states"]),
                "populations": result["populations"],
                "born_counts": result["born_counts"],
                "died_counts": result["died_counts"],
                "cells_3d": True,
                "states": result["states"],
            }

        elif req.automata_type == "epidemic":
            total_w = min(max(req.generations, 100), 380)
            result = compute_epidemic(total_weeks=total_w)
            return {
                "automata_type": req.automata_type,
                "rule": "SEIR-CA",
                "total_generations": result["total_weeks"],
                "present_week": result["present_week"],
                "countries_meta": result["countries_meta"],
                "real_data": result["real_data"],
                "states": result["states"],
            }

        else:
            raise HTTPException(status_code=400, detail="Unknown automata type")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

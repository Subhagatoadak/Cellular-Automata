"""
Hybrid SEIR Cellular Automaton for global epidemic spread.

Each country is treated as a discrete CA cell with neighbor-linked contagion
states layered on top of continuous SEIR compartments. The discrete states now
directly affect import pressure, recovery inertia, immunity, and forecast
behavior so the epidemic mode is visibly and numerically CA-driven.
"""

import json
import math
import os
import urllib.request
from datetime import date, datetime, timedelta
from functools import lru_cache
from typing import Any, Dict, List, Optional

from openai_pattern import translate_epidemic_pattern

# ─── Country dataset ───────────────────────────────────────────────────────────
COUNTRIES: Dict[str, Dict[str, Any]] = {
    "China":          {"lat": 35.86,  "lon": 104.19,  "pop": 1411, "continent": "Asia",       "code": "CN"},
    "Japan":          {"lat": 36.20,  "lon": 138.25,  "pop": 126,  "continent": "Asia",       "code": "JP"},
    "South Korea":    {"lat": 35.91,  "lon": 127.77,  "pop": 52,   "continent": "Asia",       "code": "KR"},
    "Taiwan":         {"lat": 23.70,  "lon": 120.96,  "pop": 24,   "continent": "Asia",       "code": "TW"},
    "Thailand":       {"lat": 15.87,  "lon": 100.99,  "pop": 70,   "continent": "Asia",       "code": "TH"},
    "Indonesia":      {"lat": -0.79,  "lon": 113.92,  "pop": 273,  "continent": "Asia",       "code": "ID"},
    "Philippines":    {"lat": 12.88,  "lon": 121.77,  "pop": 110,  "continent": "Asia",       "code": "PH"},
    "Vietnam":        {"lat": 14.06,  "lon": 108.28,  "pop": 97,   "continent": "Asia",       "code": "VN"},
    "Malaysia":       {"lat": 4.21,   "lon": 101.98,  "pop": 33,   "continent": "Asia",       "code": "MY"},
    "Singapore":      {"lat": 1.35,   "lon": 103.82,  "pop": 6,    "continent": "Asia",       "code": "SG"},
    "India":          {"lat": 20.59,  "lon": 78.96,   "pop": 1380, "continent": "Asia",       "code": "IN"},
    "Pakistan":       {"lat": 30.38,  "lon": 69.35,   "pop": 221,  "continent": "Asia",       "code": "PK"},
    "Bangladesh":     {"lat": 23.68,  "lon": 90.35,   "pop": 165,  "continent": "Asia",       "code": "BD"},
    "Iran":           {"lat": 32.43,  "lon": 53.69,   "pop": 84,   "continent": "Asia",       "code": "IR"},
    "Saudi Arabia":   {"lat": 23.89,  "lon": 45.08,   "pop": 35,   "continent": "Asia",       "code": "SA"},
    "Turkey":         {"lat": 38.96,  "lon": 35.24,   "pop": 84,   "continent": "Europe",     "code": "TR"},
    "Israel":         {"lat": 31.05,  "lon": 34.85,   "pop": 9,    "continent": "Asia",       "code": "IL"},
    "Italy":          {"lat": 41.87,  "lon": 12.57,   "pop": 60,   "continent": "Europe",     "code": "IT"},
    "Spain":          {"lat": 40.46,  "lon": -3.75,   "pop": 47,   "continent": "Europe",     "code": "ES"},
    "France":         {"lat": 46.23,  "lon": 2.21,    "pop": 67,   "continent": "Europe",     "code": "FR"},
    "Germany":        {"lat": 51.17,  "lon": 10.45,   "pop": 83,   "continent": "Europe",     "code": "DE"},
    "United Kingdom": {"lat": 55.38,  "lon": -3.44,   "pop": 67,   "continent": "Europe",     "code": "GB"},
    "Netherlands":    {"lat": 52.13,  "lon": 5.29,    "pop": 17,   "continent": "Europe",     "code": "NL"},
    "Belgium":        {"lat": 50.50,  "lon": 4.47,    "pop": 11,   "continent": "Europe",     "code": "BE"},
    "Sweden":         {"lat": 60.13,  "lon": 18.64,   "pop": 10,   "continent": "Europe",     "code": "SE"},
    "Poland":         {"lat": 51.92,  "lon": 19.15,   "pop": 38,   "continent": "Europe",     "code": "PL"},
    "Russia":         {"lat": 61.52,  "lon": 105.32,  "pop": 146,  "continent": "Europe",     "code": "RU"},
    "Ukraine":        {"lat": 48.38,  "lon": 31.17,   "pop": 44,   "continent": "Europe",     "code": "UA"},
    "Romania":        {"lat": 45.94,  "lon": 24.97,   "pop": 19,   "continent": "Europe",     "code": "RO"},
    "Portugal":       {"lat": 39.40,  "lon": -8.22,   "pop": 10,   "continent": "Europe",     "code": "PT"},
    "Czech Republic": {"lat": 49.82,  "lon": 15.47,   "pop": 11,   "continent": "Europe",     "code": "CZ"},
    "USA":            {"lat": 37.09,  "lon": -95.71,  "pop": 331,  "continent": "N.America",  "code": "US"},
    "Canada":         {"lat": 56.13,  "lon": -106.35, "pop": 38,   "continent": "N.America",  "code": "CA"},
    "Mexico":         {"lat": 23.63,  "lon": -102.55, "pop": 129,  "continent": "N.America",  "code": "MX"},
    "Brazil":         {"lat": -14.24, "lon": -51.93,  "pop": 213,  "continent": "S.America",  "code": "BR"},
    "Argentina":      {"lat": -38.42, "lon": -63.62,  "pop": 45,   "continent": "S.America",  "code": "AR"},
    "Colombia":       {"lat": 4.57,   "lon": -74.30,  "pop": 50,   "continent": "S.America",  "code": "CO"},
    "Peru":           {"lat": -9.19,  "lon": -75.02,  "pop": 33,   "continent": "S.America",  "code": "PE"},
    "Chile":          {"lat": -35.68, "lon": -71.54,  "pop": 19,   "continent": "S.America",  "code": "CL"},
    "South Africa":   {"lat": -30.56, "lon": 22.94,   "pop": 60,   "continent": "Africa",     "code": "ZA"},
    "Nigeria":        {"lat": 9.08,   "lon": 8.68,    "pop": 211,  "continent": "Africa",     "code": "NG"},
    "Kenya":          {"lat": -0.02,  "lon": 37.91,   "pop": 54,   "continent": "Africa",     "code": "KE"},
    "Ethiopia":       {"lat": 9.15,   "lon": 40.49,   "pop": 115,  "continent": "Africa",     "code": "ET"},
    "Egypt":          {"lat": 26.82,  "lon": 30.80,   "pop": 102,  "continent": "Africa",     "code": "EG"},
    "Morocco":        {"lat": 31.79,  "lon": -7.09,   "pop": 37,   "continent": "Africa",     "code": "MA"},
    "Australia":      {"lat": -25.27, "lon": 133.78,  "pop": 26,   "continent": "Oceania",    "code": "AU"},
    "New Zealand":    {"lat": -40.90, "lon": 174.89,  "pop": 5,    "continent": "Oceania",    "code": "NZ"},
}

AIR_ROUTES = [
    ("China", "Japan"),
    ("China", "South Korea"),
    ("China", "Thailand"),
    ("China", "Singapore"),
    ("China", "Italy"),
    ("China", "Iran"),
    ("China", "USA"),
    ("China", "Australia"),
    ("China", "United Kingdom"),
    ("Italy", "Spain"),
    ("Italy", "Germany"),
    ("Italy", "France"),
    ("Italy", "United Kingdom"),
    ("Italy", "USA"),
    ("Spain", "France"),
    ("Spain", "USA"),
    ("France", "USA"),
    ("Germany", "USA"),
    ("United Kingdom", "USA"),
    ("United Kingdom", "India"),
    ("United Kingdom", "South Africa"),
    ("USA", "Canada"),
    ("USA", "Mexico"),
    ("USA", "Brazil"),
    ("USA", "India"),
    ("USA", "Israel"),
    ("India", "United Kingdom"),
    ("India", "USA"),
    ("India", "Singapore"),
    ("Iran", "Italy"),
    ("Iran", "Turkey"),
    ("Australia", "United Kingdom"),
    ("Australia", "Singapore"),
    ("South Africa", "United Kingdom"),
    ("South Africa", "USA"),
]

CA_STATES = [
    {"id": 0, "label": "Dormant",   "color": "#24496f", "description": "Minimal local and imported pressure."},
    {"id": 1, "label": "Seeded",    "color": "#2f8cff", "description": "Imported embers are taking hold."},
    {"id": 2, "label": "Clustered", "color": "#23d0c3", "description": "Neighbor-linked clusters are forming."},
    {"id": 3, "label": "Wave",      "color": "#ffb347", "description": "Sustained domestic spread dominates."},
    {"id": 4, "label": "Crisis",    "color": "#ff5f45", "description": "Cells are saturated and exporting pressure."},
    {"id": 5, "label": "Recovery",  "color": "#9be564", "description": "Cases cool but memory of the wave remains."},
    {"id": 6, "label": "Shielded",  "color": "#c7b8ff", "description": "Vaccination and immunity suppress reignition."},
]

STATE_CONTAGION = [0.18, 0.35, 0.62, 0.94, 1.28, 0.42, 0.12]
STATE_SUSCEPTIBILITY = [0.80, 0.92, 1.02, 1.13, 1.22, 0.72, 0.54]
STATE_RECOVERY_BOOST = [0.00, 0.00, 0.02, 0.05, 0.08, 0.16, 0.12]

_EPOCH = date(2019, 12, 30)
_MAX_TOTAL_WEEKS = 520


def _resolve_present_date() -> date:
    override = os.getenv("EPIDEMIC_PRESENT_DATE")
    if override:
        return date.fromisoformat(override)
    return date.today()


def epidemic_timeline_context() -> Dict[str, Any]:
    present_date = _resolve_present_date()
    present_week = max(0, (present_date - _EPOCH).days // 7)
    return {
        "epoch": _EPOCH,
        "present_date": present_date,
        "present_week": present_week,
        "forecast_start_week": present_week + 1,
        "max_total_weeks": _MAX_TOTAL_WEEKS,
        "max_forecast_weeks": max(0, _MAX_TOTAL_WEEKS - (present_week + 1)),
    }


def _week_to_date(week: int) -> str:
    return (_EPOCH + timedelta(weeks=week)).isoformat()


def _phase(week: int, present_week: int, seasonality_weight: float = 1.0) -> Dict[str, Any]:
    seasonal = 1.0 + 0.25 * seasonality_weight * math.sin((week + 4) * 2 * math.pi / 52)

    if week < 5:
        return dict(R0=3.0, IFR=0.022, sigma=1 / 3, gamma=1 / 2, vacc=0.0, waning=0.0, reservoir=0.0,
                    travel_mult=1.0, phase="seeding", label="Origin Seeding")
    if week < 12:
        return dict(R0=3.5, IFR=0.025, sigma=1 / 3, gamma=1 / 2, vacc=0.0, waning=0.0, reservoir=0.0,
                    travel_mult=0.85, phase="wave1", label="Global Emergence")
    if week < 20:
        return dict(R0=3.2 * seasonal, IFR=0.025, sigma=1 / 3, gamma=1 / 2, vacc=0.0, waning=0.0, reservoir=0.0,
                    travel_mult=0.30, phase="wave1", label="Pandemic Declaration")
    if week < 32:
        return dict(R0=1.4, IFR=0.022, sigma=1 / 3, gamma=1 / 2, vacc=0.0, waning=0.0, reservoir=0.0,
                    travel_mult=0.10, phase="lockdown", label="Lockdowns")
    if week < 44:
        return dict(R0=2.2 * seasonal, IFR=0.020, sigma=1 / 3, gamma=1 / 2, vacc=0.0, waning=0.0, reservoir=0.0,
                    travel_mult=0.25, phase="wave2", label="Wave 2 Build")
    if week < 56:
        return dict(R0=2.8 * seasonal, IFR=0.019, sigma=1 / 3, gamma=1 / 2, vacc=0.0005, waning=0.0, reservoir=0.0,
                    travel_mult=0.20, phase="wave2", label="Wave 2 Peak")
    if week < 68:
        return dict(R0=2.0, IFR=0.016, sigma=1 / 3, gamma=1 / 2, vacc=0.006, waning=0.0, reservoir=0.0,
                    travel_mult=0.30, phase="vaccine_rollout", label="Vaccine Rollout")
    if week < 80:
        return dict(R0=4.5 * seasonal, IFR=0.010, sigma=1 / 2.5, gamma=1 / 1.5, vacc=0.010, waning=0.0, reservoir=0.0,
                    travel_mult=0.50, phase="delta", label="Delta Variant")
    if week < 92:
        return dict(R0=4.0 * seasonal, IFR=0.008, sigma=1 / 2.5, gamma=1 / 1.5, vacc=0.007, waning=0.0, reservoir=0.0,
                    travel_mult=0.55, phase="delta", label="Delta Follow-through")
    if week < 108:
        return dict(R0=9.0, IFR=0.0025, sigma=1 / 2, gamma=1 / 1, vacc=0.004, waning=0.0004, reservoir=0.0,
                    travel_mult=0.60, phase="omicron", label="Omicron Surge")
    if week < 124:
        return dict(R0=6.0, IFR=0.0015, sigma=1 / 2, gamma=1 / 1, vacc=0.002, waning=0.0022, reservoir=6e-7,
                    travel_mult=0.75, phase="endemic_transition", label="Endemic Transition")
    if week <= present_week:
        return dict(R0=3.25 * seasonal, IFR=0.0010, sigma=1 / 2.5, gamma=1 / 1.5, vacc=0.0011, waning=0.0032, reservoir=6e-7,
                    travel_mult=0.90, phase="endemic", label="Historical Endemic")
    return dict(R0=3.45 * seasonal, IFR=0.0008, sigma=1 / 2.5, gamma=1 / 1.55, vacc=0.0009, waning=0.0045, reservoir=9e-7,
                travel_mult=0.96, phase="forecast", label="Forward Forecast")


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius_km * math.asin(math.sqrt(a))


def _build_connections() -> Dict[str, List[Any]]:
    names = list(COUNTRIES.keys())
    air_set = {(a, b) for a, b in AIR_ROUTES} | {(b, a) for a, b in AIR_ROUTES}
    connections: Dict[str, List[Any]] = {name: [] for name in names}

    for a in names:
        for b in names:
            if a == b:
                continue
            dist = _haversine(
                COUNTRIES[a]["lat"], COUNTRIES[a]["lon"],
                COUNTRIES[b]["lat"], COUNTRIES[b]["lon"],
            )
            if (a, b) in air_set:
                prob = 0.18
            elif dist < 800:
                prob = 0.06
            elif dist < 2500:
                prob = 0.015
            else:
                prob = 0.002
            connections[a].append((b, prob))

    return connections


@lru_cache(maxsize=1)
def _fetch_real_covid() -> Optional[Dict[str, Any]]:
    try:
        req = urllib.request.Request(
            "https://disease.sh/v3/covid-19/historical/all?lastdays=all",
            headers={"User-Agent": "CA-Explorer/1.0"},
        )
        with urllib.request.urlopen(req, timeout=6) as response:
            raw = json.loads(response.read().decode("utf-8"))

        def parse_day(value: str) -> datetime:
            return datetime.strptime(value, "%m/%d/%y")

        ordered_cases = sorted(raw.get("cases", {}).items(), key=lambda item: parse_day(item[0]))
        ordered_deaths = raw.get("deaths", {})

        dates: List[str] = []
        cases: List[int] = []
        deaths: List[int] = []
        for day, cumulative_cases in ordered_cases:
            dates.append(parse_day(day).date().isoformat())
            cases.append(int(cumulative_cases))
            deaths.append(int(ordered_deaths.get(day, 0)))

        weekly_dates: List[str] = []
        weekly_cases: List[int] = []
        weekly_deaths: List[int] = []
        for idx in range(0, len(dates), 7):
            weekly_dates.append(dates[idx])
            weekly_cases.append(cases[idx])
            weekly_deaths.append(deaths[idx])

        return {
            "dates": weekly_dates,
            "cases": weekly_cases,
            "deaths": weekly_deaths,
            "source": "disease.sh",
        }
    except Exception:
        return None


def _derive_next_state(
    prev_state: int,
    infected_ratio: float,
    exposed_ratio: float,
    neighbor_pressure: float,
    vacc_pct: float,
) -> int:
    pressure_score = infected_ratio * 6000.0 + exposed_ratio * 3500.0 + neighbor_pressure * 4.0

    if prev_state == 6 and pressure_score > 1.9:
        return 2
    if prev_state in {3, 4} and pressure_score < 0.55:
        return 5
    if prev_state == 5 and vacc_pct > 55.0 and pressure_score < 0.18:
        return 6

    if pressure_score > 4.2 or infected_ratio > 0.010:
        return 4
    if pressure_score > 1.8 or infected_ratio > 0.0025:
        return 3
    if pressure_score > 0.65 or infected_ratio > 0.00035 or neighbor_pressure > 0.08:
        return 2
    if pressure_score > 0.10 or infected_ratio > 0.00004 or neighbor_pressure > 0.02:
        return 1

    return 0


def _dominant_states(state_counts: List[int]) -> List[str]:
    ranked = sorted(
        ((count, CA_STATES[idx]["label"]) for idx, count in enumerate(state_counts)),
        reverse=True,
    )
    return [label for count, label in ranked if count > 0][:2]


def _simulate_epidemic(
    total_weeks: int,
    present_week: int,
    ai_translation: Dict[str, Any],
) -> List[Dict[str, Any]]:
    names = list(COUNTRIES.keys())
    connections = _build_connections()
    tuning = ai_translation.get("tuning", {})
    neighbor_weight = float(tuning.get("neighbor_weight", 1.0))
    travel_weight = float(tuning.get("travel_weight", 1.0))
    seasonality_weight = float(tuning.get("seasonality_weight", 1.0))
    recovery_drag = float(tuning.get("recovery_drag", 1.0))
    vaccination_shield = float(tuning.get("vaccination_shield", 1.0))

    susceptible: Dict[str, float] = {}
    exposed: Dict[str, float] = {}
    infectious: Dict[str, float] = {}
    recovered: Dict[str, float] = {}
    dead: Dict[str, float] = {}
    vaccinated: Dict[str, float] = {}
    population: Dict[str, float] = {}

    for name, country in COUNTRIES.items():
        pop = country["pop"] * 1e6
        population[name] = pop
        susceptible[name] = pop
        exposed[name] = 0.0
        infectious[name] = 0.0
        recovered[name] = 0.0
        dead[name] = 0.0
        vaccinated[name] = 0.0

    infectious["China"] = 200.0
    exposed["China"] = 1000.0
    susceptible["China"] -= 1200.0

    cell_states = {name: 0 for name in names}
    cell_states["China"] = 2
    world_population = sum(population.values())
    frames: List[Dict[str, Any]] = []

    for week in range(total_weeks):
        phase = _phase(week, present_week, seasonality_weight)
        gamma = max(1e-6, phase["gamma"] / recovery_drag)
        beta = phase["R0"] * gamma
        vacc_rate = phase["vacc"] * vaccination_shield
        travel_mult = phase["travel_mult"] * travel_weight

        neighbor_pressure: Dict[str, float] = {}
        for name in names:
            raw_pressure = 0.0
            for neighbor, base_prob in connections[name]:
                neighbor_pop = susceptible[neighbor] + exposed[neighbor] + infectious[neighbor] + recovered[neighbor]
                if neighbor_pop <= 0:
                    continue
                infected_share = (infectious[neighbor] + 0.45 * exposed[neighbor]) / neighbor_pop
                raw_pressure += base_prob * infected_share * STATE_CONTAGION[cell_states[neighbor]]
            neighbor_pressure[name] = 1.0 - math.exp(-18.0 * neighbor_weight * raw_pressure)

        state_counts = [0 for _ in CA_STATES]
        country_snapshot: Dict[str, Any] = {}
        hotspots: List[Dict[str, Any]] = []
        global_cases = 0.0
        global_active = 0.0
        global_deaths = 0.0
        global_vacc = 0.0

        for name in names:
            pop = population[name]
            pop_m = pop / 1e6
            total_cases = exposed[name] + infectious[name] + recovered[name] + dead[name]
            state_id = cell_states[name]
            state_counts[state_id] += 1

            snapshot = {
                "active_per_m": round(infectious[name] / pop_m, 2),
                "cases_per_m": round(total_cases / pop_m, 1),
                "deaths_per_m": round(dead[name] / pop_m, 2),
                "vacc_pct": round(vaccinated[name] / pop * 100.0, 1),
                "neighbor_pressure": round(neighbor_pressure[name], 3),
                "ca_state": state_id,
                "ca_label": CA_STATES[state_id]["label"],
                "phase": phase["phase"],
            }
            country_snapshot[name] = snapshot
            hotspots.append({
                "country": name,
                "active_per_m": snapshot["active_per_m"],
                "neighbor_pressure": snapshot["neighbor_pressure"],
                "ca_label": snapshot["ca_label"],
            })

            global_cases += total_cases
            global_active += infectious[name]
            global_deaths += dead[name]
            global_vacc += vaccinated[name]

        hotspots.sort(key=lambda item: item["active_per_m"], reverse=True)
        frames.append({
            "week": week,
            "date": _week_to_date(week),
            "phase": phase["phase"],
            "label": phase["label"],
            "is_forecast": week > present_week,
            "global_cases": round(global_cases / 1e6, 2),
            "global_active": round(global_active / 1e6, 3),
            "global_deaths": round(global_deaths / 1e6, 3),
            "global_vacc_pct": round(global_vacc / world_population * 100.0, 1),
            "state_counts": {meta["label"]: state_counts[idx] for idx, meta in enumerate(CA_STATES)},
            "dominant_states": _dominant_states(state_counts),
            "hotspots": hotspots[:5],
            "countries": country_snapshot,
        })

        next_susceptible: Dict[str, float] = {}
        next_exposed: Dict[str, float] = {}
        next_infectious: Dict[str, float] = {}
        next_recovered: Dict[str, float] = {}
        next_dead: Dict[str, float] = {}
        next_vaccinated: Dict[str, float] = {}
        next_states: Dict[str, int] = {}

        for name in names:
            pop = population[name]
            active_pop = susceptible[name] + exposed[name] + infectious[name] + recovered[name]
            if active_pop <= 0:
                next_susceptible[name] = 0.0
                next_exposed[name] = 0.0
                next_infectious[name] = 0.0
                next_recovered[name] = 0.0
                next_dead[name] = dead[name]
                next_vaccinated[name] = vaccinated[name]
                next_states[name] = 0
                continue

            local_force = beta * ((infectious[name] + 0.35 * exposed[name]) / active_pop) * STATE_SUSCEPTIBILITY[cell_states[name]]
            import_force = 0.0
            for neighbor, base_prob in connections[name]:
                neighbor_pop = susceptible[neighbor] + exposed[neighbor] + infectious[neighbor] + recovered[neighbor]
                if neighbor_pop <= 0:
                    continue
                import_force += (
                    ((infectious[neighbor] + 0.45 * exposed[neighbor]) / neighbor_pop)
                    * base_prob
                    * travel_mult
                    * beta
                    * STATE_CONTAGION[cell_states[neighbor]]
                )

            reservoir_force = phase["reservoir"] * (1.0 + 0.55 * neighbor_pressure[name])
            total_force = max(0.0, local_force + import_force + reservoir_force)
            waned_immunity = min(
                recovered[name],
                phase["waning"] * recovered[name] * max(0.55, 1.12 - 0.15 * vaccination_shield),
            )
            susceptible_pool = susceptible[name] + waned_immunity
            exposure_prob = 1.0 - math.exp(-min(total_force, 8.0))
            new_exposed = min(susceptible_pool, exposure_prob * susceptible_pool)
            new_infectious = phase["sigma"] * exposed[name]
            new_recovered = (1.0 - phase["IFR"]) * gamma * infectious[name] * (1.0 + STATE_RECOVERY_BOOST[cell_states[name]])
            new_dead = phase["IFR"] * gamma * infectious[name]
            new_vaccinated = min(
                vacc_rate * pop * (1.0 + 0.12 * (1 if cell_states[name] >= 4 else 0)),
                max(0.0, susceptible_pool - new_exposed),
            )

            next_susceptible[name] = max(0.0, susceptible_pool - new_exposed - new_vaccinated)
            next_exposed[name] = max(0.0, exposed[name] + new_exposed - new_infectious)
            next_infectious[name] = max(0.0, infectious[name] + new_infectious - new_recovered - new_dead)
            next_recovered[name] = max(0.0, recovered[name] - waned_immunity + new_recovered + new_vaccinated)
            next_dead[name] = dead[name] + new_dead
            next_vaccinated[name] = vaccinated[name] + new_vaccinated
            next_states[name] = _derive_next_state(
                cell_states[name],
                next_infectious[name] / pop,
                next_exposed[name] / pop,
                neighbor_pressure[name],
                next_vaccinated[name] / pop * 100.0,
            )

        susceptible = next_susceptible
        exposed = next_exposed
        infectious = next_infectious
        recovered = next_recovered
        dead = next_dead
        vaccinated = next_vaccinated
        cell_states = next_states

    return frames


def _build_pattern_summary(
    frames: List[Dict[str, Any]],
    present_week: int,
) -> Dict[str, Any]:
    present_index = min(max(present_week, 0), len(frames) - 1)
    present_snapshot = frames[present_index]
    forecast_frames = [frame for frame in frames if frame["is_forecast"]]
    forecast_snapshot = forecast_frames[min(12, len(forecast_frames) - 1)] if forecast_frames else None
    peak_active = max(frames, key=lambda frame: frame["global_active"])
    peak_cases = max(frames, key=lambda frame: frame["global_cases"])

    milestone_indexes = sorted({
        0,
        8,
        20,
        32,
        44,
        56,
        80,
        108,
        max(0, present_index - 26),
        present_index,
        len(frames) - 1,
    })
    milestones = [
        {
            "date": frames[idx]["date"],
            "phase": frames[idx]["phase"],
            "label": frames[idx]["label"],
            "global_cases": frames[idx]["global_cases"],
            "global_active": frames[idx]["global_active"],
            "global_deaths": frames[idx]["global_deaths"],
            "global_vacc_pct": frames[idx]["global_vacc_pct"],
            "dominant_states": frames[idx]["dominant_states"],
            "is_forecast": frames[idx]["is_forecast"],
        }
        for idx in milestone_indexes
    ]

    return {
        "present_snapshot": present_snapshot,
        "forecast_snapshot": forecast_snapshot,
        "peak_active_frame": peak_active,
        "peak_cases_frame": peak_cases,
        "milestones": milestones,
        "historical_hotspots": present_snapshot["hotspots"],
        "available_forecast_weeks": len(forecast_frames),
    }


def compute_epidemic(
    total_weeks: Optional[int] = None,
    forecast_weeks_extra: int = 52,
) -> Dict[str, Any]:
    timeline = epidemic_timeline_context()
    present_week = int(timeline["present_week"])
    if total_weeks is None:
        total_weeks = present_week + 1 + max(forecast_weeks_extra, 0)

    total_weeks = min(max(int(total_weeks), 100), _MAX_TOTAL_WEEKS)
    real_data = _fetch_real_covid()

    neutral_translation = {
        "source": "baseline",
        "tuning": {
            "neighbor_weight": 1.0,
            "travel_weight": 1.0,
            "seasonality_weight": 1.0,
            "recovery_drag": 1.0,
            "vaccination_shield": 1.0,
        },
    }
    baseline_frames = _simulate_epidemic(total_weeks, present_week, neutral_translation)
    pattern_summary = _build_pattern_summary(baseline_frames, present_week)
    ai_translation = translate_epidemic_pattern(pattern_summary)
    frames = _simulate_epidemic(total_weeks, present_week, ai_translation)

    forecast_weeks = max(0, total_weeks - (present_week + 1))
    forecast_start_week = present_week + 1
    forecast_end_week = total_weeks - 1

    return {
        "countries_meta": {
            name: {
                "lat": country["lat"],
                "lon": country["lon"],
                "pop_m": country["pop"],
                "continent": country["continent"],
                "code": country["code"],
            }
            for name, country in COUNTRIES.items()
        },
        "ca_states": CA_STATES,
        "present_date": timeline["present_date"].isoformat(),
        "present_week": present_week,
        "forecast_start_week": forecast_start_week,
        "forecast_start_date": _week_to_date(forecast_start_week),
        "forecast_end_date": _week_to_date(forecast_end_week),
        "forecast_weeks": forecast_weeks,
        "max_forecast_weeks": timeline["max_forecast_weeks"],
        "total_weeks": total_weeks,
        "states": frames,
        "real_data": real_data,
        "ai_translation": ai_translation,
    }

"""
SEIR Cellular Automaton — COVID-19 World Spread Simulation
==========================================================
Models the geographic spread of SARS-CoV-2 from Dec 2019 through
a user-configurable forecast horizon (default: Jan 2026).

Each "cell" in this CA is a country. Cells update based on:
  1. Local SEIR dynamics (S→E→I→R/D, with vaccination)
  2. Imported cases from geographically/aerially connected neighbors

Phase parameters change over time to model:
  - Pre-pandemic (late 2019): seeding in China
  - Wave 1 (Mar-May 2020): explosive global spread
  - Lockdowns (Jun-Sep 2020): suppressed R0
  - Wave 2 (Oct-Dec 2020): second surge, vaccine trials
  - Vaccine rollout (Jan-Apr 2021): rapid immunization of S→V
  - Delta (May-Nov 2021): higher R0, moderate IFR
  - Omicron (Dec 2021-Apr 2022): very high R0, very low IFR
  - Endemic (2022-2023): seasonal pattern, low fatality
  - Forecast (2024+): continued endemic, waning immunity cycles
"""

import math
import json
import urllib.request
import urllib.error
from datetime import date, timedelta
from typing import List, Dict, Any, Optional

# ─── Country dataset ───────────────────────────────────────────────────────────
# lat, lon: centroid; pop: population in millions; continent label
COUNTRIES: Dict[str, Dict] = {
    # East Asia (COVID origin cluster)
    "China":         {"lat": 35.86,  "lon": 104.19, "pop": 1411, "continent": "Asia",      "code": "CN"},
    "Japan":         {"lat": 36.20,  "lon": 138.25, "pop": 126,  "continent": "Asia",      "code": "JP"},
    "South Korea":   {"lat": 35.91,  "lon": 127.77, "pop": 52,   "continent": "Asia",      "code": "KR"},
    "Taiwan":        {"lat": 23.70,  "lon": 120.96, "pop": 24,   "continent": "Asia",      "code": "TW"},
    # Southeast Asia
    "Thailand":      {"lat": 15.87,  "lon": 100.99, "pop": 70,   "continent": "Asia",      "code": "TH"},
    "Indonesia":     {"lat": -0.79,  "lon": 113.92, "pop": 273,  "continent": "Asia",      "code": "ID"},
    "Philippines":   {"lat": 12.88,  "lon": 121.77, "pop": 110,  "continent": "Asia",      "code": "PH"},
    "Vietnam":       {"lat": 14.06,  "lon": 108.28, "pop": 97,   "continent": "Asia",      "code": "VN"},
    "Malaysia":      {"lat": 4.21,   "lon": 101.98, "pop": 33,   "continent": "Asia",      "code": "MY"},
    "Singapore":     {"lat": 1.35,   "lon": 103.82, "pop": 6,    "continent": "Asia",      "code": "SG"},
    # South Asia
    "India":         {"lat": 20.59,  "lon": 78.96,  "pop": 1380, "continent": "Asia",      "code": "IN"},
    "Pakistan":      {"lat": 30.38,  "lon": 69.35,  "pop": 221,  "continent": "Asia",      "code": "PK"},
    "Bangladesh":    {"lat": 23.68,  "lon": 90.35,  "pop": 165,  "continent": "Asia",      "code": "BD"},
    # Middle East
    "Iran":          {"lat": 32.43,  "lon": 53.69,  "pop": 84,   "continent": "Asia",      "code": "IR"},
    "Saudi Arabia":  {"lat": 23.89,  "lon": 45.08,  "pop": 35,   "continent": "Asia",      "code": "SA"},
    "Turkey":        {"lat": 38.96,  "lon": 35.24,  "pop": 84,   "continent": "Europe",    "code": "TR"},
    "Israel":        {"lat": 31.05,  "lon": 34.85,  "pop": 9,    "continent": "Asia",      "code": "IL"},
    # Europe — early epicenter
    "Italy":         {"lat": 41.87,  "lon": 12.57,  "pop": 60,   "continent": "Europe",    "code": "IT"},
    "Spain":         {"lat": 40.46,  "lon": -3.75,  "pop": 47,   "continent": "Europe",    "code": "ES"},
    "France":        {"lat": 46.23,  "lon": 2.21,   "pop": 67,   "continent": "Europe",    "code": "FR"},
    "Germany":       {"lat": 51.17,  "lon": 10.45,  "pop": 83,   "continent": "Europe",    "code": "DE"},
    "United Kingdom":{"lat": 55.38,  "lon": -3.44,  "pop": 67,   "continent": "Europe",    "code": "GB"},
    "Netherlands":   {"lat": 52.13,  "lon": 5.29,   "pop": 17,   "continent": "Europe",    "code": "NL"},
    "Belgium":       {"lat": 50.50,  "lon": 4.47,   "pop": 11,   "continent": "Europe",    "code": "BE"},
    "Sweden":        {"lat": 60.13,  "lon": 18.64,  "pop": 10,   "continent": "Europe",    "code": "SE"},
    "Poland":        {"lat": 51.92,  "lon": 19.15,  "pop": 38,   "continent": "Europe",    "code": "PL"},
    "Russia":        {"lat": 61.52,  "lon": 105.32, "pop": 146,  "continent": "Europe",    "code": "RU"},
    "Ukraine":       {"lat": 48.38,  "lon": 31.17,  "pop": 44,   "continent": "Europe",    "code": "UA"},
    "Romania":       {"lat": 45.94,  "lon": 24.97,  "pop": 19,   "continent": "Europe",    "code": "RO"},
    "Portugal":      {"lat": 39.40,  "lon": -8.22,  "pop": 10,   "continent": "Europe",    "code": "PT"},
    "Czech Republic":{"lat": 49.82,  "lon": 15.47,  "pop": 11,   "continent": "Europe",    "code": "CZ"},
    # Americas
    "USA":           {"lat": 37.09,  "lon": -95.71, "pop": 331,  "continent": "N.America", "code": "US"},
    "Canada":        {"lat": 56.13,  "lon": -106.35,"pop": 38,   "continent": "N.America", "code": "CA"},
    "Mexico":        {"lat": 23.63,  "lon": -102.55,"pop": 129,  "continent": "N.America", "code": "MX"},
    "Brazil":        {"lat": -14.24, "lon": -51.93, "pop": 213,  "continent": "S.America", "code": "BR"},
    "Argentina":     {"lat": -38.42, "lon": -63.62, "pop": 45,   "continent": "S.America", "code": "AR"},
    "Colombia":      {"lat": 4.57,   "lon": -74.30, "pop": 50,   "continent": "S.America", "code": "CO"},
    "Peru":          {"lat": -9.19,  "lon": -75.02, "pop": 33,   "continent": "S.America", "code": "PE"},
    "Chile":         {"lat": -35.68, "lon": -71.54, "pop": 19,   "continent": "S.America", "code": "CL"},
    # Africa
    "South Africa":  {"lat": -30.56, "lon": 22.94,  "pop": 60,   "continent": "Africa",    "code": "ZA"},
    "Nigeria":       {"lat": 9.08,   "lon": 8.68,   "pop": 211,  "continent": "Africa",    "code": "NG"},
    "Kenya":         {"lat": -0.02,  "lon": 37.91,  "pop": 54,   "continent": "Africa",    "code": "KE"},
    "Ethiopia":      {"lat": 9.15,   "lon": 40.49,  "pop": 115,  "continent": "Africa",    "code": "ET"},
    "Egypt":         {"lat": 26.82,  "lon": 30.80,  "pop": 102,  "continent": "Africa",    "code": "EG"},
    "Morocco":       {"lat": 31.79,  "lon": -7.09,  "pop": 37,   "continent": "Africa",    "code": "MA"},
    # Oceania
    "Australia":     {"lat": -25.27, "lon": 133.78, "pop": 26,   "continent": "Oceania",   "code": "AU"},
    "New Zealand":   {"lat": -40.90, "lon": 174.89, "pop": 5,    "continent": "Oceania",   "code": "NZ"},
}

# ─── Air travel connections (major international routes) ──────────────────────
# These create long-distance "jumps" in the spread — historically accurate
AIR_ROUTES = [
    # China hub — key early export routes
    ("China", "Japan"),           # Heavy tourism/business
    ("China", "South Korea"),     # Heavy tourism
    ("China", "Thailand"),        # Major tourism
    ("China", "Singapore"),       # Major hub
    ("China", "Italy"),           # Milan-Beijing (historic key route for Wave 1)
    ("China", "Iran"),            # Qom — early cluster
    ("China", "USA"),             # San Francisco, NYC
    ("China", "Australia"),       # Sydney, Melbourne
    ("China", "United Kingdom"),  # London
    # European hub connections
    ("Italy", "Spain"),
    ("Italy", "Germany"),
    ("Italy", "France"),
    ("Italy", "United Kingdom"),
    ("Italy", "USA"),             # NYC — Lombardy connection
    ("Spain", "France"),
    ("Spain", "USA"),
    ("France", "USA"),
    ("Germany", "USA"),
    ("United Kingdom", "USA"),
    ("United Kingdom", "India"),  # Commonwealth route
    ("United Kingdom", "South Africa"),  # Omicron route (key)
    # Transatlantic / Americas
    ("USA", "Canada"),
    ("USA", "Mexico"),
    ("USA", "Brazil"),
    ("USA", "India"),
    ("USA", "Israel"),
    # South Asia
    ("India", "United Kingdom"),
    ("India", "USA"),
    ("India", "Singapore"),
    ("Iran", "Italy"),           # Documented early cross
    ("Iran", "Turkey"),
    # Oceania (initially isolated)
    ("Australia", "United Kingdom"),
    ("Australia", "Singapore"),
    ("South Africa", "United Kingdom"),  # Omicron origin → UK
    ("South Africa", "USA"),
]

# ─── Calendar ─────────────────────────────────────────────────────────────────
_EPOCH = date(2019, 12, 30)  # Week 0
_PRESENT = date(2024, 4, 2)
PRESENT_WEEK = (_PRESENT - _EPOCH).days // 7   # ≈ 227


def _week_to_date(week: int) -> str:
    return (_EPOCH + timedelta(weeks=week)).isoformat()


# ─── Phase parameters ─────────────────────────────────────────────────────────
def _phase(week: int) -> dict:
    """Return SEIR parameters and narrative for a given week."""
    # Seasonal modifier (northern hemisphere winter peaks)
    # sin peaks around week 52k+8 (late Jan)
    seasonal = 1.0 + 0.25 * math.sin((week + 4) * 2 * math.pi / 52)

    if week < 5:   # Dec 2019 – Jan 2020: seeding in Wuhan
        return dict(R0=3.0, IFR=0.022, sigma=1/3, gamma=1/2,
                    vacc=0.0, travel_mult=1.0,
                    phase="seeding", label="🔬 Origin — Wuhan")
    if week < 12:  # Jan–Feb 2020: awareness, limited intervention
        return dict(R0=3.5, IFR=0.025, sigma=1/3, gamma=1/2,
                    vacc=0.0, travel_mult=0.85,
                    phase="wave1", label="🦠 Wave 1 — Global Emergence")
    if week < 20:  # Mar–Apr 2020: explosive spread, Italy/USA
        return dict(R0=3.2 * seasonal, IFR=0.025, sigma=1/3, gamma=1/2,
                    vacc=0.0, travel_mult=0.3,
                    phase="wave1", label="🦠 Wave 1 — Pandemic Declared")
    if week < 32:  # May–Jul 2020: lockdowns reduce spread
        return dict(R0=1.4, IFR=0.022, sigma=1/3, gamma=1/2,
                    vacc=0.0, travel_mult=0.1,
                    phase="lockdown", label="🔒 Lockdowns")
    if week < 44:  # Aug–Oct 2020: partial reopening, wave 2 building
        return dict(R0=2.2 * seasonal, IFR=0.020, sigma=1/3, gamma=1/2,
                    vacc=0.0, travel_mult=0.25,
                    phase="wave2", label="🌊 Wave 2")
    if week < 56:  # Nov 2020–Jan 2021: wave 2 peak, vaccine trials
        return dict(R0=2.8 * seasonal, IFR=0.019, sigma=1/3, gamma=1/2,
                    vacc=0.0005, travel_mult=0.2,
                    phase="wave2", label="🌊 Wave 2 Peak")
    if week < 68:  # Feb–Apr 2021: vaccine rollout begins
        return dict(R0=2.0, IFR=0.016, sigma=1/3, gamma=1/2,
                    vacc=0.006, travel_mult=0.30,
                    phase="vaccine_rollout", label="💉 Vaccine Rollout")
    if week < 80:  # May–Aug 2021: Delta variant
        return dict(R0=4.5 * seasonal, IFR=0.010, sigma=1/2.5, gamma=1/1.5,
                    vacc=0.010, travel_mult=0.50,
                    phase="delta", label="⚡ Delta Variant")
    if week < 92:  # Sep–Nov 2021: Delta second wind
        return dict(R0=4.0 * seasonal, IFR=0.008, sigma=1/2.5, gamma=1/1.5,
                    vacc=0.007, travel_mult=0.55,
                    phase="delta", label="⚡ Delta (continued)")
    if week < 108: # Dec 2021–Mar 2022: Omicron — extreme spread, low IFR
        return dict(R0=9.0, IFR=0.0025, sigma=1/2, gamma=1/1,
                    vacc=0.004, travel_mult=0.6,
                    phase="omicron", label="🌪️ Omicron Surge")
    if week < 124: # Apr–Jul 2022: Omicron subvariants, endemic transition
        return dict(R0=6.0, IFR=0.0015, sigma=1/2, gamma=1/1,
                    vacc=0.002, travel_mult=0.75,
                    phase="endemic_transition", label="📉 Endemic Transition")
    if week < PRESENT_WEEK:  # Aug 2022–now: endemic seasonal
        return dict(R0=3.5 * seasonal, IFR=0.001, sigma=1/2.5, gamma=1/1.5,
                    vacc=0.001, travel_mult=0.90,
                    phase="endemic", label="🌿 Endemic — Low Fatality")
    # Forecast: continued endemic with slight waning immunity
    return dict(R0=3.2 * seasonal, IFR=0.0008, sigma=1/2.5, gamma=1/1.5,
                vacc=0.0005, travel_mult=0.95,
                phase="forecast", label="🔮 Forecast")


# ─── Geographic distance (haversine, km) ─────────────────────────────────────
def _haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lon2 - lon1)
    a = math.sin(Δφ/2)**2 + math.cos(φ1)*math.cos(φ2)*math.sin(Δλ/2)**2
    return 2 * R * math.asin(math.sqrt(a))


def _build_connections(travel_mult_base: float = 1.0):
    """
    Build adjacency list: {country: [(neighbor, base_prob), ...]}
    base_prob is the weekly cross-border import probability (modulated by travel_mult).
    """
    names = list(COUNTRIES.keys())
    air_set = set()
    for a, b in AIR_ROUTES:
        air_set.add((a, b))
        air_set.add((b, a))

    connections: Dict[str, List] = {n: [] for n in names}
    for i, a in enumerate(names):
        for j, b in enumerate(names):
            if a == b:
                continue
            dist = _haversine(
                COUNTRIES[a]["lat"], COUNTRIES[a]["lon"],
                COUNTRIES[b]["lat"], COUNTRIES[b]["lon"],
            )
            if (a, b) in air_set:
                prob = 0.18  # major air route
            elif dist < 800:
                prob = 0.06  # land neighbors or very close
            elif dist < 2500:
                prob = 0.015
            else:
                prob = 0.002  # distant but still possible
            if prob > 0:
                connections[a].append((b, prob))

    return connections


# ─── Real COVID data fetch ─────────────────────────────────────────────────────
def _fetch_real_covid() -> Optional[Dict]:
    """
    Fetch global cumulative COVID data from disease.sh.
    Returns dict: {"dates": [...], "cases": [...], "deaths": [...]}
    or None if fetch fails.
    """
    try:
        url = "https://disease.sh/v3/covid-19/historical/all?lastdays=all"
        req = urllib.request.Request(url, headers={"User-Agent": "CA-Explorer/1.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            raw = json.loads(resp.read().decode())

        dates, cases, deaths = [], [], []
        for date_str, val in sorted(raw.get("cases", {}).items(),
                                    key=lambda kv: kv[0]):
            dates.append(date_str)
            cases.append(val)
        death_map = raw.get("deaths", {})
        for date_str in dates:
            deaths.append(death_map.get(date_str, 0))

        # Downsample to weekly (every 7th entry)
        out_dates, out_cases, out_deaths = [], [], []
        for i in range(0, len(dates), 7):
            out_dates.append(dates[i])
            out_cases.append(cases[i])
            out_deaths.append(deaths[i])

        return {"dates": out_dates, "cases": out_cases, "deaths": out_deaths,
                "source": "disease.sh"}
    except Exception:
        return None


# ─── Main computation ─────────────────────────────────────────────────────────
def compute_epidemic(
    total_weeks: int = 320,
    forecast_weeks_extra: int = 0,
) -> dict:
    """
    Run the SEIR-CA world COVID simulation.
    Returns data ready for the frontend epidemic visualizer.
    """
    total_weeks = min(max(total_weeks, 100), 380)
    names = list(COUNTRIES.keys())
    connections = _build_connections()

    # State arrays (indexed by country name)
    S: Dict[str, float] = {}  # Susceptible
    E: Dict[str, float] = {}  # Exposed
    I: Dict[str, float] = {}  # Infectious
    R: Dict[str, float] = {}  # Recovered / immune
    D: Dict[str, float] = {}  # Dead (cumulative)
    V: Dict[str, float] = {}  # Vaccinated (cumulative)
    POP: Dict[str, float] = {}

    for name, cd in COUNTRIES.items():
        pop = cd["pop"] * 1e6
        POP[name] = pop
        S[name] = pop
        E[name] = 0.0
        I[name] = 0.0
        R[name] = 0.0
        D[name] = 0.0
        V[name] = 0.0

    # Seed — Wuhan outbreak, late Dec 2019
    seed_k = "China"
    seed_initial = 200
    I[seed_k] = seed_initial
    E[seed_k] = seed_initial * 5
    S[seed_k] -= seed_initial * 6

    # Fetch real data (optional overlay)
    real_data = _fetch_real_covid()

    frames = []

    for week in range(total_weeks):
        p = _phase(week)
        R0     = p["R0"]
        IFR    = p["IFR"]
        sigma  = p["sigma"]    # incubation rate (E→I per week)
        gamma  = p["gamma"]    # recovery rate (I→R per week)
        vacc   = p["vacc"]     # weekly fraction of S vaccinated
        tmult  = p["travel_mult"]

        beta = R0 * gamma  # per-week transmission rate

        # ── Snapshot for this week ────────────────────────────────────────
        c_snap = {}
        g_cases = g_deaths = g_vacc = 0.0
        for name in names:
            pop_m = POP[name] / 1e6
            tot_cases = E[name] + I[name] + R[name] + D[name]
            c_snap[name] = {
                "active_per_m":  round(I[name]       / pop_m, 2),
                "cases_per_m":   round(tot_cases      / pop_m, 1),
                "deaths_per_m":  round(D[name]        / pop_m, 2),
                "vacc_pct":      round(V[name] / POP[name] * 100, 1),
                "phase":         p["phase"],
            }
            g_cases  += tot_cases
            g_deaths += D[name]
            g_vacc   += V[name]

        frames.append({
            "week":        week,
            "date":        _week_to_date(week),
            "phase":       p["phase"],
            "label":       p["label"],
            "is_forecast": week >= PRESENT_WEEK,
            "global_cases":  round(g_cases  / 1e6, 2),   # millions
            "global_deaths": round(g_deaths / 1e6, 3),   # millions
            "global_vacc_pct": round(g_vacc / sum(POP.values()) * 100, 1),
            "countries":   c_snap,
        })

        # ── SEIR update ───────────────────────────────────────────────────
        dS = dE = dI = dR = dD = dV = 0.0
        new_S, new_E, new_I, new_R, new_D, new_V = {}, {}, {}, {}, {}, {}

        for name in names:
            N = S[name] + E[name] + I[name] + R[name]
            if N < 1:
                new_S[name]=new_E[name]=new_I[name]=new_R[name]=new_D[name]=new_V[name]=0.0
                continue

            # Local force of infection
            λ_local = beta * I[name] / N

            # Imported force of infection from connected countries
            λ_import = 0.0
            for nb, base_prob in connections.get(name, []):
                nb_N = S[nb] + E[nb] + I[nb] + R[nb]
                if nb_N > 0:
                    λ_import += (I[nb] / nb_N) * base_prob * tmult * beta

            λ = λ_local + λ_import

            # Transitions
            new_exposed    = min(S[name],  λ * S[name])
            new_infectious = sigma   * E[name]
            new_recovered  = (1 - IFR) * gamma * I[name]
            new_dead       = IFR       * gamma * I[name]
            new_vaccinated = min(vacc * POP[name], max(0.0, S[name] - new_exposed))

            new_S[name] = max(0.0, S[name] - new_exposed - new_vaccinated)
            new_E[name] = max(0.0, E[name] + new_exposed - new_infectious)
            new_I[name] = max(0.0, I[name] + new_infectious - new_recovered - new_dead)
            new_R[name] = R[name] + new_recovered + new_vaccinated
            new_D[name] = D[name] + new_dead
            new_V[name] = V[name] + new_vaccinated

        S, E, I, R, D, V = new_S, new_E, new_I, new_R, new_D, new_V

    return {
        "countries_meta": {
            name: {
                "lat": cd["lat"], "lon": cd["lon"],
                "pop_m": cd["pop"], "continent": cd["continent"], "code": cd["code"],
            }
            for name, cd in COUNTRIES.items()
        },
        "present_week":   PRESENT_WEEK,
        "total_weeks":    total_weeks,
        "states":         frames,
        "real_data":      real_data,
    }

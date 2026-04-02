import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict, Tuple

_CACHE: Dict[Tuple[str, str], Dict[str, Any]] = {}


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _fallback_translation(summary: Dict[str, Any], reason: str) -> Dict[str, Any]:
    present = summary.get("present_snapshot", {})
    forecast = summary.get("forecast_snapshot", {}) or present
    peak = summary.get("peak_active_frame", {})
    vacc_pct = float(present.get("global_vacc_pct", 0.0) or 0.0)
    peak_active = float(peak.get("global_active", 0.0) or 0.0)
    forecast_active = float(forecast.get("global_active", peak_active) or peak_active)
    forecast_cases = float(forecast.get("global_cases", present.get("global_cases", 0.0)) or 0.0)
    present_cases = float(present.get("global_cases", 0.0) or 0.0)
    hotspot_names = [h["country"] for h in present.get("hotspots", [])[:3]]

    growth = 0.0
    if present_cases > 0:
        growth = (forecast_cases - present_cases) / present_cases

    neighbor_weight = _clamp(1.0 + peak_active / 18.0 + max(growth, 0.0) * 0.35, 0.85, 1.35)
    travel_weight = _clamp(1.0 + max(growth, 0.0) * 0.25, 0.85, 1.3)
    seasonality_weight = _clamp(0.95 + (0.08 if peak.get("phase") in {"omicron", "delta"} else 0.0), 0.85, 1.25)
    recovery_drag = _clamp(1.0 + peak_active / 42.0, 0.9, 1.25)
    vaccination_shield = _clamp(0.92 + vacc_pct / 140.0, 0.9, 1.3)

    hotspot_text = ", ".join(hotspot_names) if hotspot_names else "current hotspots"
    return {
        "status": "heuristic",
        "source": "heuristic",
        "reason": reason,
        "model": None,
        "headline": "Pattern translation is running in deterministic fallback mode.",
        "summary": (
            f"The strongest CA pressure is still concentrated around {hotspot_text}, "
            "so the model increases neighbor contagion and keeps recovery slightly sticky."
        ),
        "cell_rule": (
            "A country cell heats up when infected neighbors and travel-linked neighbors stay active "
            "for multiple weeks, then cools slowly as vaccination and recovery outpace imports."
        ),
        "forecast_focus": (
            "The forecast keeps looking for smaller endemic pulses driven by seasonal reactivation "
            "instead of a single synchronized global wave."
        ),
        "highlights": [
            "Discrete country-cell states now drive spread pressure directly.",
            "Forecast weeks are generated beyond the current date instead of ending on a stale cutoff.",
            "Set OPENAI_API_KEY to replace this heuristic translator with an OpenAI Responses API pass.",
        ],
        "tuning": {
            "neighbor_weight": round(neighbor_weight, 3),
            "travel_weight": round(travel_weight, 3),
            "seasonality_weight": round(seasonality_weight, 3),
            "recovery_drag": round(recovery_drag, 3),
            "vaccination_shield": round(vaccination_shield, 3),
        },
    }


def _schema() -> Dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "headline": {"type": "string"},
            "summary": {"type": "string"},
            "cell_rule": {"type": "string"},
            "forecast_focus": {"type": "string"},
            "highlights": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 3,
                "maxItems": 3,
            },
            "tuning": {
                "type": "object",
                "properties": {
                    "neighbor_weight": {"type": "number"},
                    "travel_weight": {"type": "number"},
                    "seasonality_weight": {"type": "number"},
                    "recovery_drag": {"type": "number"},
                    "vaccination_shield": {"type": "number"},
                },
                "required": [
                    "neighbor_weight",
                    "travel_weight",
                    "seasonality_weight",
                    "recovery_drag",
                    "vaccination_shield",
                ],
                "additionalProperties": False,
            },
        },
        "required": [
            "headline",
            "summary",
            "cell_rule",
            "forecast_focus",
            "highlights",
            "tuning",
        ],
        "additionalProperties": False,
    }


def _extract_output_text(payload: Dict[str, Any]) -> str:
    if isinstance(payload.get("output_text"), str) and payload["output_text"].strip():
        return payload["output_text"]

    for item in payload.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "refusal":
                raise RuntimeError(content.get("refusal") or "OpenAI refused the request")
            if content.get("type") in {"output_text", "text"}:
                text = content.get("text")
                if isinstance(text, str) and text.strip():
                    return text

    raise RuntimeError("OpenAI response did not include output text")


def translate_epidemic_pattern(summary: Dict[str, Any]) -> Dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return _fallback_translation(summary, "OPENAI_API_KEY is not configured")

    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    cache_key = (model, json.dumps(summary, sort_keys=True))
    if cache_key in _CACHE:
        return _CACHE[cache_key]

    prompt = {
        "role": "system",
        "content": (
            "You translate epidemic timelines into cellular automata language. "
            "Return compact JSON only. Keep the text grounded in neighbor contagion, "
            "travel-linked coupling, recovery inertia, vaccination shielding, and forecast behavior. "
            "Tuning weights must stay between 0.8 and 1.35."
        ),
    }
    user = {
        "role": "user",
        "content": json.dumps(summary, separators=(",", ":")),
    }

    body = {
        "model": model,
        "input": [prompt, user],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "epidemic_ca_translation",
                "schema": _schema(),
                "strict": True,
            }
        },
    }

    timeout_seconds = float(os.getenv("OPENAI_TIMEOUT_SECONDS", "12"))
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
        parsed = json.loads(_extract_output_text(payload))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
        return _fallback_translation(summary, f"OpenAI request failed: {exc}")
    except (json.JSONDecodeError, RuntimeError, ValueError) as exc:
        return _fallback_translation(summary, f"OpenAI response parsing failed: {exc}")

    tuning = parsed.get("tuning", {})
    result = {
        "status": "openai",
        "source": "openai",
        "reason": None,
        "model": model,
        "headline": str(parsed.get("headline", "")).strip(),
        "summary": str(parsed.get("summary", "")).strip(),
        "cell_rule": str(parsed.get("cell_rule", "")).strip(),
        "forecast_focus": str(parsed.get("forecast_focus", "")).strip(),
        "highlights": [str(item).strip() for item in parsed.get("highlights", [])[:3]],
        "tuning": {
            "neighbor_weight": round(_clamp(float(tuning.get("neighbor_weight", 1.0)), 0.8, 1.35), 3),
            "travel_weight": round(_clamp(float(tuning.get("travel_weight", 1.0)), 0.8, 1.35), 3),
            "seasonality_weight": round(_clamp(float(tuning.get("seasonality_weight", 1.0)), 0.8, 1.35), 3),
            "recovery_drag": round(_clamp(float(tuning.get("recovery_drag", 1.0)), 0.8, 1.35), 3),
            "vaccination_shield": round(_clamp(float(tuning.get("vaccination_shield", 1.0)), 0.8, 1.35), 3),
        },
    }
    _CACHE[cache_key] = result
    return result

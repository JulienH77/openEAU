#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from pathlib import Path
from statistics import median
from typing import Any

import requests

API = "https://hubeau.eaufrance.fr/api/v2/hydrometrie"
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
HISTORY = DATA / "history"
DATA.mkdir(exist_ok=True)
HISTORY.mkdir(exist_ok=True)

STATIONS_FILE = DATA / "stations.json"
LIVE_FILE = DATA / "live.json"
NORMALS_FILE = DATA / "normals.json"

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "OpenEAU-GitHubActions/2.1",
    "Accept": "application/json",
})

AXES = {
    "marne", "seine", "yonne", "aube", "aisne", "oise", "loire",
    "allier", "vienne", "cher", "sarthe", "mayenne", "loir", "rhone",
    "saone", "doubs", "isere", "ain", "drome", "garonne", "dordogne",
    "lot", "tarn", "adour", "charente", "meuse", "moselle", "rhin",
    "somme", "escaut", "aude", "herault",
}

EXCLUDED = (
    "ru ", "ru de ", "ru du ", "ru des ", "ruisseau", "fossé", "fosse",
    "ravin", "drain", "torrent", "canal", "source", "bief",
)

PRIORITY_1 = {
    "marne", "seine", "loire", "rhone", "saone", "garonne", "dordogne",
    "meuse", "moselle", "rhin",
}

PRIORITY_2 = {
    "yonne", "aube", "aisne", "oise", "allier", "vienne", "cher", "sarthe",
    "mayenne", "lot", "tarn", "adour", "charente", "doubs", "isere", "ain",
    "somme", "escaut",
}

METRO = (-5.6, 9.7, 41.2, 51.2)


def normalize(value: Any) -> str:
    import unicodedata
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text.lower().strip()


def strip_article(text: str) -> str:
    for prefix in ("la ", "le ", "les ", "l' ", "l’ "):
        if text.startswith(prefix):
            return text[len(prefix):].strip()
    return text


def river_key(name: Any) -> str:
    return strip_article(normalize(name))


def parse_float(value: Any) -> float | None:
    try:
        value = float(value)
        return value if math.isfinite(value) else None
    except (TypeError, ValueError):
        return None


def load_json_file(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def get_json(url: str, params: dict[str, Any] | None = None, timeout: int = 60) -> dict[str, Any]:
    for attempt in range(4):
        try:
            response = SESSION.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            return response.json()
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError("Requête impossible")


def is_large_river(name: Any) -> bool:
    text = river_key(name)
    if not text:
        return False
    if any(excluded in text for excluded in EXCLUDED):
        return False
    return any(
        text == axis
        or text.startswith(axis + " ")
        or text.startswith(axis + "-")
        or text.startswith(axis + ",")
        for axis in AXES
    )


def is_metropolitan(station: dict[str, Any]) -> bool:
    lat = parse_float(station.get("latitude_station"))
    lon = parse_float(station.get("longitude_station"))
    if lat is None or lon is None:
        return False
    return METRO[0] <= lon <= METRO[1] and METRO[2] <= lat <= METRO[3]


def importance(station: dict[str, Any]) -> int:
    river = river_key(station.get("libelle_cours_eau"))
    if river in PRIORITY_1:
        return 1
    if river in PRIORITY_2:
        return 2
    return 3


def paginate(path: str, size: int = 5000) -> list[dict[str, Any]]:
    url = f"{API}/{path}"
    params: dict[str, Any] | None = {"format": "json", "size": size}
    rows: list[dict[str, Any]] = []
    for _ in range(10):
        payload = get_json(url, params)
        rows.extend(payload.get("data") or [])
        next_url = payload.get("next")
        if not next_url:
            break
        url, params = next_url, None
    return rows


def select_stations(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates = [
        s for s in raw
        if s.get("en_service") != 0
        and is_metropolitan(s)
        and is_large_river(s.get("libelle_cours_eau"))
    ]
    candidates.sort(key=lambda s: (
        importance(s),
        river_key(s.get("libelle_cours_eau")),
        str(s.get("code_station", "")),
    ))

    occupied: set[tuple[str, int, int]] = set()
    selected: list[dict[str, Any]] = []

    for station in candidates:
        lat = float(station["latitude_station"])
        lon = float(station["longitude_station"])
        river = river_key(station.get("libelle_cours_eau"))
        key = (river, math.floor(lat / 0.07), math.floor(lon / 0.10))
        if key in occupied:
            continue
        occupied.add(key)
        selected.append(station)

    selected.sort(key=lambda s: (
        importance(s),
        river_key(s.get("libelle_cours_eau")),
        str(s.get("code_station", "")),
    ))
    return selected[:1200]


def station_record(station: dict[str, Any]) -> dict[str, Any]:
    # Hub'Eau fournit directement la cote du zéro d'échelle.
    zero = parse_float(station.get("altitude_ref_alti_station"))
    datum = (
        station.get("sys_alti_ref_alti_station")
        or station.get("systeme_alti_ref_alti_station")
        or station.get("code_systeme_alti_ref_alti_station")
    )
    return {
        "code": station.get("code_station"),
        "site_code": station.get("code_site"),
        "name": station.get("libelle_site") or station.get("libelle_station") or "Station hydrométrique",
        "river": station.get("libelle_cours_eau"),
        "city": station.get("libelle_commune"),
        "department": station.get("libelle_departement"),
        "lat": float(station["latitude_station"]),
        "lon": float(station["longitude_station"]),
        "importance": importance(station),
        "zero_scale_m": zero,
        "zero_scale_datum": datum,
        "zero_scale_updated": station.get("date_maj_ref_alti_station"),
        "zero_scale_start": station.get("date_debut_ref_alti_station"),
    }


def fetch_current(station: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    code = station["code_station"]
    h = get_json(f"{API}/observations_tr", {
        "format": "json", "code_entite": code, "grandeur_hydro": "H",
        "size": 1, "sort": "desc",
    }).get("data") or []
    q = get_json(f"{API}/observations_tr", {
        "format": "json", "code_entite": code, "grandeur_hydro": "Q",
        "size": 1, "sort": "desc",
    }).get("data") or []

    h0 = h[0] if h else None
    q0 = q[0] if q else None
    hm = float(h0["resultat_obs"]) / 1000 if h0 and h0.get("resultat_obs") is not None else None
    qm = float(q0["resultat_obs"]) / 1000 if q0 and q0.get("resultat_obs") is not None else None

    dates = [x.get("date_obs") for x in (h0, q0) if x and x.get("date_obs")]
    observed_at = max(dates) if dates else None

    return code, {
        "height_m": hm,
        "flow_m3s": qm,
        "observed_at": observed_at,
    }


def fetch_normal(station: dict[str, Any], month: int) -> dict[str, Any] | None:
    site = station.get("code_site")
    if not site:
        return None

    end = datetime.now(timezone.utc).date().isoformat()
    payload = get_json(f"{API}/obs_elab", {
        "format": "json",
        "code_entite": site,
        "grandeur_hydro_elab": "QmM",
        "date_debut_obs_elab": "1950-01-01",
        "date_fin_obs_elab": end,
        "size": 20000,
    })

    values: list[float] = []
    for row in payload.get("data") or []:
        d = row.get("date_obs_elab")
        v = row.get("resultat_obs_elab")
        if not d or v is None:
            continue
        try:
            if int(d[5:7]) == month and float(v) > 0:
                values.append(float(v) / 1000)
        except (TypeError, ValueError):
            continue

    if not values:
        return None
    return {"normal_m3s": median(values), "sample_size": len(values), "month": month}


def classify(flow: float | None, normal: float | None) -> tuple[str, float | None]:
    if flow is None or normal is None or normal <= 0:
        return "unknown", None
    ratio = flow / normal
    if ratio < 0.20:
        return "very-low", ratio
    if ratio < 0.50:
        return "low", ratio
    if ratio <= 1.50:
        return "normal", ratio
    if ratio <= 2.00:
        return "high", ratio
    return "very-high", ratio


def fetch_height_history(code: str) -> list[dict[str, Any]]:
    # Vraie borne temporelle UTC : on ne tronque plus la journée à 00:00.
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=30)

    payload = get_json(f"{API}/observations_tr", {
        "format": "json",
        "code_entite": code,
        "grandeur_hydro": "H",
        "date_debut_obs": start.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "date_fin_obs": end.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "sort": "asc",
        "size": 20000,
    })

    result: list[dict[str, Any]] = []
    for row in payload.get("data") or []:
        value = parse_float(row.get("resultat_obs"))
        date_obs = row.get("date_obs")
        if value is None or not date_obs:
            continue
        result.append({"date": date_obs, "value": value / 1000})
    return result


def fetch_flow_history(site_code: str) -> list[dict[str, Any]]:
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=365)

    payload = get_json(f"{API}/obs_elab", {
        "format": "json",
        "code_entite": site_code,
        "grandeur_hydro_elab": "QmnJ",
        "date_debut_obs_elab": start.isoformat(),
        "date_fin_obs_elab": end.isoformat(),
        "sort": "asc",
        "size": 20000,
    })

    result: list[dict[str, Any]] = []
    for row in payload.get("data") or []:
        value = parse_float(row.get("resultat_obs_elab"))
        date_obs = row.get("date_obs_elab")
        if value is None or not date_obs:
            continue
        result.append({"date": date_obs, "value": value / 1000})
    return result


def write_history(station: dict[str, Any]) -> None:
    code = station["code_station"]
    site_code = station.get("code_site") or code
    try:
        payload = {
            "code": code,
            "site_code": station.get("code_site"),
            "updated": datetime.now(timezone.utc).isoformat(),
            "height": fetch_height_history(code),
            "flow": fetch_flow_history(site_code),
        }
        (HISTORY / f"{code}.json").write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
    except Exception as exc:
        print(f"[WARN] historique {code}: {exc}")


def main() -> None:
    raw = paginate("referentiel/stations", 5000)
    selected = select_stations(raw)
    print(f"Stations brutes : {len(raw)}")
    print(f"Stations retenues : {len(selected)}")

    station_rows = [station_record(s) for s in selected]
    station_rows.sort(key=lambda x: (x["importance"], normalize(x.get("river")), x["name"]))
    STATIONS_FILE.write_text(
        json.dumps({
            "updated": datetime.now(timezone.utc).isoformat(),
            "count": len(station_rows),
            "stations": station_rows,
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # Mesures actuelles.
    live: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(fetch_current, s): s for s in selected}
        for future in as_completed(futures):
            station = futures[future]
            try:
                code, result = future.result()
                live[code] = result
            except Exception as exc:
                print(f"[WARN] mesures {station['code_station']}: {exc}")

    # Normales mensuelles.
    normals = load_json_file(NORMALS_FILE, {})
    month = datetime.now(timezone.utc).month
    normal_jobs = [
        s for s in selected
        if normals.get(s["code_station"], {}).get("month") != month
    ]
    print(f"Normales à calculer : {len(normal_jobs)}")

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(fetch_normal, s, month): s for s in normal_jobs}
        for future in as_completed(futures):
            station = futures[future]
            code = station["code_station"]
            try:
                result = future.result()
                if result:
                    normals[code] = result
            except Exception as exc:
                print(f"[WARN] normale {code}: {exc}")

    NORMALS_FILE.write_text(
        json.dumps(normals, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # Live JSON + altitude de la surface de l'eau.
    station_lookup = {s["code"]: s for s in station_rows}
    live_rows: list[dict[str, Any]] = []

    for station in selected:
        code = station["code_station"]
        obs = live.get(code, {
            "height_m": None,
            "flow_m3s": None,
            "observed_at": None,
        })
        normal = normals.get(code)
        level, ratio = classify(
            obs.get("flow_m3s"),
            normal.get("normal_m3s") if normal else None,
        )

        meta = station_lookup.get(code, {})
        zero_scale = meta.get("zero_scale_m")
        water_level = None

        if zero_scale is not None and obs.get("height_m") is not None:
            water_level = zero_scale + obs["height_m"]

        live_rows.append({
            "code": code,
            "height_m": obs.get("height_m"),
            "flow_m3s": obs.get("flow_m3s"),
            "water_level_m_ngf": water_level,
            "observed_at": obs.get("observed_at"),
            "normal_m3s": normal.get("normal_m3s") if normal else None,
            "normal_sample_size": normal.get("sample_size") if normal else None,
            "ratio": ratio,
            "level": level,
        })

    LIVE_FILE.write_text(
        json.dumps({
            "updated": datetime.now(timezone.utc).isoformat(),
            "count": len(live_rows),
            "stations": live_rows,
        }, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    # Historiques pré-calculés.
    print(f"Historiques à générer : {len(selected)}")
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(write_history, s) for s in selected]
        for i, future in enumerate(as_completed(futures), 1):
            try:
                future.result()
            except Exception as exc:
                print(f"[WARN] historique : {exc}")
            if i % 100 == 0:
                print(f"Historiques : {i}/{len(selected)}")

    print("OpenEAU : génération terminée.")


if __name__ == "__main__":
    main()

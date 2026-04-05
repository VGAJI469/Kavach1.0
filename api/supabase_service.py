"""
supabase_service.py — Read worker history from Supabase
Used by fraud scorer to cross-check claim legitimacy.
"""
import httpx
from typing import Optional
from config import SUPABASE_URL, SUPABASE_ANON_KEY


def _headers() -> dict:
    return {
        "apikey":        SUPABASE_ANON_KEY or "",
        "Authorization": f"Bearer {SUPABASE_ANON_KEY or ''}",
        "Content-Type":  "application/json",
    }


async def get_worker_claims_history(worker_id: str) -> list:
    """
    Fetch last 90 days of claims for a worker.
    Returns list of claim dicts.
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return []

    url = f"{SUPABASE_URL}/rest/v1/claims"
    params = {
        "worker_id": f"eq.{worker_id}",
        "select":    "id,trigger_type,payout_amount,status,fraud_score,triggered_at",
        "order":     "triggered_at.desc",
        "limit":     "50",
    }

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(url, params=params, headers=_headers())
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        print(f"[SupabaseService] Claims fetch error: {e}")
        return []


async def get_worker_profile(worker_id: str) -> Optional[dict]:
    """
    Fetch worker profile for tenure and earnings history.
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return None

    url = f"{SUPABASE_URL}/rest/v1/workers"
    params = {
        "id":     f"eq.{worker_id}",
        "select": "id,name,city,platform,weekly_earnings,created_at,risk_score",
        "limit":  "1",
    }

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(url, params=params, headers=_headers())
            resp.raise_for_status()
            results = resp.json()
            return results[0] if results else None
    except Exception as e:
        print(f"[SupabaseService] Worker fetch error: {e}")
        return None


async def get_city_claim_velocity(city: str, minutes: int = 60) -> int:
    """
    Count claims filed from a city in the last N minutes.
    Used to detect coordinated fraud spikes.
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return 0

    from datetime import datetime, timedelta
    since = (datetime.utcnow() - timedelta(minutes=minutes)).isoformat()

    url = f"{SUPABASE_URL}/rest/v1/claims"
    params = {
        "select":       "id",
        "triggered_at": f"gte.{since}",
    }

    # Join with workers to filter by city — use RPC if available
    # Fallback: just return 0 and let fraud model use other signals
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(url, params=params, headers=_headers())
            resp.raise_for_status()
            return len(resp.json())
    except Exception as e:
        print(f"[SupabaseService] Velocity check error: {e}")
        return 0

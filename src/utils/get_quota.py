import sys
import json
import os

# Insert the path of the hermes-agent so we can import agent modules
sys.path.insert(0, '/home/nhien36hk/.hermes/hermes-agent')

try:
    from agent.google_oauth import get_valid_access_token, load_credentials
    from agent.google_code_assist import retrieve_user_quota
except ImportError as exc:
    print(json.dumps({"success": False, "error": f"Gemini modules unavailable: {exc}"}))
    sys.exit(0)

try:
    access_token = get_valid_access_token()
except Exception as exc:
    print(json.dumps({"success": False, "error": f"No Google OAuth credentials found: {exc}"}))
    sys.exit(0)

try:
    creds = load_credentials()
    project_id = (creds.project_id if creds else "") or ""
    buckets = retrieve_user_quota(access_token, project_id=project_id)
except Exception as exc:
    print(json.dumps({"success": False, "error": f"Quota lookup failed: {exc}"}))
    sys.exit(0)

# Format the buckets
result_buckets = []
for b in buckets:
    result_buckets.append({
        "model_id": b.model_id,
        "token_type": b.token_type,
        "remaining_fraction": b.remaining_fraction,
        "reset_time_iso": b.reset_time_iso
    })

print(json.dumps({
    "success": True,
    "project_id": project_id,
    "buckets": result_buckets
}))

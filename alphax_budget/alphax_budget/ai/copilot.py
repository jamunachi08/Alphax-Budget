from __future__ import annotations

import json
import frappe
from frappe import _

def _get_settings():
    # Single doctype
    return frappe.get_single("AlphaX Budget Settings")

def _allowed(user: str) -> bool:
    settings = _get_settings()
    if not getattr(settings, "enable_ai", 0):
        return False
    allowed_roles = [d.role for d in (getattr(settings, "allowed_roles", []) or []) if getattr(d, "role", None)]
    # If not configured, restrict to System Manager for safety
    if not allowed_roles:
        return frappe.has_role("System Manager", user=user)
    return any(frappe.has_role(r, user=user) for r in allowed_roles)

def _summarize_budget_context():
    # Keep this lightweight + safe. We only return a compact summary.
    # You can expand later to include Budget vs Actual vs Commitment cubes.
    today = frappe.utils.today()
    return {
        "today": today,
        "company": frappe.defaults.get_global_default("company"),
        "note": "Add Budget vs Actual vs Commitment summaries here (AFI roadmap)."
    }

def _call_openai_compatible(settings, messages):
    endpoint = (settings.ai_endpoint or "").strip()
    api_key = (settings.ai_api_key or "").strip()
    model = (settings.ai_model or "").strip() or "gpt-4o-mini"
    if not endpoint or not api_key:
        frappe.throw(_("AI endpoint / key not configured in AlphaX Budget Settings."))

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": messages,
        "temperature": float(settings.temperature or 0.2),
        "max_tokens": int(settings.max_tokens or 800),
    }

    # Works for OpenAI-compatible endpoints (OpenAI, Azure (compatible), Ollama proxies, etc.)
    res = frappe.integrations.utils.make_post_request(endpoint, headers=headers, data=json.dumps(payload))
    # Try to parse OpenAI-style response
    try:
        return res["choices"][0]["message"]["content"], res
    except Exception:
        return frappe.as_json(res), res

@frappe.whitelist()
def ask(question: str) -> str:
    """Budget Copilot: answers a user question using configured AI (or safe local fallback).

    This function is intentionally conservative for cloud safety:
    - Only enabled if settings.enable_ai
    - Role restricted
    - Logs Q&A if enabled
    """
    question = (question or "").strip()
    if not question:
        return _("Please provide a question.")

    user = frappe.session.user
    settings = _get_settings()

    if not _allowed(user):
        return _("Copilot is disabled for your role (or not enabled). Ask your System Manager to enable it in AlphaX Budget Settings.")

    ctx = _summarize_budget_context()

    # If provider is None, return a smart deterministic answer template (still useful)
    provider = (settings.ai_provider or "None").strip()
    if provider == "None":
        answer = (
            "Copilot is enabled, but AI Provider is set to 'None'.\n\n"
            "Here is what I can do once you configure an OpenAI-compatible endpoint in AlphaX Budget Settings:\n"
            "• Explain overspend drivers (by account / cost center / item / supplier)\n"
            "• Forecast month-end budget risk\n"
            "• Suggest budget transfers and spending controls\n\n"
            f"Your question: {question}\n"
        )
        _maybe_log(settings, user, question, ctx, answer, provider=provider, model=settings.ai_model, raw=None)
        return answer

    messages = [
        {"role": "system", "content": "You are AlphaX Budget Copilot for ERPNext. Be concise, practical, and cite numbers when available. If data is missing, say what you would need."},
        {"role": "user", "content": f"Question: {question}\n\nContext (JSON): {json.dumps(ctx, ensure_ascii=False)}"},
    ]

    try:
        answer, raw = _call_openai_compatible(settings, messages)
    except Exception as e:
        answer = _("AI call failed: {0}").format(str(e))
        raw = None

    _maybe_log(settings, user, question, ctx, answer, provider=provider, model=settings.ai_model, raw=raw)
    return answer

def _maybe_log(settings, user, question, ctx, answer, provider=None, model=None, raw=None):
    if not getattr(settings, "log_insights", 0):
        return
    try:
        doc = frappe.new_doc("AlphaX Budget Insight Log")
        doc.asked_by = user
        doc.asked_on = frappe.utils.now_datetime()
        doc.question = question
        doc.context = json.dumps(ctx, ensure_ascii=False, indent=2)
        doc.answer = answer
        doc.provider = provider or ""
        doc.model = model or ""
        # token estimation is provider-specific; leave blank
        doc.insert(ignore_permissions=True)
        frappe.db.commit()
    except Exception:
        # never block user for logging failure
        pass

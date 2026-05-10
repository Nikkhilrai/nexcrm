"""Merge-tag renderer for email templates.

Supported tags:
    {{lead_name}}         Full name of the lead
    {{lead_first_name}}   First word of full_name
    {{lead_company}}      Lead's company
    {{lead_designation}}  Lead's designation
    {{lead_email}}        Lead's email address
    {{event_name}}        Full event name (e.g. "LexTalk World Bangalore 2026")
    {{event_city}}        Event city (e.g. "Bangalore")
    {{event_location}}    City + country (e.g. "Bangalore, India")
    {{event_date}}        Formatted date range (e.g. "June 11, 2026" / "Sep 9–10, 2026")
    {{pipeline_name}}     Sub-pipeline name (e.g. "Delegate Passes")
    {{tier_name}}         Package tier name, blank if none
    {{sender_name}}       Name of the user sending; "LexTalk Team" for auto-sends
"""

import re

from leads.models import Lead


_TAG_RE = re.compile(r"\{\{(\w+)\}\}")


def _format_event_date(event) -> str:
    """Return a human-readable date or date-range for the event."""
    if not event or not event.start_date:
        return ""
    start = event.start_date
    end = event.end_date
    month = start.strftime("%B")
    year = start.strftime("%Y")
    if not end or end == start:
        return f"{month} {start.day}, {year}"
    if end.month == start.month and end.year == start.year:
        return f"{month} {start.day}–{end.day}, {year}"
    return f"{start.strftime('%b')} {start.day} – {end.strftime('%b')} {end.day}, {year}"


def build_context(lead: Lead, sender_name: str = "") -> dict[str, str]:
    """Build the merge-tag context dict for a given lead."""
    first_name = (lead.full_name or "").split()[0] if lead.full_name else ""
    tier_name = lead.package_tier.name if lead.package_tier_id else ""
    event = lead.event_interest if lead.event_interest_id else None

    city = event.city if event else ""
    country = event.country if event else ""
    location = f"{city}, {country}" if city and country else city or country

    return {
        "lead_name": lead.full_name or "",
        "lead_first_name": first_name,
        "lead_company": lead.company or "",
        "lead_designation": lead.designation or "",
        "lead_email": lead.email or "",
        "event_name": event.name if event else "",
        "event_city": city,
        "event_location": location,
        "event_date": _format_event_date(event),
        "pipeline_name": lead.sub_pipeline.name if lead.sub_pipeline_id else "",
        "tier_name": tier_name,
        "sender_name": sender_name or "LexTalk Team",
    }


def render_template(text: str, context: dict[str, str]) -> str:
    """Replace all {{tag}} occurrences in text using context.

    Unknown tags are left as-is so typos are visible rather than silently blank.
    """
    def replacer(match: re.Match) -> str:
        key = match.group(1)
        return context.get(key, match.group(0))

    return _TAG_RE.sub(replacer, text)

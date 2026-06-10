#!/usr/bin/env python3
"""Haalt publicaties op uit het Slack-kanaal #vers-van-de-pers en werkt data/publicaties.json bij.

De bot "DMT Slack notifier" post elk gepubliceerd artikel in het kanaal; het
berichttijdstip is het publicatiemoment. Dit script leest de kanaalhistorie via
de Slack Web API, parseert de berichten en voegt nieuwe artikelen toe aan het
databestand dat het dashboard inleest.

Gebruik:
    SLACK_BOT_TOKEN=xoxb-... python scripts/fetch_slack.py            # incrementeel
    SLACK_BOT_TOKEN=xoxb-... python scripts/fetch_slack.py --backfill 30

Vereiste Slack-scopes: channels:history (bot moet lid zijn van het kanaal).
"""

import argparse
import html
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib import parse, request
from zoneinfo import ZoneInfo

CHANNEL_ID = os.environ.get("SLACK_CHANNEL_ID", "C07SRB3QWR5")
DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "publicaties.json"
AMSTERDAM = ZoneInfo("Europe/Amsterdam")

TITLE_RE = re.compile(r"^\*(?P<title>.+?)\*\s*(?:-\s*(?P<author>.*))?$")
URL_RE = re.compile(r"<(https://www\.nrc\.nl/[^>|]+)")
META_RE = re.compile(
    r"Desk:\s*\*(?P<desk>.+?)\*,\s*artikeltype:\s*\*(?P<artikeltype>.+?)\*,"
    r"\s*volgonderwerpen:\s*(?P<topics>.*)"
)
TOPIC_RE = re.compile(r"\*(.+?)\*")


def slack_api(method: str, token: str, **params) -> dict:
    url = f"https://slack.com/api/{method}?" + parse.urlencode(params)
    req = request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with request.urlopen(req) as resp:
        data = json.load(resp)
    if not data.get("ok"):
        sys.exit(f"Slack API-fout bij {method}: {data.get('error')}")
    return data


def parse_message(msg: dict) -> dict | None:
    """Zet een bot-bericht om naar een artikelrecord; None als het geen artikel is."""
    if msg.get("subtype") not in (None, "bot_message"):
        return None
    text = msg.get("text", "")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return None

    title_match = TITLE_RE.match(lines[0])
    url_match = URL_RE.search(text)
    meta_match = META_RE.search(text)
    if not (title_match and url_match and meta_match):
        return None

    # Titels komen soms dubbel-ge-escaped binnen (&amp;#8216;), dus twee keer unescapen.
    title = html.unescape(html.unescape(title_match.group("title"))).strip()
    author = (title_match.group("author") or "").strip() or None
    topics_raw = meta_match.group("topics")
    topics = [] if "_geen_" in topics_raw else TOPIC_RE.findall(topics_raw)

    published = datetime.fromtimestamp(float(msg["ts"]), tz=AMSTERDAM)
    return {
        "published_at": published.isoformat(timespec="seconds"),
        "title": title,
        "author": html.unescape(author) if author else None,
        "desk": meta_match.group("desk"),
        "artikeltype": meta_match.group("artikeltype"),
        "volgonderwerpen": topics,
        "url": url_match.group(1),
    }


def fetch_since(token: str, oldest: float) -> list[dict]:
    records, cursor = [], None
    while True:
        params = {"channel": CHANNEL_ID, "limit": 200, "oldest": f"{oldest:.6f}"}
        if cursor:
            params["cursor"] = cursor
        data = slack_api("conversations.history", token, **params)
        for msg in data.get("messages", []):
            record = parse_message(msg)
            if record:
                records.append(record)
        cursor = data.get("response_metadata", {}).get("next_cursor")
        if not data.get("has_more") or not cursor:
            return records
        time.sleep(1)  # rate limit van conversations.history respecteren


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backfill", type=int, metavar="DAGEN",
                        help="haal de volledige historie van de afgelopen N dagen op")
    args = parser.parse_args()

    token = os.environ.get("SLACK_BOT_TOKEN")
    if not token:
        sys.exit("Zet de omgevingsvariabele SLACK_BOT_TOKEN (xoxb-... met scope channels:history).")

    existing = json.loads(DATA_PATH.read_text()) if DATA_PATH.exists() else []

    if args.backfill:
        oldest = (datetime.now(timezone.utc) - timedelta(days=args.backfill)).timestamp()
    elif existing:
        newest = max(item["published_at"] for item in existing)
        oldest = datetime.fromisoformat(newest).timestamp() + 0.000001
    else:
        oldest = (datetime.now(timezone.utc) - timedelta(days=14)).timestamp()

    new_records = fetch_since(token, oldest)

    seen = {(item["url"], item["published_at"]) for item in existing}
    added = [r for r in new_records if (r["url"], r["published_at"]) not in seen]
    merged = sorted(existing + added, key=lambda item: item["published_at"])

    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATA_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(added)} nieuwe artikelen toegevoegd, totaal {len(merged)}.")


if __name__ == "__main__":
    main()

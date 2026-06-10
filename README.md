# Vers van de pers — publicatiedashboard

Live dashboard van het NRC-publicatieritme, gevoed door het Slack-kanaal
**#vers-van-de-pers**. Daar post de *DMT Slack notifier* elk gepubliceerd
artikel; het berichttijdstip is het publicatiemoment. Dit dashboard maakt
daarmee zichtbaar **wanneer** we publiceren — bijvoorbeeld de piek tussen
16 en 17 uur — uitgesplitst naar desk en artikeltype.

## Onderdelen

| Bestand | Functie |
| --- | --- |
| `index.html` + `assets/` | Het dashboard zelf: statische pagina met Plotly-grafieken |
| `data/publicaties.json` | De geparseerde publicaties (één record per artikel) |
| `scripts/fetch_slack.py` | Haalt nieuwe berichten op via de Slack API en werkt de data bij |
| `.github/workflows/update-data.yml` | Draait het fetch-script elke 20 minuten |

Elk record ziet er zo uit:

```json
{
  "published_at": "2026-06-09T19:29:16+02:00",
  "title": "Zij weten allemaal wat WTP, RPO en MVB betekent…",
  "author": "Eva Smal",
  "desk": "Economie",
  "artikeltype": "reportage",
  "volgonderwerpen": ["Pensioenen", "Financiële sector", "Economie"],
  "url": "https://www.nrc.nl/nieuws/2026/06/09/…"
}
```

## Lokaal bekijken

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Live zetten

1. **Slack-app aanmaken** op <https://api.slack.com/apps> met de bot-scope
   `channels:history`, installeer de app in de NRC-workspace en nodig de bot
   uit in #vers-van-de-pers (`/invite @<botnaam>`).
2. **Secret instellen**: voeg het bot-token (`xoxb-…`) toe als repository-secret
   `SLACK_BOT_TOKEN` (Settings → Secrets and variables → Actions).
3. **GitHub Pages aanzetten**: Settings → Pages → Deploy from a branch →
   kies deze branch, map `/ (root)`.
4. De workflow ververst `data/publicaties.json` elke 20 minuten; Pages
   publiceert automatisch de nieuwe versie.

Eenmalig een langere historie laden kan met:

```bash
SLACK_BOT_TOKEN=xoxb-… python scripts/fetch_slack.py --backfill 90
```

> **Let op:** GitHub Pages is openbaar tenzij de organisatie GitHub Enterprise
> Cloud heeft (dan kan Pages op "private" voor alleen org-leden). Overweeg dat,
> of host de map intern, omdat de data het volledige publicatielog bevat —
> al is alles erin ook gewoon op nrc.nl te zien.

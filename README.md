# Vers van de pers — publicatiedashboard

Live dashboard van het NRC-publicatieritme, gevoed door het Slack-kanaal
**#vers-van-de-pers**. Het maakt zichtbaar **wanneer** we publiceren —
bijvoorbeeld de middagpiek rond 15–17 uur — uitgesplitst naar desk en
artikeltype. Doelgroep: chefs van deelredacties die het gesprek over
publicatiespreiding willen voeren.

---

## Hoe werkt het? (het hele idee in vier zinnen)

1. In #vers-van-de-pers post een bestaande bot (de *DMT Slack notifier*)
   automatisch elk artikel dat NRC publiceert, mét desk, artikeltype en
   auteur. Het tijdstip van dat Slack-bericht is het publicatiemoment.
   **Die bot hoef je dus niet te bouwen — die draait al.**
2. Een klein script (`scripts/fetch_slack.py`) leest die berichten uit en
   zet ze om in een overzichtelijk databestand: `data/publicaties.json`.
3. GitHub draait dat script elke 20 minuten automatisch voor je
   (via "GitHub Actions", zie uitleg hieronder).
4. Het dashboard (`index.html`) is een gewone webpagina die dat databestand
   inleest en er grafieken van tekent. GitHub kan die pagina gratis hosten
   ("GitHub Pages"), zodat iedereen met de link het dashboard ziet.

Schematisch:

```
#vers-van-de-pers  →  fetch_slack.py  →  data/publicaties.json  →  dashboard
   (Slack)           (elke 20 min,        (groeiend archief)       (webpagina)
                      via GitHub Actions)
```

## Even de begrippen (voor wie GitHub nieuw is)

- **Repository (repo)**: deze map met bestanden, met versiegeschiedenis,
  opgeslagen bij GitHub.
- **Branch**: een benoemde versie van de repo. Dit project staat nu op de
  branch `claude/nrc-publication-dashboard-teomsw`; vaak wordt werk
  uiteindelijk samengevoegd naar de hoofdbranch (`main`).
- **GitHub Actions**: een gratis "robotje" van GitHub dat op gezette tijden
  een script voor je draait. Wat het moet doen staat in
  `.github/workflows/update-data.yml` — dat bestand staat er al, je hoeft
  het alleen maar van een Slack-token te voorzien (stap 2 en 3 hieronder).
- **Secret**: een veilige kluis in GitHub voor wachtwoorden en tokens, zodat
  die niet zichtbaar in de code staan.
- **GitHub Pages**: gratis hosting van GitHub voor statische webpagina's,
  rechtstreeks vanuit je repo.

## Wat zit waar?

| Bestand | Functie |
| --- | --- |
| `index.html` + `assets/` | Het dashboard: webpagina met grafieken (Plotly wordt lokaal meegeleverd, geen externe afhankelijkheden) |
| `data/publicaties.json` | Alle geparseerde publicaties, één record per artikel |
| `scripts/fetch_slack.py` | Haalt nieuwe Slack-berichten op en vult het databestand aan |
| `.github/workflows/update-data.yml` | De instructie voor GitHub Actions: draai het script elke 20 minuten |

Eén record uit het databestand ziet er zo uit:

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

---

## Stap 1 — Het dashboard op je eigen computer bekijken

Er zit al twee weken aan echte data in de repo, dus dit werkt meteen:

1. Installeer [Python](https://www.python.org/downloads/) als je dat nog
   niet hebt (op een Mac staat het er meestal al op).
2. Open een terminal in de map van dit project en typ:

   ```bash
   python3 -m http.server 8000
   ```

3. Open <http://localhost:8000> in je browser. Klaar.

(Waarom die server? Browsers weigeren om veiligheidsredenen databestanden te
laden als je `index.html` rechtstreeks dubbelklikt.)

## Stap 2 — De Slack-koppeling maken (géén programmeerwerk)

Je maakt hier geen bot die iets *post* — je maakt een Slack-"app" die
alleen mag *meelezen* in het kanaal. Zie het als een leespas. Vijf minuten
klikwerk:

1. Ga naar <https://api.slack.com/apps> en log in met je NRC-Slack-account.
2. Klik **Create New App** → **From scratch**. Geef hem een herkenbare naam,
   bijv. `versvandepers-dashboard`, en kies de NRC-workspace.
3. Klik in het linkermenu op **OAuth & Permissions**. Scroll naar
   **Scopes** → **Bot Token Scopes** → **Add an OAuth Scope** en kies
   `channels:history` (= "mag berichten lezen in openbare kanalen waar de
   app lid van is" — meer mag deze app dus niet).
4. Scroll terug omhoog en klik **Install to Workspace** → **Allow**.
   *Let op: bij veel organisaties moet een Slack-beheerder dit eerst
   goedkeuren. Je krijgt dan een "Request to install"-knop; de
   beheerder krijgt automatisch bericht.*
5. Na installatie verschijnt onder **OAuth & Permissions** een
   **Bot User OAuth Token** dat begint met `xoxb-`. Kopieer dat.
   **Behandel dit als een wachtwoord**: niet in een bestand in de repo
   zetten, niet delen via Slack of mail.
6. Ga in Slack naar #vers-van-de-pers en typ:
   `/invite @versvandepers-dashboard` (de naam uit stap 2). Nu mag de app
   het kanaal lezen.

## Stap 3 — Het token aan GitHub geven

1. Ga naar de repo op github.com → tabblad **Settings** →
   **Secrets and variables** → **Actions**.
2. Klik **New repository secret**. Naam: `SLACK_BOT_TOKEN` (exact zo),
   waarde: het `xoxb-…`-token uit stap 2. Opslaan.

GitHub Actions kan nu bij het token, zonder dat het ooit zichtbaar in de
code of de logs staat.

## Stap 4 — Testen of de verversing werkt

1. Ga naar het tabblad **Actions** van de repo.
2. Klik links op **Ververs dashboard-data** → knop **Run workflow** →
   **Run workflow**. (Dit is hetzelfde wat straks elke 20 minuten vanzelf
   gebeurt, maar nu handmatig.)
3. Na een halve minuut zie je een groen vinkje. Het script heeft dan
   nieuwe publicaties opgehaald en `data/publicaties.json` bijgewerkt.

Zie je een rood kruis? Klik erop voor het logboek. De twee meest
voorkomende fouten:

- `invalid_auth` → het token is verkeerd gekopieerd of de app is nog niet
  geïnstalleerd (stap 2.4).
- `not_in_channel` → de app is nog niet uitgenodigd in het kanaal
  (stap 2.6).

## Stap 5 — Het dashboard online zetten (GitHub Pages)

1. Ga naar **Settings** → **Pages** (linkermenu).
2. Onder **Build and deployment**: kies bij *Source* **Deploy from a
   branch**, en kies daaronder de branch waarop dit project staat
   (nu `claude/nrc-publication-dashboard-teomsw`; na samenvoegen naar
   `main` pas je dit aan) met map **/ (root)**. Klik **Save**.
3. Na een minuut of twee staat bovenaan die pagina de link, in de vorm
   `https://<gebruikersnaam>.github.io/Versvandepersdash/`. Dat is de link
   die je met de chefs deelt.

> **Openbaarheid:** een GitHub Pages-site is standaard voor iedereen met de
> link toegankelijk, ook buiten NRC. Alles in de data staat ook gewoon op
> nrc.nl, maar wil je het toch afschermen, dan kan dat met GitHub
> Enterprise Cloud (Pages op "private") of door de map op een interne
> server te zetten.

## Daarna: het onderhoudt zichzelf

- Elke 20 minuten haalt GitHub Actions de nieuwe publicaties op en werkt
  het databestand bij; GitHub Pages publiceert de nieuwe versie vanzelf.
  Jij hoeft niets meer te doen.
- Meer historie laden (bijv. drie maanden, voor een robuuster weekbeeld)
  kan eenmalig vanaf je eigen computer:

  ```bash
  SLACK_BOT_TOKEN=xoxb-… python3 scripts/fetch_slack.py --backfill 90
  ```

  Daarna de gewijzigde `data/publicaties.json` committen en pushen — of
  vraag iemand met git-ervaring dat even mee te doen.
- Slack bewaart in de meeste workspaces berichten beperkt lang; het
  databestand in deze repo is dus meteen ook een blijvend archief van het
  publicatieritme.

## Veelgestelde vragen

**Moet ik een Slackbot programmeren?**
Nee. De bot die de artikelen post bestaat al (beheerd door DMT). Jij maakt
alleen een lees-app (stap 2) — dat is configuratie, geen code.

**De cijfers lopen achter / het dashboard ververst niet.**
Kijk op het tabblad **Actions** of de laatste runs groen zijn. GitHub voert
geplande taken soms een paar minuten later uit dan gepland; dat is normaal.

**Kan ik de grafieken aanpassen?**
Ja — alle grafieklogica staat in `assets/app.js`, de opmaak in
`assets/style.css`. Teksten en volgorde van de blokken staan in
`index.html`.

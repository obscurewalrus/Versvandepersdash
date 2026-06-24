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
3. GitHub draait dat script elk uur automatisch voor je
   (via "GitHub Actions", zie uitleg hieronder).
4. Het dashboard (`index.html`) is een gewone webpagina die dat databestand
   inleest en er grafieken van tekent. We hosten die pagina gratis op
   **Cloudflare Pages** met een inlogscherm ervoor (**Cloudflare Access**),
   zodat alleen NRC-collega's erbij kunnen — zie stap 5.

Schematisch:

```
#vers-van-de-pers → fetch_slack.py → data/publicaties.json → dashboard → login
   (Slack)          (elk uur, via      (groeiend archief)     (Cloudflare  (Cloudflare
                     GitHub Actions)                            Pages)       Access)
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
- **Cloudflare Pages**: gratis hosting voor statische webpagina's,
  rechtstreeks vanuit je repo — zoals GitHub Pages, maar via Cloudflare, wat
  nodig is voor de login-beveiliging hieronder.
- **Cloudflare Access**: een gratis inlogscherm dat Cloudflare vóór je site
  zet, zodat alleen goedgekeurde mailadressen erbij kunnen.

## Wat zit waar?

| Bestand | Functie |
| --- | --- |
| `index.html` + `assets/` | Het dashboard: webpagina met grafieken (Plotly wordt lokaal meegeleverd, geen externe afhankelijkheden) |
| `data/publicaties.json` | Alle geparseerde publicaties, één record per artikel |
| `scripts/fetch_slack.py` | Haalt nieuwe Slack-berichten op en vult het databestand aan |
| `.github/workflows/update-data.yml` | De instructie voor GitHub Actions: draai het script elk uur |

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
   **Run workflow**. (Dit is hetzelfde wat straks elk uur vanzelf
   gebeurt, maar nu handmatig.)
3. Na een halve minuut zie je een groen vinkje. Het script heeft dan
   nieuwe publicaties opgehaald en `data/publicaties.json` bijgewerkt.

Zie je een rood kruis? Klik erop voor het logboek. De twee meest
voorkomende fouten:

- `invalid_auth` → het token is verkeerd gekopieerd of de app is nog niet
  geïnstalleerd (stap 2.4).
- `not_in_channel` → de app is nog niet uitgenodigd in het kanaal
  (stap 2.6).

## Stap 5 — Online zetten mét login-beveiliging (Cloudflare Access)

We willen niet dat zomaar iedereen met de link erbij kan. Daarom hosten we
het dashboard achter **Cloudflare Access**: een inlogscherm dat vóór de
hele site komt te staan, zodat alleen mensen met een goedgekeurd
mailadres erin kunnen — de data inbegrepen.

### Waarom niet "gewoon" GitHub Pages met een slotje?

Cloudflare Access kan alleen verkeer afschermen dat ook echt via Cloudflare
loopt. Het standaard GitHub Pages-adres (`…github.io`) doet dat niet. De
eenvoudigste oplossing is daarom om dezelfde site te hosten op **Cloudflare
Pages** in plaats van GitHub Pages. Dat is gratis, leest dezelfde repo, en
staat meteen op Cloudflare — dus je hebt géén eigen domeinnaam nodig.

> Heb je wél een eigen (NRC-)domein en wil je per se op GitHub Pages
> blijven? Dan kan dat ook — zie *Alternatief* onderaan deze stap.

### 5a. Cloudflare-account en de site koppelen

1. Maak een gratis account op <https://dash.cloudflare.com/sign-up>.
2. Kies in het linkermenu **Workers & Pages** → **Create** →
   tabblad **Pages** → **Connect to Git**.
3. Koppel je GitHub-account en kies deze repository. Cloudflare vraagt om
   bouwinstellingen — die zijn hier heel simpel, want de site is al kant-en-klaar:
   - **Production branch**: de branch waarop dit project staat
     (nu `claude/nrc-publication-dashboard-teomsw`; na samenvoegen naar
     `main` kies je `main`).
   - **Framework preset**: *None*.
   - **Build command**: leeg laten.
   - **Build output directory**: `/` (de hoofdmap).
4. Klik **Save and Deploy**. Na een minuut krijg je een adres als
   `https://versvandepers-dashboard.pages.dev`. De site is nu online —
   maar nog openbaar; dat lossen we in 5b op.

Vanaf nu bouwt Cloudflare de site automatisch opnieuw bij elke nieuwe
commit, inclusief de uurlijkse data-updates van de robot. Het dashboard
blijft dus vanzelf actueel.

### 5b. Het inlogscherm ervoor zetten (Cloudflare Access)

1. Ga in het Cloudflare-dashboard naar **Zero Trust** (eigen onderdeel in
   het menu). De eerste keer kies je een teamnaam en het gratis plan
   (tot 50 gebruikers — ruim genoeg voor de chefs).
2. Ga naar **Access** → **Applications** → **Add an application** →
   **Self-hosted**.
3. Vul in:
   - **Application name**: bijv. `Vers van de pers dashboard`.
   - **Session duration**: bijv. 24 uur (hoe vaak men opnieuw inlogt).
   - **Application domain**: het `…pages.dev`-adres uit stap 5a.
4. **Policy** toevoegen → geef hem een naam als `NRC-medewerkers`,
   actie **Allow**, en kies bij de regels bijvoorbeeld:
   - *Selector* **Emails ending in** → `@nrc.nl` (iedereen met een
     NRC-mailadres mag erin), of
   - *Selector* **Emails** → een handmatige lijst met de adressen van de
     chefs.
5. Opslaan. Cloudflare gebruikt standaard een **e-mail-pincode**: een
   bezoeker vult zijn mailadres in, krijgt een eenmalige code gemaild en is
   binnen. Geen wachtwoorden om te beheren. (Wil je liever inloggen met het
   NRC-account? Dan kan DMT/IT later een koppeling met Google/Microsoft
   toevoegen — niet nodig om te starten.)

Klaar. De `…pages.dev`-link is nu de link die je met de chefs deelt; bij het
openen krijgen ze eerst het inlogscherm.

### Alternatief: op GitHub Pages blijven met een eigen domein

Heb je een (sub)domein dat je via Cloudflare mag beheren — bijv.
`dashboard.nrc.nl` — dan kun je GitHub Pages aanhouden:

1. Zet GitHub Pages aan (**Settings** → **Pages** → *Deploy from a branch*,
   map `/ (root)`).
2. Voeg het domein als **Custom domain** toe in diezelfde Pages-instellingen.
3. Beheer de DNS van dat domein bij Cloudflare, met het record op
   **proxied** (oranje wolkje), en zet daar dezelfde Access-policy op als
   in 5b.

Dit vergt een domeinnaam en wat DNS-werk (meestal via IT), en is daarom
voor de meeste mensen omslachtiger dan de Cloudflare Pages-route hierboven.

## Daarna: het onderhoudt zichzelf

- Elk uur haalt GitHub Actions de nieuwe publicaties op en werkt het
  databestand bij; Cloudflare Pages bouwt de site daarna vanzelf opnieuw.
  Jij hoeft niets meer te doen. (De frequentie staat bewust op uurlijks om
  binnen de gratis bouwlimiet van Cloudflare Pages te blijven — zie de
  uitleg in `.github/workflows/update-data.yml`.)
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
Twee schakels om te checken: (1) op GitHub het tabblad **Actions** — staan
de laatste runs groen? en (2) in Cloudflare onder **Workers & Pages** —
heeft de laatste *deployment* een groen vinkje? GitHub voert geplande taken
soms een paar minuten later uit dan gepland; dat is normaal.

**Iemand komt het inlogscherm niet door.**
Controleer in Cloudflare onder **Zero Trust → Access → Applications** de
policy: valt hun mailadres binnen de regel (bijv. `@nrc.nl` of de
handmatige lijst)? Bij een verkeerd adres geeft Cloudflare netjes
"That account does not have access".

**Wie betaalt dit?**
Niets, bij normaal gebruik: zowel GitHub Actions/Pages-builds als Cloudflare
Pages en Cloudflare Access (tot 50 gebruikers) zitten ruim binnen de gratis
lagen.

**Kan ik de grafieken aanpassen?**
Ja — alle grafieklogica staat in `assets/app.js`, de opmaak in
`assets/style.css`. Teksten en volgorde van de blokken staan in
`index.html`.

# Bonus-side

En responsiv bonusoversigt, der henter data fra `bonuses.json`. Scraperen bruger GratisDeals' offentlige bonusoversigt; admin-panelets egne ændringer gemmes lokalt i browseren.

## Lokal test

1. Åbn en terminal i projektmappen.
2. Start en lokal server med `python3 -m http.server 8000`.
3. Gå til <http://localhost:8000> for forsiden eller <http://localhost:8000/admin.html> for administrationen.
4. Log ind med demoadgangskoden `skift-mig`, og opret, redigér eller slet en bonus. Genindlæs siden for at kontrollere, at ændringerne er gemt.

Data fra admin-panelet er lokal for browseren og deles ikke mellem enheder eller brugere. Det automatiske JSON-feed er den offentlige forsidekilde, så lokale adminændringer bliver ikke automatisk sendt til GitHub. Bonusser uden oplyste free spins vises som "Ikke oplyst".

## Automatisk bonusopdatering

1. `SOURCES` i `scraper.py` er konfigureret til `https://gratisdeals.dk/casino-bonusser/`. Kort, casino-navne, bonuslinks, reklamebadge og kildens "Dansk licens"-badge parses fra sidens offentlige HTML.
2. Kildens licensbadge er ikke en uafhængig kontrol. Det vises som "Kilde angiver dansk licens"; `licenseVerified` forbliver `false`, indtil en person har kontrolleret tilladelsen. Tilbudslinks er markeret som reklame, når kilden viser `#reklame`.
3. Kontrollér kildens vilkår, robots.txt og gældende regler før automatiske hentninger. Scraperen prøver ikke at omgå login, CAPTCHA eller andre adgangsbegrænsninger. Kør `python3 -m pip install -r requirements.txt` og derefter `python3 scraper.py` lokalt.
4. Commit og push ændringerne til GitHub. Workflowet i `.github/workflows/update.yml` kører kl. 00, 06, 12 og 18 UTC samt kan startes manuelt fra GitHub Actions. Det kræver, at repository tillader workflowets `contents: write`-permission; branch protection må ikke blokere bot-commits.

Hvis en kilde fejler, eller ingen bonuskort kan parses, fejler scriptet uden at erstatte den eksisterende `bonuses.json`. GitHub Actions kan desuden starte planlagte jobs med forsinkelse. Forsiden henter feedet ved indlæsning og igen hver sjette time, med `localStorage`-cache som fallback.

Scraperen kan ikke vide, om en bonus reelt er dansk-licenseret, eller om bonusvilkår stadig gælder. Den henter de oplysninger, der vises af kilden; kontrollér licens, tilbud og vilkår før publicering.

## Offentlig side

Pages-jobbet i `.github/workflows/update.yml` udgiver kun `index.html`, `style.css`, `script.js` og `bonuses.json`. Admin-siden og login-scriptet er ikke med i Pages-artifactet. Workflowet deployer efter push til `main`, manuelt fra Actions og efter bonusopdateringen.

Sæt repositoryets Pages build source til **GitHub Actions**, og push til `main`. Den offentlige adresse er `https://smokeydk6.github.io/Bonus-side-/`. Scraperens workflow skal have `contents: write`; branch protection må ikke blokere bot-commits.

Admin-siden er fortsat kun til lokal demo på `/admin.html` via en lokal server. Den er ikke en hosted adminløsning og skal have en backend med rigtig adgangskontrol, før den eventuelt udgives separat.

## Filer

- `index.html`: Offentlig bonusoversigt.
- `admin.html`: Login og administrationspanel.
- `style.css`: Responsivt layout og styling.
- `script.js`: Bonusvisning, søgning, filtre, JSON-feed og lokal CRUD-lagring.
- `auth.js`: Enkel demoadgang til administrationspanelet.
- `scraper.py`: Henter og parser bonuskort fra konfigurerede kilder.
- `requirements.txt`: Python-afhængigheder.
- `bonuses.json`: Datafeed til forsiden.
- `.github/workflows/update.yml`: Kører scraperen hver sjette time og committer ændringer.
- `.github/workflows/deploy-pages.yml`: Udgiver kun den offentlige forside og bonusdata.

## Før offentlig brug

Admin-login er kun en lokal demo: adgangskoden i `auth.js` kan ses i browseren, og `localStorage` kan redigeres af brugeren. Admin er derfor ikke med i den offentlige Pages-side. Kontrollér licens, bonusvilkår, links og gældende markedsføringsregler for hvert tilbud.
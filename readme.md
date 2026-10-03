![](./Public/github_header.png)

*Cette librairie **n'est en aucun cas** liée à [Réseau Mistral](https://www.reseaumistral.com/) et est réalisée en utilisant des données accessibles publiquement.*

---

## Avant tout, qu'est-ce que le « Réseau Mistral » ?

[Le Réseau Mistral](https://www.reseaumistral.com/) est le réseau de transport en commun de la métropole Toulon Provence Méditerranée. Il regroupe des bus, des bateaux-bus et des lignes scolaires desservant les communes de l'aire toulonnaise.

**Miawstral** fournit :

- une **API REST** : arrêts, lignes, horaires, prochains départs et calcul d'itinéraires ;
- un **calculateur d'itinéraires** basé sur l'algorithme [RAPTOR](./ROUTING_ALGORITHM.md), qui tient compte des vrais horaires, des correspondances et de la marche ;
- une **interface web** (React + carte Leaflet) dans [`client/`](./client) ;
- un **scraper** qui récupère les fiches horaires publiques du réseau.

## Démarrage rapide

### Avec Docker : tout en une commande

Prérequis : Docker avec Compose v2.

```bash
docker compose up -d --build
```

Puis ouvrez **http://localhost:3000** (interface web) ou **http://localhost:3000/api/docs** (documentation de l'API).

Le compose lance tout ce qu'il faut :

| Service | Rôle |
| --- | --- |
| `app` | API + interface web, sur le port 3000 |
| `flaresolverr` | passe la protection Cloudflare pour récupérer les fiches horaires |
| `osrm-prepare` | au premier lancement seulement : télécharge OpenStreetMap (≈ 80 Mo, département du Var), garde la zone de Toulon et prépare les graphes de calcul (quelques minutes) |
| `osrm-foot`, `osrm-car` | tracés à pied et en bus sur la carte |

L'application est utilisable immédiatement. Au premier démarrage, elle récupère les horaires à jour des deux sens de chaque ligne en arrière-plan (environ 10 minutes, suivi sur `/api/data/status`), puis toutes les 24 h. En attendant, elle utilise les horaires fournis dans le dépôt. Les horaires et les graphes OSRM sont conservés dans des volumes Docker.

Variables utiles, à mettre dans l'environnement ou dans `.env` :

- `MIAWSTRAL_PORT` : port de l'interface (défaut 3000) ;
- `ADMIN_TOKEN` : active `POST /api/data/refresh` ;
- `AUTO_REFRESH_HOURS` : fréquence de mise à jour des horaires (défaut 24, 0 pour désactiver) ;
- `OSM_BBOX` : zone de carte gardée pour OSRM.

```bash
docker compose logs -f app                       # suivre l'application
docker compose down                              # arrêter (les données sont gardées)
docker compose down -v                           # arrêter et tout effacer
```

### Sans Docker

Prérequis : [Node.js](https://nodejs.org/) ≥ 20.12 et [bun](https://bun.sh/).

```bash
bun run setup             # dépendances de l'API et de l'interface
cp .env.example .env      # optionnel
bun run dev               # API sur http://localhost:3000 + interface sur http://localhost:5173
```

Ouvrez **http://localhost:5173** : en développement, l'interface est servie par Vite (qui relaie `/api` vers le port 3000). `bun run dev:api` et `bun run client:dev` lancent chaque partie séparément.

En production : `bun run client:build && bun run build && bun start`, l'API sert alors l'interface compilée sur `/`.

## API

La documentation interactive (OpenAPI / Swagger) est servie sur [`/api/docs`](http://localhost:3000/api/docs).

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/health` | État du service et des données chargées |
| GET | `/api/stops` | Tous les arrêts |
| GET | `/api/stops/search?q=liberte` | Recherche d'arrêts (insensible aux accents) |
| GET | `/api/stops/nearby?lat=&lon=&radius=` | Arrêts autour d'un point, du plus proche au plus loin |
| GET | `/api/stops/:id` | Détail d'un arrêt, lignes et horaires de passage |
| GET | `/api/stops/:id/departures?time=08:00` | Prochains départs |
| GET | `/api/lines` | Toutes les lignes |
| GET | `/api/lines/search?q=brusc` | Recherche de lignes |
| GET | `/api/lines/:id` | Détail d'une ligne : sens, arrêts et horaires |
| POST | `/api/routes/calculate` | Calcul d'itinéraires |
| GET | `/api/data/status` | Données chargées et état du dernier rafraîchissement |
| POST | `/api/data/refresh` | Rafraîchit les horaires (jeton admin requis) |

Exemple :

```bash
curl -X POST http://localhost:3000/api/routes/calculate \
  -H 'Content-Type: application/json' \
  -d '{ "from": { "stopId": "MISTRAL:SECENN" }, "to": { "lat": 43.0995, "lon": 5.88 }, "departureTime": "08:00" }'
```

`from` et `to` acceptent un arrêt (`stopId`) ou des coordonnées (`lat`, `lon`). Options : `departureTime` (`HH:MM`, par défaut l'heure actuelle à Toulon), `maxTransfers` (0 à 4, défaut 2), `maxWalkingDistance` (m, défaut 800), `excludedLines`, `maxResults` (défaut 5), `includeGeometry` (défaut `true`).

Chaque itinéraire indique ses heures de départ et d'arrivée, ses correspondances, la marche, et pour chaque trajet en bus les arrêts desservis avec leurs horaires. Les erreurs ont la forme `{ "success": false, "message": "..." }` avec un code HTTP adapté (400, 404…).

## Données et rafraîchissement

Les fiches horaires sont publiées par Instant System derrière Cloudflare : le scraper passe par [FlareSolverr](https://github.com/FlareSolverr/FlareSolverr). Il récupère les deux sens de chaque ligne (`OUTWARD` et `RETURN` sur le site) pour le **prochain jour ouvré** (`SCRAPER_DATE` pour en choisir un autre), en conservant les cases « - » des fiches pour que chaque colonne reste une course.

Avec Docker, c'est automatique (voir plus haut). Sans Docker :

```bash
docker run -d -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest
bun run scrape              # lignes déjà connues
bun run scrape -- --full    # toutes les lignes de 1 à 300, plus U
bun run scrape -- 87 U      # seulement ces lignes
```

Ou via l'API, avec `ADMIN_TOKEN` défini :

```bash
curl -X POST "http://localhost:3000/api/data/refresh?mode=smart" -H "Authorization: Bearer $ADMIN_TOKEN"
```

Le rafraîchissement tourne en arrière-plan (suivi sur `/api/data/status`). Une ligne en échec garde son ancien fichier, et le réseau est rechargé à chaud à la fin.

### Limites connues

- **Horaires de semaine** : un seul jour est récupéré (le prochain jour ouvré). Les horaires du samedi, du dimanche et des vacances ne sont pas encore distingués.
- **Données du dépôt** : les fichiers de `data/` sont à l'ancien format, sans le sens retour (déduit du sens aller et signalé `estimated: true`) et sans les cases « - » (courses reconstituées par alignement, voir [ROUTING_ALGORITHM.md](./ROUTING_ALGORITHM.md)). Un rafraîchissement les remplace par des données exactes.
- Sans serveur [OSRM](https://project-osrm.org/) (`OSRM_FOOT_URL`, `OSRM_CAR_URL`), les trajets sont dessinés d'arrêt en arrêt.

## Configuration

Toutes les variables sont décrites dans [`.env.example`](./.env.example) : port, dossier des données, OSRM, FlareSolverr, rafraîchissement automatique, jeton admin, CORS, niveau de logs.

## Développement

```bash
bun run test        # tests (vitest) : algorithmes, scraper, intégrité des données, API
bun run typecheck
bun run build       # compile dans dist/
```

```
src/
  api/          routes Express, validation, documentation OpenAPI
  network/      chargement des horaires, reconstitution des courses, modèle du réseau
  routing/      RAPTOR, planification d'itinéraires, géométries OSRM
  scraper/      scraper des fiches horaires et rafraîchissement
  lib/          temps, géographie, logs, erreurs HTTP
data/           horaires (<ligne>_horaires.json)
client/         interface web React
docker/osrm/    préparation des graphes OSRM
tests/          tests vitest
```

## Accès aux données

A l'heure actuelle, `Miawstral` n'a accès à **aucune** de vos données personnelles, et n'y aura jamais accès : nous voulons rester respectueux de vos données. Le projet est, et restera, open-source.

## Licence

Le projet est sous licence GPL-3.0. Référez-vous au fichier [LICENSE](LICENSE) pour voir les conditions.

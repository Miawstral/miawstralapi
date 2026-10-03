![](./Public/github_header.png)

*Projet indépendant, **non affilié** au [Réseau Mistral](https://www.reseaumistral.com/). Il utilise les données ouvertes publiées par le réseau sur [transport.data.gouv.fr](https://transport.data.gouv.fr/datasets/reseau-de-transport-urbain-de-la-metropole-toulon-provence-mediterranee).*

---

## Miawstral

Le [Réseau Mistral](https://www.reseaumistral.com/) est le réseau de transport en commun de la métropole Toulon Provence Méditerranée : bus, bateaux-bus et téléphérique du Faron. **Miawstral** en est une application web et une API publique, rapides et soignées :

- **Itinéraires** calculés avec [RAPTOR](./ROUTING_ALGORITHM.md) sur les horaires officiels : correspondances, marche, bateaux-bus, « partir à » ou « arriver à », n'importe quel jour couvert par les horaires, option accessible en fauteuil roulant, tracés réels des lignes.
- **Temps réel** : retards et courses supprimées dans les itinéraires et les prochains départs, **véhicules en direct sur la carte** (position GPS, cap, vitesse, retard), infos trafic.
- **Prochains départs** à chaque arrêt, des deux côtés de la rue, avec favoris.
- **Explorateur de lignes** : tracé officiel, arrêts, prochains passages, véhicules de la ligne en direct, perturbations.
- **« Jusqu'où aller en 30 min ? »** : carte isochrone de tous les arrêts atteignables depuis un point.
- **Recherche rapide ⌘K**, liens partageables pour chaque vue, export d'un trajet vers le calendrier, mode sombre, application installable (PWA).
- **API documentée** sur [`/docs`](http://localhost:3000/docs), avec console d'essai en direct.

## Démarrage rapide

### Avec Docker : tout en une commande

```bash
docker compose up -d --build
```

Ouvrez **http://localhost:3000** (application) et **http://localhost:3000/docs** (documentation de l'API).

| Service | Rôle |
| --- | --- |
| `app` | API + interface web. Télécharge les horaires officiels au démarrage puis les met à jour ; interroge le temps réel à la demande. |
| `osrm-prepare` | Premier lancement seulement : télécharge OpenStreetMap (≈ 80 Mo, Var) et prépare les trajets à pied (environ une minute). |
| `osrm-foot` | Tracés des trajets à pied sur la carte (les bus suivent les tracés officiels). |

Variables utiles : `MIAWSTRAL_PORT` (défaut 3000), `ADMIN_TOKEN` (active `POST /api/data/refresh`), `OSM_BBOX`. Toutes les options sont décrites dans [`.env.example`](./.env.example).

### Sans Docker

Prérequis : [Node.js](https://nodejs.org/) ≥ 20.12 et [bun](https://bun.sh/).

```bash
bun run setup             # dépendances de l'API et de l'interface
bun run dev               # API sur :3000 + interface sur http://localhost:5173
```

En production : `bun run client:build && bun run build && bun start` (l'API sert l'interface sur `/`).

## API

Documentation interactive : **`/docs`** (spécification OpenAPI : `/api/openapi.json`).

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/stops` · `/api/stops/search?q=` · `/api/stops/nearby?lat=&lon=` | Arrêts |
| GET | `/api/stops/:id` | Arrêt, lignes et horaires de passage |
| GET | `/api/stops/:id/departures?time=&date=` | Prochains départs **avec le temps réel** |
| GET | `/api/lines` · `/api/lines/:id` · `/api/lines/:id/shape` | Lignes, arrêts et horaires, tracé officiel |
| POST | `/api/routes/calculate` | Itinéraires (départ ou arrivée, date, PMR…) avec retards et alertes |
| GET | `/api/isochrone?stopId=&maxDuration=` | Arrêts atteignables et temps de trajet |
| GET | `/api/realtime/vehicles` | Véhicules en circulation (position, retard, prochain arrêt) |
| GET | `/api/realtime/alerts` | Infos trafic |
| GET | `/api/health` · `/api/data/status` | État du service et des données |

```bash
curl -X POST http://localhost:3000/api/routes/calculate \
  -H 'Content-Type: application/json' \
  -d '{ "from": { "stopId": "SECENN" }, "to": { "lat": 43.1255, "lon": 5.9301 }, "arrivalTime": "09:00" }'
```

Les listes d'arrêts et de lignes sont compressées et servies avec `ETag` / `Cache-Control` ; les calculs d'itinéraires et d'isochrones sont limités à 120 requêtes par minute et par IP (`RATE_LIMIT_PER_MINUTE`).

## Données

| Source | Contenu | Mise à jour |
| --- | --- | --- |
| [GTFS](https://transport.data.gouv.fr/datasets/reseau-de-transport-urbain-de-la-metropole-toulon-provence-mediterranee) | Horaires théoriques, calendriers, arrêts, tracés, accessibilité, couleurs | Vérifiée toutes les 12 h (`GTFS_REFRESH_HOURS`), téléchargement conditionnel |
| GTFS-RT VehiclePosition | Position des véhicules | À la demande, cache 10 s |
| GTFS-RT TripUpdate | Retards, courses supprimées | À la demande, cache 20 s |
| GTFS-RT Alert | Perturbations | À la demande, cache 2 min |

Données publiées par le Réseau Mistral (RATP Dev) sous licence ouverte. Fonds de carte © [OpenFreeMap](https://openfreemap.org), © [OpenMapTiles](https://openmaptiles.org), © contributeurs [OpenStreetMap](https://www.openstreetmap.org/copyright).

## Développement

```bash
bun run test        # tests (vitest) : GTFS, RAPTOR, temps réel, API
bun run typecheck
bun run build
```

```
src/
  gtfs/         lecture du GTFS, calendriers, réseau d'un jour de service
  realtime/     flux GTFS-RT (véhicules, retards, alertes) et enrichissement
  network/      modèle du réseau, tracés
  routing/      RAPTOR, itinéraires, isochrones, géométries
  api/          routes Express, validation, cache, limitation de débit, OpenAPI
client/         application React (carte MapLibre/Leaflet, PWA) et page /docs
docker/osrm/    préparation du graphe piéton OSRM
tests/          tests vitest (mini GTFS de test dans tests/fixtures)
```

## Accès aux données

`Miawstral` n'a accès à **aucune** de vos données personnelles : les favoris et recherches récentes restent dans votre navigateur. Le projet est, et restera, open-source.

## Licence

GPL-3.0. Voir [LICENSE](LICENSE).

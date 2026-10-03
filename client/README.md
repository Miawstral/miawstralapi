# Miawstral · client web

Interface web de Miawstral, le calculateur d'itinéraires du Réseau Mistral (Toulon) :
recherche d'arrêts, calcul d'itinéraires, carte interactive (tracés, arrêts, prochains départs).

Stack : Vite, React 19, TypeScript, Tailwind CSS, Leaflet (`react-leaflet`) avec un fond de carte
vectoriel MapLibre ([OpenFreeMap](https://openfreemap.org), sans clé d'API), police Geist.

Design : carte plein écran, panneau flottant (tiroir sur mobile), palette neutre où seules les
couleurs des lignes ressortent, thème clair/sombre selon le système. Les recherches sont
partageables par l'URL (`?from=MISTRAL:SIBRUE&to=MISTRAL:TOLIBI&t=08:00`).

## Démarrage

```bash
bun install
bun run dev      # http://localhost:5173
```

Le serveur de développement redirige `/api` vers le backend sur `http://localhost:3000`.
Depuis la racine du dépôt, `bun run dev` lance les deux à la fois.
Si le backend tourne sur un autre port : `API_PROXY_TARGET=http://localhost:3001 bun run dev`.

## Build

```bash
bun run build    # vérification TypeScript + build dans dist/
bun run lint
```

Le backend sert automatiquement `client/dist` sur `/` quand ce dossier existe.

## Configuration

| Variable              | Rôle                                                                          |
| --------------------- | ----------------------------------------------------------------------------- |
| `VITE_API_URL`        | URL du backend, si l'API n'est pas servie sur la même origine (défaut : vide). |
| `API_PROXY_TARGET`    | Cible du proxy `/api` en développement (défaut : `http://localhost:3000`).     |

Exemple : `VITE_API_URL=https://api.example.org bun run build`.

## Organisation

- `src/lib/api.ts` : client HTTP typé (gestion des erreurs `{ success: false, message }`).
- `src/types.ts` : types de l'API, copiés de `src/interfaces/` du backend.
- `src/components/planner` : formulaire (recherche d'arrêts, options).
- `src/components/results` : liste des itinéraires et détail des étapes.
- `src/components/map` : carte Leaflet (itinéraire, arrêts, popups).

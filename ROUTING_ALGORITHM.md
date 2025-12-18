# Algorithme de Routage - Réseau Mistral

## Architecture

Ce système utilise un **algorithme hybride optimisé** inspiré du **Connection Scan Algorithm (CSA)** utilisé par les applications professionnelles de transport en commun.

## Composants

### 1. Connection Scan Algorithm (CSA)
**Fichier:** `routing-algorithm.service.ts`

#### Principe
- Chaque "connection" = un bus allant d'un arrêt A à B à une heure précise
- Base de données pré-calculée de toutes les connections possibles
- Recherche par nombre de correspondances (0, 1, 2...)

#### Avantages
- ✅ **Optimal garanti** : trouve toujours le meilleur chemin
- ✅ **Ultra rapide** : O(n) où n = nombre de connections scannées
- ✅ **Basé sur les horaires réels** : pas d'approximation
- ✅ **Priorise les lignes directes** : cherche d'abord 0 correspondance, puis 1, puis 2

#### Complexité
- Preprocessing : O(S × T) où S = arrêts, T = horaires (fait une fois au démarrage)
- Requête : O(C) où C = connections scannées
- Mémoire : ~10-50MB pour un réseau urbain typique

### 2. Round-Based Public Transit Routing (inspiré de RAPTOR)
**Utilisé dans:** `findJourneyWithNTransfers()`

#### Principe
- Itération par "round" = par nombre de correspondances
- Round 0 : lignes directes uniquement
- Round 1 : trajet avec 1 correspondance
- Round 2 : trajet avec 2 correspondances

#### Avantages
- ✅ Garantit le nombre minimal de correspondances
- ✅ Efficace pour les petits réseaux (< 2000 arrêts)
- ✅ Facile à comprendre et debugger

### 3. Optimisations Implémentées

#### Merge Connections
```typescript
journeyToSteps(journey)
```
Fusionne les connections consécutives sur la même ligne pour éviter d'afficher :
- ❌ Bus 81 : A → B (1 arrêt)
- ❌ Bus 81 : B → C (1 arrêt)
- ✅ Bus 81 : A → C (2 arrêts)

#### Scoring Intelligent
```typescript
transferScore = transfers × 1800
durationScore = duration × 1
```
Une correspondance coûte l'équivalent de **30 minutes** :
- Ligne directe de 45 min >> Trajet avec 1 correspondance de 30 min
- Comportement similaire à Google Maps / Citymapper

#### Validation des Horaires
- Rejette les durées aberrantes (< 1 min ou > 120 min entre arrêts)
- Gère la traversée de minuit (23:50 → 00:10)
- Valide que départ < arrivée pour chaque connection

## Comparaison avec d'autres algorithmes

| Algorithme | Temps | Optimalité | Complexité | Utilisé par |
|------------|-------|------------|------------|-------------|
| **CSA** (notre choix) | O(C) | ✅ Optimal | Simple | Öffi, Rome2Rio |
| **RAPTOR** | O(R × S) | ✅ Optimal | Moyenne | Google Maps |
| **Transfer Patterns** | O(1)* | ✅ Optimal | Complexe | Uber, Lyft |
| **A*** | O(E log V) | ❌ Sous-optimal | Simple | Navigation GPS |
| **Dijkstra** | O(E log V) | ⚠️ Sans horaires | Simple | OpenStreetMap |

*après preprocessing lourd

## Performance Attendue

### Réseau Mistral (estimations)
- Arrêts : ~1060
- Lignes : ~55
- Connections : ~50,000-100,000
- Preprocessing : **~2-5 secondes** au démarrage
- Requête moyenne : **< 100ms**
- Requête complexe : **< 500ms**

### Optimisations Futures Possibles
1. **Cache des journeys fréquents** (A→B populaires)
2. **Spatial indexing** (R-tree pour recherche géographique)
3. **Parallel scanning** (multi-threading pour grandes requêtes)
4. **Transfer Patterns** (si le réseau devient très grand)

## Pourquoi pas A* ?

A* est excellent pour :
- ✅ Navigation routière (heuristique = distance à vol d'oiseau)
- ✅ Jeux vidéo (pathfinding sur grille)
- ✅ Robotique (espace continu)

Mais **inadapté** pour le transport en commun :
- ❌ L'heuristique spatiale ne fonctionne pas (un arrêt proche géographiquement peut être très loin en temps)
- ❌ Ne gère pas naturellement les horaires
- ❌ Peut manquer des solutions optimales (exemple : petit détour → ligne directe)

## Références

- [Connection Scan Algorithm Paper](https://arxiv.org/abs/1703.05997)
- [RAPTOR Algorithm](https://www.microsoft.com/en-us/research/wp-content/uploads/2012/01/raptor_alenex.pdf)
- [Google Maps Routing](https://blog.google/products/maps/google-maps-101-how-we-map/)

# Calcul d'itinéraires — Réseau Mistral

Le calcul se fait en trois temps : le GTFS officiel donne les **courses** du jour de service, regroupées en **motifs** ; chaque requête lance ensuite **RAPTOR** plusieurs fois pour proposer des alternatives, puis les itinéraires sont enrichis par le **temps réel**.

## 1. Les courses d'un jour de service

`src/gtfs/`

Les horaires viennent du GTFS officiel du Réseau Mistral. Pour une date, les services actifs sont calculés à partir de `calendar.txt` (jours de la semaine, période de validité) et de `calendar_dates.txt` (ajouts et suppressions : jours fériés, vacances). Seules les courses de ces services forment le réseau du jour, construit en ≈ 50 ms et gardé en cache.

Un jour de service va de 3 h à 3 h : une course à `24:30:00` circule à 00 h 30 le lendemain. À 00 h 30, l'application interroge donc le service de la veille.

## 2. Le modèle du réseau

`src/network/network.ts`, construit pour chaque jour de service demandé :

- **arrêts** indexés par identifiant, avec les lignes qui les desservent ;
- **motifs** (*routes* dans RAPTOR) : courses d'une même ligne ayant exactement la même suite d'arrêts, triées par heure de départ. Quand aucune course n'en dépasse une autre (propriété FIFO), la recherche de la première course utilisable est une recherche dichotomique ;
- **correspondances à pied** entre arrêts distants de moins de 300 m (distance à vol d'oiseau × 1,3, à 4,8 km/h).

## 3. RAPTOR

`src/routing/raptor.ts` — *Round-bAsed Public Transit Optimized Router*, [Delling, Pajor, Werneck, 2012](https://www.microsoft.com/en-us/research/wp-content/uploads/2012/01/raptor_alenex.pdf).

Le tour *k* calcule l'heure d'arrivée au plus tôt à chaque arrêt en empruntant au plus *k* véhicules :

1. on parcourt chaque motif passant par un arrêt amélioré au tour précédent, à partir de cet arrêt ;
2. le long du motif, on garde la course la plus tôt possible : on y monte si on est à l'arrêt avant son passage (avec **2 min de correspondance** minimum après un autre bus) et on améliore les arrêts suivants ;
3. on relâche les correspondances à pied depuis les arrêts atteints en bus.

Le départ et l'arrivée sont des ensembles d'arrêts accessibles à pied (`maxWalkingDistance`). Les élagages classiques sont appliqués : on n'améliore un arrêt que si on bat la meilleure heure connue à cet arrêt *et* la meilleure heure d'arrivée à destination.

À la fin de chaque tour, si la destination est atteinte plus tôt qu'avec moins de véhicules, on obtient un nouvel itinéraire **Pareto-optimal** (heure d'arrivée, nombre de correspondances) : par exemple un direct à 7 h 30 et un trajet avec une correspondance à 7 h 14.

## 4. Itinéraires proposés

`src/routing/planner.ts`

- RAPTOR est relancé juste après le départ le plus tôt trouvé, jusqu'à 8 fois, pour proposer les départs suivants.
- Les itinéraires dominés (partir plus tôt pour arriver plus tard avec autant de correspondances) sont écartés, ainsi que ceux plus lents que la marche.
- Un itinéraire **entièrement à pied** est proposé quand la destination est à moins de 2 km.
- On part « juste à temps » : l'heure de départ affichée est celle où il faut quitter le point de départ pour attraper le premier bus.
- Les trajets en bus suivent le **tracé officiel** (`shapes.txt`), découpé entre l'arrêt de montée et celui de descente grâce à `shape_dist_traveled`. Les trajets à pied sont demandés à OSRM s'il est configuré.
- **Arriver à** : des recherches au plus tôt sont lancées en partant de plus en plus tôt (toutes les 4 minutes sur 3 heures), en gardant les trajets qui arrivent à temps ; RAPTOR est assez rapide pour cela (≈ 20 ms en tout).
- **Accessibilité** : avec l'option PMR, on ne monte et on ne descend qu'aux arrêts accessibles (`wheelchair_boarding`).

## 5. Temps réel

`src/realtime/`

Les trois flux GTFS-RT sont lus à la demande et gardés quelques secondes en cache. Les retards d'une course (`TripUpdate`) sont propagés le long de ses arrêts selon la règle GTFS-RT : un arrêt sans mise à jour hérite du retard du dernier arrêt mis à jour avant lui. Ils servent aux prochains départs (triés par heure prévue), aux itinéraires (heures prévues de montée et de descente, courses supprimées) et aux véhicules en direct (`VehiclePosition`). Les perturbations (`Alert`) sont rattachées aux lignes des itinéraires.

## 6. Isochrones

`reachability()` lance RAPTOR sans destination : on obtient l'heure d'arrivée au plus tôt à chaque arrêt du réseau, d'où la carte « jusqu'où aller en 30 minutes » (≈ 10 ms).

## Performances

Un jour de semaine compte ≈ 60 lignes, 2 000 arrêts et 4 000 courses. Une requête d'itinéraire prend entre 5 et 20 ms, une isochrone ≈ 10 ms, la lecture du GTFS complet ≈ 1 s au démarrage.

## Pistes

- RAPTOR inversé pour « arriver à » (au lieu de l'échantillonnage actuel).
- rRAPTOR (*range RAPTOR*) pour obtenir tous les départs d'une plage horaire en un seul calcul.
- Temps de marche issus d'OSRM dans le calcul, et plus seulement pour l'affichage.
- Utiliser les heures prévues en temps réel dans RAPTOR lui-même (aujourd'hui, elles annotent les itinéraires calculés sur les horaires théoriques).

# Calcul d'itinéraires — Réseau Mistral

Le calcul se fait en trois temps : les fiches horaires sont transformées en **courses**, regroupées en **motifs** au démarrage ; chaque requête lance ensuite **RAPTOR** plusieurs fois pour proposer des alternatives.

## 1. Des fiches horaires aux courses

`src/network/trip-builder.ts`

Une fiche horaire est une grille : une ligne par arrêt, une colonne par course, « - » quand la course ne dessert pas l'arrêt. Une **course** est la suite `(arrêt, heure)` d'un véhicule.

- **Format v2** (scraper actuel) : les « - » sont conservés (`null`), chaque colonne est donc une course.
- **Format v1** (données historiques) : les « - » avaient été supprimés. Les heures d'un arrêt restent dans l'ordre des colonnes, mais on ne sait plus à quelle colonne chacune appartient. L'ancien code associait `times[i]` d'un arrêt à `times[i]` du suivant, ce qui donnait des horaires incohérents sur 22 des 45 lignes (branches, services partiels).

  Les courses sont reconstituées arrêt par arrêt par un **alignement qui préserve l'ordre** (programmation dynamique, comme une distance d'édition) entre les courses en cours et les heures de l'arrêt :
  - prolonger une course coûte le nombre de minutes écoulées (au plus 30 min, plus 3 min par arrêt sauté, plafonné à 60) ;
  - commencer une nouvelle course coûte 30 ;
  - une course peut sauter l'arrêt sans coût.

  Sur les données du dépôt, 99,9 % des horaires sont rattachés à une course et le nombre de courses correspond au nombre de colonnes des fiches (vérifié par `tests/data.test.ts`).

Les courses qui passent minuit sont « déroulées » (`23:55 → 24:05`). Quand un seul sens d'une ligne est connu, le sens opposé est **estimé** en inversant les courses (mêmes temps de parcours, mêmes heures de départ depuis l'autre terminus) et marqué `estimated`.

## 2. Le modèle du réseau

`src/network/network.ts`, construit une fois au démarrage (≈ 150 ms) puis après chaque rafraîchissement :

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
- Les tracés sont demandés à OSRM en parallèle (un appel par étape, avec tous les arrêts intermédiaires), mis en cache, et ignorés pendant une minute si OSRM ne répond pas. Sans OSRM, les trajets passent par les coordonnées des arrêts.

## Performances

Sur le réseau actuel (45 lignes, 1 060 arrêts, ≈ 3 200 courses, ≈ 250 motifs), une requête complète prend entre 2 et 20 ms sans les tracés OSRM.

## Pistes

- Requête « arriver avant » (RAPTOR inversé).
- Calendriers (semaine, week-end, vacances scolaires) dès que le scraper récupère plusieurs dates.
- rRAPTOR (*range RAPTOR*) pour obtenir tous les départs d'une plage horaire en un seul calcul.
- Temps de marche issus d'OSRM dans le calcul, et plus seulement pour l'affichage.

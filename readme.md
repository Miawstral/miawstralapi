![](./Public/github_header.png)

*Cette librairie **n'est en aucun cas** lié à [Réseau Mistral](https://www.reseaumistral.com/) et est réalisé en utilisant des données accessibles publiquement.*
--- 

## Avant tout, qu'est ce que "Réseau Mistral" ?  
[Le Réseau Mistral](https://www.reseaumistral.com/) est le réseau de transport en commun de la métropole Toulon Provence Méditerranée. Il regroupe différents moyens de transport, tels que des bus, des bateaux-bus, et des lignes de transport scolaire, permettant de desservir efficacement les communes de la région toulonnaise. Géré par Régie des Transports Métropolitains Toulon (RMTT), il propose un ensemble de services aux usagers via son site web, son application mobile, et divers outils numériques.


## Implementations 

| [JavaScript/TypeScript](https://github.com/Ivy-js/miawstral/tree/javascript) | [Python](https://github.com/Ivy-Js/miawstral/tree/python) 
| :---:  | :---: |

## Tech Stack 

Pour Miawstral, j'utilise globalement du NodeJS pour récupèrer les arrêts et les informations fournies par [Réseau Mistral](https://www.reseaumistral.com/), afin de contourner la sécurité fournie par [Cloudflare](https://cloudflare.com/) j'ai utilisé le proxy [FlareSolverr](https://github.com/FlareSolverr/FlareSolverr). J'ai fait tourner l'image Docker sur le port `8191 (par défaut)` afin de recevoir les données. 

## Accès aux données
A l'heure actuelle, `Miawstral` n'a accès a **aucune** de vos données personnelles. Et elle n'y aura jamais accès car nous voulons rester respectueux de vos données. Le projet est, et restera open-source.


## License

Le projet est sous license GPL-3.0 License. Référez-vous au fichier [LICENSE](LICENSE) pour voir les conditions. 
# Réseau

Un réseau électrique en simulation : des centrales à démarrer ou non, des lignes où le courant suit les lois de
Kirchhoff et non un chemin choisi, une demande, du vent et du soleil tirés par graine, des batteries et des barrages ;
puis les pannes, une ligne qui tombe et la charge qui se reporte sur les autres, jusqu'à la cascade.

Client de [`mcts-commun`](../mcts-commun/README.md). La recherche sera choisie par la mesure, contre l'ordre de préséance économique avec une marge de réserve, et la règle N-1.

**État** (14/11/2026, version 0.2.0) : le cadrage est fait (`docs/recherche/`, les réponses de Sami dans
`questions.md`), le modèle écrit (`docs/modele.md`). J1 : le calcul DC des flux sur les IEEE 14, 30 et 118 de
PGLib-OPF, les facteurs de report (PTDF, LODF). J2 : la cascade, avec la règle de Grid2Op, et sa mesure
(`docs/mesures/cascade-j2.md`). La page montre la carte, coupe une ligne, lance la cascade et la rejoue pas à pas.
La suite, la répartition au moindre coût (J3), attend le solveur QP de `mcts-commun`.

## Les commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm install` | installe les outils, relie `mcts-commun` et active le hook de commit |
| `npm run check` | le lint, les types, puis les tests ; c'est ce que lance le hook |
| `npm run lint` (`lint:fix`) | eslint, avec le budget de complexité de lopin |
| `npm run types` | tsc vérifie le JavaScript d'après ses commentaires JSDoc, sans rien compiler |
| `npm test` (`test:coverage`) | les tests de `node --test`, dont la longueur des `.md` et les empreintes du modèle |
| `npm run page` | la page, sur http://127.0.0.1:4808/web/ ; l'état se partage par l'adresse (`#ouvertes=1-2&conso=1.3`) |
| `node scripts/cascade-sweep.js [paires] [graine]` | la mesure du J2, par un créneau (`mcts-backlog --slot 1 -- …`), 25 s |
| `npm run changelog` | `web/changelog.html` depuis `docs/changelog.json`, après une nouvelle version |

Les règles du dépôt sont dans [`CLAUDE.md`](CLAUDE.md).

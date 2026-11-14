# Réseau

Un réseau électrique en simulation : des centrales à démarrer ou non, des lignes où le courant suit les lois de
Kirchhoff et non un chemin choisi, une demande, du vent et du soleil tirés par graine, des batteries et des barrages ;
puis les pannes, une ligne qui tombe et la charge qui se reporte sur les autres, jusqu'à la cascade.

Client de [`mcts-commun`](../mcts-commun/README.md). La recherche sera choisie par la mesure, contre l'ordre de préséance économique avec une marge de réserve, et la règle N-1.

**État** (14/11/2026, version 0.1.0) : le cadrage est fait (`docs/recherche/`, les réponses de Sami dans
`questions.md`), le modèle écrit (`docs/modele.md`). Le J1 est là : le calcul DC des flux sur les IEEE 14, 30 et 118 de
PGLib-OPF, les facteurs de report (PTDF, LODF), et la page, où l'on coupe une ligne pour voir son flux se reporter.
La suite, la cascade (J2), est dans `docs/recherche/pistes.md`.

## Les commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm install` | installe les outils, relie `mcts-commun` et active le hook de commit |
| `npm run check` | le lint, les types, puis les tests ; c'est ce que lance le hook |
| `npm run lint` (`lint:fix`) | eslint, avec le budget de complexité de lopin |
| `npm run types` | tsc vérifie le JavaScript d'après ses commentaires JSDoc, sans rien compiler |
| `npm test` (`test:coverage`) | les tests de `node --test`, dont la longueur des `.md` et les empreintes du modèle |
| `npm run page` | la page, sur http://127.0.0.1:4808/web/ ; l'état se partage par l'adresse (`#ouvertes=1-2&conso=1.3`) |
| `npm run changelog` | `web/changelog.html` depuis `docs/changelog.json`, après une nouvelle version |

Les règles du dépôt sont dans [`CLAUDE.md`](CLAUDE.md).

# Réseau

Un réseau électrique en simulation : des centrales à démarrer ou non, des lignes où le courant suit les lois de
Kirchhoff et non un chemin choisi, une demande, du vent et du soleil tirés par graine, des batteries et des barrages ;
puis les pannes, une ligne qui tombe et la charge qui se reporte sur les autres, jusqu'à la cascade.

Client de [`mcts-commun`](../mcts-commun/README.md). La recherche sera choisie par la mesure, contre l'ordre de préséance économique avec une marge de réserve, et la règle N-1.

**État** : la recherche du cadrage est écrite (`docs/recherche/`, 14/11/2026) : la physique, les bancs, les méthodes
publiées, les pistes classées et les questions pour Sami. Pas de code avant ses réponses ; le modèle
(`docs/modele.md`) suivra.

## Les commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm install` | installe les outils, relie `mcts-commun` et active le hook de commit |
| `npm run check` | le lint, les types, puis les tests ; c'est ce que lance le hook |
| `npm run lint` (`lint:fix`) | eslint, avec le budget de complexité de lopin |
| `npm run types` | tsc vérifie le JavaScript d'après ses commentaires JSDoc, sans rien compiler |
| `npm test` (`test:coverage`) | les tests de `node --test`, dont la longueur des `.md` |

Les règles du dépôt sont dans [`CLAUDE.md`](CLAUDE.md).

# Réseau

Un réseau électrique en simulation : des centrales à démarrer ou non, des lignes où le courant suit les lois de
Kirchhoff et non un chemin choisi, une demande, du vent et du soleil tirés par graine, des batteries et des barrages ;
puis les pannes, une ligne qui tombe et la charge qui se reporte sur les autres, jusqu'à la cascade.

Client de [`mcts-commun`](../mcts-commun/README.md). La recherche sera choisie par la mesure, contre l'ordre de préséance économique avec une marge de réserve, et la règle N-1.

**État** (17/11/2026, version 0.4.2) : le cadrage est fait (`docs/recherche/`, les réponses de Sami dans
`questions.md`), le modèle écrit (`docs/modele.md`). J1 : le calcul DC des flux sur les IEEE 14, 30 et 118 de
PGLib-OPF, les facteurs de report (PTDF, LODF). J2 : la cascade, avec la règle de Grid2Op, et sa mesure
(`docs/mesures/cascade-j2.md`). J3 : la répartition au moindre coût (le DC-OPF, par le solveur `qp` de
`mcts-commun`), qui retrouve les coûts publiés par PGLib-OPF, ses prix nodaux, la règle N-1 et son prix
(`docs/mesures/opf-j3.md`). L'état du modèle est la moins chère qui tient la règle N-1 tant qu'elle existe ; au-delà,
celle dont la pire charge après une perte est la plus faible ; les cascades sont remesurées depuis l'une et l'autre (`docs/mesures/cascade-n1.md`,
`cascade-j3.md`), et la distribution de leurs tailles (`cascade-queue.md`). J4 : la journée de RTS-GMLC à l'heure, la liste de préséance avec
réserve, réglée sur les jours pairs de 2020 et mesurée sur les impairs (`docs/mesures/journee-j4.md`), contre la règle N-1
(`journee-n1.md`) et dans ses cascades (`rts-cascades.md`) ; la liste N-1, la seconde règle à battre, qui répartit
chaque heure sous la règle N-1 (`journee-liste-n1.md`). La page montre
la carte, la répartition et ses prix, coupe une ligne, lance la cascade et la rejoue pas à pas.

## Les commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm install` | installe les outils, relie `mcts-commun` et active le hook de commit |
| `npm run check` | le lint, les types, puis les tests ; c'est ce que lance le hook |
| `npm run lint` (`lint:fix`) | eslint, avec le budget de complexité de lopin |
| `npm run types` | tsc vérifie le JavaScript d'après ses commentaires JSDoc, sans rien compiler |
| `npm test` (`test:coverage`) | les tests de `node --test`, dont la longueur des `.md` et les empreintes du modèle |
| `npm run page` | la page, sur http://127.0.0.1:4808/web/ ; l'état se partage par l'adresse (`#ouvertes=1-2&conso=1.3`) |
| `node scripts/cascade-sweep.js [paires] [graine] [secure\|cost\|pmax]` | les cascades, par un créneau (`mcts-backlog --slot 1 -- …`) : sous la répartition du modèle (N-1 tant qu'elle existe, 35 s), au moindre coût (J3, 35 s) ou celle du J2 (25 s) |
| `node scripts/cascade-tail.js [secure|cost] [triplets] [graine]` | la queue des tailles de panne : toutes les pertes simples et les paires, des triplets tirés par graine, par un créneau ; 7 min |
| `node scripts/rts-fetch.js`, puis `node scripts/rts-convert.js` | RTS-GMLC : télécharge les 50 Mo du dépôt épinglé dans `data/rts-gmlc/brut/` (hors de git), puis réécrit `data/rts_gmlc*.json*` |
| `npx mcts-race races/j4-regle.json --follow` | le réglage de la liste de préséance (J4) : 18 variantes sur les jours pairs de 2020, par la file |
| `node scripts/day-measure.js <variantes…>` | la mesure du J4 sur les 183 jours impairs, chaque variante contre la première, par un créneau |
| `node scripts/day-n1.js [variante] [sortie]`, `node scripts/rts-cascades.js [heures] [variante] [sortie]` | la règle N-1 sur les 8 784 heures d'une variante (la liste réglée : 2 min, la liste N-1 `v0.3-h12-n1` : 4 min) ; ses cascades à des heures réparties sur les charges de l'année (240 heures : 11 min) ; par la file |
| `node scripts/rts-cascade-causes.js [fichier] [variante]` | la première ligne tombée et les îlots des grandes pannes des heures fragiles ; 2 min, par un créneau |
| `node scripts/opf-measure.js` | la mesure du J3 : la validation contre PGLib, la charge maximale, le prix de la sécurité ; 10 s |
| `npm run changelog` | `web/changelog.html` depuis `docs/changelog.json`, après une nouvelle version |

Les règles du dépôt sont dans [`CLAUDE.md`](CLAUDE.md).

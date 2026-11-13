# Les méthodes publiées : les règles, les recherches, les solveurs

Lu les 13 et 14/11/2026. Ce fichier dit ce qui a été essayé ailleurs, et ce qu'on en attend ici. Les attentes chiffrées
sont des **hypothèses** tant qu'aucune mesure ne les a confirmées.

## 1. Les règles à battre

**La liste de préséance** (*priority list*) : on classe les centrales par préférence, en général par coût du
combustible, et on en démarre autant qu'il faut, période par période (de Mars, 2022, § 2 et § 3.7). C'est la plus
simple et la plus rapide des méthodes de démarrage. Elle ignore les lignes : la répartition qui suit peut surcharger
le réseau.

**La marge de réserve** : on démarre plus que la demande prévue, pour couvrir l'erreur de prévision et la perte d'un
groupe. RTS-GMLC publie des **besoins de réserve** par zone et par heure (dossier `Reserves`), ce qui fixe la marge
sans l'inventer. Sinon, **hypothèse** : le plus gros groupe en marche plus un pourcentage de la demande.

**La règle N-1** ([physique.md](physique.md) § 4) : on refuse tout état où la perte d'une seule ligne surchargerait
une autre ; la répartition est corrigée d'avance (préventif) ou un remède est prêt (curatif).

**Le MILP** : la méthode de l'industrie pour le démarrage (programmation linéaire en nombres entiers, sur 24 à 48
heures). De Mars : elle est « mal adaptée aux systèmes très aléatoires ». Nous n'en écrirons pas : c'est l'étalon des
articles, pas notre règle à battre.

## 2. La recherche arborescente pour le démarrage

**De Mars (thèse UCL, 20/10/2022)**, « Reinforcement Learning and Tree Search Methods for the Unit Commitment
Problem » :
- **La méthode** : la *recherche arborescente guidée*. Une politique apprise élague le choix des groupes à démarrer à
  chaque heure (2^n combinaisons sans elle), puis une recherche (coût uniforme, puis IDA*) explore les heures qui
  suivent avec le modèle du réseau. C'est exactement notre `beam` guidé par une règle.
- **Les données** : le réseau de Grande-Bretagne (demande et vent réels), jusqu'à **100 groupes**, « le plus grand
  de la littérature » pour ces méthodes. L'étalon classique est le problème de Kazarlis : 10 groupes, 24 heures.
- **Les résultats** (résumé, verbatim) : compétitive avec le démarrage déterministe, **jusqu'à 1,4 % de coût en
  moins** ; avec les pannes de groupes, **plus de 2 % d'économie** face aux critères de réserve conventionnels. La
  recherche « apprend des marges de réserve économiques et robustes ».

**O'Malley, de Mars, Badesa et Strbac (arXiv 2212.04824, 2022)** : sur un grand jeu de jours, le MILP déterministe
et stochastique « produisent régulièrement des plannings moins chers que l'apprentissage par renforcement » ; plus de
deux fois le coût pour 50 groupes. L'hybride (l'apprentissage propose, le MILP stochastique finit) gagne 0,3 %.

**Ce qu'on en tire** : une politique seule ne suffit pas ; la recherche avec un modèle bat les règles de réserve,
de quelques pour cent. **Hypothèse** pour notre P7 : 1 à 3 % de coût en moins à énergie non distribuée égale, contre
la liste de préséance avec réserve, sur RTS-GMLC.

## 3. La conduite en temps réel : ce qu'ont appris les L2RPN

**Marot et al. 2021** (rétrospective de NeurIPS 2020, PMLR 133, lue en entier) :
- « **Tous les agents par apprentissage simulent aussi en ligne** pour choisir une action parmi les meilleures
  proposées : ils ne se fiaient pas entièrement à leurs décisions. »
- **Le deuxième de la piste adaptabilité**, kunjietang, était « un simple système expert qui simule une liste ordonnée
  et limitée de **200 actions de topologie** » ; le 5e de la piste robustesse aussi. Cela « borne la valeur ajoutée de
  l'apprentissage » sur ces problèmes.
- Toutes les équipes ont **réduit les actions à 1 000 au plus**, et ajouté des règles d'expert : ne rien faire si
  aucune ligne n'est près de sa limite, reconnecter les lignes dès que possible, revenir à la topologie initiale.
- « **La validation des actions par simulation était indispensable.** »
- Le gagnant (Baidu) : 1 000 actions retenues par des règles, une politique entraînée par évolution sur 5 000 cœurs.

**Dorfer et al. 2022** (arXiv 2211.05612, 1er du WCCI 2022) : AlphaZero, donc une **recherche MCTS**, avec une valeur
heuristique à la place d'un réseau de valeur et un arrêt précoce dès qu'une bonne solution est trouvée ; 72 958 actions
de topologie, réduites aux 2 000 plus fréquentes. Leur tableau (part des pas survécus) : force brute 61,1 % (153 ms
par pas) ; les 25 meilleures propositions simulées 65,3 % (34 ms) ; MCTS « oracle » 76,9 % (1,7 s) ; les 5 meilleures
topologies plus un redispatch 82,1 %. Le redispatch moyen baisse de 60 %.

**Lehna et al. 2023** (arXiv 2304.00765) : un agent à règles amélioré (le « Tutor » glouton, qui simule chaque action
et garde celle qui laisse la plus faible charge maximale, plus un contrôle N-1) atteint **la même performance** que
l'agent par apprentissage ; l'apprentissage garde l'avantage du temps de calcul.

**Lan et al. 2019** (gagnant de 2019) : imitation, exploration guidée et une alerte précoce.

**Ce qu'on en tire** : la règle à battre en conduite est **le glouton qui simule** une petite liste d'actions, pas
« ne rien faire ». Notre faisceau et notre ISMCTS doivent battre ce glouton à budget de simulation égal. C'est aussi la
place naturelle de MCTS dans ce projet : Dorfer y gagne 11 points sur le top-25, au prix de 50 fois le temps.

## 4. Les barrages : SDDP, plus tard

La programmation dynamique duale stochastique (Pereira et Pinto, 1991) gère un stock d'eau dans le temps sous
incertitude, par des coupes de Benders : l'outil des gestionnaires de parcs hydrauliques
(`mcts-commun/docs/algorithmes.md` § 5). RTS-GMLC a 20 groupes hydrauliques, mais leurs séries sont des profils
imposés, pas des réservoirs ; il faudra un réservoir à nous (**hypothèse**). Pas avant que le reste tienne.

## 5. Les solveurs QP, et la demande à commun

**Le problème** ([physique.md](physique.md) § 3) : minimiser ½ pᵀQp + cᵀp sous une égalité (l'équilibre), des bornes
(Pmin, Pmax) et 2 × lignes inégalités denses (les limites, par la PTDF), plus les écarts d'angle pour comparer à
PGLib. **Q est diagonale et souvent nulle** : les coûts de PGLib sont linéaires, ceux de RTS-GMLC sont des courbes en
4 segments (donc linéaires par morceaux). C'est souvent un **LP**.

| Solveur | Ce qu'il résout | Pour nous |
|---|---|---|
| **Goldfarb et Idnani (1983)**, dual à ensemble actif | QP **strictement** convexe, égalités et inégalités générales ; le paquet JS `quadprog` (MIT) en est un portage direct du Fortran de R | petit, dense, se relance de l'ensemble actif précédent ; il faut ajouter un ε à Q pour les coûts linéaires |
| **OSQP** (ADMM) | `l ≤ Ax ≤ u`, Q semi-définie (donc les LP aussi) ; interfaces C, Python, Matlab, Julia, R, **aucune en JS** | robuste, mais une précision moyenne et beaucoup d'itérations pour une tolérance fine (doc) |
| **HiGHS** (MIT) | LP, MIP et QP convexe (ensemble actif primal) ; `highs-js` le compile en WebAssembly, Node et navigateur, un seul fil | une dépendance lourde, mais un **oracle** idéal pour tester notre solveur, et un MIP si on voulait l'étalon MILP |

**La forme de la demande** (postée à commun au tableau le 14/11) :

| | IEEE 14 (PGLib) | IEEE 118 | RTS-GMLC |
|---|---|---|---|
| Variables (productions) | 5 (2 utiles) | 54 | 73 thermiques + renouvelables écrêtables + stockage, ~160 |
| Égalités | 1 (ou 14 avec les angles) | 1 (ou 118) | 1 (ou 73) |
| Inégalités générales, denses | 2 × 20 | 2 × 186 | 2 × 120 |
| Avec le N-1 préventif | 2 × 20 × 19, presque toutes inactives | 2 × 186 × 185 | 2 × 120 × 119 |

**Ce qu'il nous faut du solveur** : des contraintes linéaires **générales** (pas seulement des bornes) ; Q
semi-définie (ou un ε documenté) ; les **multiplicateurs** (les prix nodaux, pour la page) ; le **redémarrage à chaud**
(le faisceau résout des milliers de répartitions voisines) ; l'ajout de contraintes au fil de l'eau (le N-1) ; un
diagnostic d'infaisabilité clair ; rien d'alloué dans la boucle chaude. **Notre recommandation** : un dual à ensemble
actif dense (Goldfarb-Idnani), écrit dans la lib, testé contre `highs-js` en dépendance de développement. Le choix
reste à commun.

## Sources

- P. de Mars, *Reinforcement Learning and Tree Search Methods for the Unit Commitment Problem*, thèse, UCL,
  20/10/2022 : https://discovery.ucl.ac.uk/10157786/2/Thesis.pdf (résumé, introduction, § 5 lus)
- C. O'Malley, P. de Mars, L. Badesa, G. Strbac, arXiv 2212.04824, 2022 (résumé)
- A. Marot et al., « Learning to run a Power Network Challenge: a Retrospective Analysis », PMLR 133, 2021 :
  https://proceedings.mlr.press/v133/marot21a.html (lu en entier)
- M. Dorfer et al., « Power Grid Congestion Management via Topology Optimization with AlphaZero », arXiv 2211.05612
  (§ 1 à 5 lus)
- M. Lehna et al., « Managing power grids through topology actions », arXiv 2304.00765 (§ 1 à 4 lus ; les chiffres
  des § 5 à 7, vus en résumé, ne sont pas repris)
- T. Lan et al., arXiv 1911.04263 (résumé)
- D. Goldfarb, A. Idnani, « A numerically stable dual method for solving strictly convex quadratic programs »,
  *Mathematical Programming* 27, 1983, p. 1-33 (cité par le README de https://github.com/albertosantini/quadprog)
- OSQP : https://osqp.org/docs/solver/index.html et `docs/interfaces/index.html`
- HiGHS : https://highs.dev ; highs-js : https://github.com/lovasoa/highs-js

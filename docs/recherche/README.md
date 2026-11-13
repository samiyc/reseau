# La recherche du cadrage

Ce dossier rassemble ce qui a été cherché avant d'écrire une ligne de code, les 13 et 14/11/2026, à la demande de
Sami : « fais la recherche du cadrage dans docs/recherche/ (sources vérifiées : IEEE 14/30/118, PGLib-OPF, RTS-GMLC,
Grid2Op), puis des pistes à tester classées et mes questions groupées. Pas de code avant mes réponses. »

**La règle des chiffres** : chaque chiffre a sa source, lue le 13 ou le 14/11 (le fichier, le dépôt ou le rapport, avec
son lien). Ce qui vient d'une source secondaire (Wikipédia, un résumé) le dit. Ce qui n'est pas sourcé est marqué
**hypothèse**.

## La question

Un réseau électrique doit, à chaque instant, produire exactement ce qui se consomme. Il le fait avec des centrales
qu'il faut démarrer des heures à l'avance, du vent et du soleil qu'on ne commande pas, et des lignes où le courant ne
va pas où on veut : il se répartit selon les lois de Kirchhoff. Quand une ligne tombe, son flux se reporte sur les
autres, qui peuvent tomber à leur tour.

Le problème se coupe en trois couches, que la littérature traite à part :

1. **Le démarrage des centrales** (*unit commitment*, la veille, à l'heure) : lesquelles tournent. Une décision
   discrète, sous l'incertitude de la météo et des pannes. Règle de référence : la liste de préséance avec une marge
   de réserve.
2. **La répartition** (*economic dispatch*, puis *DC-OPF* quand on tient compte des lignes) : combien chacune
   produit, au moindre coût, sans dépasser les lignes. Une décision continue, un programme quadratique (QP) ou
   linéaire.
3. **La conduite en temps réel** : ce qu'on fait quand une ligne tombe ou surcharge (ouvrir une ligne, couper un
   poste en deux, redispatcher, délester). C'est le terrain de Grid2Op et des concours L2RPN de RTE.

## Les fichiers

| Fichier | Ce qu'il contient |
|---|---|
| [physique.md](physique.md) | le calcul des flux (DC power flow), les facteurs PTDF et LODF, le DC-OPF, la règle N-1, les cascades (le modèle OPA, trois grandes pannes réelles), ce que le modèle DC ne voit pas |
| [bancs.md](bancs.md) | les réseaux IEEE 14, 30 et 118 (MATPOWER), PGLib-OPF et ses coûts de référence, RTS-GMLC et son année de données, Grid2Op et les concours L2RPN |
| [methodes.md](methodes.md) | les règles et les recherches publiées : la liste de préséance, la réserve, le MILP, la recherche arborescente guidée (de Mars, 2022), ce qui a gagné les L2RPN (simuler avant d'agir), SDDP ; les solveurs QP |
| [pistes.md](pistes.md) | les expériences à mener, classées, avec ce que chacune doit trancher et contre quoi elle se mesure |
| [questions.md](questions.md) | les questions pour Sami, groupées, chacune avec une recommandation ; puis celles pour un professionnel (un dispatcheur) |
| [glossaire.md](glossaire.md) | les mots du métier, en français et en anglais |
| [prompt.md](prompt.md) | le prompt de recherche métier, pour creuser un point plus tard |

## Ce qu'on a déjà, ce qui est neuf

| Couche | Dans la lib (`mcts-commun`) | Neuf |
|---|---|---|
| Les flux | rien | le DC power flow (un système linéaire de la taille du réseau), les PTDF et LODF, la cascade |
| La répartition | `climb` (une escalade, pour comparer) | le DC-OPF : un QP à contraintes linéaires générales. **Le solveur ira dans la lib** (Sami, 13/11) ; la demande à commun est postée au tableau, avec la forme du problème ([methodes.md](methodes.md) § 5) |
| Le démarrage | `beam` (le faisceau sur les heures), `search` (l'ISMCTS sur des mondes météo), `mcts-race` | la liste de préséance, les contraintes des centrales (minimum technique, rampes, durées minimales, coûts de démarrage) |
| La conduite | `beam`, `climb`, `events` (les pannes datées) | les actions de topologie ; « simuler avant d'agir », la leçon des L2RPN |
| La mesure | `measure`, `random` (les jours tirés par graine), `sprt` | les trois objectifs, jamais fondus : le coût, l'énergie non distribuée, les surcharges |

## Le chemin proposé

Le détail est dans [pistes.md](pistes.md), sous réserve des réponses de Sami ([questions.md](questions.md)) :

1. **J1, les flux** : IEEE 14 (version PGLib, avec ses limites de ligne), le DC power flow, une ligne qui tombe, le
   report vérifié par les LODF. La page : la carte, les lignes colorées par leur charge.
2. **J2, la cascade** : la règle de déclenchement des surcharges, des pannes tirées par graine, la taille des
   coupures selon la charge du réseau.
3. **J3, la répartition** : le DC-OPF (avec le solveur de la lib), validé contre les coûts publiés par PGLib-OPF.
4. **J4, une journée** : RTS-GMLC (73 nœuds, 73 centrales thermiques, l'année 2020 de vent et de soleil, prévisions
   et réalisé), la liste de préséance avec réserve, la règle N-1.
5. **J5 et après, la recherche** : le faisceau puis l'ISMCTS sur le démarrage, contre la règle, apparié sur les mêmes
   jours ; puis la conduite en temps réel ; les batteries ; les barrages (SDDP) en dernier.

# Les pistes à tester

Les expériences du projet, classées par ordre de passage. Chacune dit ce qu'elle doit trancher et contre quoi elle se
mesure. Une piste qui ne tranche rien n'est pas lancée. Rédigé le 14/11/2026, d'après [physique.md](physique.md),
[bancs.md](bancs.md) et [methodes.md](methodes.md), **sous réserve des réponses de Sami** ([questions.md](questions.md)).

**Les règles de mesure, pour toutes** (CLAUDE.md) : des jours tirés par graine, la recherche et la règle sur les
**mêmes** jours, l'écart apparié avec son intervalle, **sur chaque objectif à part** : le coût, l'énergie non
distribuée, les surcharges (nombre et MW·h au-delà des limites). Un tri rapide rejette, il ne promeut jamais.

## Vue d'ensemble

| # | Piste | Jalon | Ce qu'elle tranche | Dans la lib |
|---|---|---|---|---|
| P1 | Le DC power flow, PTDF et LODF, sur l'IEEE 14 | J1 | le socle : des flux justes, vite | – |
| P2 | La page : la carte, les lignes colorées par leur charge | J1 | voir ce que fait le modèle | `web/theme.css` |
| P3 | La cascade et la charge critique | J2 | le réseau a-t-il un coude, comme chez Dobson ? | `random`, `events`, `measure` |
| P4 | Le DC-OPF, validé contre PGLib-OPF | J3 | la répartition est-elle juste ? | le solveur QP, demandé |
| P5 | La règle N-1 : vérifier, puis prévenir | J3-J4 | ce que coûte la sécurité | le solveur QP |
| P6 | La journée RTS-GMLC et la liste de préséance avec réserve | J4 | **la règle à battre**, bien réglée | `mcts-race`, `measure` |
| P7 | Le faisceau sur le démarrage | J5 | la recherche bat-elle la règle ? | `beam` |
| P8 | L'ISMCTS sur des mondes météo | J5-J6 | l'incertitude paie-t-elle d'être cherchée ? | `search` |
| P9 | La conduite en temps réel : la topologie | J6 | battre le glouton qui simule | `beam`, `search` |
| P10 | Le stockage | J7 | arbitrage et congestion | `climb` |
| P11 | Les barrages | plus tard | la valeur de l'eau | SDDP, à écrire |

## P1. Le DC power flow (J1)

- **À écrire** : la lecture d'un cas MATPOWER (le `.m` de PGLib, converti une fois en JSON par un script, la
  conversion testée), Bbus et Bf, la résolution avec un nœud de référence, la PTDF et la LODF, la détection des
  îlots (une ligne pont).
- **Le réseau** : l'IEEE 14 de PGLib v23.07 (limites de 53 à 664 MW, [bancs.md](bancs.md) § 2).
- **Les tests** : au nœud, la somme des flux égale l'injection (Kirchhoff) ; la somme des injections est nulle ; le
  flux après coupure par la LODF égale celui d'une nouvelle résolution, sur chaque ligne ; couper un pont crée deux
  îles et le dit ; tout se rejoue.
- **La vérification externe** : les flux du DC power flow de MATPOWER sur `case14` (**hypothèse** : on prend ses
  angles publiés dans un exemple ou on les calcule une fois par Octave ; à voir avec Sami, question 8).
- **Le banc** : le temps d'une résolution et d'un report par LODF, en microsecondes, sur 14, 30 et 118 nœuds.

## P2. La page (J1)

- **La carte** : l'IEEE 14 n'a pas de coordonnées ; on place ses 14 nœuds à la main, d'après son schéma unifilaire
  classique. RTS-GMLC a ses latitudes et longitudes.
- **Les lignes** colorées par leur charge (flux / limite), leur épaisseur par le flux, une flèche pour le sens. Un
  clic sur une ligne la coupe : le report se voit aussitôt.
- **Le thème** : `mcts-commun/web/theme.css`, en sépia (le Khaki de Notepad++), port 4808.

## P3. La cascade et la charge critique (J2)

**Faite le 14/11** : [../mesures/cascade-j2.md](../mesures/cascade-j2.md). Il y a un coude, et c'est la limite N-0 de
la répartition (1,03 sur le 30, 1,09 sur le 118) ; aucun des trois réseaux n'est N-1 à sa charge de base (0,58,
0,65, 0,68). La queue de Dobson ne se voit pas encore : à refaire au J3, avec le DC-OPF. **Refaite au J3**
([../mesures/cascade-j3.md](../mesures/cascade-j3.md)) : la répartition au moindre coût laisse des lignes exactement à
leur limite, et une perte sur deux fait cascade pour quelques millionièmes de dépassement. **Depuis la répartition N-1** (le choix de
Sami, [../mesures/cascade-n1.md](../mesures/cascade-n1.md)) : plus aucune perte simple ne cascade sous la limite N-1,
les paires perdent 0,1 à 1 % ; au-delà, une falaise, que la répartition à la moindre charge après une perte (le
choix suivant de Sami) change en pente sur les IEEE 30 et 118. **La queue** ([../mesures/cascade-queue.md](../mesures/cascade-queue.md),
15/11) : sur le 118, autour de sa limite N-1, une densité des tailles de pente −1,1 à −1,7, dans la plage de Dobson ;
au-delà, du tout ou rien. Les IEEE 14 et 30 sont trop petits pour une queue.

- **La règle** : celle de Grid2Op ([physique.md](physique.md) § 5), lue dans son code : au-delà de 2 fois sa limite,
  une ligne tombe aussitôt ; au-delà de sa limite, à son 3e pas d'affilée. Après chaque chute, on recalcule ; un
  îlot sans assez de production déleste.
- **L'expérience** : la consommation de base multipliée par un facteur de 0,6 à 1,4 ; à chaque facteur, des centaines
  de pannes initiales tirées par graine (une ou deux lignes) ; on mesure la consommation perdue.
- **Ce qu'on attend** (Dobson 2005) : peu de pertes à faible charge, puis un coude, une queue lourde, et des pannes
  totales au-delà. Sur l'IEEE 30 et 118 de PGLib, plus maillés que le 14.
- **La page** : la cascade rejouée pas à pas, les lignes qui rougissent puis tombent.

## P4. Le DC-OPF (J3)

**Fait le 14/11** : [../mesures/opf-j3.md](../mesures/opf-j3.md). Les six coûts DC de BASELINE.md sont retrouvés, au
dernier chiffre publié près, sous la convention de PowerModels (sans rapports de transformation), lue dans son code ;
les trois cas aux petits angles sont infaisables, comme chez lui. Les prix nodaux sont vérifiés par différences finies.

- **Le solveur** : celui de la lib, demandé à commun le 14/11 ([methodes.md](methodes.md) § 5). En attendant, la
  répartition par préséance sans réseau suffit à P1-P3.
- **La validation** : retrouver les coûts DC de BASELINE.md : 2 051,5 $/h (14), 7 472,8 (30), 93 101 (118), et
  4 797,6 / 16 145 / 231 290 en conditions congestionnées, à 10⁻³ près. Un écart dit qu'une contrainte manque (les
  écarts d'angle, d'abord).
- **Les prix nodaux** : les multiplicateurs de l'équilibre et des lignes. Ils s'affichent sur la carte.

## P5. La règle N-1 (J3-J4)

**Vérifier et prévenir, faits le 14/11** ([../mesures/opf-j3.md](../mesures/opf-j3.md)) : aucun des trois réseaux
n'est N-1 à sa charge de base, même avec la meilleure répartition ; la règle tient jusqu'à 0,72, 0,81 et 0,77 fois la
charge. En dessous, elle coûte de 2 à 57 % sur le 14 et le 30, de 4 à 16 % sur le 118. Reste le scénario de 2006,
sous 0,7 fois la charge.

- **Vérifier** : pour un état, la LODF donne toutes les pertes de ligne d'un coup ; on liste celles qui surchargent.
- **Prévenir** (SCOPF) : le DC-OPF avec les limites après perte, ajoutées au fil de l'eau. On mesure **le prix de la
  sécurité** : le coût N-1 moins le coût sans N-1, sur les cas PGLib typiques et congestionnés.
- **Le scénario de 2006** : un état sûr, une ligne ouverte « sans calcul », la cascade. Sur l'IEEE 118 congestionné,
  on cherche une ligne dont l'ouverture rend l'état non N-1 et dont une perte suivante fait cascade.

## P6. La journée RTS-GMLC et la règle à battre (J4)

- **Le modèle** : les 73 groupes thermiques avec leurs Pmin, rampes, durées minimales et coûts de démarrage ; le
  renouvelable écrêtable ; les séries de 2020.
- **Les jours** : tirés par graine parmi les 366 ; la décision de la veille voit `DAY_AHEAD_*`, le jour se joue sur
  `REAL_TIME_*` (une erreur de prévision réelle). Au pas horaire d'abord ([questions.md](questions.md), question 3).
- **La règle** : la liste de préséance, avec la réserve des fichiers de RTS-GMLC ou une marge réglée, puis le DC-OPF
  à chaque heure, puis le délestage s'il le faut.
- **Le réglage d'abord** : la marge se règle par la course aux configurations (`mcts-race`) sur des jours
  d'entraînement, et se mesure sur d'autres. Une recherche ne bat qu'une règle bien réglée (la leçon du temps fixe
  réglé des feux).

## P7. Le faisceau sur le démarrage (J5)

- **Le dispositif** : à chaque heure, les états possibles (quels groupes en marche) ; le faisceau garde les W
  meilleurs plannings partiels, notés par le DC-OPF de chaque heure (avec redémarrage à chaud) et les coûts de
  démarrage. Les successeurs sont proposés par la règle (démarrer le suivant de la liste, arrêter le dernier), comme
  la politique qui élague chez de Mars.
- **La note** : lexicographique ou pondérée, selon la réponse de Sami ([questions.md](questions.md), question 4).
- **Ce qu'on attend**, en **hypothèse** : 1 à 3 % de coût en moins à énergie non distribuée égale, d'après de Mars.
  Le faisceau voit la prévision seule ; il peut perdre sur les jours mal prévus.

## P8. L'ISMCTS sur des mondes météo (J5-J6)

- **Les mondes** : des réalisations plausibles du jour, tirées en ajoutant à la prévision des erreurs prises sur
  d'autres jours de l'année (écart entre `REAL_TIME` et `DAY_AHEAD`), et des pannes de groupes tirées par leurs taux.
- **La question** : chercher sur plusieurs mondes économise-t-il la réserve qu'une règle garde par prudence ? C'est
  le résultat de de Mars avec les pannes (plus de 2 %).
- **Contre** : la règle réglée (P6) et le faisceau sur la prévision (P7), appariés sur les mêmes jours et les mêmes
  pannes.

## P9. La conduite en temps réel (J6)

- **Les actions** : ouvrir ou refermer une ligne, redispatcher, délester en dernier ; une action par pas, comme
  Grid2Op. Couper un poste en deux viendra ensuite (le modèle doit savoir dédoubler un nœud).
- **L'adversaire** : une ligne attaquée tirée par graine, comme dans les L2RPN depuis 2020.
- **Les règles à battre** : ne rien faire ; puis **le glouton qui simule** une liste de 200 actions et garde celle qui
  laisse la plus faible charge maximale (le 2e de NeurIPS 2020, le Tutor de Lehna).
- **Les recherches** : le faisceau sur quelques pas, puis MCTS (Dorfer : +11 points de survie sur le top-25, 50 fois
  plus lent). À budget de simulations égal.

## P10. Le stockage (J7)

Le stockage de RTS-GMLC (50 MW, rendement 85 %) puis des batteries placées par nous : la charge la nuit, la décharge à
la pointe, et le soulagement d'une ligne saturée. Un plan de charge sur la journée, par escalade (`climb`), contre la
règle « charger sous un prix, décharger au-dessus ».

## P11. Les barrages (plus tard)

Un réservoir, des apports tirés par graine, la valeur de l'eau ; SDDP ([methodes.md](methodes.md) § 4). Seulement
quand le reste tient, et si Sami le veut.

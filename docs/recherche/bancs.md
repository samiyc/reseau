# Les bancs publics

Vérifiés les 13 et 14/11/2026 sur les fichiers eux-mêmes (dépôts GitHub, fichiers bruts), pas de mémoire. Les
comptes faits par nous sur un fichier sont signalés comme tels.

## 1. Les réseaux IEEE 14, 30 et 118 (format MATPOWER)

Les réseaux de test historiques. Le 14 nœuds est « une portion du réseau d'American Electric Power (Midwest) en
février 1962 », saisi au format IEEE Common Data Format en 1993 ; l'archive de l'université de Washington prévient
qu'il **n'a pas de limites de ligne** et que ses données n'ont pas été vérifiées par un calcul de flux.

Comptés sur les fichiers de MATPOWER (`data/case14.m`, `case30.m`, `case118.m`, `case_ieee30.m`, branche master) :

| | case14 | case30 | case118 | case_ieee30 |
|---|---|---|---|---|
| Nœuds | 14 | 30 | 118 | 30 |
| Centrales (toutes avec Pmax > 0) | 5 | 6 | 54 | 6 |
| Lignes et transformateurs | 20 (dont 3 transfos) | 41 | 186 (dont 11 transfos) | 41 (dont 7 transfos) |
| Limites de ligne (RATE_A) | **aucune** (0) | oui, 16 à 130 MW | **aucune** | **aucune** |
| Consommation totale | 259 MW | 189,2 MW | 4 242 MW | 283,4 MW |
| Puissance installée (Σ Pmax) | 772,4 MW | 335 MW | 9 966,2 MW | 900,2 MW |
| Coûts | quadratiques | quadratiques | quadratiques | quadratiques |

**Deux 30 nœuds** : `case30` est la version d'Alsaç et Stott (1974), avec les centrales, coûts et limites de Ferrero
et al. (1997), la charge du nœud 5 mise à zéro ; `case_ieee30` est la conversion du fichier IEEE d'origine. Ils ne
donnent pas les mêmes flux.

**Ce qu'on en retient** : sans limites de ligne, il n'y a ni surcharge ni cascade. Les versions de MATPOWER ne
suffisent donc pas ; celles de PGLib-OPF, si (§ 2).

## 2. PGLib-OPF (IEEE PES)

La bibliothèque de référence des bancs d'OPF, tenue par un groupe de travail de l'IEEE PES (rapport arXiv
1908.02788, v2 du 4/01/2021).

- **La version** : v23.07 (CHANGELOG et BASELINE). Le README demande de citer la version.
- **Le format et la licence** : MATPOWER (`.m`), Creative Commons Attribution 4.0.
- **Trois conditions par réseau** : typique (à la racine), **congestionnée** (`api/` : « des limites thermiques
  actives ») et **petits angles** (`sad/` : des limites d'écart d'angle actives).
- **La taille** : de 3 nœuds (`case3_lmbd`) à 78 484 (`case78484_epigrids`), d'après BASELINE.md. Familles : IEEE,
  PEGASE, **RTE** (`case1888_rte` à `case6515_rte`), GOC (le concours ARPA-E), ACTIVSg, etc.
- **Les limites qui manquaient** ont été ajoutées par un modèle statistique ou une borne raisonnable (rapport, § V-B,
  lu en résumé) : ces réseaux « peuvent ne refléter aucun réseau réel ».

**Le 14 nœuds de PGLib** (`pglib_opf_case14_ieee.m`, lu en entier) : 5 groupes aux nœuds 1, 2, 3, 6 et 8, mais
**seuls deux produisent** (340 MW au nœud 1, 59 MW au nœud 2) ; les trois autres sont des compensateurs synchrones
(Pmax = 0). Les coûts sont **linéaires** (terme quadratique nul ; 7,92 et 23,27 $/MWh). Les 20 lignes ont toutes une
limite, de 53 MW (4-9) à 664 MW (4-5). Consommation : 259 MW.

**Le 118 nœuds de PGLib** : 54 groupes, coûts linéaires partout (19 avec un coût non nul), limites de 72 à 7 218 MW.

**Les coûts de référence** (BASELINE.md, résolus par IPOPT dans PowerModels.jl v0.19.9), en $/h :

| Réseau | DC, typique | AC, typique | DC, congestionné | AC, congestionné | DC, petits angles |
|---|---|---|---|---|---|
| case14_ieee | 2 051,5 | 2 178,1 | 4 797,6 | 5 999,4 | infaisable |
| case30_ieee | 7 472,8 | 8 208,5 | 16 145 | 18 037 | infaisable |
| case118_ieee | 93 101 | 97 214 | 231 290 | 249 610 | infaisable |

**C'est notre test de validation** du DC-OPF (P5) : retrouver la colonne DC à quelques millièmes près. Le DC
« infaisable » des petits angles montre que la formulation de PowerModels garde les **limites d'écart d'angle** ;
notre formulation devra les garder aussi pour comparer. **Vérifié dans son code au J3** (v0.19.9, `src/form/dcp.jl`) :
le flux d'une branche y vaut −b·(θf − θt) avec b = Im(1 / (r + jx)), **sans rapport de transformation ni
déphasage**, à la différence de MATPOWER (1 / (x · τ)) ; les shunts comptent comme une consommation. Sous cette
convention, nous retrouvons les six coûts ([../mesures/opf-j3.md](../mesures/opf-j3.md)).

## 3. RTS-GMLC (le réseau de test de fiabilité, modernisé par les laboratoires du DOE)

Une mise à jour du RTS-96 de l'IEEE, « développée pour la modélisation des coûts de production » (README), sur une
région fictive du sud-ouest des États-Unis. Dépôt `GridMod/RTS-GMLC`, lu le 13/11.

- **Le réseau** : 73 nœuds en 3 zones (101-124, 201-224, 301-325) ; 120 branches, dont 16 transformateurs (notre
  compte) ; une liaison à courant continu (113-316). `bus.csv` donne **la latitude et la longitude** de chaque
  nœud : la carte de la page est fournie.
- **Le parc** (`gen.csv`, 158 lignes, notre compte) : **73 thermiques** (39 turbines à combustion, dont 12 au fioul ;
  23 vapeur, dont 16 au charbon ; 10 cycles combinés ; 1 nucléaire), 20 hydrauliques, 4 éoliennes, 25 parcs
  photovoltaïques, 31 toitures photovoltaïques, 1 solaire thermodynamique, **1 stockage** (rendement 85 %), 3
  compensateurs synchrones.
- **Ce qu'il faut pour le démarrage** (en-têtes de `gen.csv`) : Pmin et Pmax, rampe (MW/min), durées minimales de
  marche et d'arrêt, temps et chaleur de démarrage à froid, tiède et chaud, coût de démarrage hors combustible, courbe
  de consommation spécifique en 5 points, prix du combustible, taux de panne forcée, MTTF et MTTR. Tout y est.
- **Les séries** : l'année **2020** (8 784 heures, vérifié sur le fichier), en **deux versions** : la prévision de la
  veille (`DAY_AHEAD_*`, horaire) et le réalisé (`REAL_TIME_*`, au pas de 5 minutes). Charge par zone, éolien,
  photovoltaïque, toitures, hydraulique, solaire thermodynamique, réserves. **L'écart entre les deux est une vraie
  erreur de prévision**, sans rien inventer.
- **Les ordres de grandeur** (nos sommes sur les fichiers, à revérifier avant de les afficher) : environ 14 500 MW
  installés, dont 8 076 MW thermiques et 2 508 MW éoliens ; une pointe de **8 192 MW** (somme horaire des trois
  zones, prévision de la veille).
- **La licence** : un accord d'utilisation NREL/DOE : usage, copie et diffusion libres, à condition de garder la
  notice et de **citer DOE/NREL/Alliance**.
- **L'article de référence** (Barrows et al., IEEE Trans. Power Systems, 2020, de mémoire) n'est pas nommé dans le
  dépôt, et le PDF joint (25 Mo) n'a pas pu être lu : **à vérifier** avant de le citer.

## 4. Grid2Op et les concours L2RPN (RTE)

La plateforme de RTE pour apprendre à conduire un réseau, et le support des concours *Learning to Run a Power
Network*.

- **Le logiciel** : Python, licence MPL-2.0, version 1.12.6 (13/10/2026, d'après le CHANGELOG ; PyPI n'a pas pu être
  lu). Calcul **AC** par PandaPower, ou LightSim2Grid, bien plus rapide : `simulate` sur le 14 nœuds en 17,3 ms
  contre 1,56 ms (tableau de la doc, version 1.5.0, 2021).
- **Les actions** : ouvrir ou fermer une ligne, **couper un poste en deux jeux de barres** (la topologie), redispatcher
  une centrale (sous ses rampes), écrêter le renouvelable, piloter un stockage. Par défaut, une seule action de poste
  et une seule de ligne par pas ; une action illégale devient « ne rien faire ».
- **Le temps** : un pas de **5 minutes** ; un épisode du 14 nœuds dure 8 064 pas, soit 28 jours.
- **Les surcharges** : une ligne au-delà de sa limite plus de 2 pas consécutifs est coupée, aussitôt au-delà d'un
  seuil dur de 2 fois la limite (lu dans son code), et reconnectable après 10 pas ([physique.md](physique.md) § 5).
- **Les environnements** (tableau de la doc, à jour en avril 2021, donc peut-être vieilli) :

| Environnement | Postes | Lignes | Centrales | Charges | Particularités |
|---|---|---|---|---|---|
| `l2rpn_case14_sandbox` | 14 | 20 | 6 | 11 | IEEE 14 modifié, redispatch |
| `l2rpn_neurips_2020_track1` | 36 | 59 | 22 | 37 | maintenance, adversaire |
| `l2rpn_neurips_2020_track2` | 118 | 186 | 62 | 99 | maintenance |
| `l2rpn_wcci_2022` | 118 | 186 | 62 | 91 | adversaire, stockage |
| `l2rpn_idf_2023` | 118 | 186 | 62 | 99 | prévisions sur 12 pas, l'adversaire attaque 3 lignes |

- **Les concours** : 2019 (IJCNN, gagné par Geirina), WCCI 2020, NeurIPS 2020 (pistes robustesse et adaptabilité,
  gagnées par Baidu), ICAPS 2021 (« la confiance »), WCCI 2022 (« l'énergie du futur », gagné par une approche
  AlphaZero), IDF 2023 (la région parisienne). Aucun concours après 2023 trouvé sur le site.

**Ce qu'on en prend** : les règles (le déclenchement des surcharges, une action par pas, l'adversaire qui attaque des
lignes), les **leçons des gagnants** ([methodes.md](methodes.md) § 3), et peut-être leurs données. **Ce qu'on n'en
prend pas** : Grid2Op est en Python et en AC ; nos scores ne se comparent pas aux siens. Une comparaison directe
demanderait de faire tourner Grid2Op à côté ([questions.md](questions.md), question 7).

## 5. Ce que chaque banc sert

| Banc | Pour | Jalon |
|---|---|---|
| IEEE 14 de PGLib | les flux, la carte, une ligne qui tombe ; la validation du DC-OPF (2 051,5 $/h) | J1, J3 |
| IEEE 30 et 118 de PGLib | la validation à plus grande taille ; les cascades sur un réseau maillé ; le temps de calcul | J2, J3 |
| PGLib, conditions congestionnées | des réseaux où les limites mordent : le terrain de la règle N-1 | J3, J4 |
| RTS-GMLC | **le réseau principal** : le démarrage, la météo réelle et sa prévision, le stockage, l'hydraulique | J4 et après |
| Grid2Op, L2RPN | les règles de conduite, les leçons des gagnants | J6 |

## Sources

- Archive des cas de test, université de Washington : https://labs.ece.uw.edu/pstca/ (page du 14 nœuds :
  `pf14/pg_tca14bus.htm`)
- MATPOWER, fichiers de cas : https://github.com/MATPOWER/matpower/tree/master/data
- PGLib-OPF : https://github.com/power-grid-lib/pglib-opf (README, CHANGELOG.md, BASELINE.md) ; IEEE PES Task
  Force, « The Power Grid Library for Benchmarking AC Optimal Power Flow Algorithms », arXiv 1908.02788
- RTS-GMLC : https://github.com/GridMod/RTS-GMLC (README, `RTS_Data/SourceData/*.csv`,
  `RTS_Data/timeseries_data_files/`, `RTS-GMLC_updates.md`)
- Grid2Op : https://github.com/Grid2op/grid2op ; https://grid2op.readthedocs.io/en/latest/available_envs.html ;
  `user/parameters.html`, `user/action.html`, `user/environment.html`
- L2RPN : https://l2rpn.chalearn.org/competitions

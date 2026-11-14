# Le modèle

Rédigé le 14/11/2026, après les réponses de Sami ([recherche/questions.md](recherche/questions.md)). Les sources et
les raisons sont dans [recherche/](recherche/README.md) ; ce fichier dit ce que le code fait, et ce qu'il fera.

**Ce que c'est** : un réseau de transport en courant continu équivalent (le modèle DC), ses centrales, sa
consommation, ses pannes. Pour comprendre les reports de flux, les cascades, et ce que coûte la sécurité.
**Ce que ce n'est pas** : un outil d'exploitation. La tension, le réactif, la fréquence et la stabilité n'y sont pas
([recherche/physique.md](recherche/physique.md) § 7). La page le dit.

## 1. Le réseau

- **Les données** : les fichiers MATPOWER de PGLib-OPF v23.07 (licence CC BY 4.0), convertis une fois en JSON par
  `scripts/matpower-to-json.js` dans `data/`. Le JSON garde les matrices et le nom de leurs colonnes, tels quels ;
  `src/grid/case.js` en tire le réseau.
- **Les unités** : les puissances en MW à l'entrée et à la sortie ; les calculs en unités réduites (p.u.), sur la
  base du fichier (`baseMVA`, 100 MVA). Les angles en radians.
- **Les nœuds** : numérotés de 0 à n−1 dans l'ordre du fichier (le numéro du fichier est gardé pour l'affichage).
  Chaque nœud a sa consommation `Pd` et sa conductance de shunt `Gs` (une consommation de plus, en DC).
- **Les branches** : une ligne ou un transformateur entre deux nœuds, en service ou non. Sa **susceptance** est
  b = 1 / (x · τ), où x est la réactance et τ le rapport du transformateur (1 pour une ligne) ; son **déphasage** φ
  (en degrés dans le fichier). Sa **limite** est RATE_A, en MW.
- **Les centrales** : un nœud, Pmin, Pmax, la production du fichier `Pg`, un coût polynomial (c2, c1, c0, en $/h).
  Les compensateurs synchrones (Pmax = 0) sont gardés, sans effet en DC.
- **Le nœud de référence** : celui de type 3 dans le fichier.

## 2. Les flux

Pour des injections nettes P (production moins consommation, par nœud) et un ensemble de branches en service :

1. **Les îlots** : les composantes connexes des branches en service. Chacune a son nœud de référence : celui du
   fichier s'il y est, sinon le nœud de plus grande Pmax installée, sinon le premier.
2. **Les angles** : le système `Bbus · θ = P − Pφ` restreint aux nœuds qui ne sont pas de référence, l'angle des
   nœuds de référence valant 0. Bbus est la laplacienne des susceptances ; Pφ les injections équivalentes des
   déphaseurs. Une factorisation LU dense avec pivot partiel, puis deux substitutions.
3. **Les flux** : sur la branche k de f vers t, F = b · (θf − θt − φ), positif dans le sens f → t, en MW.
4. **Le bilan** : le nœud de référence de chaque îlot absorbe l'écart de son îlot (comme `rundcpf` de MATPOWER).
   Cet écart est rendu par îlot : c'est ce que la centrale de référence doit produire en plus, ou, sans centrale,
   la consommation qu'il faudra délester (J2).
5. **Le taux de charge** : |F| / RATE_A. Au-delà de 1, la branche est en **surcharge**.

**Les invariants, testés** : à chaque nœud, la somme des flux sortants égale l'injection (Kirchhoff) ; dans chaque
îlot, la somme des injections, bilan compris, est nulle ; une branche hors service ne porte rien.

## 3. Les sensibilités

- **PTDF** (branches × nœuds), pour le réseau intact et le nœud de référence du fichier : la colonne n est le flux
  sur chaque branche pour 1 MW injecté en n et retiré au nœud de référence. Les flux d'un état valent PTDF · P.
- **LODF** (branches × branches) : LODF(l, k) = h(l) / (1 − h(k)), où h est le flux d'un transfert de 1 MW entre les
  deux bouts de k ; −1 sur la diagonale. Si 1 − h(k) est nul (à 10⁻⁹ près), k est un **pont** : sa perte coupe le
  réseau en deux, la colonne est marquée `NaN`.
- **Le test** : pour chaque branche qui n'est pas un pont, le flux après sa perte par la LODF égale celui d'une
  nouvelle résolution sans elle, à 10⁻⁹ MW près.

## 4. L'état du réseau, et la répartition provisoire

La consommation du fichier, multipliée par un **facteur de charge** (1 par défaut ; la page le fait varier). Dans
chaque îlot, **toutes les centrales produisent la même part de leur Pmax**, celle qui couvre la demande de l'îlot
(`src/grid/supply.js`) ; si la demande dépasse la capacité, toutes sont à Pmax et l'îlot **déleste** le reste, au
prorata ; un îlot sans centrale perd toute sa consommation. C'est une **hypothèse** provisoire, en attendant le DC-OPF
du J3 (décidée le 14/11, au J2) : les productions des fichiers PGLib sont un « départ à plat », pas une répartition,
et le nœud de référence seul pour équilibrer faisait délester 393 MW au 118 sans aucune panne. Avec elle, aucune
ligne des trois réseaux n'est en surcharge à la charge de base ([mesures/cascade-j2.md](mesures/cascade-j2.md)).

Les productions du fichier ne servent plus qu'aux tests du calcul des flux (`baseInjection`).

## 5. Les jalons (le détail dans [recherche/pistes.md](recherche/pistes.md))

- **J2, la cascade** (fait le 14/11, `src/cascade/`) : la règle de Grid2Op 1.12.6, déterministe (Sami, 14/11),
  lue dans son code : dans un pas, une branche au-delà de 2 fois sa limite tombe aussitôt, et on recalcule jusqu'à ce
  que plus rien ne tombe ; une branche au-delà de sa limite tombe à son 3e pas d'affilée ; un îlot sans assez de
  production déleste. L'expérience : toutes les pertes simples et des paires tirées par graine (`createRng`), à
  chaque facteur de charge ([mesures/cascade-j2.md](mesures/cascade-j2.md)).
- **J3, la répartition** : le DC-OPF, avec le solveur QP de la lib (demandé le 14/11), validé contre les coûts DC de
  PGLib-OPF ; les prix nodaux ; la règle N-1 par la LODF.
- **J4, la journée** : RTS-GMLC, au pas horaire ; la liste de préséance avec réserve, réglée par `mcts-race`.
- **J5 et après** : le faisceau puis l'ISMCTS sur le démarrage ; la conduite au pas de 5 minutes ; le stockage au J7.

## 6. Les mesures

Trois objectifs, **jamais fondus** en un score : le **coût** ($), l'**énergie non distribuée** (MWh) et les
**surcharges** (nombre de branche-pas au-delà de 1, et MW·h au-delà des limites). Une recherche et une règle se
comparent sur les **mêmes jours** tirés par graine, par l'écart apparié et son intervalle (`measure`), objectif par
objectif. Pour choisir entre deux plans, la recherche les range **dans l'ordre** : l'énergie non distribuée, puis
les surcharges, puis le coût (Sami, 14/11).

## 7. Ce qu'on prend de la lib

| Module | Pour | Quand |
|---|---|---|
| `random` | les pannes et les jours tirés par graine | J2 |
| `events` | les pannes datées dans une journée | J2, J4 |
| `measure`, `race` | les comparaisons appariées, le réglage des règles | J4 |
| le solveur QP (à venir) | le DC-OPF | J3 |
| `beam`, `search`, `climb` | le démarrage, la conduite, le stockage | J5 et après |
| `web/theme.css`, `bin/serve.js` | la page, port 4808 | J1 |

## 8. Les empreintes

`tests/fingerprint.test.js` garde un hachage de ce que fait le modèle : les flux de l'injection du fichier sur les trois réseaux,
et ceux d'après chaque perte d'une branche de l'IEEE 14 (J1) ; la répartition des trois réseaux à 1,2 fois leur
charge, et les cascades de l'IEEE 30 après chaque perte simple, au même facteur (J2). Une refonte n'en change aucun ; un changement voulu du
modèle met à jour le hachage et le dit dans son commit, avec les mesures avant et après.

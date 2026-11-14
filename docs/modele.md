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
- **Les écarts d'angle** : ANGMIN et ANGMAX bornent θf − θt (±30° sur les trois réseaux PGLib) ; aucune borne à ±360°
  ou au-delà, ni quand les deux valent 0, comme MATPOWER les lit.
- **Deux conventions** pour la susceptance : celle de MATPOWER, celle du modèle ; et celle de PowerModels en DC,
  b = x / (r² + x²), sans rapport ni déphasage (lu dans son code, v0.19.9). La seconde ne sert qu'à retrouver les
  coûts publiés par PGLib-OPF, qui en viennent ([mesures/opf-j3.md](mesures/opf-j3.md)).

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

## 4. L'état du réseau

La consommation du fichier, multipliée par un **facteur de charge** (1 par défaut ; la page le fait varier). Puis
deux temps (`src/grid/state.js`) :

1. **La répartition**, sur le réseau tel que son fichier l'a (toutes ses branches en service) : **la moins chère qui
   tient la règle N-1**, tant qu'il en existe une (§ 5 ; Sami, 14/11, au vu de [mesures/cascade-j3.md](mesures/cascade-j3.md)),
   et au-delà, celle qui **rend la pire charge après une perte la plus faible possible**, puis la moins chère à ce
   niveau (`dispatch: "secure"`, par défaut ; Sami, 14/11, au vu de la falaise de
   [mesures/cascade-n1.md](mesures/cascade-n1.md)). Si aucune ne sert toute la consommation, elle en
   déleste le moins possible, puis, à délestage égal, choisit la moins chère : l'ordre lexicographique de Sami (§ 7),
   en deux résolutions, sans prix de la défaillance. `dispatch: "cost"` prend toujours la moins chère (le J3).
2. **L'équilibre des îlots** (`src/grid/balance.js`) : les branches coupées ne changent pas la répartition. Les
   centrales gardent ses consignes, et chaque îlot comble son propre écart. S'il manque de puissance, ses centrales
   montent toutes de la même part de leur marge (jusqu'à Pmax), et il déleste le reste au prorata de ses
   consommations. S'il en a trop, elles baissent toutes de la même part de leur production. C'est une **hypothèse**,
   comme un réglage de fréquence partagé selon la marge. Un îlot sans centrale perd toute sa consommation.

**La répartition du J2** (`dispatch: "pmax"`, `src/grid/supply.js`) reste disponible pour rejouer ses mesures. Dans
chaque îlot, toutes les centrales y produisent la même part de leur Pmax. Avec des consignes au prorata de Pmax,
l'équilibre des îlots redonne exactement cette règle. Les productions des fichiers PGLib (un « départ à plat », pas une
répartition) ne servent qu'aux tests du calcul des flux (`baseInjection`).

**Une surcharge** est un taux de charge au-delà de 1 + 10⁻⁶. La répartition tient des lignes exactement à leur
limite, et un arrondi ne doit pas les compter en surcharge. Grid2Op compare strictement avec 1.

## 5. La répartition au moindre coût (J3)

`src/opf/`, le DC-OPF du manuel de MATPOWER (§ 6.2), résolu par le solveur `qp` de la lib :

- **Le programme** : les productions des centrales en service (Pmax > Pmin ; les autres à Pmax), qui minimisent
  Σ c2·p² + c1·p ; sous une égalité, la production égale la consommation (shunts compris) ; les bornes Pmin ≤ p ≤ Pmax ;
  et, pour chaque branche, deux lignes de la PTDF : son flux entre ses limites. La limite d'une branche est RATE_A et
  ses écarts d'angle : en DC, θf − θt = F / (baseMVA · b) + φ, la plus serrée l'emporte. Les coûts de PGLib sont
  linéaires : c'est un LP.
- **Les prix nodaux** : ce que coûte un MW de plus consommé au nœud, tirés des multiplicateurs de Karush-Kuhn-Tucker
  que rend `qp` : −eq − Σ le[r]·a_r[n]. Vérifiés par différences finies sur les 118 nœuds.
- **La règle N-1** (`security`) : après la répartition, la LODF donne d'un coup les flux après chaque perte d'une
  branche ; celles qui dépassent leur limite entrent dans le programme, qu'on résout de nouveau à chaud, jusqu'à ce
  qu'aucune ne dépasse. Un pont n'est pas une perte de la règle (sa perte coupe le réseau). Après une perte, une
  branche garde sa limite RATE_A et perd ses écarts d'angle : une **hypothèse**, l'usage d'un SCOPF en DC.
- **Au-delà de la limite N-1** (`src/opf/margin.js`) : une variable de plus, α ≥ 1, la pire charge après une perte ;
  chaque limite après une perte devient F + LODF·F_c ≤ α · RATE_A, ajoutée quand la répartition la dépasse, comme
  pour la règle. Trois résolutions, dans l'ordre de Sami : le moins de délestage, puis le plus petit α, puis le moindre
  coût à α tenu. Les limites du réseau intact restent strictes. α = 1 : la règle tient.
- **Jusqu'où la charge peut monter** (`maxLoad`) : le plus grand facteur de charge qui a une répartition, par
  dichotomie, sans et avec la règle N-1.
- **Le réseau doit être d'un seul tenant** : la PTDF l'exige. L'état d'un réseau coupé en îlots équilibre chacun
  autour de la répartition du réseau intact (§ 4).
- **Le délestage** (`shedding`) : quand aucune répartition ne sert toute la consommation, une variable par nœud
  consommateur, entre 0 et sa consommation. Une première résolution minimise le délestage, une seconde le coût, à
  délestage au plus égal. Les prix nodaux n'ont alors plus de sens, et ne sont pas rendus.

## 6. Les jalons (le détail dans [recherche/pistes.md](recherche/pistes.md))

- **J2, la cascade** (fait le 14/11, `src/cascade/`, refaite au J3 sous la répartition au moindre coût :
  [mesures/cascade-j3.md](mesures/cascade-j3.md), puis sous la répartition N-1 : [mesures/cascade-n1.md](mesures/cascade-n1.md)) : la règle de Grid2Op 1.12.6, déterministe (Sami, 14/11),
  lue dans son code : dans un pas, une branche au-delà de 2 fois sa limite tombe aussitôt, et on recalcule jusqu'à ce
  que plus rien ne tombe ; une branche au-delà de sa limite tombe à son 3e pas d'affilée ; un îlot sans assez de
  production déleste. L'expérience : toutes les pertes simples et des paires tirées par graine (`createRng`), à
  chaque facteur de charge ([mesures/cascade-j2.md](mesures/cascade-j2.md)).
- **J3, la répartition** (fait le 14/11, `src/opf/`) : le DC-OPF avec le solveur `qp` de la lib (livré le 14/11),
  qui retrouve les six coûts DC de PGLib-OPF au dernier chiffre publié près ; les prix nodaux ; la règle N-1 par la
  LODF ; la charge maximale sans et avec elle, et le prix de la sécurité
  ([mesures/opf-j3.md](mesures/opf-j3.md)).
- **J4, la journée** : RTS-GMLC, au pas horaire ; la liste de préséance avec réserve, réglée par `mcts-race`.
- **J5 et après** : le faisceau puis l'ISMCTS sur le démarrage ; la conduite au pas de 5 minutes ; le stockage au J7.

## 7. Les mesures

Trois objectifs, **jamais fondus** en un score : le **coût** ($), l'**énergie non distribuée** (MWh) et les
**surcharges** (nombre de branche-pas au-delà de 1, et MW·h au-delà des limites). Une recherche et une règle se
comparent sur les **mêmes jours** tirés par graine, par l'écart apparié et son intervalle (`measure`), objectif par
objectif. Pour choisir entre deux plans, la recherche les range **dans l'ordre** : l'énergie non distribuée, puis
les surcharges, puis le coût (Sami, 14/11).

## 8. Ce qu'on prend de la lib

| Module | Pour | Quand |
|---|---|---|
| `random` | les pannes et les jours tirés par graine | J2 |
| `events` | les pannes datées dans une journée | J2, J4 |
| `measure`, `race` | les comparaisons appariées, le réglage des règles | J4 |
| `qp` | le DC-OPF, ses prix nodaux, la règle N-1 | J3 |
| `beam`, `search`, `climb` | le démarrage, la conduite, le stockage | J5 et après |
| `web/theme.css`, `bin/serve.js` | la page, port 4808 | J1 |

## 9. Les empreintes

`tests/fingerprint.test.js` garde un hachage de ce que fait le modèle : les flux de l'injection du fichier sur les trois réseaux,
et ceux d'après chaque perte d'une branche de l'IEEE 14 (J1) ; la répartition des trois réseaux à 1,2 fois leur
charge, et les cascades de l'IEEE 30 après chaque perte simple, au même facteur (J2) ; la répartition des trois réseaux
à 0,7 fois leur charge, sans et avec la règle N-1, ses prix nodaux et son coût ; l'état des trois réseaux à 1,2 fois
leur charge et les cascades de l'IEEE 30 à sa charge de base, sous cette répartition (J3) ; les cascades de l'IEEE 30
après des paires de pertes à 0,8 fois sa charge, sous la répartition N-1 ; l'état des trois réseaux à 1,2 fois leur
charge et les cascades de l'IEEE 30 à sa charge de base, sous la répartition au-delà de la limite N-1. Les empreintes du J2
gardent leur répartition (`dispatch: "pmax"`). Une refonte n'en change aucun ;
un changement voulu du modèle met à jour le hachage et le dit dans son commit, avec les mesures avant et après.

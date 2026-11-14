# J3 : la répartition au moindre coût, sa validation, et le prix de la sécurité

Mesuré le 14/11/2026 par `node scripts/opf-measure.js` (sous `--slot 1`, machine pleine), sur les trois réseaux IEEE
de PGLib-OPF v23.07. Le détail, facteur par facteur, est dans [opf-j3.json](opf-j3.json). Le modèle est décrit dans
[../modele.md](../modele.md) § 5.

## 1. La validation contre PGLib-OPF

Les coûts DC de `BASELINE.md` viennent de PowerModels v0.19.9 (`DCPPowerModel`, résolu par IPOPT). Dans son code
(`src/form/dcp.jl`), le flux d'une branche vaut −b·(θf − θt), avec b = Im(1 / (r + jx)) : **sans rapport de
transformation ni déphasage**. Les shunts y comptent comme une consommation, et les écarts d'angle y sont bornés. Notre
répartition, sous cette convention :

| Réseau | Cas | BASELINE.md ($/h) | Nous ($/h) | Écart | Nous, convention MATPOWER |
|---|---|---|---|---|---|
| IEEE 14 | typique | 2 051,5 | 2 051,526 | +0,026 | 2 051,5 |
| IEEE 14 | congestionné (`api`) | 4 797,6 | 4 797,600 | 0,000 | 4 664,4 |
| IEEE 14 | petits angles (`sad`) | infaisable | infaisable | – | infaisable |
| IEEE 30 | typique | 7 472,8 | 7 472,815 | +0,015 | 7 504,4 |
| IEEE 30 | congestionné | 16 145 | 16 145,053 | +0,053 | 16 185,1 |
| IEEE 30 | petits angles | infaisable | infaisable | – | 7 504,4 |
| IEEE 118 | typique | 93 101 | 93 100,730 | −0,270 | 93 132,7 |
| IEEE 118 | congestionné | 231 290 | 231 291,909 | +1,909 | 234 168,6 |
| IEEE 118 | petits angles | infaisable | infaisable | – | infaisable |

- **Les six coûts sont retrouvés à la demi-unité du dernier chiffre publié près.** Les trois cas aux petits angles
  sont infaisables, comme chez PowerModels. Le test `tests/opf.test.js` le garde.
- **La convention compte** : avec les rapports de transformation (MATPOWER, la convention du modèle), le coût change
  de 0 à 2,8 % (le 14 congestionné). Le 30 aux petits angles devient même faisable : les rapports changent les
  écarts d'angle des transformateurs.
- **Les prix nodaux** sont vérifiés par différences finies : sur l'IEEE 30 congestionné (test) et sur les 118 nœuds
  du 118 à 0,75, 0,8 et 1 fois la charge, ils égalent le coût d'un MW de plus, à moins de 10⁻⁶ $/MWh près.

## 2. Jusqu'où la charge peut monter

Le plus grand facteur de charge qui a une répartition, par dichotomie à 10⁻⁴ près. En regard, ceux du J2, sous la
répartition au prorata de Pmax ([cascade-j2.md](cascade-j2.md)).

| Réseau | Capacité installée | N-0, au prorata (J2) | N-0, au moindre coût | N-1, au prorata (J2) | N-1, au moindre coût |
|---|---|---|---|---|---|
| IEEE 14 | 1,541 | 1,54 (la capacité) | **1,540** | 0,58 | **0,722** |
| IEEE 30 | 1,281 | 1,03 | **1,104** | 0,65 | **0,808** |
| IEEE 118 | 1,536 | 1,09 | **1,338** | 0,68 | **0,768** |

- **La répartition au moindre coût repousse la limite du réseau intact** : de 7 % sur le 30, de 23 % sur le 118. La
  répartition au prorata gaspillait la capacité des lignes.
- **Aucun des trois réseaux n'est N-1 à sa charge de base, même avec la meilleure répartition.** La règle tient
  jusqu'à 0,72, 0,81 et 0,77 fois la charge. Les limites de PGLib n'ont pas été posées pour la règle N-1 : elles
  viennent d'un modèle statistique ou d'une borne raisonnable ([../recherche/bancs.md](../recherche/bancs.md) § 2).
- **Sur l'IEEE 14, la borne se calcule à la main.** Si 1-2 tombe, la production du nœud 1 n'a plus que 1-5
  (128 MW), et le nœud 2 n'a que 59 MW. La règle tient donc jusqu'à (128 + 59) / 259 = 0,722 fois la charge, ce que
  la dichotomie retrouve.

## 3. Le prix de la sécurité

Le coût de la répartition N-1 moins celui sans la règle, en part du second, quand la règle tient :

| Facteur | IEEE 14 | IEEE 30 | IEEE 118 |
|---|---|---|---|
| 0,40 | 0 % | 0 % | +5,4 % |
| 0,50 | +2,2 % | +7,1 % | +4,6 % |
| 0,60 | +34,2 % | +36,2 % | +4,0 % |
| 0,65 | +46,4 % | +47,4 % | +3,9 % |
| 0,70 | +57,0 % | +57,0 % | +8,3 % |
| 0,75 | infaisable | +53,0 % | +15,6 % |
| 0,80 | infaisable | +47,6 % | infaisable |

- **Sur les petits réseaux, la sécurité coûte cher.** Une seule contrainte lie : sur le 14, 1-5 après la perte de
  1-2, qui borne le nœud 1 à 128 MW. Le reste vient du groupe du nœud 2, trois fois plus cher (23,27 contre
  7,92 $/MWh).
- **Sur le 118, elle coûte de 4 à 16 %**, plus près de ce qu'on attendait (4 à 8 contraintes liantes). Près de sa
  limite, ses prix nodaux s'écartent de 0,53 à 194 $/MWh.
- **La règle N-1 fait apparaître des prix différents d'un nœud à l'autre** là où le réseau intact n'en a pas : sur le
  14, un seul prix (7,92) sans la règle ; de 7,92 à 23,27 avec elle.

## 4. Le temps

Une répartition à 0,6 fois la charge, médiane de 15 :

| | IEEE 14 | IEEE 30 | IEEE 118 |
|---|---|---|---|
| Sans la règle | 0,25 ms | 0,75 ms | 7,95 ms |
| Avec la règle N-1 | 0,27 ms | 0,88 ms | 16,0 ms |

Sur le 118, la règle prend 3 passes et n'ajoute que 185 à 300 lignes de contraintes aux 372 du réseau intact, sur les
65 000 possibles (177 pertes × 185 branches × 2 côtés). C'est l'ajout au fil de l'eau qui le permet.

## 5. Ce que ça change

- **Les études N-1 se font sous 0,7 fois la charge**, ou avec du délestage dans la répartition. C'est le cas de la
  piste P5 (le scénario de 2006).
- **Le coude du J2 était celui de la répartition au prorata.** Avec la répartition au moindre coût, le réseau intact
  tient plus loin (1,10 et 1,34). La mesure des cascades est à refaire avec elle.

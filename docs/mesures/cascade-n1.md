# Les cascades depuis la répartition du modèle : la règle N-1, puis la moindre surcharge

Mesuré le 14/11/2026 par `node scripts/cascade-sweep.js 300 1 secure` (sous `--slot 1`, 35 s), la même expérience
qu'au J2 et au J3 ([cascade-j2.md](cascade-j2.md), [cascade-j3.md](cascade-j3.md)) : de 0,6 à 1,5 fois la charge,
toutes les pertes d'une branche et 300 paires tirées par la graine 1, chacune jusqu'au bout de sa cascade, sous la
règle de Grid2Op. Le point de départ est celui que Sami a choisi en deux temps, le 14/11 ([../modele.md](../modele.md)
§ 4 et 5) :

1. **La répartition la moins chère qui tient la règle N-1, tant qu'il en existe une** : jusqu'à 0,722, 0,808 et 0,768
   fois la charge ([opf-j3.md](opf-j3.md)).
2. **Au-delà, celle dont la pire charge après une perte est la plus faible**, puis la moins chère à ce niveau
   (`src/opf/margin.js`). La première version retombait là sur la moins chère, d'où une falaise (§ 2).

Le détail est dans [cascade-n1.json](cascade-n1.json).

## 1. Sous la limite N-1

Les pertes simples, puis les paires : la perte moyenne de consommation, la part des événements qui coûtent quelque
chose, et les lignes perdues en moyenne. Entre parenthèses, la répartition au moindre coût au même facteur (J3).

| Réseau, facteur | Pertes simples : perte, part touchée, lignes | Paires : perte, part touchée, lignes |
|---|---|---|
| IEEE 14, 0,6 | 0 % ; 0 % ; 0 (3,1 % ; 5 % ; 0,1) | 0,6 % ; 3,7 % ; 0 (6,5 % ; 0,1 ligne) |
| IEEE 14, 0,7 | 0 % ; 0 % ; 0 (3,4 % ; 5 % ; 0,1) | 1,0 % ; 4,7 % ; 0,01 (7,4 % ; 0,1 ligne) |
| IEEE 30, 0,6 | 0,0 % ; 2,4 % ; 0 (3,4 % ; 9,8 % ; 0,1) | 0,3 % ; 7,0 % ; 0 (8,5 % ; 0,2 ligne) |
| IEEE 30, 0,8 | 0,0 % ; 2,4 % ; 0 (26,1 % ; 46 % ; 1,2) | 0,3 % ; 7,0 % ; 0,01 (28,5 % ; 1,2 ligne) |
| IEEE 118, 0,6 | 0,0 % ; 2,7 % ; 0 (2,6 % ; 53 % ; 8,9) | 0,1 % ; 6,7 % ; 0,18 (2,6 % ; 8,8 lignes) |
| IEEE 118, 0,75 | 0,0 % ; 2,7 % ; 0 (2,7 % ; 54 % ; 9,7) | 0,3 % ; 7,0 % ; 0,25 (2,9 % ; 9,5 lignes) |

- **Aucune perte simple ne fait tomber de ligne**, sur les trois réseaux, à tous les facteurs où la règle tient : c'est
  ce qu'elle garantit, et la cascade le confirme. Les 2,4 et 2,7 % de pertes simples qui coûtent quelque chose sont
  des ponts : leur perte isole un nœud ou une antenne, qui perd sa consommation (la règle ne les compte pas,
  [../modele.md](../modele.md) § 5).
- **Les paires restent bénignes** : 0,1 à 1 % de consommation perdue en moyenne, contre 2,6 à 28 % depuis la
  répartition au moindre coût. Le 9e décile est à 0 sur les trois réseaux. Sur les IEEE 14 et 30, les paires qui
  coûtent ne font presque tomber aucune ligne (0,01 en moyenne) : elles isolent une partie du réseau (le nœud 1 de
  l'IEEE 14, avec 1-2 et 1-5 : 62 à 68 % de perte). Sur le 118, 7 % des paires coûtent, une paire fait tomber 0,2
  autre ligne en moyenne, et la pire perd 29 % de la consommation, à 0,75.
- **L'artefact du J3 disparaît** : la répartition N-1 tient aussi chaque ligne sous sa limite après chaque perte, et le
  fil du rasoir ([cascade-j3.md](cascade-j3.md) § 2) ne coupe plus.

## 2. Au-delà : de la falaise à la pente

**La première version** reprenait au-delà la répartition au moindre coût, et ses cascades : d'un pas de 0,05 à
l'autre, la perte moyenne d'une perte simple sautait de 0 à 27 % sur l'IEEE 30 (de 0,80 à 0,85), de 0 à 2,6 % sur le
118 (de 0,75 à 0,80, puis 14 % à 0,85). **La répartition à la moindre surcharge** (le choix de Sami) en fait une pente.
La perte moyenne d'une perte simple, puis la pire charge après une perte (α) et le surcoût sur la moins chère :

| Facteur | IEEE 30 : perte (au moindre coût) | IEEE 30 : α, surcoût | IEEE 118 : perte (au moindre coût) | IEEE 118 : α, surcoût |
|---|---|---|---|---|
| 0,80 | 0,0 % (26,1 %) | 1,000 ; +48 % | 0,5 % (2,6 %) | 1,048 ; +21 % |
| 0,85 | 4,5 % (27,1 %) | | 1,0 % (14,3 %) | |
| 0,90 | 4,7 % (28,1 %) | 1,192 ; +26 % | 1,9 % (7,0 %) | 1,196 ; +17 % |
| 1,00 | 5,0 % (29,7 %) | 1,400 ; +11 % | 6,1 % (3,7 %) | 1,345 ; +16 % |
| 1,10 | 12,0 % (31,0 %) | 1,608 ; +0 % | 7,4 % (21,5 %) | 1,493 ; +13 % |
| 1,20 | 36,7 % (36,7 %) | 1,651 ; +0 % | 27,5 % (25,1 %) | 1,641 ; +11 % |

- **Sur l'IEEE 30, la perte moyenne est divisée par six** de 0,85 à 1,0 fois la charge. Au-delà de 1,1, près de sa
  limite N-0 (1,104), le réseau intact ne laisse plus de choix : la répartition à la moindre surcharge est la moins
  chère, et les cascades sont les mêmes.
- **Sur le 118, la pente monte de 0,5 % à 7 %** entre 0,8 et 1,1 fois la charge, puis saute à 20 % à 1,15. À 1,0
  fois la charge, elle perd plus (6,1 %) que la moins chère (3,7 %), dont les lignes au fil du rasoir tombaient
  moins à ce facteur-là : la moins chère n'est pas monotone ([cascade-j3.md](cascade-j3.md) § 1), celle-ci l'est
  presque.
- **Sur l'IEEE 14, rien ne change** : passé 187/259 de la charge, la perte de 1-2 met toujours 1-5 au-delà de sa
  limite (α = 200/128 à la charge de base, à la main), et 1-5 tombe à son 3e pas au lieu du 1er.
- **Le prix** : 11 à 48 % de plus que la moins chère sur l'IEEE 30 sous 1,0 fois la charge, 11 à 21 % sur le 118.

## 3. La queue de Dobson

Sous la limite N-1, elle n'a pas de matière : presque rien ne cascade. Au-delà, la distribution des pertes n'a pas
encore été regardée sous cette répartition : à faire avant de reposer la question 5 du cadrage (déterministe ou
probabiliste, à l'OPA).

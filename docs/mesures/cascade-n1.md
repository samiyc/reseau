# Les cascades depuis la répartition qui tient la règle N-1

Mesuré le 14/11/2026 par `node scripts/cascade-sweep.js 300 1 secure` (sous `--slot 1`, 24 s), la même expérience
qu'au J2 et au J3 ([cascade-j2.md](cascade-j2.md), [cascade-j3.md](cascade-j3.md)) : de 0,6 à 1,5 fois la charge,
toutes les pertes d'une branche et 300 paires tirées par la graine 1, chacune jusqu'au bout de sa cascade, sous la
règle de Grid2Op. Seul le point de départ change, au choix de Sami (14/11) : **la répartition la moins chère qui
tient la règle N-1, tant qu'il en existe une** (jusqu'à 0,722, 0,808 et 0,768 fois la charge :
[opf-j3.md](opf-j3.md)), et la moins chère au-delà ([../modele.md](../modele.md) § 4). Le détail est dans
[cascade-n1.json](cascade-n1.json).

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

## 2. Au-delà : la falaise

Passé la limite N-1, le modèle reprend la répartition au moindre coût, et ses cascades : les chiffres sont alors ceux
de [cascade-j3.md](cascade-j3.md), au même facteur. D'un pas de 0,05 à l'autre, la perte moyenne d'une perte simple
saute de 0 à 27 % sur l'IEEE 30 (de 0,80 à 0,85), de 0 à 2,6 % sur le 118 (de 0,75 à 0,80, puis 14 % à 0,85), de 0 à
3,5 % sur l'IEEE 14 (de 0,70 à 0,75 : la perte de 1-2).

Un exploitant ne passe pas d'un coup de « sûr » à « au moindre coût, au fil du rasoir ». Le modèle le fait parce
qu'au-delà de la limite, il n'a pas de règle intermédiaire : c'est la question posée à Sami le 14/11, avec une
recommandation, sans chiffre inventé : au-delà, **minimiser d'abord la pire charge après une perte**, puis le coût
à ce niveau (le même ordre lexicographique que le délestage).

## 3. La queue de Dobson

Sous la limite N-1, elle n'a pas de matière : presque rien ne cascade. Au-delà, ce sont les cascades du J3 (un
plateau, pas une loi de puissance). La question 5 du cadrage (déterministe ou probabiliste, à l'OPA) attend la règle
au-delà de la limite.

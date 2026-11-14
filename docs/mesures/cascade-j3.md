# Les cascades sous la répartition au moindre coût (J3)

Mesuré le 14/11/2026 par `node scripts/cascade-sweep.js 300 1 cost` (sous `--slot 1`, 35 s), la même expérience
qu'au J2 ([cascade-j2.md](cascade-j2.md)) : de 0,6 à 1,5 fois la charge, toutes les pertes d'une branche et 300
paires tirées par la graine 1, chacune jusqu'au bout de sa cascade, sous la règle de Grid2Op. Seul le point de départ
change : la répartition au moindre coût du réseau intact, résolue une fois par facteur de charge
([../modele.md](../modele.md) § 4 et 5). Les centrales gardent ses consignes pendant la cascade, et chaque îlot se
rééquilibre autour d'elles. Le détail est dans [cascade-j3.json](cascade-j3.json).

## 1. Ce qui change, sur les pertes simples

La perte moyenne de consommation et la part des pertes qui coûtent plus de 10 %, au J2 (au prorata de Pmax) et au J3
(au moindre coût) :

| Facteur | IEEE 30, J2 | IEEE 30, J3 | IEEE 118, J2 | IEEE 118, J3 | IEEE 118, J3 : lignes perdues |
|---|---|---|---|---|---|
| 0,6 | 0 % ; 0 % | 3,4 % ; 7 % | 0 % ; 0 % | 2,6 % ; 0 % | 8,9 |
| 0,7 | 3,9 % ; 7 % | 7,9 % ; 15 % | 0,3 % ; 1 % | 2,8 % ; 0,5 % | 9,3 |
| 0,8 | 4,4 % ; 7 % | 26,1 % ; 44 % | 0,7 % ; 3 % | 2,6 % ; 8 % | 5,2 |
| 0,9 | 6,2 % ; 10 % | 28,1 % ; 44 % | 1,9 % ; 7 % | 7,0 % ; 17 % | 9,8 |
| 1,0 | 8,2 % ; 12 % | 29,7 % ; 44 % | 2,8 % ; 10 % | 3,7 % ; 10 % | 5,9 |
| 1,1 | 65,3 % ; 93 % | 31,0 % ; 44 % | 30,3 % ; 98 % | 21,5 % ; 62 % | 21,2 |
| 1,2 | 72,9 % ; 100 % | 36,7 % ; 46 % | 32,5 % ; 100 % | 25,1 % ; 68 % | 24,2 |

Sur l'IEEE 14, rien ne change, à tous les facteurs : la seule perte qui fait cascade est 1-2. Au J3, 1-5 tombe dès le
premier pas (le nœud 1 envoie tout, plus de deux fois 128 MW) au lieu du troisième, et la perte finale est la même.

- **Au-dessus de la limite du J2, la répartition au moindre coût tient mieux** : à 1,1 fois la charge, la perte
  moyenne passe de 65 à 31 % sur le 30, de 30 à 22 % sur le 118. Elle repousse la limite du réseau intact.
- **En dessous, elle tient moins bien, et dès les faibles charges.** Sur le 118 à 0,6 fois la charge, plus de la
  moitié des pertes simples font tomber des lignes, 9 en moyenne, pour 2,6 % de consommation perdue.
- **La courbe n'est plus monotone** : sur le 118, la perte moyenne vaut 7,0 % à 0,9 et 3,7 % à 1,0. D'un facteur de
  charge à l'autre, la répartition change, et avec elle les lignes qu'elle laisse à leur limite.

## 2. Le fil du rasoir

**Une large part de ces cascades est un artefact.** La répartition au moindre coût laisse des lignes **exactement** à
leur limite : 77-82 et 94-100 sur le 118 à 0,6 fois la charge. Une perte, même lointaine, les pousse au-delà d'un
rien, et la règle de Grid2Op (une ligne au-delà de sa limite tombe à son 3e pas) les fait tomber. Mesuré sur le 118,
sur toutes les pertes simples, de combien la plus chargée de ces lignes dépasse sa limite :

| Facteur | Médiane | Au-delà de 10⁻⁶ | Au-delà de 0,1 % | Au-delà de 1 % |
|---|---|---|---|---|
| 0,6 | +0,001 % | 56 % des pertes | 27 % | 16 % |
| 1,0 | +0,017 % | 60 % | 42 % | 24 % |

Une perte sur deux « fait cascade » parce qu'une ligne dépasse sa limite de quelques millionièmes. Un exploitant ne
tient pas une ligne à 100,000 % : il garde une marge, ou il tient la règle N-1, qui borne aussi les flux d'après la
perte. Le résultat dépend donc d'un choix du modèle, le point de fonctionnement de départ : c'est la question posée à
Sami le 14/11.

## 3. La queue de Dobson

Elle ne se voit pas mieux qu'au J2. Sur le 118 à 1,1 fois la charge, les pertes simples se groupent entre 31 % (la
médiane) et 41 % (le 9e décile), avec un maximum à 48 % : un plateau, pas une loi de puissance. Les cascades restent
déterministes, et le hasard n'est que dans la perte de départ. La question 5 du cadrage (déterministe ou probabiliste,
à l'OPA) se reposera après le choix du point de départ.

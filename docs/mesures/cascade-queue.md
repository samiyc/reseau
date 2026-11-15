# La queue des tailles de panne, depuis la répartition du modèle

Mesuré le 15/11/2026 par `node scripts/cascade-tail.js secure 3000 1` (sous `--slot 1`, 7 min, dont 6,5 sur le 118).
C'est la question de P3 ([../recherche/pistes.md](../recherche/pistes.md)) : la distribution des tailles de panne
a-t-elle, à une charge critique, la queue en loi de puissance de Dobson ? La réponse conditionne la question 5 du
cadrage : une cascade déterministe ou probabiliste. Le détail est dans [cascade-queue.json](cascade-queue.json).

- **Les pannes de départ** : toutes les pertes d'une branche, **toutes les paires** (190, 820 et 17 205), et 3 000
  triplets tirés par la graine 1 (tous les 1 140 sur l'IEEE 14). Chacune va jusqu'au bout de sa cascade, sous la règle
  de Grid2Op, à 8 facteurs de charge de 0,7 à 1,3.
- **La répartition** : celle du modèle. C'est la moins chère qui tient la règle N-1 jusqu'à 0,722, 0,808 et 0,768 fois
  la charge, puis, au-delà, celle dont la pire charge après une perte est la plus faible
  ([cascade-n1.md](cascade-n1.md)).
- **La taille d'une panne** : la part de la consommation perdue, au-delà de ce que la répartition déleste avant toute
  perte. Ce délestage de départ n'existe que sur l'IEEE 30 au-delà de sa limite N-0 (1,104) : 3,3 % de la
  consommation à 1,15, 13 % à 1,3.
- **Ce qu'on compare** : la **densité** de probabilité de la taille, sur des classes d'une demi-décade, de 0,1 % à 100 %,
  et sa pente sur un graphique log-log, ajustée par moindres carrés sur les classes non vides. Une loi de puissance y
  est une droite. Les références ([../recherche/physique.md](../recherche/physique.md) § 5) :
  - les pannes nord-américaines de 1984 à 1998 : environ −1,1 ;
  - le modèle de branchement de Dobson à sa charge critique : −1,5 ;
  - un exposant de −1 à −2 est compatible avec les données.

## 1. L'IEEE 118, où la queue se forme

Sur les 17 205 paires : la perte moyenne, la part des paires par taille de panne, et la pente de la densité (celle des
3 000 triplets entre parenthèses).

| Facteur | Perte moyenne | Moins de 0,1 % | 0,1 à 1 % | 1 à 10 % | 10 à 100 % | Pente |
|---|---|---|---|---|---|---|
| 0,7 | 0,2 % | 93,0 % | 3,7 % | 2,6 % | 0,7 % | −1,72 (−1,52) |
| 0,8 | 1,1 % | 86,4 % | 4,5 % | 5,4 % | 3,7 % | −1,26 (−1,10) |
| 0,9 | 3,9 % | 75,8 % | 4,2 % | 5,2 % | 14,7 % | −0,81 (−0,76) |
| 1,0 | 10,9 % | 60,1 % | 3,7 % | 2,1 % | 34,0 % | −0,55 (−0,54) |
| 1,1 | 13,3 % | 55,8 % | 2,8 % | 1,1 % | 40,4 % | −0,41 (−0,35) |
| 1,15 | 24,7 % | 17,4 % | 2,2 % | 1,1 % | 79,3 % | −0,28 (−0,23) |
| 1,2 | 30,7 % | 5,7 % | 1,3 % | 0,0 % | 93,0 % | −0,01 (−0,06) |
| 1,3 | 34,2 % | 2,0 % | 0,7 % | 0,0 % | 97,1 % | +0,20 (+0,40) |

- **Autour de la limite N-1 (0,768), la pente est dans la plage de Dobson** : −1,7 à 0,7 fois la charge, −1,3 à 0,8
  (−1,5 et −1,1 sur les triplets). Les tailles s'étalent sur toutes les classes, de 0,1 à 30 %. Une partie des
  petites pertes ne doit rien à une cascade : à 0,7, 7 % des paires coûtent quelque chose, mais 3,5 % seulement font
  tomber une ligne, les autres isolent un nœud. Celles qui cascadent font tomber 1 ligne (176 paires) ou 4 à 15
  (376 paires), rarement 2 ou 3.
- **Au-delà, la densité s'aplatit puis s'inverse** : −0,8 à 0,9, −0,5 à 1,0, puis 0 et une pente positive à 1,2 et
  1,3. Le milieu se vide : à 1,0, une paire sur 50 perd de 1 à 10 %, une sur trois plus de 10 %. Les lignes perdues
  font de même : à 1,0, 695 paires n'en font tomber qu'une, 5 157 en font tomber de 16 à 63, et 925 entre les deux. C'est **du tout ou rien** : une cascade s'éteint aussitôt ou emporte une grande part du réseau, comme un
  processus de branchement au-delà de sa charge critique.
- **Le coude** est entre 0,9 et 1,0 (la perte moyenne passe de 3,9 à 10,9 %), puis entre 1,1 et 1,15 (de 13 à 25 %).
  C'est plus haut que la limite N-1 : entre les deux, la répartition à la moindre surcharge tient encore la plupart
  des pertes ([cascade-n1.md](cascade-n1.md) § 2).

## 2. Les IEEE 30 et 14 : trop petits pour une queue

Sur les 820 paires de l'IEEE 30 :

| Facteur | Perte moyenne | Moins de 0,1 % | 0,1 à 1 % | 1 à 10 % | 10 à 100 % | Pente |
|---|---|---|---|---|---|---|
| 0,7 | 0,4 % | 92,0 % | 0,4 % | 7,0 % | 0,7 % | −1,22 (−1,09) |
| 0,8 | 0,6 % | 91,7 % | 0,4 % | 7,0 % | 0,9 % | −1,15 (−1,01) |
| 0,9 | 9,8 % | 77,6 % | 0,2 % | 6,6 % | 15,6 % | −0,49 (−0,48) |
| 1,0 | 11,7 % | 75,0 % | 0,2 % | 6,6 % | 18,1 % | −0,38 (−0,39) |
| 1,1 | 23,1 % | 59,9 % | 0,2 % | 6,2 % | 33,7 % | −0,25 (−0,28) |
| 1,2 | 36,7 % | 36,1 % | 0,2 % | 6,1 % | 57,6 % | −0,14 (−0,19) |

- **La pente de −1,2 sous la limite N-1 n'est pas une queue.** Presque aucune paire ne fait tomber de ligne (3 sur
  820 à 0,8) : les 7 % entre 1 et 10 % sont des nœuds isolés, toujours les mêmes, qui perdent leur consommation. La
  pente ne dit que la taille de ces nœuds.
- **Au-delà, du tout ou rien**, comme sur le 118 : la classe de 1 à 10 % ne bouge pas (les mêmes isolements), et tout
  ce qui s'ajoute va au-delà de 10 %. Une paire y fait tomber au plus 15 lignes sur 41.
- **L'IEEE 14** a trois sortes de pannes, à tous les facteurs : rien, un nœud isolé (1 à 10 %), ou la chute de 1-2 et
  de 1-5, qui coupe le nœud 1 (plus de 32 %). Sa « pente » ne mesure rien.

## 3. Ce que ça dit

- **Une queue au sens de Dobson se voit sur l'IEEE 118, et seulement autour de sa limite N-1** : de 0,7 à 0,8 fois la
  charge, la densité des tailles décroît avec une pente de −1,1 à −1,7, dans la plage des données nord-américaines et
  du modèle de branchement. C'est une indication, pas une preuve. La pente s'ajuste sur 5 ou 6 classes. Le réseau n'a
  que 186 branches, ce qui coupe la queue tôt. Le hasard n'est que dans la panne de départ.
- **Au-delà, la cascade déterministe donne du tout ou rien** : le milieu de la distribution se vide, et une part
  croissante des pannes emporte de 10 à 60 % de la consommation. La répartition à la moindre surcharge déplace le
  coude (la falaise du J3 était entre 0,8 et 0,85 sur le 118), mais ne change pas cette forme.
- **Sur la question 5** : la cascade déterministe suffit à faire apparaître la charge critique et sa queue. Une
  cascade probabiliste, à l'OPA (une ligne surchargée tombe avec une probabilité), adoucirait sans doute le tout ou
  rien au-delà. C'est une hypothèse, non mesurée. Rien de ce qui vient (la journée du J4, la recherche sur le
  démarrage) n'en dépend.

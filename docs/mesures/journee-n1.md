# La règle N-1 sur l'année, sous la liste réglée (J4)

Mesuré le 17/11/2026 par `node scripts/day-n1.js v0.3-h12` (job `reseau-n1-annee-2`, 87 s). C'est le troisième
objectif de la règle à battre ([journee-j4.md](journee-j4.md)), les surcharges. La liste réglée joue les 366 jours de
2020 : la réserve publiée, une marge de 30 % sur le vent et le soleil prévus, un maintien de 12 heures, le démarrage
dans l'heure. Pour chacune des 8 784 heures, on cherche par les facteurs de report (LODF) quelle perte d'une seule
branche mettrait une autre au-delà de sa limite (`src/opf/security.js`). La répartition de chaque heure tient les
limites du réseau intact, pas celles d'après une perte. Le détail est dans [journee-n1.json](journee-n1.json).

## 1. Trois heures sur quatre ne tiennent pas la règle

- **6 473 heures sur 8 784 (73,7 %) ont au moins une surcharge après une perte**, avec 20 couples (perte, ligne
  surchargée) par heure en moyenne et 743 couples différents dans l'année.
- **Ce n'est pas le fil du rasoir** du J3 ([cascade-j3.md](cascade-j3.md) § 2), même s'il en a une part : 73,1 % des
  heures ont une surcharge de plus de 1 %, 70,1 % de plus de 5 %. Sur les heures non N-1, la pire charge après une perte
  a pour médiane 143 % de la limite, pour 9e décile 170 %, pour maximum 220 %.
- **La nuit et le soir surtout** : de 89 à 100 % des heures de 17 h à 6 h, de 30 à 49 % de 9 h à 15 h. Par mois, de 64 %
  (octobre) à 91 % (juillet). Par quartile de consommation : 80 % des heures les moins chargées, 61 et 66 % au milieu,
  88 % des plus chargées.

| Heure | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Non N-1 (%) | 94 | 95 | 93 | 93 | 92 | 89 | 75 | 46 | 30 | 31 | 35 | 40 | 40 | 42 | 49 | 65 | 88 | 98 | 100 | 100 | 98 | 94 | 92 | 89 |

## 2. Où

| Perte → ligne surchargée | Heures | Pire charge |
|---|---|---|
| 325-121 → 318-223, et l'inverse | 2 596 | 200 % |
| 323-325 → 318-223 | 2 596 | 200 % |
| 117-122 → 121-122, et l'inverse | 1 833 | 175 % |
| 301-303 → 303-309 | 2 155 | 157 % |
| 303-309 → 301-303 | 1 797 | 136 % |
| 220-223, 219-220, 218-221, 319-320, 318-321 → 303-309 | 1 800 à 2 750 chacune | 100 à 102 % |

- **Les deux liaisons de la zone 3 vers les zones 1 et 2** (325-121 et 318-223, 500 MW chacune, `branch.csv`) : la
  perte de l'une, ou du transformateur 323-325 qui alimente la première, met l'autre au double de sa limite.
- **Les deux lignes qui évacuent le nœud 122** (117-122 et 121-122, 500 MW) : ses six groupes hydrauliques
  (300 MW) et son parc éolien (713 MW) passent par elles, et la perte de l'une surcharge l'autre.
- **La ligne 303-309**, qui évacue l'éolien du nœud 309 : la répartition la tient souvent exactement à sa limite (c'est
  elle qui fait écrêter, [../modele.md](../modele.md) § 10). Toute perte voisine la pousse d'un rien au-delà : c'est
  la part du fil du rasoir.

## 3. Ce que ça dit pour la suite

- **La règle à battre a trois objectifs, et elle est mauvaise sur le troisième** : sans énergie non distribuée, au
  coût mesuré, mais trois heures sur quatre hors de la règle N-1. Une recherche qui la bat sur le coût devra au moins
  ne pas faire pire ici.
- **Tenir la règle N-1 coûterait** : sous leur limite N-1, la répartition N-1 coûte de 2 à 57 % de plus sur les
  IEEE 14 et 30, de 4 à 16 % sur le 118 ([opf-j3.md](opf-j3.md)) ; sur RTS-GMLC, avec les groupes de la liste réglée,
  3,4 % pour la tenir là où elle est tenable ([journee-liste-n1.md](journee-liste-n1.md)).
- **Une hypothèse du J4 à revoir** : la répartition de chaque heure ne demande que le réseau intact. **Fait le 17/11**
  (Sami) : la liste N-1, la répartition de chaque heure sous la règle, au moindre délestage puis à la moindre
  surcharge, est la seconde règle à battre. Elle coûte 3,4 % de plus, et 47 % des heures restent hors de la règle :
  les groupes démarrés ne permettent pas mieux ([journee-liste-n1.md](journee-liste-n1.md)).

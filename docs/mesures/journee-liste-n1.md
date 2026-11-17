# La liste N-1 : la seconde règle à battre

Mesuré le 17/11/2026, à la demande de Sami (« ok pour la piste 1, avec N-1 »). La liste réglée du J4
([journee-j4.md](journee-j4.md)) ne tient pas la règle N-1 trois heures sur quatre ([journee-n1.md](journee-n1.md)).
**La liste N-1** garde ses groupes démarrés (la réserve publiée, une marge de 30 % sur le vent et le soleil prévus, un
maintien de 12 heures, le démarrage dans l'heure). Seule change la répartition de chaque heure : celle du J3 au-delà
de la limite N-1 (`src/opf/margin.js`, [../modele.md](../modele.md) § 5), dans l'ordre de Sami :

1. le moindre délestage ;
2. puis la moindre pire charge après la perte d'une branche, notée α, qui vaut 1 quand la règle tient ;
3. puis le moindre coût.

C'est la variante `v0.3-h12-n1`.

- **Le prix** : `node scripts/day-measure.js --days all --out journee-n1-liste.json v0.3-h12 v0.3-h12-n1
  r2-v0.3-h12-n1 v0.5-h12-n1`, job `reseau-liste-n1-prix-2`, 724 s, sur les 366 jours ([journee-n1-liste.json](journee-n1-liste.json)).
- **Où** : `node scripts/day-n1.js v0.3-h12-n1 journee-n1-liste-n1.json`, job `reseau-liste-n1-ou-2`, 221 s.
- **Les cascades** : `node scripts/rts-cascades.js 240 v0.3-h12-n1 rts-cascades-n1.json`, job
  `reseau-liste-n1-cascades-2`, 651 s, aux mêmes 240 heures que [rts-cascades.md](rts-cascades.md).

Un premier passage a trouvé 8 heures où la répartition ne convergeait pas : 200 tours proximaux de `qp` ne suffisaient
pas à la première étape. `solveMargin` en permet 1 000 depuis (`5da6785`), et plus aucune heure ne manque.

## 1. Le prix : 3,4 % sur l'année, 3,2 % sur les jours impairs

Chaque variante contre la liste réglée, jour par jour, sur les 366 jours. « Hors N-1 » compte les heures où une perte
mettrait une branche au-delà de sa limite (à 10⁻⁵ près). « Pire charge » est la pire charge après une perte sur ces
heures : médiane, 9e décile, maximum.

| Variante | Coût par jour | $/MWh | Écart, IC 95 % | Énergie non distribuée | Heures hors N-1 | Pire charge | Écrêté par jour |
|---|---|---|---|---|---|---|---|
| liste réglée | 1 413,6 k$ | 14,14 | | aucune | 6 472 (73,7 %) | 143 %, 170 %, 220 % | 5,37 GWh |
| **liste N-1** | **1 461,7 k$** | **14,62** | **+48,1 k$ [+42,7 ; +53,4], +3,4 %** | aucune | **4 166 (47,4 %)** | 127 %, 170 %, 200 % | 7,50 GWh |
| liste N-1, deux fois la réserve | 1 474,3 k$ | 14,75 | +60,6 k$ [+53,9 ; +67,3], +4,3 % | aucune | 3 847 (43,8 %) | 125 %, 166 %, 200 % | 7,84 GWh |
| liste N-1, marge de 50 % | 1 465,2 k$ | 14,66 | +51,5 k$ [+44,2 ; +58,9], +3,6 % | aucune | 4 010 (45,7 %) | 128 %, 170 %, 200 % | 8,06 GWh |

- **La liste N-1 coûte plus cher chacun des 366 jours** : la répartition fait passer moins par les lignes chargées,
  avec des groupes plus chers et en **écrêtant** 2,1 GWh de plus par jour de vent, de soleil et d'hydraulique, qui
  ne coûtent rien. Ses démarrages sont les mêmes (8,4 par jour, dont 2,4 dans l'heure) : ses groupes aussi.
- **Elle ramène 2 306 heures sous la règle**, et n'en fait sortir aucune. Il en reste 4 166, que les groupes démarrés
  ne peuvent pas tenir : α > 1 y est le mieux que la répartition puisse faire.
- **Plus de groupes en marche aident un peu, et coûtent** : deux fois la réserve ôte 0,9 heure hors N-1 par jour pour
  13 k$ de plus ; la marge de 50 %, 0,4 heure. Sur les jours pairs (ceux du réglage), la marge de 50 % coûte 7,0 k$ de plus
  par jour, IC [+1,5 ; +12,4], pour 0,38 heure de moins hors N-1. Coût et surcharges ne se mélangent pas
  (CLAUDE.md) : la liste N-1 garde les réglages du J4, faits sur le coût.

**Sur les 183 jours impairs**, ceux de la mesure du J4 : **1 475,7 k$ par jour, 14,76 $/MWh**, +45,1 k$ par jour sur
la liste réglée, IC [+38,1 ; +52,0] (+3,2 %), sans énergie non distribuée, **11,5 heures hors N-1 par jour** au lieu
de 17,6.

## 2. Où elle reste hors de la règle

| Heure | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Liste réglée (%) | 94 | 95 | 93 | 93 | 92 | 89 | 75 | 46 | 30 | 31 | 35 | 40 | 40 | 42 | 49 | 65 | 88 | 98 | 100 | 100 | 98 | 94 | 92 | 89 |
| Liste N-1 (%) | 52 | 42 | 40 | 39 | 41 | 46 | 33 | 17 | 19 | 26 | 30 | 33 | 34 | 37 | 39 | 45 | 67 | 86 | 92 | 91 | 81 | 61 | 44 | 43 |

La nuit se règle surtout par la répartition : de 9 heures sur 10 à 4 sur 10. Le soir, de la 17e à la 21e heure, pas : la
liste N-1 y reste hors de la règle de 67 à 92 % des heures.

| Perte → ligne surchargée | Heures | Pire charge |
|---|---|---|
| 325-121 → 318-223, et l'inverse ; 323-325 → 318-223 | 2 500 | 199,8 % |
| 208-209 → 208-210, et l'inverse | 1 727 | 168,8 % |
| 107-108 → 107-203, et l'inverse | 1 248 | 180,6 % |
| 308-309 → 308-310, et l'inverse | 988 | 139,6 % |
| 315-321, 215-221, 123-217 → 325-121 | 980 à 1 390 chacune | 100 à 113 % |

- **Les deux liaisons de la zone 3** restent les premières : la répartition ne fait pas descendre ce que l'une
  reporte sur l'autre. **Hypothèse**, non vérifiée : l'échange de la zone 3 est fixé par ses groupes démarrés (leur
  premier point est fixe) et sa consommation ; seul le démarrage pourrait le changer.
- **Des paires de lignes qui partent d'un même nœud** (208, 107 et 308) prennent la suite : chacune reçoit, à la perte
  de l'autre, ce qu'elle portait.
- **Les lignes d'évacuation du nœud 122** (117-122 et 121-122) passent de 1 833 heures à 733, à 153 % au plus : sans
  doute en écrêtant leur vent (**hypothèse**, l'écrêtement par nœud n'est pas relevé).

## 3. Les cascades : 25 heures fragiles sur 56 deviennent calmes

Aux mêmes 240 heures que [rts-cascades.md](rts-cascades.md), les 120 pertes simples et les 7 140 paires, depuis la
répartition de la liste N-1 ([rts-cascades-n1.json](rts-cascades-n1.json)) :

| | Liste réglée | Liste N-1 |
|---|---|---|
| Heures fragiles (une perte simple coûte plus de 1 % en moyenne) | 56 | 31, toutes fragiles déjà |
| Perte moyenne d'une perte simple, sur les 240 heures | 1,65 % | 1,29 % |
| Perte moyenne d'une paire, sur les 240 heures | 2,19 % | 1,67 % |
| Aux heures fragiles : paires sans perte (moins de 0,1 %) | 59,5 % | 50,8 % |
| Aux heures fragiles : paires qui perdent de 10 à 32 % | 32,5 % | 42,1 % |

- **Une heure qui tient la règle N-1 est calme** : aucune des 31 heures fragiles n'a α = 1. Leur α a pour médiane
  1,58 et pour maximum 1,96. Les 209 heures calmes tiennent la règle aux deux tiers, avec un α médian de 1,00.
- **Les heures qui restent fragiles le sont autant ou plus** : 42 % des paires y emportent de 10 à 32 % de la
  consommation. Ce sont celles que les groupes démarrés ne peuvent pas tenir : 25 de la 14e à la 23e heure, 6 la nuit.
- **Le tout ou rien a une cause commune** (`node scripts/rts-cascade-causes.js rts-cascades-n1.json v0.3-h12-n1`) :
  - Dans 1 213 des 1 428 pertes simples qui emportent plus de 10 % aux heures fragiles (85 %), **la première ligne à
    tomber est la liaison 325-121** de la zone 3. Sous la liste réglée, c'est 1 401 sur 1 911 (73 %).
  - Les pertes de départ sont variées : 315-321, 215-221, 323-325, 318-223, 118-121, et d'autres.
  - Le réseau finit le plus souvent en deux îlots (727 fois sur 1 428).

  C'est l'hypothèse de [rts-cascades.md](rts-cascades.md) § 2, mais par un autre chemin que le seuil de 200 % : une perte
  de beaucoup d'endroits surcharge 325-121, qui tombe, puis la zone 3 se coupe du reste.

## 4. Ce que ça donne pour la suite

**Deux règles à battre**, mesurées sur les mêmes jours impairs, objectif par objectif :

| Règle | Énergie non distribuée | Coût par jour | Heures hors N-1 par jour |
|---|---|---|---|
| la liste réglée (`v0.3-h12`) | aucune | 1 430,7 k$ | 17,6 |
| la liste N-1 (`v0.3-h12-n1`) | aucune | 1 475,7 k$ | 11,5 |

- **Une recherche sur le démarrage (P7) peut gagner sur les deux** : c'est le démarrage qui laisse 4 166 heures hors de
  la règle, et 31 heures fragiles sur 240. Démarrer un groupe dans la zone 3 ou près des nœuds 107, 208 et 308 aux
  heures du soir est ce que la liste ne sait pas faire (**hypothèse**).
- **Battre la liste réglée sur le coût en restant aussi fragile ne suffit plus** : une recherche doit dire où elle se
  place contre l'une et l'autre, sur les trois objectifs.

# Le faisceau sur le démarrage, contre les deux règles (J5)

Mesuré le 17/11/2026, à la demande de Sami (« ok pour le J5 »). C'est la piste P7
([../recherche/pistes.md](../recherche/pistes.md)) : chercher quels groupes démarrer, plutôt que les prendre dans
l'ordre de la liste. Le faisceau est mesuré contre les deux règles à battre :
- **la liste réglée** du J4, faite sur le coût ([journee-j4.md](journee-j4.md)) ;
- **la liste N-1**, faite sur les surcharges ([journee-liste-n1.md](journee-liste-n1.md)).

Chaque faisceau est comparé à sa règle sur ses trois objectifs, chacun à part.

## 1. Le faisceau

`src/day/beam.js`, sur `createBeam` de mcts-commun. Il décide la veille, sur la prévision, comme la liste ; le plan est
ensuite joué sur le réalisé par le même `playDay`, avec le démarrage dans l'heure.

- **Les plans** : le faisceau garde les W meilleurs plans partiels (W = 8 ou 32), heure après heure.
- **Les successeurs sont ceux de la liste** (de Mars, 2022 : une politique élague, une recherche regarde devant). À
  chaque heure, douze choix, à partir de l'heure que la liste aurait décidée depuis l'état du plan :
  - l'heure de la liste elle-même ;
  - cette heure avec un groupe de plus : le k-ième groupe libre à l'arrêt dans l'ordre de la liste, k de 1 à 8 (le
    suivant de la liste, ou un plus loin, peut-être mieux placé sur le réseau) ;
  - avec ses un ou deux groupes les plus chers arrêtés ;
  - avec tous les groupes de l'heure d'avant gardés en marche.
- **Les limites** : les temps minimaux de marche et d'arrêt sont tenus, comme la capacité que la liste demande, sa
  réserve. Le faisceau cherche *quels* groupes faire tourner, pas combien de MW garder en réserve. La première heure
  est celle de la liste : la journée part des mêmes groupes.
- **La note** : la répartition de chaque heure sur la prévision (sous la règle N-1 pour la variante `-n1`), avec le
  démarrage dans l'heure comme le jour le jouera, plus les démarrages. Elle suit l'ordre de Sami (question 4,
  lexicographique) :
  1. le délestage ;
  2. puis la surcharge : la pire charge après une perte, au-delà de 1, sommée sur les heures ;
  3. puis le coût.
- **La valeur d'un plan partiel** (méthode du pilote) : la liste joue les heures qui restent. Chaque plan est donc noté
  sur sa journée complétée par la liste, et le plan de la liste est toujours parmi eux : le faisceau ne fait jamais
  pire qu'elle sur la prévision.

**Deux défauts trouvés en l'essayant**, sur 4 jours :
- **Sans le démarrage dans l'heure dans la note**, la liste délestait en prévision (132 MW le jour 1). Le faisceau
  payait d'avance des groupes pour l'éviter, alors que le temps réel couvre ce manque par les turbines, moins cher :
  1 080 k$ au lieu de 1 010 k$.
- **Sans valeur**, le faisceau était glouton : il élaguait tôt les plans qui gardent un groupe pour le soir et ne
  retrouvait même plus le plan de la liste.

**Hypothèse de la note** : les turbines démarrées dans l'heure y paient leur démarrage à froid, et n'y restent pas en
marche les heures suivantes (le jeu les y garde).

**La mesure** : `node scripts/day-measure.js --part k/12 --out journee-j5-pk.json v0.3-h12 v0.3-h12-n1 b8-v0.3-h12
b32-v0.3-h12 b8-v0.3-h12-n1 b32-v0.3-h12-n1`, jobs `reseau-j5-p1` à `p12` (1 670 à 1 944 s chacun), puis `--merge`
([journee-j5.json](journee-j5.json)). Ce sont les **183 jours impairs**, ceux de la mesure du J4. Les deux largeurs
sont mesurées sur ces jours mêmes : les deux sont rapportées, aucune n'est choisie après coup sur eux.

## 2. Contre la liste réglée : 1 % de moins

| Variante | Coût par jour | Écart à la liste, IC 95 % | Jours moins chers | Énergie non distribuée | Démarrages (dans l'heure) | Écrêté par jour | Heures hors N-1 par jour |
|---|---|---|---|---|---|---|---|
| liste réglée | 1 430,7 k$ | | | aucune | 8,6 (2,5) | 5,25 GWh | 17,5 |
| faisceau de 8 | 1 418,5 k$ | **−12,2 k$ [−15,7 ; −8,6], −0,85 %** | 139 sur 183 | aucune | 8,0 (1,9) | 4,87 GWh | 17,4 |
| faisceau de 32 | 1 416,7 k$ | **−14,0 k$ [−17,6 ; −10,5], −0,98 %** | 149 sur 183 | aucune | 8,0 (1,8) | 4,84 GWh | 17,3 |

- **Le faisceau bat la liste réglée** sur le coût, à énergie non distribuée égale (aucune), et ne fait pas pire sur
  les surcharges (−0,2 heure hors N-1 par jour, IC [−0,4 ; 0,0]).
- **C'est en bas de l'attente de P7** (1 à 3 %, **hypothèse** d'après de Mars, qui gagnait jusqu'à 1,4 % contre le
  démarrage déterministe) : la liste réglée est déjà bonne, et le faisceau ne touche pas à la réserve.
- **D'où vient le gain** : les démarrages coûtent autant (158 k$ par jour contre 159 k$). Le faisceau démarre moins de
  turbines dans l'heure (1,9 contre 2,5) et écrête moins de vent et de soleil (4,87 GWh contre 5,25). Ses groupes en
  marche laissent plus de place au renouvelable : **hypothèse**, l'écrêtement par groupe n'est pas relevé.
- **32 plans font un peu mieux que 8** : −1,9 k$ par jour, IC [−2,8 ; −0,9] : moins chers 57 jours, plus chers 14,
  le même plan 112 jours, pour un calcul environ deux fois plus long (15 s par jour au lieu de 7).
- Sur 6 jours, le faisceau n'a rien trouvé de mieux que la liste en prévision : il joue la liste.

## 3. Contre la liste N-1 : 3,9 heures hors N-1 de moins par jour, pour 6 % de plus

| Variante | Coût par jour | Écart à la liste N-1, IC 95 % | Heures hors N-1 par jour | Écart, IC 95 % | Pire charge : médiane, 9e décile, max | Énergie non distribuée |
|---|---|---|---|---|---|---|
| liste N-1 | 1 475,7 k$ | | 11,5 (47,7 %) | | 127 %, 170 %, 200 % | aucune |
| faisceau N-1 de 8 | 1 566,5 k$ | +90,8 k$ [+75,3 ; +106,2], +6,2 % | **7,6 (31,5 %)** | **−3,9 h [−4,5 ; −3,3]** | 117 %, 150 %, 196 % | aucune |
| faisceau N-1 de 32 | 1 565,1 k$ | +89,3 k$ [+73,6 ; +105,0], +6,1 % | 7,6 (31,5 %) | −3,9 h [−4,5 ; −3,3] | 117 %, 150 %, 196 % | aucune |

- **Dans l'ordre de Sami, le faisceau N-1 bat la liste N-1** : même énergie non distribuée (aucune), puis 3,9 heures
  hors de la règle de moins par jour. Il en a moins 134 jours sur 183, plus 2 jours. 15 jours tiennent la règle à
  toutes les heures, contre 5.
- **Il le paie** : +6,2 % sur la liste N-1, +9,5 % sur la liste réglée (+135,8 k$ par jour, IC [+117,8 ; +153,8]). Il
  démarre plus de groupes (10,2 par jour contre 8,6) et écrête plus (8,0 GWh). La note est lexicographique : une
  surcharge plus faible l'emporte sur n'importe quel coût.
- **Le prix d'une heure ramenée sous la règle** : environ 23 k$ pour le faisceau N-1, au-delà de la liste N-1.
  C'est trois fois plus que la répartition N-1 seule (7,4 k$ l'heure, la liste N-1 contre la liste réglée), mais
  c'est un gain que la répartition ne pouvait pas faire.
- **La largeur ne change rien** sous N-1 : −1,4 k$ par jour, IC [−6,1 ; +3,2], et les mêmes heures.

**Où** (part des jours hors N-1, à chaque heure) :

| Heure | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Liste réglée (%) | 93 | 95 | 93 | 92 | 89 | 87 | 75 | 46 | 28 | 31 | 36 | 39 | 39 | 42 | 49 | 64 | 88 | 98 | 99 | 100 | 98 | 93 | 91 | 87 |
| Liste N-1 (%) | 53 | 41 | 40 | 44 | 44 | 48 | 34 | 19 | 20 | 26 | 30 | 32 | 34 | 39 | 39 | 46 | 66 | 85 | 92 | 91 | 79 | 58 | 45 | 40 |
| Faisceau N-1 de 8 (%) | 53 | 19 | 11 | 12 | 14 | 15 | 15 | 9 | 18 | 24 | 28 | 31 | 32 | 34 | 36 | 36 | 45 | 60 | 75 | 72 | 49 | 31 | 23 | 14 |

- **La nuit se règle presque entièrement** : de 4 jours sur 10 à 1 sur 10 de la 2e à la 7e heure. La première heure
  ne bouge pas : elle est celle de la liste, par construction.
- **Le soir recule, sans disparaître** : de 85-92 % à 60-75 % de la 18e à la 20e heure. Le soir est le moment où la
  liste N-1 restait hors de la règle faute des bons groupes ([journee-liste-n1.md](journee-liste-n1.md) § 2) : le
  faisceau en démarre d'autres. Lesquels n'est pas relevé ; l'**hypothèse** du J4, des groupes de la zone 3 ou près des
  nœuds 107, 208 et 308, reste à vérifier.
- **Le milieu de la journée ne bouge presque pas** (de 9 à 36 %, comme la liste N-1) : **hypothèse**, ce sont les
  heures où le solaire fixe les flux, que le démarrage ne change pas.

## 4. Ce que ça donne pour la suite

- **Les deux règles sont battues, chacune sur son objectif** : la liste réglée de 1 % sur le coût, la liste N-1 de
  3,9 heures hors N-1 par jour, à énergie non distribuée égale (aucune).
- **Le faisceau sur le coût ne rend pas le réseau plus sûr**, et le faisceau N-1 coûte cher. Entre les deux, il y a
  une frontière : combien payer une heure ramenée sous la règle. La note lexicographique ne la montre pas ; une note
  pondérée (question 4, b) la parcourrait, au prix d'un prix inventé par heure hors N-1. **Sami, 17/11** : on garde
  la note lexicographique.
- **Les deux sont décidés sur la prévision** : sur les jours mal prévus, le faisceau peut perdre. Il perd 28 à 38
  jours sur 183 contre la liste réglée. C'est la question de P8 : chercher sur plusieurs mondes météo.
- **Ses cascades** (§ 5) : 2 heures fragiles sur 240 au lieu de 31 pour la liste N-1. Le faisceau N-1 ne fait pas
  que retirer des heures hors de la règle : il retire surtout celles où une perte part en cascade.

## 5. Les cascades du faisceau N-1 : 2 heures fragiles sur 240

`node scripts/rts-cascades.js 240 b8-v0.3-h12-n1 rts-cascades-faisceau-n1.json`, job
`reseau-cascades-faisceau-n1`, 7 589 s (le faisceau replanifie la journée de chaque heure), aux mêmes 240 heures que
[rts-cascades.md](rts-cascades.md) et [journee-liste-n1.md](journee-liste-n1.md) § 3
([rts-cascades-faisceau-n1.json](rts-cascades-faisceau-n1.json)). Une heure est fragile quand une perte simple y coûte
plus de 1 % de la consommation en moyenne.

| | Liste réglée | Liste N-1 | Faisceau N-1 de 8 |
|---|---|---|---|
| Heures fragiles | 56 | 31 | **2** |
| Heures qui tiennent la règle N-1 (α = 1) | non relevé | 138 | 171 |
| Perte moyenne d'une perte simple, sur les 240 heures | 1,65 % | 1,29 % | **0,14 %** |
| Perte moyenne d'une paire, sur les 240 heures | 2,19 % | 1,67 % | **0,28 %** |
| Aux heures fragiles : paires sans perte (moins de 0,1 %) | 59,5 % | 50,8 % | 51,2 % |
| Aux heures fragiles : paires qui perdent de 10 à 32 % | 32,5 % | 42,1 % | 33,2 % |

Aucune cascade non stabilisée, aucune heure sans répartition.

- **29 des 31 heures fragiles de la liste N-1 deviennent calmes** : une perte simple y coûtait de 1,1 à 21,7 % en
  moyenne, elle y coûte de 0,02 à 0,42 %. 18 tiennent la règle ; les 11 autres restent un peu au-delà (α de 1,01 à
  1,26 ; sous la liste N-1, α médian de 1,58 aux heures fragiles).
- **Le soir aussi** : 23 de ces 29 heures sont de la 17e à la 23e heure, 5 la nuit, 1 à la 14e. Le soir reste hors de la
  règle 60 à 75 % du temps (§ 3), mais d'un peu : ses pertes n'y font plus tomber de ligne en chaîne.
- **Pourquoi celles-là** : la note somme l'excès α − 1 sur les heures, et les heures fragiles ont les plus grands α ;
  c'est là que la note gagne le plus. Quels groupes le faisceau y démarre n'est pas relevé : l'**hypothèse** de
  [journee-liste-n1.md](journee-liste-n1.md) § 3, des groupes qui déchargent la liaison 325-121 de la zone 3, reste à
  vérifier.
- **α ne suffit pas à dire qu'une heure est fragile** : aux heures calmes hors de la règle, α va jusqu'à 1,67, sous
  la liste N-1 comme sous le faisceau. C'est la ligne surchargée qui compte, pas seulement combien.
- **Les deux heures qui restent** ont le même α et la même perte que sous la liste N-1, à 0,01 % près : la 5e heure du
  jour 141 (3 438 MW, α = 1,96, 15,5 % par perte simple) et la 15e heure du jour 238, la plus chargée de l'année
  (7 961 MW, α = 1,62). Le faisceau n'y a pas changé la répartition ; **hypothèse** : aucun des douze successeurs ne
  les rend tenables (à la pointe, les groupes sont sans doute presque tous en marche).
- **Le prix reste celui du § 3** : +6,2 % sur la liste N-1, +9,5 % sur la liste réglée.

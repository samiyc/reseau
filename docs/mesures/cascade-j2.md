# J2 : la cascade et la charge critique

Mesuré le 14/11/2026 (piste P3 de [../recherche/pistes.md](../recherche/pistes.md)) :
`node scripts/cascade-sweep.js 300 1`, passé par un créneau d'un fil de la file (`mcts-backlog --slot 1`), 25 s en
tout. Les données brutes sont dans [cascade-j2.json](cascade-j2.json).

## Le dispositif

- **Les réseaux** : les IEEE 14, 30 et 118 de PGLib-OPF v23.07, avec leurs limites de ligne.
- **La répartition** : dans chaque îlot, toutes les centrales produisent la même part de leur Pmax
  (`src/grid/supply.js`). C'est une **hypothèse** provisoire, neutre, en attendant le DC-OPF du J3. Les productions
  des fichiers PGLib ne sont pas un point de fonctionnement (un « départ à plat ») : avec la seule référence pour
  équilibrer, le 118 délestait déjà 393 MW sans aucune panne. L'ordre de préséance, essayé aussi, surcharge le 30 et
  le 118 dès la charge de base, comme attendu d'une règle qui ignore les lignes.
- **La règle de déclenchement** : celle de Grid2Op 1.12.6, lue dans son code (`Backend.next_grid_state`,
  `Parameters.py`). Au-delà de 2 fois sa limite, une ligne tombe aussitôt, et les flux sont recalculés dans le même
  pas jusqu'à ce que plus rien ne tombe. Au-delà de sa limite, son compteur monte d'un cran par pas, et elle tombe
  quand il dépasse 2, donc à son 3e pas de surcharge d'affilée. Un îlot sans assez de production déleste ce qui
  manque, au prorata.
- **Les évènements** : à chaque facteur de charge, de 0,6 à 1,5, **toutes les pertes d'une ligne** (sans hasard), et
  **300 paires** tirées par la graine 1 (190 sur le 14, qui n'en a pas plus). Chaque cascade va jusqu'à ce que le
  réseau tienne (aucune n'a atteint la borne de 50 pas).
- **La mesure** : la part de la consommation perdue à la fin, comme Dobson, Carreras et Newman (2005) ; sa moyenne
  avec son intervalle à 95 %, la part des évènements qui coûtent plus de 10 % (avec l'intervalle de Wilson), et le
  nombre moyen de lignes perdues.
- **Les limites de sécurité** : le premier facteur (par pas de 0,01) où le réseau intact a une ligne au-delà de sa
  limite (N-0), et le premier où la perte d'une seule ligne en met une autre au-delà (N-1).

## Ce que ça montre

1. **Il y a un coude, et c'est la limite N-0.** Sur le 30, la perte moyenne passe de 8 % à 64 % (pertes simples)
   entre 1,00 et 1,05 fois la charge ; sur le 118, de 4 % à 30 % entre 1,05 et 1,10. Ce sont exactement les facteurs
   où le réseau intact surcharge : 1,03 et 1,09. Au-delà, la cascade n'a plus besoin d'évènement : elle part d'elle-même,
   et presque toute panne finit au-dessus de 10 %.
2. **Aucun des trois réseaux n'est N-1 à sa charge de base**, avec cette répartition : une seule perte de ligne fait
   surcharger dès 0,58 (14, la perte de 1-2), 0,65 (30, 1-2) et 0,68 (118, 38-65). Entre la limite N-1 et la limite
   N-0, les pertes montent doucement : c'est la zone où la règle N-1 a quelque chose à protéger. Elle aura un coût
   (J3, J4).
3. **Sous le coude, les grosses pertes viennent de la topologie, pas de la charge.** Sur le 14, la seule perte simple
   qui coûte (5 % des évènements, la perte de 1-2) surcharge 1-5, qui tombe au 3e pas : le nœud 1 et ses 340 MW se
   retrouvent seuls, et le réseau perd 200 MW sur 259. Le 14 n'a qu'une porte de sortie pour sa grosse centrale. Les
   paires ajoutent les îlots (le nœud 14 coupé de 9 et de 13, etc.).
4. **Les paires coûtent deux à trois fois plus que les pertes simples** sous le coude (118 à 1,00 : 6,6 % contre
   2,8 % ; part au-delà de 10 % : 23 % contre 10 %), et autant au-delà : là, la cascade ne dépend plus de l'évènement.
5. **La courbe n'est pas lisse au-delà du coude** (118 : 46 % à 1,35, 40 % à 1,40). La règle est déterministe : un
   facteur un peu plus haut peut faire tomber une ligne plus tôt et sauver un îlot. Ce n'est pas du bruit de mesure.

**Ce que ça ne montre pas encore** : la queue en loi de puissance de Dobson. Notre transition est brutale, parce que la
règle est déterministe et que la répartition ne réagit pas (elle ne redispatche pas pour soulager une ligne). Le
modèle probabiliste d'OPA, et surtout une répartition qui tient compte des lignes (le DC-OPF du J3), sont les deux
leviers pour la voir. **Décision proposée** : refaire cette mesure au J3, avec le DC-OPF, avant de toucher à la règle
(Sami avait demandé le déterministe d'abord, et le probabiliste seulement s'il change les conclusions).

## Les tableaux

Chaque cellule : la perte moyenne ± son intervalle à 95 %, la part des évènements au-delà de 10 % [intervalle de
Wilson], le nombre moyen de lignes perdues.


## IEEE 14 (0.3 s)

N-0 : > 1,6 ; N-1 : 0.58 (perte de 1-2). 20 pertes simples, 190 paires.

| Facteur | Pertes simples : perte moyenne, part > 10 %, lignes perdues | Paires : perte moyenne, part > 10 %, lignes perdues |
|---|---|---|
| 0,60 | 3,1 % ± 6,1 %, 5,0 % [0,9 % ; 23,6 %], 0,1 | 6,5 % ± 2,7 %, 10,5 % [6,9 % ; 15,7 %], 0,1 |
| 0,65 | 3,2 % ± 6,4 %, 5,0 % [0,9 % ; 23,6 %], 0,1 | 7,1 % ± 2,8 %, 11,6 % [7,8 % ; 16,9 %], 0,1 |
| 0,70 | 3,4 % ± 6,6 %, 5,0 % [0,9 % ; 23,6 %], 0,1 | 7,4 % ± 2,9 %, 11,6 % [7,8 % ; 16,9 %], 0,1 |
| 0,75 | 3,5 % ± 6,8 %, 5,0 % [0,9 % ; 23,6 %], 0,1 | 7,6 % ± 3,0 %, 11,6 % [7,8 % ; 16,9 %], 0,1 |
| 0,80 | 3,6 % ± 7,0 %, 5,0 % [0,9 % ; 23,6 %], 0,1 | 7,8 % ± 3,1 %, 11,6 % [7,8 % ; 16,9 %], 0,1 |
| 0,85 | 3,7 % ± 7,2 %, 5,0 % [0,9 % ; 23,6 %], 0,1 | 8,0 % ± 3,2 %, 11,6 % [7,8 % ; 16,9 %], 0,1 |
| 0,90 | 3,7 % ± 7,3 %, 5,0 % [0,9 % ; 23,6 %], 0,1 | 8,1 % ± 3,2 %, 11,6 % [7,8 % ; 16,9 %], 0,1 |
| 0,95 | 3,8 % ± 7,5 %, 5,0 % [0,9 % ; 23,6 %], 0,1 | 8,2 % ± 3,3 %, 11,6 % [7,8 % ; 16,9 %], 0,1 |
| 1,00 | 3,9 % ± 7,6 %, 5,0 % [0,9 % ; 23,6 %], 0,1 | 8,8 % ± 3,4 %, 12,1 % [8,2 % ; 17,5 %], 0,1 |
| 1,05 | 3,9 % ± 7,7 %, 5,0 % [0,9 % ; 23,6 %], 0,1 | 9,9 % ± 3,7 %, 13,2 % [9,1 % ; 18,7 %], 0,1 |
| 1,10 | 4,0 % ± 7,8 %, 5,0 % [0,9 % ; 23,6 %], 0,1 | 10,5 % ± 3,8 %, 13,7 % [9,5 % ; 19,3 %], 0,1 |
| 1,15 | 4,0 % ± 7,9 %, 5,0 % [0,9 % ; 23,6 %], 0,1 | 11,0 % ± 3,9 %, 14,2 % [10,0 % ; 19,9 %], 0,2 |
| 1,20 | 4,1 % ± 7,9 %, 5,0 % [0,9 % ; 23,6 %], 0,1 | 11,1 % ± 3,9 %, 14,2 % [10,0 % ; 19,9 %], 0,2 |
| 1,25 | 4,1 % ± 8,0 %, 5,0 % [0,9 % ; 23,6 %], 0,1 | 11,7 % ± 4,1 %, 14,7 % [10,4 % ; 20,5 %], 0,2 |
| 1,30 | 4,1 % ± 8,1 %, 5,0 % [0,9 % ; 23,6 %], 0,1 | 13,2 % ± 4,3 %, 16,3 % [11,7 % ; 22,2 %], 0,2 |
| 1,35 | 4,2 % ± 8,1 %, 5,0 % [0,9 % ; 23,6 %], 0,1 | 13,6 % ± 4,3 %, 17,4 % [12,6 % ; 23,4 %], 0,2 |
| 1,40 | 4,2 % ± 8,2 %, 5,0 % [0,9 % ; 23,6 %], 0,1 | 14,0 % ± 4,4 %, 18,4 % [13,6 % ; 24,5 %], 0,2 |
| 1,45 | 4,2 % ± 8,3 %, 5,0 % [0,9 % ; 23,6 %], 0,1 | 14,1 % ± 4,4 %, 18,4 % [13,6 % ; 24,5 %], 0,2 |
| 1,50 | 18,0 % ± 16,2 %, 20,0 % [8,1 % ; 41,6 %], 0,5 | 31,8 % ± 5,9 %, 38,4 % [31,8 % ; 45,5 %], 0,8 |

## IEEE 30 (1.7 s)

N-0 : 1.03 ; N-1 : 0.65 (perte de 1-2). 41 pertes simples, 300 paires.

| Facteur | Pertes simples : perte moyenne, part > 10 %, lignes perdues | Paires : perte moyenne, part > 10 %, lignes perdues |
|---|---|---|
| 0,60 | 0,0 % ± 0,1 %, 0,0 % [0,0 % ; 8,6 %], 0,0 | 0,3 % ± 0,2 %, 0,7 % [0,2 % ; 2,4 %], 0,0 |
| 0,65 | 1,2 % ± 2,4 %, 2,4 % [0,4 % ; 12,6 %], 0,0 | 2,6 % ± 1,2 %, 5,3 % [3,3 % ; 8,5 %], 0,1 |
| 0,70 | 3,9 % ± 4,3 %, 7,3 % [2,5 % ; 19,4 %], 0,1 | 9,8 % ± 2,3 %, 18,7 % [14,7 % ; 23,5 %], 0,2 |
| 0,75 | 4,2 % ± 4,6 %, 7,3 % [2,5 % ; 19,4 %], 0,1 | 10,4 % ± 2,5 %, 18,7 % [14,7 % ; 23,5 %], 0,2 |
| 0,80 | 4,4 % ± 4,8 %, 7,3 % [2,5 % ; 19,4 %], 0,1 | 10,9 % ± 2,6 %, 18,7 % [14,7 % ; 23,5 %], 0,2 |
| 0,85 | 4,5 % ± 5,0 %, 7,3 % [2,5 % ; 19,4 %], 0,1 | 11,3 % ± 2,7 %, 18,7 % [14,7 % ; 23,5 %], 0,2 |
| 0,90 | 6,2 % ± 5,9 %, 9,8 % [3,9 % ; 22,5 %], 0,2 | 14,1 % ± 3,0 %, 22,3 % [18,0 % ; 27,4 %], 0,4 |
| 0,95 | 6,4 % ± 6,0 %, 9,8 % [3,9 % ; 22,5 %], 0,2 | 15,3 % ± 3,1 %, 24,0 % [19,5 % ; 29,1 %], 0,5 |
| 1,00 | 8,2 % ± 6,8 %, 12,2 % [5,3 % ; 25,5 %], 0,3 | 19,3 % ± 3,4 %, 29,3 % [24,5 % ; 34,7 %], 0,7 |
| 1,05 | 64,0 % ± 5,6 %, 92,7 % [80,6 % ; 97,5 %], 2,7 | 60,0 % ± 2,7 %, 86,7 % [82,4 % ; 90,1 %], 2,5 |
| 1,10 | 65,3 % ± 5,7 %, 92,7 % [80,6 % ; 97,5 %], 3,3 | 62,1 % ± 2,6 %, 88,0 % [83,8 % ; 91,2 %], 2,9 |
| 1,15 | 66,5 % ± 5,8 %, 92,7 % [80,6 % ; 97,5 %], 3,5 | 63,2 % ± 2,7 %, 88,0 % [83,8 % ; 91,2 %], 3,2 |
| 1,20 | 72,9 % ± 0,1 %, 100,0 % [91,4 % ; 100,0 %], 3,9 | 72,9 % ± 0,5 %, 100,0 % [98,7 % ; 100,0 %], 3,9 |
| 1,25 | 74,0 % ± 0,0 %, 100,0 % [91,4 % ; 100,0 %], 4,0 | 74,3 % ± 0,4 %, 100,0 % [98,7 % ; 100,0 %], 4,2 |
| 1,30 | 75,0 % ± 0,0 %, 100,0 % [91,4 % ; 100,0 %], 4,1 | 75,3 % ± 0,4 %, 100,0 % [98,7 % ; 100,0 %], 4,3 |
| 1,35 | 75,9 % ± 0,0 %, 100,0 % [91,4 % ; 100,0 %], 4,1 | 76,2 % ± 0,4 %, 100,0 % [98,7 % ; 100,0 %], 4,3 |
| 1,40 | 76,8 % ± 0,0 %, 100,0 % [91,4 % ; 100,0 %], 4,1 | 77,0 % ± 0,4 %, 100,0 % [98,7 % ; 100,0 %], 4,3 |
| 1,45 | 77,6 % ± 0,0 %, 100,0 % [91,4 % ; 100,0 %], 4,1 | 77,8 % ± 0,4 %, 100,0 % [98,7 % ; 100,0 %], 4,3 |
| 1,50 | 78,3 % ± 0,0 %, 100,0 % [91,4 % ; 100,0 %], 4,1 | 78,5 % ± 0,4 %, 100,0 % [98,7 % ; 100,0 %], 4,4 |

## IEEE 118 (23.5 s)

N-0 : 1.09 ; N-1 : 0.68 (perte de 38-65). 186 pertes simples, 300 paires.

| Facteur | Pertes simples : perte moyenne, part > 10 %, lignes perdues | Paires : perte moyenne, part > 10 %, lignes perdues |
|---|---|---|
| 0,60 | 0,0 % ± 0,0 %, 0,0 % [0,0 % ; 2,0 %], 0,0 | 0,1 % ± 0,1 %, 0,0 % [0,0 % ; 1,3 %], 0,0 |
| 0,65 | 0,0 % ± 0,0 %, 0,0 % [0,0 % ; 2,0 %], 0,0 | 0,1 % ± 0,1 %, 0,0 % [0,0 % ; 1,3 %], 0,1 |
| 0,70 | 0,3 % ± 0,4 %, 1,1 % [0,3 % ; 3,8 %], 0,2 | 1,3 % ± 0,7 %, 4,3 % [2,5 % ; 7,3 %], 0,8 |
| 0,75 | 0,4 % ± 0,5 %, 1,6 % [0,6 % ; 4,6 %], 0,3 | 1,9 % ± 0,8 %, 6,0 % [3,8 % ; 9,3 %], 1,3 |
| 0,80 | 0,7 % ± 0,6 %, 2,7 % [1,2 % ; 6,1 %], 0,5 | 2,6 % ± 1,0 %, 8,7 % [6,0 % ; 12,4 %], 1,6 |
| 0,85 | 1,5 % ± 1,0 %, 5,4 % [2,9 % ; 9,6 %], 1,1 | 3,8 % ± 1,2 %, 12,0 % [8,8 % ; 16,2 %], 2,5 |
| 0,90 | 1,9 % ± 1,1 %, 7,0 % [4,1 % ; 11,6 %], 1,6 | 4,6 % ± 1,3 %, 15,7 % [12,0 % ; 20,2 %], 3,6 |
| 0,95 | 2,3 % ± 1,1 %, 8,1 % [4,9 % ; 12,9 %], 1,7 | 5,0 % ± 1,2 %, 17,7 % [13,8 % ; 22,4 %], 3,5 |
| 1,00 | 2,8 % ± 1,2 %, 10,2 % [6,6 % ; 15,4 %], 2,1 | 6,6 % ± 1,4 %, 22,7 % [18,3 % ; 27,7 %], 4,8 |
| 1,05 | 4,4 % ± 1,5 %, 15,1 % [10,6 % ; 20,9 %], 3,5 | 9,4 % ± 1,6 %, 32,0 % [27,0 % ; 37,5 %], 7,1 |
| 1,10 | 30,3 % ± 0,9 %, 97,8 % [94,6 % ; 99,2 %], 26,0 | 31,1 % ± 0,9 %, 96,7 % [94,0 % ; 98,2 %], 26,2 |
| 1,15 | 36,6 % ± 0,6 %, 100,0 % [98,0 % ; 100,0 %], 33,4 | 36,1 % ± 0,6 %, 100,0 % [98,7 % ; 100,0 %], 31,9 |
| 1,20 | 32,5 % ± 0,6 %, 100,0 % [98,0 % ; 100,0 %], 22,3 | 33,3 % ± 0,6 %, 100,0 % [98,7 % ; 100,0 %], 23,8 |
| 1,25 | 36,6 % ± 0,5 %, 100,0 % [98,0 % ; 100,0 %], 27,6 | 37,0 % ± 0,6 %, 100,0 % [98,7 % ; 100,0 %], 28,4 |
| 1,30 | 38,1 % ± 0,5 %, 100,0 % [98,0 % ; 100,0 %], 28,7 | 39,0 % ± 0,5 %, 100,0 % [98,7 % ; 100,0 %], 30,2 |
| 1,35 | 46,0 % ± 0,4 %, 100,0 % [98,0 % ; 100,0 %], 32,2 | 45,7 % ± 0,5 %, 100,0 % [98,7 % ; 100,0 %], 33,8 |
| 1,40 | 39,5 % ± 0,5 %, 100,0 % [98,0 % ; 100,0 %], 34,0 | 40,7 % ± 0,6 %, 100,0 % [98,7 % ; 100,0 %], 35,0 |
| 1,45 | 41,6 % ± 0,7 %, 100,0 % [98,0 % ; 100,0 %], 38,3 | 43,4 % ± 0,7 %, 100,0 % [98,7 % ; 100,0 %], 39,9 |
| 1,50 | 47,3 % ± 0,8 %, 100,0 % [98,0 % ; 100,0 %], 45,1 | 49,2 % ± 0,7 %, 100,0 % [98,7 % ; 100,0 %], 47,0 |


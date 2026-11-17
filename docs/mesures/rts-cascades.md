# Les cascades sur RTS-GMLC, depuis la liste réglée

Mesuré le 17/11/2026 par `node scripts/rts-cascades.js 240 v0.3-h12` (job `reseau-cascades-rts-2`). C'est la question
de P3 ([../recherche/pistes.md](../recherche/pistes.md)) sur le réseau principal, avec une vraie journée. Les IEEE 30
et 118 n'avaient qu'une consommation multipliée par un facteur ([cascade-queue.md](cascade-queue.md)).

- **Les heures** : 240 heures de 2020, une à chaque quantile de la consommation, de la plus faible (2 646 MW) à la
  pointe (7 961 MW).
- **L'état** : celui que laisse la liste réglée à cette heure ([journee-j4.md](journee-j4.md)), ses groupes démarrés
  et sa répartition.
- **Les pannes** : les 120 pertes simples et les 7 140 paires de branches, chacune jusqu'au bout de sa cascade sous la
  règle de Grid2Op. Au total, 1,74 million de cascades, toutes stabilisées.
- **La taille** : la part de la consommation perdue au-delà de ce que la répartition déleste déjà. Le détail est dans
  [rts-cascades.json](rts-cascades.json).

## 1. Des heures calmes, des heures fragiles

**56 heures sur 240 sont fragiles** : une perte simple y coûte plus de 1 % de la consommation en moyenne, et à
24 d'entre elles, plus d'une perte simple sur deux emporte plus de 10 %. Les 184 autres sont calmes : 3 % des pertes
simples y coûtent quelque chose, en moyenne.

| | Heures calmes (184) | Heures fragiles (56) |
|---|---|---|
| Paires sans perte (moins de 0,1 %) | 93,4 % | 59,5 % |
| Paires qui perdent de 1 à 10 % | 5,1 % | 6,0 % |
| Paires qui perdent de 10 à 32 % | 1,4 % | 32,5 % |
| Paires qui perdent plus de 32 % | 0,02 % | 1,8 % |
| Pente de la densité des tailles | −0,64 | +0,52 |

- **La fragilité ne suit pas la charge** : 17 heures fragiles sur 60 dans le quart le moins chargé, 11 et 23 dans les
  quarts du milieu, 5 seulement dans le quart le plus chargé. Ce n'est pas le coude de Dobson, une charge critique
  au-delà de laquelle tout cascade.
- **Elle suit l'heure du jour** : 54 des 56 heures fragiles sont entre 17 h et 8 h, le soir et la nuit, comme les
  heures qui ne tiennent pas la règle N-1 ([journee-n1.md](journee-n1.md) : 89 à 100 % de 17 h à 6 h). C'est quand le
  vent de la nuit s'exporte que le réseau est tendu, pas quand la consommation culmine.
- **Du tout ou rien**, comme sur les IEEE 30 et 118 au-delà de leur coude : aux heures fragiles, une paire de pertes
  s'éteint aussitôt, ou emporte de 10 à 32 % de la consommation (le tiers des paires). Le milieu reste presque vide.
  La densité monte vers les grandes pannes (+0,52) : aucune loi de puissance. Sur toutes les heures mises ensemble,
  la pente est de −0,08.

## 2. Une piste, non vérifiée

Les heures non N-1 ont pour pire couple la perte d'une des deux liaisons de la zone 3 (325-121 et 318-223), qui met
l'autre à **200 % de sa limite** ([journee-n1.md](journee-n1.md) § 2). C'est exactement le seuil dur de Grid2Op : au-delà
de deux fois sa limite, une ligne tombe aussitôt. Si c'est elle, la perte d'une liaison couperait la zone 3 du reste,
et la perte de 10 à 32 % serait le déséquilibre d'une zone coupée. **Hypothèse** : le script ne garde pas les lignes
tombées de chaque cascade, et ce lien n'est pas vérifié.

## 3. Ce que ça dit

- **Sur RTS-GMLC, le danger d'une cascade dépend de l'état, pas de la charge** : de ce que la répartition fait passer
  par les liaisons entre zones et par les lignes d'évacuation de l'éolien. Une même consommation peut être calme ou
  fragile.
- **La queue de Dobson ne se voit pas** sous la cascade déterministe : on a des heures calmes et des heures fragiles,
  et dans les heures fragiles du tout ou rien. La question 5 du cadrage (déterministe ou probabiliste) reste ouverte ;
  une cascade probabiliste adoucirait sans doute ce tout ou rien. C'est une hypothèse.
- **Pour une recherche** (J5 et après) : une répartition qui garde les liaisons entre zones sous la moitié de leur
  seuil dur rendrait sans doute calmes la plupart des heures fragiles. C'est le troisième objectif, les surcharges, et
  la règle à battre y est mauvaise.

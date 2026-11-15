# La journée de RTS-GMLC : la liste de préséance, réglée puis mesurée (J4)

Mesuré le 15/11/2026. La règle à battre est celle de P6 ([../recherche/pistes.md](../recherche/pistes.md)) : la liste
de préséance avec réserve, décidée la veille sur la prévision, puis la répartition de chaque heure sur le réalisé.
Le modèle est dans [../modele.md](../modele.md) § 10. Le détail est dans [journee-j4.json](journee-j4.json) et la
course dans `races/j4-regle/`.

- **Les jours** : les 366 jours de 2020, chacun joué seul. La course règle sur les **183 jours pairs** ; la mesure se
  fait sur les **183 jours impairs**, qu'elle n'a pas vus.
- **Ce qu'on compte**, à part et dans l'ordre de Sami : l'énergie non distribuée, puis le coût (répartitions et
  démarrages). Les lignes tiennent leur limite à chaque heure, par construction.
- **Le démarrage dans l'heure** (Sami, 15/11) : quand la répartition d'une heure délesterait, les turbines à
  combustion à l'arrêt démarrent, les moins chères d'abord. Sans lui, même deux fois la réserve publiée plus la moitié
  du vent et du soleil prévus laissaient 10 MWh non distribués par jour (3 jours sur 40) : le vent manque parfois de
  600 MW sur sa prévision.

## 1. Le réglage : la course

Trois réglages : la réserve publiée, tenue à **une fois** (**hypothèse** : c'est une obligation, comme la règle N-1 ;
le modèle n'a pas encore de panne de groupe, et sans elle il ne punirait pas une réserve nulle) ; la **marge sur le
vent et le soleil prévus**, de 0 à 50 % ; le **maintien en marche**, 6, 12 ou 24 heures. Soit 18 variantes, jouées
sur les mêmes jours par `mcts-race` (lots de 20 jours, au moins 40 avant d'écarter, risque de 5 % sur toute la
course), le score étant le coût du jour.

- **Aucune des 2 404 journées jouées n'a laissé d'énergie non distribuée** : le coût départage seul.
- **Écartées** : toutes les variantes sans marge sur le renouvelable (à 40 et 60 jours) ; toutes celles qui ne gardent
  les groupes que 6 heures ; la marge de 50 % (à 140 jours), trop prudente.
- **Restent 8 variantes au bout des 183 jours** : les marges de 10 à 40 %, avec un maintien de 12 ou 24 heures. Ces
  deux maintiens donnent exactement les mêmes journées : au-delà de 12 heures, la prévision du jour ne voit plus de
  redémarrage à éviter. La meilleure moyenne est à 30 %, puis 20 %.

## 2. La mesure, sur les jours impairs

Chaque variante contre la liste simple (la réserve publiée, ni marge sur le renouvelable, ni maintien), jour par jour :

| Variante | Coût par jour | $/MWh | Écart à la liste simple, IC 95 % | Jours moins chers | Énergie non distribuée | Démarrages par jour (dans l'heure) |
|---|---|---|---|---|---|---|
| liste simple | 1 548 k$ | 15,49 | | | 192 MWh, 1 jour | 22,9 (7,0) |
| maintien 12 h | 1 453 k$ | 14,53 | −95 k$ [−106 ; −84], −6,2 % | 175 sur 183 | 192 MWh, 1 jour | 13,5 (6,4) |
| marge 20 %, maintien 12 h | 1 433 k$ | 14,33 | −116 k$ [−129 ; −102], −7,5 % | 167 sur 183 | aucune | 9,7 (3,3) |
| **marge 30 %, maintien 12 h** | **1 431 k$** | **14,31** | **−118 k$ [−132 ; −103], −7,6 %** | 163 sur 183 | aucune | 8,6 (2,5) |

- **Le maintien en marche fait l'essentiel** : la liste simple arrête puis redémarre ses groupes dans la journée,
  et ses démarrages font 21 % de son coût. Garder un groupe que la liste voudra de nouveau dans les 12 heures divise
  ses démarrages presque par deux, et son coût baisse de 6,2 %.
- **La marge sur le renouvelable gagne encore 1,4 point** : sans elle, l'erreur de prévision du vent se paie en
  démarrages de turbines dans l'heure, chères (6,4 par jour, contre 2,5 avec la marge de 30 %). Contre le maintien
  seul, la marge de 30 % coûte 22 k$ de moins par jour, IC [−31 ; −14], soit −1,5 %.
- **Les marges de 20 et 30 % ne se distinguent pas** : −2,1 k$ par jour, IC [−5,5 ; +1,3]. On retient 30 %, la meilleure
  sur les jours pairs comme sur les impairs.
- **L'énergie non distribuée** : un seul jour sur 183, le 27 avril (jour 117), coûte 192 MWh à la liste simple et au
  maintien seul, malgré les turbines. Les marges l'évitent. Sa cause n'est pas analysée.
- **L'écrêtement** (vent, soleil et hydraulique) monte avec la marge : de 3,3 GWh par jour pour la liste simple à
  5,3 GWh pour la liste réglée, sur 48 GWh disponibles en moyenne. Des groupes en plus tournent à leur minimum et
  prennent la place du renouvelable.

## 3. La règle à battre

**La liste réglée** : la réserve publiée, une marge de 30 % sur le vent et le soleil prévus, un maintien de 12 heures
(`v0.3-h12`). Elle coûte **1 431 k$ par jour, 14,31 $/MWh**, sur les jours impairs, sans énergie non distribuée. C'est
contre elle qu'une recherche se mesurera (P7, le faisceau sur le démarrage), sur les mêmes jours impairs, objectif par
objectif. L'attente de P7, en **hypothèse** d'après de Mars : 1 à 3 % de moins.

Ce que le modèle ne voit pas encore, et qui pourrait changer le réglage : les pannes de groupes (la raison d'être de
la réserve, P8), la règle N-1 dans la répartition de chaque heure, la liaison à courant continu, le stockage, et
l'histoire d'un jour à l'autre (chaque jour part sans passé).

# Le prompt de recherche métier

À coller dans une session de recherche (ou à donner à un professionnel) pour creuser un point plus tard. Rédigé le
14/11/2026, d'après ce qui reste ouvert dans [questions.md](questions.md) § 2.

```text
Je construis un modèle pédagogique d'un réseau électrique de transport (calcul DC des flux, démarrage et répartition
des centrales, règle N-1, cascades de surcharges), pour comprendre, pas pour exploiter. Pour chaque point, donne des
chiffres sourcés (rapport, norme, article, page de gestionnaire de réseau), avec le lien et la date ; dis quand un
chiffre est une estimation ou vient d'une source secondaire.

1. Surcharges : combien de temps une ligne de 225 ou 400 kV tient-elle à 110 %, 120 %, 150 % de sa limite
   permanente avant que sa protection ne la coupe ? Limites temporaires en usage chez RTE ou ailleurs en Europe.
2. N-1 : la définition en vigueur (règlement UE 2017/1485, l'article sur l'analyse des aléas) ; préventif contre
   curatif : quand un gestionnaire accepte-t-il un état non N-1 parce qu'une parade est prête ?
3. Topologie : quelles manœuvres les dispatcheurs utilisent-ils pour soulager une ligne (ouvrir une ligne, découpler
   des jeux de barres), à quelle fréquence, en combien de temps ?
4. Réserves : les volumes de FCR, aFRR et mFRR de la France, et la règle qui les fixe (l'incident de référence).
5. Défaillance : le critère français (3 heures par an ?) à sa source, et la valeur de l'énergie non distribuée
   retenue en France et par la méthode de l'ACER (décision 23/2020).
6. Prévision : l'erreur typique de la prévision de la veille pour l'éolien et le solaire, en pourcentage de la
   puissance installée, en France ou dans une étude publique.
7. Démarrage : les ordres de grandeur d'un démarrage (durée, coût) pour une turbine à combustion, un cycle combiné,
   une centrale charbon, un réacteur nucléaire.
```

# Les questions pour Sami, et pour un professionnel

Rédigé le 14/11/2026. Chaque question porte une recommandation ; ce qui est recommandé est ce que le projet fera si
Sami dit « ok ».

**La réponse de Sami (14/11)** : « Ok pour la suite. » **Les onze recommandations du § 1 sont donc décidées** :
l'exploitation seulement ; l'IEEE 14, 30 et 118 de PGLib puis RTS-GMLC ; l'heure, puis 5 minutes pour la conduite ;
la note lexicographique (énergie non distribuée, surcharges, coût) ; la cascade déterministe ; le DC seulement ;
Grid2Op non installé ; pas de référence extérieure pour les flux ; `highs-js` en développement dans la lib (à la
décision de commun) ; le stockage au J7, les barrages plus tard ; la carte dès le J1. Le modèle qui en découle est
dans [`../modele.md`](../modele.md).

## 1. Pour Sami

### Le périmètre

1. **Exploiter un parc, ou aussi le construire ?** « La gestion d'un parc » peut vouloir dire décider chaque jour
   quelles centrales tournent (l'exploitation), ou décider sur des années quelles centrales et quelles lignes
   construire (l'investissement).
   → **Recommandation** : l'exploitation seulement, de l'heure à la journée, puis à l'année. L'investissement est un
   autre problème (sur des décennies, avec ses propres bancs) ; il viendra peut-être après.

2. **Les réseaux** : l'IEEE 14 de PGLib pour les flux et la carte (J1), l'IEEE 30 et 118 de PGLib pour les cascades
   et la validation, puis **RTS-GMLC comme réseau principal** (73 nœuds, 73 centrales thermiques, l'éolien, le
   solaire, un stockage, l'année 2020 avec prévisions et réalisé, les coordonnées des nœuds).
   → **Recommandation** : oui. Le 14 nœuds de PGLib n'a que deux centrales qui produisent : il ne sert pas au
   démarrage ; RTS-GMLC a tout ce qu'il faut ([bancs.md](bancs.md) § 3).

3. **Le pas de temps** : l'heure (24 décisions par jour, la veille pour le lendemain) ou les 5 minutes de Grid2Op et
   du réalisé de RTS-GMLC ?
   → **Recommandation** : l'heure pour le démarrage et la répartition (J4-J5) ; les 5 minutes pour la conduite en
   temps réel (J6), où les surcharges se jouent.

### La mesure

4. **La note interne de la recherche.** La mesure garde les trois objectifs à part (CLAUDE.md). Mais pour choisir
   entre deux plans, la recherche doit les ordonner. Deux façons : (a) **lexicographique** : d'abord l'énergie non
   distribuée, puis les surcharges, puis le coût ; (b) **pondérée** : le coût plus l'énergie non distribuée au prix
   de la défaillance (la *VOLL*, de l'ordre de milliers d'euros le MWh ; aucun chiffre vérifié pour la France), plus
   une pénalité de surcharge.
   → **Recommandation** : (a), lexicographique. Elle n'invente aucun prix, et elle dit ce que fait un exploitant :
   la sécurité d'abord. On essaiera (b) seulement si (a) rend la recherche trop prudente.

5. **La cascade** : déterministe, à la Grid2Op (une ligne surchargée 2 pas tombe), ou probabiliste, à l'OPA (une
   ligne surchargée tombe avec une probabilité) ?
   → **Recommandation** : déterministe d'abord ; le hasard est dans les pannes initiales, tirées par graine. Le
   probabiliste ensuite, s'il change les conclusions.
   → **Sami, 14/11** : déterministe. **Mesuré le 15/11** ([../mesures/cascade-queue.md](../mesures/cascade-queue.md)) :
   elle suffit à faire voir la charge critique et une queue dans la plage de Dobson, sur le 118.

### Le modèle

6. **Le modèle DC seulement ?** Il voit les flux actifs, les surcharges et les reports, pas la tension, le réactif,
   ni la fréquence. La panne ibérique de 2025 (une affaire de tension) lui échappe ([physique.md](physique.md) § 6).
   → **Recommandation** : oui, DC seulement, et la page le dit. Un calcul AC (Newton-Raphson) est un projet à lui
   seul.

7. **Grid2Op lui-même** : l'installer (Python) pour s'y comparer directement, ou seulement en reprendre les règles ?
   → **Recommandation** : en reprendre les règles et les leçons, sans l'installer. Ses scores sont en AC, avec ses
   données ; ils ne se comparent pas aux nôtres. Si un jour on veut un classement L2RPN, ce sera un chantier à part.

8. **La vérification des flux** : faut-il une référence extérieure (MATPOWER sous Octave, gratuit, installé une
   fois pour produire des flux de référence enregistrés dans les tests) ?
   → **Recommandation** : non. Les invariants (Kirchhoff, la LODF contre une nouvelle résolution, un réseau de 3
   nœuds résolu à la main) et les **coûts publiés par PGLib** (P4) suffisent. Si un écart résiste, on installera.

### La lib

9. **Le solveur QP** : il doit accepter des contraintes linéaires générales (les limites de ligne), pas seulement des
   bornes, et des coûts souvent linéaires (Q nulle). La demande est postée à commun avec la forme du problème
   ([methodes.md](methodes.md) § 5). Faut-il autoriser `highs-js` (MIT, WebAssembly) **en dépendance de
   développement** de la lib, comme oracle de ses tests ?
   → **Recommandation** : oui, en développement seulement ; le solveur lui-même reste écrit dans la lib, sans
   dépendance. À la décision de commun pour le reste.

### L'ordre

10. **Le stockage et les barrages** : le stockage au J7 (une batterie, un plan de charge), les barrages plus tard
    (SDDP, un réservoir à inventer) ?
    → **Recommandation** : oui. Les barrages n'arrivent que si le reste tient.

11. **La première page** : la carte de l'IEEE 14, les lignes colorées par leur charge, un clic pour couper une ligne
    et voir le report ; puis la cascade pas à pas.
    → **Recommandation** : oui, dès le J1 : c'est ce qui fait comprendre Kirchhoff en dix secondes.

## 2. Pour un professionnel (un dispatcheur, chez RTE ou ailleurs)

Pas cherché pour le moment. Ses questions, avec ce qu'on suppose en attendant :

1. **Combien de temps une ligne tient-elle en surcharge ?** Grid2Op coupe après 2 pas de 5 minutes. Les vraies
   protections ont des limites temporaires (des minutes, selon le dépassement).
   **Hypothèse** : la règle de Grid2Op.
2. **Préventif ou curatif ?** Dans quelle mesure RTE accepte-t-il un état non N-1 parce qu'une parade (une manœuvre
   prête) existe ? **Hypothèse** : préventif pour les règles simples, curatif comme piste de recherche.
3. **Quelles manœuvres de topologie servent vraiment ?** Ouvrir une ligne, coupler ou découpler des jeux de barres :
   lesquelles, et à quelle fréquence ? **Hypothèse** : ouvrir et refermer des lignes d'abord.
4. **La réserve** : comment la France dimensionne-t-elle ses réserves (primaire, secondaire, tertiaire) ? Aucun
   chiffre de RTE n'a pu être lu. **Hypothèse** : les besoins publiés par RTS-GMLC, ou le plus gros groupe en marche.
5. **Le prix de la défaillance** : quelle valeur de l'énergie non distribuée retenir ? La méthode européenne est
   celle de l'ACER (décision 23/2020, octobre 2020), dont les chiffres n'ont pas pu être lus. Le Bilan prévisionnel
   de RTE vise **3 heures de défaillance par an** en espérance (vu dans un résumé de recherche, pas lu à la source).
   **Hypothèse** : sans objet si la note est lexicographique (question 4).
6. **L'erreur de prévision** : la veille, de combien se trompe-t-on sur l'éolien et le solaire ? **Hypothèse** :
   celle de RTS-GMLC (l'écart entre prévision et réalisé de 2020), à mesurer sur ses fichiers.

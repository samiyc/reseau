# La physique : les flux, la règle N-1, les cascades

Lu les 13 et 14/11/2026. Les sources sont citées à chaque paragraphe ; la liste est en fin de fichier.

## 1. Le DC power flow : le courant ne choisit pas son chemin

Dans un réseau maillé, on ne décide pas par où passe l'énergie. On décide des injections (ce que chaque centrale
produit, ce que chaque nœud consomme), et les flux en découlent par les lois de Kirchhoff. Le calcul exact (AC) est
non linéaire. Le **modèle DC** le linéarise, avec trois hypothèses (MATPOWER, manuel 8.1, § 3.7) :

- les lignes sont **sans pertes** : on néglige leur résistance et leur capacité, il ne reste que la réactance x ;
- toutes les **tensions valent 1 p.u.** (l'unité réduite) ;
- les **écarts d'angle** entre les deux bouts d'une ligne sont petits : sin(θf − θt) ≈ θf − θt.

Il reste deux relations linéaires (MATPOWER, `makeBdc`) :

- **les injections et les angles** : `P = Bbus · θ (+ Pbusinj)`, où Bbus est la matrice de susceptance du réseau
  (une laplacienne pondérée par 1/x) ;
- **les flux et les angles** : `Pf = Bf · θ (+ Pfinj)`. Le flux d'une ligne vaut (θf − θt) / x, au déphaseur près.

On fixe l'angle d'un **nœud de référence** (le *slack*) à 0 ; le système qui reste est carré et inversible si le
réseau est connexe. Pour 14 à 118 nœuds, c'est un système dense de quelques dizaines à une centaine d'inconnues : une
factorisation, puis des substitutions. **Hypothèse** : quelques microsecondes à quelques dizaines par résolution en
JavaScript, à mesurer au banc.

**La précision** : Stott, Jardim et Alsaç (2009) rappellent que ces modèles sont partout, sur les marchés à
congestion, mais que leurs flux ne sont bons que « quand ils le sont, ce qui n'est nullement assuré » (résumé, lu par
une recherche) ; leurs tests à grande échelle sont plus pessimistes que les études antérieures, et ils jugent
indispensable d'estimer les pertes sur un grand réseau. Pour un modèle « pour comprendre », c'est acceptable ; on le
dit à la page.

## 2. PTDF et LODF : les reports, sans tout recalculer

Le modèle étant linéaire, on peut tout précalculer :

- **PTDF** (*power transfer distribution factor*) : une matrice lignes × nœuds. L'élément (l, n) est le flux sur la
  ligne l quand on injecte 1 MW au nœud n et qu'on le retire au nœud de référence. MATPOWER : « Builds the DC PTDF
  matrix for a given choice of slack » (`makePTDF`, nbr × nb). Les flux d'un état valent `PTDF · P`.
- **LODF** (*line outage distribution factor*) : une matrice lignes × lignes. L'élément (l, k) est la part du flux de
  la ligne k, avant sa perte, qui se reporte sur la ligne l quand k tombe. MATPOWER la tire de la PTDF (`makeLODF`) :
  avec h le flux sur chaque ligne d'un transfert entre les deux bouts de k, LODF(l, k) = h(l) / (1 − h(k)), et −1 sur
  la diagonale. Une ligne dont h(k) = 1 est un **pont** : la couper sépare le réseau en deux îles.

C'est ce qui rend la règle N-1 bon marché : vérifier les n lignes une à une coûte un produit matrice-vecteur, pas n
résolutions. Et c'est le test naturel du J1 : le flux après coupure calculé par la LODF égale celui d'une nouvelle
résolution sans la ligne.

## 3. Le DC-OPF : la répartition qui respecte les lignes

MATPOWER, manuel 8.1, § 6.2 : avec le modèle DC et des coûts au plus quadratiques, l'OPF « se simplifie en un
programme quadratique, à contraintes linéaires et à coût quadratique ». Les variables sont les angles θ et les
productions Pg ; les contraintes :

- **l'équilibre à chaque nœud** (une égalité par nœud) : `Bbus·θ + Pd + Gsh − Cg·Pg = 0` ;
- **les limites des lignes** (deux inégalités par ligne) : `−Fmax ≤ Bf·θ ≤ Fmax` ;
- **l'angle de référence** fixé, et **les bornes des centrales** `Pmin ≤ Pg ≤ Pmax`.

On peut éliminer les angles par la PTDF : il reste les productions, **une seule égalité** (la somme produite égale
la somme consommée) et **2 × lignes inégalités denses**. Les **multiplicateurs** de ces contraintes sont les **prix
nodaux** (LMP) : le coût d'un MW de plus à chaque nœud. Ils diffèrent d'un nœud à l'autre dès qu'une ligne est
saturée, ce qui se dessine bien.

**Le N-1 préventif** (SCOPF) ajoute, pour chaque perte de ligne k, les limites de toutes les lignes après report
(par la LODF) : 2 × lignes × lignes inégalités, presque toutes inactives. On ne les ajoute qu'au fur et à mesure
qu'elles sont violées.

## 4. La règle N-1

La définition de l'UCTE (Operation Handbook, Policy 3), citée par le rapport sur la panne du 4/11/2006 (note 3,
p. 17) : tout évènement simple probable entraînant la perte d'un élément (groupe, ligne, transformateur) « ne doit
pas mettre en danger la sécurité de l'exploitation interconnectée, c'est-à-dire déclencher une cascade de
déclenchements ou la perte d'une quantité importante de consommation » ; les éléments restants doivent absorber la
charge reportée. Une perte locale de consommation est tolérée si elle est « prévisible et limitée localement ».

Le rapport de l'Italie 2003 (UCTE, § 4) précise qu'après la perte d'un élément, la règle demande deux temps : d'abord
des mesures correctives pour rester stable, puis, dès que possible, des mesures pour **revenir à un état N-1 sûr**.
C'est le N-1 **curatif** (on agit après la perte) à côté du N-1 **préventif** (on se place d'avance là où toute perte
est tenable). Le texte en vigueur aujourd'hui est le règlement (UE) 2017/1485 (SO GL) ; son article sur l'analyse
des aléas n'a pas pu être lu (EUR-Lex n'a rendu que sa navigation) : **à vérifier** avant de le citer.

## 5. Les cascades

**Le modèle OPA** (Dobson, Carreras, Lynch, Newman, Oak Ridge, depuis 2001) simule deux échelles de temps : la
cascade rapide (un calcul DC, une répartition par programmation linéaire, des lignes surchargées qui tombent) et
l'évolution lente du réseau (on renforce les lignes qui ont lâché, la demande croît). D'après les résumés lus
(articles de 2004 et 2007, non lus en entier) : la distribution des tailles de panne a une **queue lourde**, et le
réseau s'organise de lui-même vers un point critique.

**Le modèle de charge** de Dobson, Carreras et Newman (2005, résumé lu) : un modèle probabiliste analytique, dont la
distribution du nombre de composants perdus « a une région en loi de puissance à une charge critique », et une
probabilité notable de panne totale au-delà. **C'est l'expérience à reproduire** (P3) : la taille des coupures selon
la charge du réseau, et le coude.

**La règle de Grid2Op** (paramètres par défaut, lus le 13/11) : une ligne au-dessus de sa limite thermique plus de
**2 pas** (de 5 minutes) consécutifs est déconnectée ; au-dessus d'un seuil dur (l'exemple de la doc prend 2 fois la
limite, la valeur par défaut n'est pas dite) elle l'est aussitôt ; elle ne peut être reconnectée qu'après 10 pas.
C'est une règle déterministe, simple à reprendre.

## 6. Trois grandes pannes, et une qui n'est pas une cascade thermique

| Date | Ce qui s'est passé | Source |
|---|---|---|
| 28/09/2003, Italie | la ligne suisse Mettlen-Lavorgo (« Lukmanier ») déclenche à 03:01 sur un amorçage avec un arbre ; à 03:25, Sils-Soazza fait de même ; l'Italie se sépare, tient deux minutes et demie en îlot, puis s'éteint. Environ 56 millions de personnes (Wikipédia) | rapport final UCTE, avril 2004 |
| 14/08/2003, États-Unis et Canada | des lignes de FirstEnergy (Ohio) touchent des arbres trop hauts ; « une zone d'environ 50 millions de personnes et 61 800 MW de charge » | rapport final de la Task Force, avril 2004 |
| 04/11/2006, Europe | une ligne double 380 kV (Conneforde-Diele, au-dessus de l'Ems) est coupée pour laisser passer un navire ; « le critère N-1 n'était pas rempli » ; la cascade coupe plus de 15 millions de foyers et sépare le réseau synchrone en **trois zones** | rapport final UCTE, 2007 |
| 28/04/2025, Espagne et Portugal | selon le panel d'ENTSO-E (rapport final du 20/03/2026) : des oscillations, des manques dans le contrôle de la tension et de la puissance réactive, puis des hausses rapides de tension et des pertes de production en cascade | page ENTSO-E |

**Ce que ces pannes apprennent au modèle** :
- 2006 est l'exemple parfait du N-1 : un état sûr en apparence, une manœuvre non vérifiée, une cascade. Un réseau
  IEEE peut le rejouer en petit (P4).
- 2003 (les deux) : l'élément déclencheur est banal (un arbre) ; c'est l'état du réseau qui fait la cascade.
- 2025 est **hors du modèle DC** : c'est une affaire de tension et de réactif, que le DC néglige par construction.
  On le dit à la page, comme limite.

## 7. Ce que le modèle DC ne voit pas

La tension et la puissance réactive (2025), la stabilité dynamique (les deux minutes et demie de l'îlot italien), la
fréquence (la séparation de 2006 en trois zones, chacune à sa fréquence), les pertes (Stott). Le modèle voit les flux
actifs, les surcharges et les reports : ce qui fait une cascade thermique.

## Sources

- MATPOWER, *User's Manual*, version 8.1 (12/07/2025), § 3.7 et § 6.2 : https://matpower.org/docs/MATPOWER-manual.pdf
- MATPOWER, `makeBdc`, `makePTDF`, `makeLODF` (7.1) : https://matpower.org/docs/ref/matpower7.1/lib/makePTDF.html
  (et `makeLODF.html`, `makeBdc.html` à côté)
- B. Stott, J. Jardim, O. Alsaç, « DC Power Flow Revisited », *IEEE Trans. Power Systems* 24(3), 2009,
  p. 1290-1300, DOI 10.1109/TPWRS.2009.2021235 (résumé seulement)
- I. Dobson, B. A. Carreras, D. E. Newman, « A Loading-Dependent Model of Probabilistic Cascading Failure »,
  *Probability in the Engineering and Informational Sciences* 19(1), 2005, DOI 10.1017/S0269964805050023 (résumé)
- I. Dobson et al., « Complex systems analysis of series of blackouts », *Chaos* 17(2), 2007,
  DOI 10.1063/1.2737822 (non lu : l'accès a été refusé)
- UCTE, *Final Report of the Investigation Committee on the 28 September 2003 Blackout in Italy*, avril 2004 :
  https://eepublicdownloads.entsoe.eu/clean-documents/pre2015/publications/ce/otherreports/20040427_UCTE_IC_Final_report.pdf
- U.S.-Canada Power System Outage Task Force, *Final Report on the August 14, 2003 Blackout*, avril 2004 :
  https://www.energy.gov/sites/prod/files/oeprod/DocumentsandMedia/BlackoutFinal-Web.pdf
- UCTE, *Final Report, System Disturbance on 4 November 2006*, 2007 :
  https://eepublicdownloads.entsoe.eu/clean-documents/pre2015/publications/ce/otherreports/Final-Report-20070130.pdf
- ENTSO-E, *28 April 2025 Iberian Blackout* : https://www.entsoe.eu/publications/blackout/28-april-2025-iberian-blackout/
- Grid2Op, paramètres : https://grid2op.readthedocs.io/en/latest/user/parameters.html

# Le glossaire

Les mots du métier, en français et en anglais (les sources et le code sont en anglais). Rédigé le 14/11/2026.

## Le réseau

| Français | Anglais | Ce que c'est |
|---|---|---|
| nœud, poste | bus, substation | un point du réseau où se raccordent lignes, centrales et consommation ; un poste peut porter plusieurs nœuds |
| jeu de barres | busbar | le conducteur d'un poste où se branchent les départs ; un poste à deux jeux de barres peut être coupé en deux nœuds |
| ligne, branche | line, branch | une ligne ou un transformateur entre deux nœuds |
| réactance | reactance (x) | ce qui freine le passage du courant alternatif dans une ligne ; le seul paramètre de ligne du modèle DC |
| limite thermique | thermal limit, rating (RATE_A) | le flux qu'une ligne supporte sans s'échauffer trop ; au-delà, elle est en surcharge |
| taux de charge | loading, ρ (rho) | le flux divisé par la limite ; au-delà de 1, surcharge |
| unité réduite | per unit (p.u.) | les grandeurs divisées par une base (100 MVA dans MATPOWER) |
| nœud de référence | slack bus, reference bus | le nœud dont l'angle vaut 0 et qui équilibre le calcul |
| îlot | island | une partie du réseau séparée du reste |
| liaison à courant continu | HVDC line | une liaison dont on commande le flux, contrairement aux lignes alternatives |

## Les flux

| Français | Anglais | Ce que c'est |
|---|---|---|
| calcul de répartition, écoulement de puissance | power flow, load flow | le calcul des flux à partir des injections |
| calcul DC, linéarisé | DC power flow | le calcul linéaire, sans pertes ni tension ([physique.md](physique.md) § 1) |
| angle de phase | voltage angle (θ) | l'écart de phase entre deux nœuds fait passer le courant |
| facteur de transfert | PTDF | le flux d'une ligne pour 1 MW injecté à un nœud |
| facteur de report | LODF | la part du flux d'une ligne perdue qui se reporte sur une autre |
| répartition optimale | optimal power flow (OPF), DC-OPF | la production au moindre coût qui respecte les lignes |
| répartition sûre | security-constrained OPF (SCOPF) | la même, qui tient aussi après la perte de n'importe quel élément |
| prix nodal | locational marginal price (LMP) | le coût d'un MW de plus en un nœud ; il varie quand une ligne sature |
| congestion | congestion | une ligne à sa limite, qui empêche la production la moins chère de passer |

## La production

| Français | Anglais | Ce que c'est |
|---|---|---|
| équilibre offre-demande | balance, adequacy | produire à chaque instant ce qui se consomme |
| démarrage des centrales, plan de marche | unit commitment (UC) | décider lesquelles tournent, heure par heure |
| répartition économique | economic dispatch (ED) | décider combien chacune produit |
| ordre de préséance économique | merit order | les centrales classées par coût marginal croissant |
| liste de priorité | priority list | la règle de démarrage qui suit cet ordre |
| minimum technique | minimum stable level (Pmin) | la puissance au-dessous de laquelle une centrale en marche ne descend pas |
| rampe | ramp rate | la vitesse à laquelle une centrale change sa production |
| durée minimale de marche, d'arrêt | min up time, min down time | une centrale démarrée doit tourner tant d'heures ; arrêtée, rester arrêtée tant |
| coût de démarrage | start-up cost | ce que coûte un démarrage, selon que la centrale est froide, tiède ou chaude |
| consommation spécifique | heat rate | le combustible brûlé par MWh produit |
| réserve tournante | spinning reserve | la puissance disponible sur les centrales en marche, pour un imprévu |
| réserves primaire, secondaire, tertiaire | FCR, aFRR, mFRR | les réserves européennes, de la seconde au quart d'heure |
| redispatching | redispatching | changer la production de centrales pour soulager une ligne |
| écrêtement | curtailment | produire moins de renouvelable que possible, pour l'équilibre ou une ligne |
| compensateur synchrone | synchronous condenser | une machine tournante qui ne produit pas d'énergie active (Pmax = 0) |
| valeur de l'eau | water value | ce que vaut l'eau gardée dans un barrage pour plus tard |

## La sécurité

| Français | Anglais | Ce que c'est |
|---|---|---|
| règle du N-1 | N-1 criterion | le réseau tient après la perte de n'importe quel élément ([physique.md](physique.md) § 4) |
| aléa | contingency | la perte d'un élément (ligne, groupe, transformateur) |
| parade | remedial action | la manœuvre prévue pour un aléa |
| préventif, curatif | preventive, corrective | agir avant l'aléa, ou après |
| cascade | cascading failure | des déclenchements en chaîne, chaque report surchargeant la suivante |
| déclenchement | trip | une protection qui ouvre une ligne |
| délestage | load shedding | couper volontairement des consommateurs pour sauver le reste |
| énergie non distribuée | energy not served (ENS), EENS | l'énergie que les consommateurs n'ont pas reçue |
| défaillance | loss of load, LOLE | ne pas pouvoir servir toute la demande ; LOLE en compte les heures par an |
| valeur de l'énergie non distribuée | value of lost load (VOLL) | ce que coûte un MWh non servi |
| panne générale | blackout | la coupure d'une région entière |

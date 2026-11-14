# Les données

| Fichier | Source | Licence |
|---|---|---|
| `pglib/pglib_opf_case14_ieee.m`, `case30`, `case118` | PGLib-OPF v23.07 (IEEE PES), https://github.com/power-grid-lib/pglib-opf, copiés tels quels le 14/11/2026 | Creative Commons Attribution 4.0 ; le 14 nœuds : © 1999 Richard D. Christie, université de Washington |
| `pglib/pglib_opf_case*_ieee__api.m`, `__sad.m` | les mêmes, en conditions congestionnées (`api/`) et aux petits angles (`sad/`), du même dépôt, copiés tels quels le 14/11/2026 (J3) | la même |
| `pglib_opf_case*_ieee*.json` | les mêmes, convertis par `node scripts/matpower-to-json.js data/pglib/<cas>.m data/<cas>.json` | la même |

Les fichiers `.m` gardent leur en-tête, qui dit d'où vient chaque valeur ajoutée par PGLib (limites des lignes,
coûts, Pmax). Ce qu'on en a vérifié est dans [`../docs/recherche/bancs.md`](../docs/recherche/bancs.md) § 2.

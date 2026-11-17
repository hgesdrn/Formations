# Indices spectraux et perturbations en forêt boréale

Petite app de démonstration : comment le satellite, l'indice spectral, la perturbation et l'occupation du sol font varier la valeur d'un indice.

Ouvrir `index.html` dans un navigateur. Pas de dépendance, pas de compilation.

## Fichiers

| Fichier | Rôle |
|---|---|
| `data.js` | Bandes, capteurs, indices, classes, perturbations (à corriger ici) |
| `app.js` | Paysage fictif, calculs, graphiques, carte |
| `styles.css` | Mise en page |

## Ce que l'app fait

- **Graphiques** : réflectance des bandes utilisées par l'indice pour la classe choisie, avant et après perturbation, avec la formule, la valeur et Δ (après − avant).
- **Carte** : paysage fictif de 100 × 50 pixels, identique en haut (avant) et en bas (après). La taille du pixel dépend du capteur et de la bande la plus grossière de l'indice. Un clic sur un pixel sélectionne sa classe.
- **Sévérité** : mélange linéaire entre le spectre intact et le spectre pleinement perturbé.

## Limites des données (à lire)

- Les réflectances sont **illustratives** : des ordres de grandeur typiques tirés de la littérature, et non des mesures. Aucun jeu officiel n'a été utilisé.
- Landsat 8/9 et Sentinel-2 utilisent les mêmes spectres de surface. Le capteur ne change que les numéros de bande, les longueurs d'onde centrales, la résolution et la disponibilité du red-edge (NDRE, Sentinel-2 seulement).
- Les 7 classes sont génériques (inspirées des grandes classes d'occupation du sol), pas la nomenclature officielle de la *Cartographie de l'occupation des terres du Québec*.
- La part de perturbation subie par chaque classe (`affects` dans `data.js`) est une hypothèse pédagogique. Par exemple, la TBE touche les résineux et la moitié du mixte.

## Décisions consignées

- 2026-11-17 : classes génériques et réflectances illustratives, acceptées par Hugues.

# Formations

Site web regroupant mes formations et ateliers, construit avec
[Quarto](https://quarto.org). Chaque formation est **autonome** et peut
être donnée séparément.

## Structure

```
Formations/
├── _quarto.yml                    # configuration du site
├── index.qmd                      # page d'accueil (liste des formations)
├── images/                        # images partagées (logo, etc.)
├── atelier-creation-carte/        # une formation = un dossier autonome
│   ├── index.qmd
│   └── images/
├── atelier-applications-terrain/  # une autre formation
│   ├── index.qmd
│   └── images/
└── docs/                          # site rendu (publié par GitHub Pages)
```

Toutes les formations sont **au même niveau** (à la racine). Le mot
« atelier » dans un nom de dossier est optionnel : nommez chaque dossier
comme bon vous semble (ex. `carte-arcgis`, `dendrochronologie`,
`poterie-raku`). Un seul axe compte : un dossier = une formation.

## Ajouter une nouvelle formation

1. Créer un dossier à la racine (nom sans accents ni espaces, ex.
   `mon-nouvel-atelier/`).
2. Y déposer un `index.qmd` (copiez-en un existant comme point de départ).
3. Ajouter une carte dans `index.qmd` (accueil) et une entrée de menu
   dans `_quarto.yml`.
4. `quarto render`, puis *commit* et *push*.

## Rendre le site localement

```bash
quarto preview   # aperçu en direct
quarto render    # génère le dossier docs/
```

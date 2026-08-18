# OpenEAU

Carte des stations hydrométriques des grands cours d'eau français.

## Architecture

Le navigateur ne contacte plus directement Hub'Eau pour la carte ou les graphiques.

GitHub Actions génère automatiquement :

- `data/stations.json` : stations, coordonnées, importance et cote du zéro d'échelle ;
- `data/live.json` : hauteur, débit, niveau relatif, normale et altitude de la surface de l'eau ;
- `data/history/<CODE>.json` : historique hauteur (~30 jours) et débit journalier (~1 an), utilisé par les graphiques.

Le workflow est lancé automatiquement toutes les 30 minutes et peut être lancé manuellement dans l'onglet **Actions**.

## Installation dans GitHub

1. Mettre tout le contenu de ce dossier à la racine du dépôt.
2. Vérifier que `index.html` est directement à la racine.
3. Dans **Settings → Pages**, choisir **Deploy from a branch**, `main`, `/ (root)`.
4. Dans **Actions**, ouvrir **Mise à jour des données OpenEAU**.
5. Cliquer sur **Run workflow** pour le premier remplissage.
6. Attendre que le workflow soit vert avant d'ouvrir le site.

## Données altimétriques

La `Cote du zéro d'échelle` est récupérée depuis la fiche station HydroPortail. Lorsque la hauteur instantanée est disponible, le script calcule également :

`altitude de la surface de l'eau = cote du zéro d'échelle + hauteur`

La valeur est affichée comme une altitude de la surface de l'eau, et non comme une profondeur d'eau.

# 💧 OpenEAU

> **Carte interactive des stations hydrométriques des grands cours d’eau français**

OpenEAU est une carte interactive consacrée au suivi hydrologique des principaux cours d’eau de **France métropolitaine**.

Le site permet de localiser les stations hydrométriques, de visualiser leur situation récente et de consulter l’évolution de la **hauteur d’eau** et du **débit**.

---

## 🗺️ Le projet

OpenEAU propose une lecture simple et visuelle de la situation hydrologique des grands cours d’eau français.

La carte privilégie notamment :

**Marne · Seine · Loire · Rhône · Garonne · Dordogne · Meuse · Moselle · Rhin · Saône · Yonne · Oise · Aisne · Aube · Allier · Vienne · Cher · Adour · Lot · Tarn · Somme · Charente**

Le nombre de stations visibles évolue avec le niveau de zoom afin de conserver une carte lisible à l’échelle de la France tout en permettant une exploration plus détaillée localement.

---

## 📍 Les stations

Chaque station est représentée par un cercle dont la couleur indique sa situation hydrologique relative :

| Couleur | Situation |
|:--:|---|
| 🔴 | Très élevé |
| 🟠 | Élevé |
| 🟢 | Normal |
| 🔵 | Bas |
| 🔵 | Très bas |
| ⚪ | Donnée indisponible |

La situation est déterminée à partir du **débit actuel comparé à une référence historique propre à la station et au mois courant**.

Une valeur élevée par rapport à la normale ne signifie toutefois pas automatiquement que le cours d’eau déborde. Les couleurs constituent un indicateur de situation relative et non une carte réglementaire de vigilance ou de débordement.

---

## 📊 Données affichées

En sélectionnant une station, OpenEAU présente notamment :

- la hauteur d’eau actuelle ;
- le débit actuel ;
- la date de la dernière mesure ;
- la cote du zéro d’échelle lorsqu’elle est disponible ;
- l’altitude estimée de la surface de l’eau ;
- la référence hydrologique mensuelle utilisée ;
- l’évolution récente de la hauteur ;
- l’évolution du débit ;
- les principales informations relatives à la station.

### Hauteur et altitude de l’eau

La hauteur hydrométrique est une mesure relative au **zéro de l’échelle** de la station.

Lorsque la cote du zéro d’échelle est disponible, OpenEAU calcule l’altitude de la surface de l’eau selon :

```text
Altitude de la surface de l’eau
=
Cote du zéro d’échelle
+
Hauteur mesurée
```

Exemple :

```text
Cote du zéro :      9,58 m
Hauteur mesurée :  -1,85 m
────────────────────────────
Surface de l’eau :  7,73 m
```

Cette valeur correspond à une **altitude de la surface de l’eau**, et non à la profondeur du cours d’eau.

---

## 📈 Historique

Les graphiques permettent d'explorer l'évolution des mesures dans le temps.

### Hauteur

L'historique de hauteur repose sur les observations hydrométriques disponibles pour la station, sur une période pouvant aller jusqu'à environ **30 jours**.

### Débit

L'historique de débit permet d'explorer une période pouvant aller jusqu'à **un an**, à partir des débits moyens journaliers disponibles.

Les graphiques proposent plusieurs périodes :

**1 jour · 7 jours · 30 jours · 3 mois · 1 an**

La molette de la souris permet également d'agrandir ou de réduire la période observée.

En déplaçant la souris sur la courbe, la date et la valeur exacte de la mesure apparaissent.

---

## 🌊 Sources des données

Les données hydrométriques sont issues de l'écosystème **Eaufrance / Hub'Eau**, notamment de l'API Hydrométrie.

Les informations exploitées comprennent :

- le référentiel des stations ;
- les observations hydrométriques de hauteur et de débit ;
- les débits moyens journaliers ;
- les débits moyens mensuels utilisés comme références historiques.

### Sources

- [API Hydrométrie Hub'Eau](https://hubeau.eaufrance.fr/page/api-hydrometrie)
- [HydroPortail](https://www.hydro.eaufrance.fr/)
- [Eaufrance](https://www.eaufrance.fr/)
- [Vigicrues](https://www.vigicrues.gouv.fr/)

---

## ⚡ Mise à jour des données

OpenEAU utilise des **fichiers JSON pré-calculés** afin d'éviter de multiplier les requêtes directement depuis le navigateur.

L'architecture repose sur :

```text
Hub'Eau
   │
   ▼
GitHub Actions
   │
   ├── stations.json
   ├── live.json
   ├── normals.json
   └── history/*.json
   │
   ▼
GitHub Pages
   │
   ▼
OpenEAU
```

Les données sont régénérées automatiquement toutes les **30 minutes** par GitHub Actions.

Cette architecture permet :

- un chargement rapide de la carte ;
- une réduction importante des requêtes côté navigateur ;
- une meilleure stabilité du site ;
- la conservation des historiques dans les fichiers du projet ;
- l'affichage de la dernière génération de données disponible lorsque la source distante est momentanément indisponible.

---

## 🔎 Interprétation

OpenEAU est avant tout un **outil de visualisation et d'exploration**.

La catégorie « Très élevé » indique qu'une valeur est nettement supérieure à la référence historique utilisée pour la station. Elle ne constitue pas à elle seule une information officielle de risque de crue ou de débordement.

Pour les informations opérationnelles relatives aux crues et aux niveaux de vigilance, il convient de consulter les données officielles de **Vigicrues**.

---

## 🛠️ Technologies

Le site utilise notamment :

- **HTML / CSS / JavaScript**
- **Leaflet**
- **Python**
- **GitHub Pages**
- **GitHub Actions**
- **API Hub'Eau**

La cartographie est réalisée avec **Leaflet** et un fond cartographique sombre basé sur **OpenStreetMap / CARTO**.

---

## 👤 À propos

**OpenEAU** est un projet cartographique personnel visant à rendre les données hydrométriques françaises plus accessibles et plus faciles à explorer visuellement.

Le projet porte une attention particulière aux grands cours d'eau, notamment à la **Marne**, avec une volonté de conserver une représentation sobre, rapide et lisible à différentes échelles.

---

## 📜 Données et limites

Les données affichées dépendent de la disponibilité et de la qualité des données produites par les organismes fournisseurs.

Une station peut ponctuellement ne pas disposer d'une observation récente, d'une référence historique ou d'une cote du zéro d'échelle exploitable.

Les altitudes de surface de l'eau calculées par OpenEAU sont dérivées des données disponibles pour la station et ne constituent pas une mesure topographique indépendante.

---

### 💧 OpenEAU

**Observer les cours d'eau français, station par station.**

---
type: expo
types_livres: [Livres et Expo]       # quand le sous-type est expo (voir agent.md, 1.1)
categories: [3619, 6717]             # Culture + News : choix actuel de l'outil, À VALIDER
titre: "{Nom de l'exposition} : {accroche}"
chapo:
  source_prioritaire: journaliste
  si_absent: genere
  phrases_max: 2
  mots_max: 40
corps:
  photos_max: 2
  espacement_min_mots: 150
image_une:
  format: 1280x853
  source: visuel_expo
  traitement: recadrage_centre
---

# Chronique expo

**Aucun précédent trouvé sur le site** pour ce format. Cette fiche reprend le traitement
actuel de l'outil (« Remember Me », brouillon 158904, rangé en Culture + News) et les règles
communes. Elle est entièrement à valider avant activation.

## Structure exacte

```
<h3>{chapô}</h3>

{texte du journaliste, intégral}

[caption …]{visuel 2} © {crédit}[/caption]

<em>{Lieu} – {dates de l'exposition}</em>

<em>{Prénom Nom}</em>
```

## Règles par élément

### Titre
- `{Nom de l'exposition} : {accroche}`, l'accroche étant le titre donné par le journaliste.
  Pas d'accroche livrée : le nom de l'exposition seul.

### Chapô
1. Journaliste en priorité.
2. Sinon, une ou deux phrases, 40 mots maximum : nom de l'exposition, artiste ou sujet, lieu,
   ville et dates, **s'ils figurent dans la livraison**.
   Modèle : `{Lieu} consacre l'exposition {Nom} à {Sujet}, du {date} au {date}.`

### Infos pratiques
- Ligne `<em>{Lieu} – {dates}</em>` seulement si le lieu et les dates sont livrés.
  Rien n'est complété (ni horaires, ni prix, ni adresse) s'ils ne sont pas fournis.

### Photos
- Image à la une = visuel 1. Dans le corps : 2 visuels au maximum, au moins 150 mots entre eux.
- Crédit obligatoire en légende s'il est fourni ; sinon alerte « crédit photo manquant ».

### Signature
- `<em>{Prénom Nom}</em>`, dernier bloc.

## Questions à trancher avec Alma
- Rubrique : Culture + News, ou une autre ?
- Format du titre.
- Faut-il le bloc d'infos pratiques ?

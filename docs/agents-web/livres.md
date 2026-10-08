---
type: livres
types_livres: [Livres et Expo]       # quand le sous-type est livre ou BD (voir agent.md, 1.1)
categories: [6715, 3619]             # Chroniques Livres + Culture
titre:
  bd: "BD : {Titre} – {accroche}"
  roman: "{Titre}, le nouveau roman de {Auteur}"
  autre: "{Titre}, de {Auteur}"
chapo:
  source_prioritaire: journaliste
  si_absent: genere
  phrases_max: 2
  mots_max: 35
corps:
  photos_max: 0
  intertitres: autorises_si_livres   # h4, uniquement ceux du journaliste
image_une:
  format: 1280x853
  source: couverture
  traitement: recadrage_centre
---

# Chronique livre ou BD

Référence sur le site : 156061 (BD « Billy the Kid », signée Loraine Adam), 149647 et 148832 (romans).

## Structure exacte

```
<h3>{chapô}</h3>

{texte du journaliste, intégral, avec ses intertitres en <h4> s'il en a mis}

[rwp-review]

<em>{Prénom Nom}</em>
```

## Règles par élément

### Titre
- BD : `BD : {Titre} – {accroche}` ; l'accroche est le titre donné par le journaliste. Pas
  d'accroche livrée : `BD : {Titre}`.
- Roman : `{Titre}, le nouveau roman de {Auteur}`, seulement si la livraison dit qu'il s'agit
  d'un roman. Sinon : `{Titre}, de {Auteur}`.
- Jamais de préfixe « Chronique : ».

### Chapô
1. Journaliste en priorité.
2. Sinon, une ou deux phrases, 35 mots maximum : auteur(s), titre, genre (roman, BD, essai)
   et éditeur **s'ils figurent dans la livraison**.
   Modèle : `{Auteur} signe {Titre}, {genre} paru chez {Éditeur}.`
3. Jamais un extrait du texte du journaliste.

### Corps
- Texte intégral. Intertitres en `<h4>` seulement si le journaliste en a mis.
- Aucune photo dans le corps.

### Note
- `[rwp-review]` uniquement si une note est fournie.

### Signature
- `<em>{Prénom Nom}</em>`, sans « Par » (format de la BD Billy the Kid, la plus récente).

> À VALIDER : les anciennes chroniques livres finissaient par un renvoi vers le numéro papier
> et la boutique. Faut-il un renvoi vers le numéro de l'hebdo, comme sur le cinéma ?

### Image à la une
- Couverture du livre, recadrée au centre en 1280×853 (pratique actuelle).
- Texte alternatif : `Couverture de {Titre}`.

> À VALIDER : même question que pour les pochettes (couverture entière sur fond flouté).

## Contrôles propres à ce type
- Aucune photo dans le corps.
- Le dernier bloc est une signature `<em>…</em>`.
- Titre sans « Chronique : ».

---
type: interview
types_livres: [Interview]
variantes:
  musique: { categories: [6708, 3627] }          # Interviews Musique + Musique
  culture: { categories: [6709, 3619] }          # Interviews Culture + Culture
titre: "INTERVIEW : {Nom}, {accroche}"
chapo:
  source_prioritaire: journaliste
  si_absent: genere
  phrases_max: 2
  mots_max: 45
corps:
  questions: h4
  reponses: paragraphes
  photos_max: 3
  espacement_min_mots: 200
image_une:
  format: 1280x853
  source: photo_1
  traitement: recadrage_centre
---

# Interview

Référence sur le site : 157989 (Johnny Marr), 158471 (Mastodon), et l'interview RSH241
d'Anthrax (158884), validée par Alma « all nickel » une fois les questions passées en Titre 4.

## Structure exacte

```
<h3>{chapô}</h3>

{introduction du journaliste, s'il y en a une}

<h4>{question 1}</h4>

{réponse 1, un ou plusieurs paragraphes}

<h4>{question 2}</h4>

{réponse 2}

[caption …]{photo} © {Photographe}[/caption]

<h4>{question 3}</h4>

{réponse 3}
```

## Règles par élément

### Variante musique ou culture
- Musique : la personne interviewée est un artiste musical ou un membre de groupe.
- Culture : cinéma, livres, arts.
- La variante est lue dans la livraison (champ rubrique ou sous-type). Absente : variante
  musique et alerte « variante d'interview à confirmer ».

### Titre
- `INTERVIEW : {Nom}, {accroche}`.
- `{accroche}` = le titre donné par le journaliste, recopié tel quel. Pas de titre fourni :
  `INTERVIEW : {Nom}` seul, et alerte « titre d'interview à compléter ». Jamais d'accroche inventée.

### Chapô
1. Journaliste en priorité.
2. Sinon, une ou deux phrases, 45 maximum, avec seulement : qui est la personne (telle que
   le journaliste la présente) et l'objet de l'entretien (album, film, livre, tournée) s'il est
   nommé dans la livraison.
   Modèle : `{Nom}, {présentation reprise du texte}, revient sur {objet}.`
3. Jamais une réponse de l'interviewé ni une citation dans le chapô.

### Questions et réponses
- **Chaque question en `<h4>`**, sans « Q : », sans gras, sans numéro.
- Détection d'une question, dans cet ordre :
  1. elle est marquée comme question dans la livraison (gras, préfixe « Q », ou style dédié) ;
  2. sinon : **ne pas deviner**. Article bloqué avec l'alerte « questions non identifiables ».
- Le préfixe éventuel (« Q : », « RS : », « Rolling Stone : ») est retiré.
- Les réponses restent du texte, avec leurs paragraphes d'origine.
  Préfixe de réponse (« R : », nom de l'artiste) retiré.
- Les didascalies du journaliste (« [Rires] ») sont conservées telles quelles.

> À VALIDER : comment les questions sont-elles marquées dans le fichier livré par les journalistes ?

### Photos
- Image à la une = photo 1.
- Dans le corps : 3 au maximum, toujours **après une réponse**, jamais entre une question et
  sa réponse. Au moins 200 mots entre deux photos.
- Légende : `© {Photographe}` si fourni.

### Fin d'article
- Aucun élément fixe : ni signature, ni « À lire aussi » imposés.
- Lien vers l'album ou le film uniquement s'il est fourni.

## Contrôles propres à ce type
- Au moins 2 `<h4>`.
- Aucun `<h4>` ne se termine sans « ? », sauf liste explicite de questions affirmatives
  fournie par le journaliste (sinon alerte, non bloquante).
- Aucun `<strong>` qui occupe seul un paragraphe (ancien format des questions).
- Aucune photo placée directement après un `<h4>`.

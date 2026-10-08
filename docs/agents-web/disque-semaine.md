---
type: disque-semaine
types_livres: [Disque de la semaine]
categories: [6716, 23176, 3627]      # Chroniques Musique + Disque de la Semaine + Musique
titre: "{Artiste} – {Album}"
chapo:
  source_prioritaire: journaliste
  si_absent: genere
  phrases_max: 1
  mots_max: 30
corps:
  photos_max: 0
  intertitres: interdits
image_une:
  format: 1000x1000
  source: pochette
  traitement: entiere                # aucun recadrage
elements_fin_ordre: [video, note, tracklist, signature]
---

# Disque de la semaine

Référence sur le site : articles 157978 (Howlin' Jaws), 157212 (Tom Morello).
Sur 12 disques de la semaine relus, 11 sont publiés par Mathieu et 12 ont une tracklist.

## Structure exacte, dans cet ordre

```
<h3>{chapô}</h3>

{texte du journaliste, intégral}

{URL YouTube seule}

[rwp-review]

<h6>Voici la tracklist :</h6>
<ol>
<li>{titre 1}</li>
<li>{titre 2}</li>
</ol>

<em>Par {Prénom Nom}</em>
```

## Règles par élément

### Titre
- `{Artiste} – {Album}`, sans préfixe ni suffixe.

### Chapô
- Mêmes règles que chronique.md (journaliste en priorité, sinon modèle neutre).
- Modèle : `{Artiste} sort {Album}, son {n}e album, le {date de sortie}.`
- Maximum 30 mots (les chapôs du site font environ 20 mots).
- Jamais un extrait du texte du journaliste.

### Corps
- Texte intégral, sans photo ni intertitre.
- Longueur constatée sur le site : 190 à 380 mots. Un texte plus court n'est pas bloquant,
  mais génère l'alerte « disque de la semaine court ».

### Vidéo
- URL fournie, seule sur sa ligne ; sinon absente et alerte « vidéo non fournie ».

### Note
- `[rwp-review]` présent seulement si une note est fournie dans la livraison.

> À VALIDER : le module de note est présent sur environ 1 disque de la semaine sur 2.
> Faut-il le mettre systématiquement ?

### Tracklist
- Uniquement si la tracklist est fournie, recopiée dans l'ordre, un titre par `<li>`.
- Intitulé exact : `<h6>Voici la tracklist :</h6>`.
- Non fournie : bloc absent et alerte « tracklist non fournie ». Ne jamais la chercher.

### Signature
- `<em>Par {Prénom Nom}</em>`, dernier bloc.

> À VALIDER : la signature n'apparaît pas toujours sur les disques de la semaine publiés.

### Image à la une
- **Pochette carrée entière, 1000×1000**, sans recadrage. C'est la pratique du site pour ce
  type (contrairement aux chroniques en 1280×853).
- Pochette livrée non carrée : la placer entière, centrée, sur un fond 1000×1000 et ajouter
  l'alerte « pochette non carrée ».
- Légende : vide, sauf si un crédit est fourni. Texte alternatif : `{Artiste} – {Album}`.

> À VALIDER avec Mathieu : confirmer le format 1000×1000 pour ce type.

## Contrôles propres à ce type
- Image à la une en 1000×1000.
- Si une tracklist est fournie : `<h6>Voici la tracklist :</h6>` suivi d'une `<ol>` avec autant
  de `<li>` que de titres livrés.
- Corps sans photo ni `<h4>`.

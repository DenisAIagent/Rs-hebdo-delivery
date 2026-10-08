---
type: chronique
types_livres: [Chroniques, Chronique Coup de Coeur]
categories: [6716, 3627]            # Chroniques Musique + Musique
titre: "{Artiste} – {Album}"        # tiret demi-cadratin entouré d'espaces
chapo:
  source_prioritaire: journaliste
  si_absent: genere
  phrases_max: 1
  mots_max: 35
corps:
  photos_max: 0
  intertitres: interdits
image_une:
  format: 1280x853
  source: pochette
  traitement: recadrage_centre      # pratique actuelle du site, voir note
elements_fin_ordre: [site_officiel, video, a_lire_aussi, note, signature]
---

# Chronique musique

Référence sur le site : articles 157996 (MeShell Ndegeocello), 157994 (Valley of the Sun),
et les chroniques RSH241 corrigées par Alma (158889, 158891, 158893).

## Structure exacte, dans cet ordre

```
<h3>{chapô}</h3>

{texte du journaliste, intégral, paragraphes séparés par une ligne vide}

<a href="{site officiel}" target="_blank" rel="noopener">Site officiel</a>

{URL YouTube seule}

<em>À lire aussi :</em> <a href="{URL article RS}">{titre de l'article RS}</a>

[rwp-review-recap id="0"]

<em>Par {Prénom Nom}</em>
```

## Règles par élément

### Titre
- `{Artiste} – {Album}`, tels qu'écrits dans la livraison (casse et accents conservés).
- Aucun préfixe (« Chronique : », « Critique : ») et aucun suffixe.

### Chapô
1. **Si le journaliste a fourni un chapô** : le reprendre tel quel. S'il dépasse 35 mots,
   le garder quand même et ajouter l'alerte « chapô journaliste long ».
2. **Sinon**, générer une seule phrase neutre, selon ce modèle :
   `{Artiste} sort {Album}, son {n}e album, le {date de sortie}.`
   - Chaque partie entre accolades n'est écrite que si elle figure dans la livraison.
   - Numéro d'album absent : supprimer « , son {n}e album ».
   - Date absente : supprimer « le {date} ».
   - Il reste au minimum : `{Artiste} sort {Album}.`
   - Une précision factuelle (ville d'origine du groupe, label) est admise seulement si elle
     figure mot pour mot dans le texte du journaliste.
3. **Interdit** : prendre une phrase ou un extrait du texte du journaliste comme chapô.
   C'est le problème relevé par Alma sur Institut, Damaghead et Death Valley Girls.
4. Pas d'avis, pas d'adjectif évaluatif (« ambitieux », « magistral ») dans un chapô généré.

### Corps
- Le texte du journaliste en entier, dans l'ordre livré. Ni coupe, ni ajout.
- Aucune photo, aucun intertitre.

### Site officiel
- Uniquement si un lien « site officiel » ou « lien de commande » est fourni.
- Sinon : ligne absente, alerte « lien de commande non fourni ».

### Vidéo
- URL YouTube fournie par le journaliste, seule sur sa ligne.
- Plusieurs URL fournies : la première uniquement.
- Aucune URL fournie : ligne absente, alerte « vidéo non fournie ». Ne jamais en chercher une.

### À lire aussi
- Uniquement si un article publié sur rollingstone.fr porte l'étiquette exacte de l'artiste.
- Choisir le plus récent publié. Titre recopié tel quel.
- Aucun article trouvé : ligne absente, sans alerte.

### Note
- Ligne `[rwp-review-recap id="0"]` toujours présente, telle quelle.
- La note elle-même est saisie en relecture.

> À VALIDER : la note est-elle fournie par le journaliste sur la plateforme ? Si oui, l'agent la reporte.

### Signature
- `<em>Par {Prénom Nom}</em>`, avec le nom du journaliste tel qu'il apparaît dans la livraison.
- Toujours le dernier bloc.

### Image à la une
- La pochette fournie, ramenée en 1280×853 par recadrage centré (pratique actuelle du site,
  y compris sur les chroniques publiées par l'équipe).
- Texte alternatif : `{Artiste} – {Album}`.
- Pas de photo dans le corps.

> À VALIDER : Alma préfère la pochette entière. Option possible : pochette entière centrée
> sur un fond 1280×853 fait de la même pochette floutée. À trancher avant d'activer.

### Étiquettes
- Artiste (étiquette existante, recherche exacte).
- Musiciens invités cités par le journaliste, s'ils ont déjà une étiquette.
- Ne jamais créer d'étiquette de genre musical.

## Variante coup de cœur

> À VALIDER : aucun signe distinctif n'a été trouvé sur le site pour les coups de cœur
> (ni catégorie, ni étiquette, ni mention dans le titre). En attendant, même traitement
> qu'une chronique, sans rien ajouter.

## Contrôles propres à ce type (en plus du contrôle final d'agent.md)
- Corps sans `<img>` ni `[caption]`.
- Aucun `<h4>`.
- Le dernier bloc commence par `<em>Par `.
- Chapô généré ≤ 35 mots et composé uniquement des éléments du modèle.

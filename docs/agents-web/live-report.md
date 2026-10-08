---
type: live-report
types_livres: [Live report]
categories: [72709, 3627]            # Live Reports + Musique
titre: "LIVE REPORT : {Artiste} {préposition} {Salle}"
chapo:
  source_prioritaire: journaliste
  si_absent: genere
  phrases_max: 2
  mots_max: 40
corps:
  photos_max: 3                      # site : 0 à 4, médiane 2
  photos_surplus: ignorer            # À VALIDER : ou galerie en fin d'article
  espacement_min_mots: 150
  intertitres: interdits
image_une:
  format: 1280x853
  source: photo_1
  traitement: recadrage_centre
  legende: "© {Photographe} pour Rolling Stone"
elements_fin_ordre: [setlist]
signature: aucune                    # À VALIDER
---

# Live report

Référence sur le site : articles 158417 (Last Train, Mathieu), 157394 (BIGBANG),
158638 (The Cushings). Contre-exemple : la version automatique de Last Train (158883),
jugée illisible par Alma (9 photos en blocs Gutenberg, chapô réduit à la date).

## Structure exacte

```
<h3>{chapô}</h3>

{paragraphes 1 à k du texte}

[caption …]{photo 2} © {Photographe} pour Rolling Stone[/caption]

{paragraphes suivants}

[caption …]{photo 3} © {Photographe} pour Rolling Stone[/caption]

{fin du texte}

<h6>Setlist :</h6>
<ol>
<li>{morceau 1}</li>
</ol>
```

## Règles par élément

### Titre
- `LIVE REPORT : {Artiste} {au|à la|à l'} {Salle}`, en reprenant le nom de la salle livré.
- Préposition : « au » devant un nom masculin connu (Zénith, Stade de France), sinon « à ».
  En cas de doute : « à ».
- Deux artistes à l'affiche, s'ils sont tous deux nommés dans le titre livré :
  `LIVE REPORT : {Artiste 1} et {Artiste 2} à {Ville ou Salle}`.

### Chapô
1. Journaliste en priorité.
2. Sinon, une ou deux phrases, 40 mots maximum, qui contiennent seulement :
   l'artiste, la salle, la ville, la date du concert, et l'enjeu **s'il est écrit dans le texte**
   (fin de tournée, salle complète, premier Zénith…).
   Modèle : `{Artiste} était sur la scène {de la salle} à {Ville} le {date}.`
   Puis, si le texte le dit : `{enjeu repris des mots du journaliste}.`
3. **Interdit** : un chapô qui se limite à « Artiste – Salle – Date », comme dans la version
   automatique rejetée.

### Corps
- Texte intégral, aucun intertitre.
- La ligne d'en-tête éventuelle « Artiste – Salle – Date » de la livraison est retirée du
  corps : elle sert au titre et au chapô.

### Photos
- Image à la une = photo 1 de la livraison.
- Dans le corps : **photos 2 et 3 au maximum**, soit 2 photos (3 au total avec l'image à la une).
- Placement : après le paragraphe qui termine le premier tiers, puis le deuxième tiers du texte.
  Jamais deux photos à la suite. Au moins 150 mots entre deux photos.
  Texte de moins de 300 mots : une seule photo dans le corps.
- Photos au-delà : ignorées, alerte « photos en surnombre ignorées (n) ».
- Format : `[caption]` de l'éditeur classique, jamais de `<figure>` ni de bloc Gutenberg.
- Légende : `© {Photographe} pour Rolling Stone`. Crédit non fourni : légende vide et
  alerte « crédit photo manquant ».

> À VALIDER : nombre maximal de photos, et photos en trop ignorées ou mises en galerie.

### Setlist
- Uniquement si elle est fournie. `<h6>Setlist :</h6>` puis `<ol>`, un morceau par `<li>`,
  dans l'ordre livré, rappels compris.
- Non fournie : bloc absent, sans alerte.

### Signature
- Aucune : les live reports publiés n'en ont pas.
- La ligne « Par … » éventuelle de la livraison est retirée du corps, et sert à l'auteur.

> À VALIDER : confirmer l'absence de signature.

### À lire aussi
- Pas sur ce type (absent des live reports publiés).

## Contrôles propres à ce type
- Titre commençant par `LIVE REPORT : `.
- Nombre de `[caption]` dans le corps ≤ 2.
- Aucune photo dans les 150 premiers mots, ni deux `[caption]` consécutifs.
- Aucun `<figure>`, aucun `<!-- wp:`.
- Chapô de plus de 10 mots (évite le chapô réduit à la date).

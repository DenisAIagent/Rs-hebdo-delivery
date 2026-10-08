---
type: chronique-cinema
types_livres: [Chronique Cinema]
mode: groupe_hebdo                   # un seul article pour toutes les chroniques cinéma d'un même numéro
categories: [6714, 3, 3619]          # Chroniques Films/TV + Cinéma/Séries/TV + Culture
titre: "CINÉMA : {N} films et séries à voir cette semaine – {JJ/MM/AAAA}"
chapo:
  source: modele_fixe                # aucune génération libre
corps:
  photos_max: 0
  bloc_par_film: [h4, etoiles, texte, signature, video]
image_une:
  format: 1280x853
  source: visuel_semaine             # À VALIDER
---

# Chronique cinéma

Référence sur le site : 158640 (« CINÉMA : 4 films et séries à voir cette semaine – 07/10/2026 »)
et 157772. Sur 12 articles de la rubrique, 8 sont des sélections groupées de ce type.

> À VALIDER EN PREMIER : le site publie **un article groupé par semaine**. L'outil crée
> aujourd'hui un article « Critique : {film} » par film. Cette fiche suit la pratique du site.
> Si Alma préfère un article par film, cette fiche est à réécrire.

## Regroupement
- Toutes les livraisons « Chronique Cinema » d'un même numéro RSH forment **un seul article**.
- L'article n'est créé que lorsque toutes les chroniques cinéma attendues du numéro sont livrées.

> À VALIDER : comment l'outil sait-il que toutes les chroniques sont livrées (nombre attendu
> par numéro, ou déclenchement manuel) ?

## Structure exacte

```
<h3>L'équipe de Rolling Stone France vous propose sa sélection à voir au cinéma ou ailleurs la semaine du {JJ mois AAAA}.</h3>

Retrouvez notre sélection cinéma chaque semaine dans <a href="{URL de la page du numéro RSH}">notre hebdo</a>. Découvrez <a href="https://shop.rollingstone.fr/pages/abonnements">nos formules d'abonnement</a>.

<h4>{Titre du film} de {Réalisateur}</h4>
{étoiles}

{texte du journaliste, intégral}

<em>{Prénom Nom}</em>

{URL de la bande-annonce seule}

<h4>{Film suivant} de {Réalisateur}</h4>
…
```

## Règles par élément

### Titre
- `CINÉMA : {N} films et séries à voir cette semaine – {JJ/MM/AAAA}`.
- `{N}` = nombre de chroniques dans l'article. Date = date de parution du numéro.

### Chapô et introduction
- Texte **fixe**, recopié tel quel, seule la date change. Aucune génération.
- Le lien « notre hebdo » pointe vers la page du numéro RSH sur rollingstone.fr. Page inconnue :
  lien retiré (texte conservé) et alerte « lien du numéro hebdo manquant ».

### Bloc par film (ordre de la livraison)
1. `<h4>{Titre} de {Réalisateur}</h4>` : titre et réalisateur tels que livrés.
   Une série : `<h4>{Titre} de {Créateur}</h4>` si le créateur est livré, sinon `<h4>{Titre}</h4>`.
2. Ligne d'étoiles `★★★` (étoiles pleines, sans espace), seulement si la note est livrée.
   Jamais de note déduite du texte.
3. Le texte du journaliste en entier.
4. `<em>{Prénom Nom}</em>` : sans « Par ».
5. URL de la bande-annonce seule sur sa ligne, si elle est fournie. Sinon : absente et alerte
   « bande-annonce non fournie ».

### Image à la une
- 1280×853. Sur 158640, le visuel est une composition de la semaine (« Cinema 0710 »).

> À VALIDER : qui produit ce visuel composé ? En attendant : affiche du premier film,
> recadrée au centre, et alerte « visuel de la sélection à remplacer ».

## Contrôles propres à ce type
- Nombre de `<h4>` = nombre de chroniques livrées = `{N}` du titre.
- Chaque `<h4>` est suivi, avant le `<h4>` suivant, d'une signature `<em>…</em>`.
- Chapô identique au modèle, à la date près.

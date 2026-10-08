---
nom: agent-web-rs-hebdo
version: 0.1 (premier jet, à valider par Alma et Mathieu)
role: transformer un papier livré sur la plateforme RS Hebdo en article WordPress prêt à relire
statut_wordpress: pending            # « En attente de relecture », jamais publish
editeur: classique                   # jamais de blocs Gutenberg (<!-- wp:... -->)
auteur_creation: rs_delivery
---

# Agent web RS Hebdo : aiguillage et règles communes

Ce fichier est lu en premier, à chaque papier. Il dit quel fichier de règles charger,
puis fixe les règles qui valent pour tous les types. En cas de conflit, la fiche du
type de papier prime sur ce fichier, sauf pour la section « Interdits absolus ».

## 1. Aiguillage

Le type est lu dans le champ « Type de papier » de la livraison. Jamais déduit du texte.

| Type livré (plateforme)    | Fichier à charger        |
| -------------------------- | ------------------------ |
| Chroniques                 | chronique.md             |
| Chronique Coup de Coeur    | chronique.md (variante coup de cœur) |
| Disque de la semaine       | disque-semaine.md        |
| Live report                | live-report.md           |
| Interview                  | interview.md             |
| Chronique Cinema           | chronique-cinema.md      |
| Livres et Expo             | livres.md ou expo.md (voir 1.1) |

Type absent, vide ou inconnu : **ne rien créer**, signaler « type de papier non reconnu ».

### 1.1 Livres et Expo
Un seul type livré couvre deux formats web. Règle de tri, dans cet ordre :
1. Si la livraison contient un champ « sous-type » (livre, BD, expo) : l'utiliser.
2. Sinon : **ne pas deviner**. Créer l'article avec livres.md et ajouter l'alerte
   « sous-type livre/expo à confirmer ».

> À VALIDER : ajouter un champ « sous-type » obligatoire sur la plateforme pour ce type.

## 2. Ce que l'agent a le droit de faire, et rien d'autre

L'agent **met en forme**. Il n'écrit pas, sauf dans un cas : le chapô, quand le
journaliste n'en a pas fourni, et seulement selon la règle de la fiche du type.

Tout le reste est mécanique : balises, ordre des blocs, catégories, image, liens fournis.

## 3. Interdits absolus (valables pour tous les types, sans exception)

1. Ne jamais modifier, raccourcir, résumer ou réécrire le texte du journaliste.
   Seules corrections admises : espaces insécables avant « : ; ! ? » et « » ».
2. Ne jamais déplacer une partie du texte du journaliste dans le chapô.
   Le chapô s'ajoute au texte, il ne le remplace pas.
3. Ne jamais ajouter un fait absent de la livraison : date, chiffre, numéro d'album,
   label, nom, citation, classement, lieu.
4. Ne jamais aller chercher soi-même une vidéo, un lien, une photo ou une note.
   Seuls les éléments fournis dans la livraison sont utilisés.
5. Ne jamais utiliser de blocs Gutenberg (`<!-- wp:... -->`), ni de `<figure>`, ni d'`<iframe>`.
6. Ne jamais publier. Statut toujours `pending`.
7. Ne jamais relancer la génération sur un article déjà relu ou modifié par un humain.
   Si l'article existe déjà dans WordPress (même référence RSH + même titre), **ne rien
   écraser** : signaler « article déjà présent, relu ou en cours de relecture ».

**Règle d'abstention** : quand une information manque, on l'omet et on le signale.
On ne la complète jamais, même si elle paraît évidente.

## 4. Formats HTML communs (éditeur classique)

| Élément | Format exact |
| --- | --- |
| Chapô | `<h3>…</h3>`, toujours le **premier** bloc, une seule fois |
| Intertitre / question d'interview | `<h4>…</h4>` |
| Intitulé de liste (tracklist, setlist) | `<h6>Voici la tracklist :</h6>` ou `<h6>Setlist :</h6>` |
| Liste | `<ol><li>…</li></ol>` |
| Paragraphe | texte brut séparé par une ligne vide (pas de `<p>`, l'éditeur classique les ajoute) |
| Vidéo | l'URL YouTube **seule sur sa ligne**, rien d'autre sur la ligne |
| Photo dans le texte | `[caption id="attachment_ID" align="aligncenter" width="1280"]<img src="…" alt="…" width="1280" height="…" class="size-large wp-image-ID" /> © Photographe[/caption]` |
| Italique | `<em>…</em>` (titres d'œuvres, citations, « À lire aussi : », signature) |
| Lien externe | `<a href="…" target="_blank" rel="noopener">…</a>` |
| Lien interne rollingstone.fr | `<a href="…">…</a>` |

Interdit dans le corps : `<h1>`, `<h2>`, `<h5>`, un second `<h3>`, `<br>` en série, `&nbsp;` en série.

## 5. Image à la une (règle commune, la fiche du type peut la remplacer)

- Format : 1280×853 px, JPG.
- Source : la première image de la livraison (pochette, couverture, photo de concert).
- Recadrage : centré. Pour une pochette ou une couverture, voir la fiche du type.
- Légende WordPress : `© Photographe` si le crédit est fourni, sinon vide (jamais « © DR » inventé).
- Texte alternatif : `Artiste – Titre` (ou le sujet principal), sans mot ajouté.
- Une image téléversée et non utilisée est supprimée de la médiathèque avant la fin du traitement.

## 6. Métadonnées WordPress communes

| Champ | Règle |
| --- | --- |
| Statut | `pending` |
| Auteur | rs_delivery à la création ; voir table 6.1 pour la réattribution |
| Catégories | celles de la fiche du type, **exactement**, IDs ci-dessous |
| Étiquettes | nom de l'artiste ou du sujet principal, tel qu'il existe déjà dans WordPress (recherche exacte, pas de doublon créé) ; autres noms propres présents dans la livraison |
| Main Music Artist | nom de l'artiste principal, pour les types musicaux |
| TAG Style Music | **laissé vide** : renseigné à la main en relecture (non automatisable pour l'instant) |
| Catégorie Spécial Métal | **jamais ajoutée par l'agent** : décision humaine en relecture |
| Yoast | non renseigné par l'agent (relecture humaine) |

### 6.1 Comptes auteurs connus

| Signature dans la livraison | Compte WordPress |
| --- | --- |
| Xavier Bonnet | ID 5 |
| Samuel Regnard | ID 30 |
| Mathieu David | ID 376 |
| Belkacem Bahlouli | compte « Belkacem » (ID à relever) |
| Loraine Adam | à compléter |
| Denis Roulleau | à compléter |

Journaliste absent de la table : laisser rs_delivery et signaler « compte auteur inconnu ».

> À VALIDER : l'agent réattribue-t-il l'auteur lui-même, ou Alma le fait-elle en relecture ?

### 6.2 IDs des catégories

| Catégorie | ID |
| --- | --- |
| Musique | 3627 |
| Chroniques Musique | 6716 |
| Disque de la Semaine | 23176 |
| Live Reports | 72709 |
| Interviews Musique | 6708 |
| Spécial Métal | 6275 |
| Culture | 3619 |
| Cinéma/Séries/TV | 3 |
| Chroniques Films/TV | 6714 |
| Chroniques Livres | 6715 |
| Interviews Culture | 6709 |
| News (Culture) | 6717 |

## 7. Titre de l'article

- Format fixé par chaque fiche.
- Plus de suffixe « [EN ATTENTE DE RELECTURE] » : le statut `pending` suffit.
  > À VALIDER avec Alma.

## 8. Contrôle final (bloquant)

Avant d'enregistrer, le code vérifie l'article produit. **Un seul échec = article non
créé**, et le rapport liste les écarts.

1. Le premier bloc est un `<h3>`, et il n'y en a qu'un.
2. Le texte du journaliste est présent **en entier** dans le corps, mot pour mot
   (comparaison du texte livré et du texte du corps hors chapô, espaces normalisés).
3. Le chapô respecte la longueur maximale de la fiche du type.
4. Aucun mot du chapô qui soit un nombre, une date ou un nom propre n'est absent de la livraison.
5. Aucune balise interdite (section 4), aucun bloc Gutenberg, aucune iframe.
6. Nombre de photos dans le corps ≤ maximum de la fiche du type.
7. Catégories = exactement celles de la fiche.
8. Image à la une présente, au bon format.
9. Statut = `pending`.

## 9. Rapport de traitement

Pour chaque papier, une ligne :
`RSH### | type | titre | créé / bloqué | alertes`

Alertes possibles : vidéo non fournie, lien de commande non fourni, chapô généré
(non fourni par le journaliste), crédit photo manquant, compte auteur inconnu,
sous-type livre/expo à confirmer, photos en surnombre ignorées, article déjà présent.

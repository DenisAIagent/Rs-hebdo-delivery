# Note pour le développeur de rollingstone.fr

## Ce qu'on demande

Déposer **un seul fichier** sur le site :

```
scripts/wp/rs-delivery-rest-meta.php   →   wp-content/mu-plugins/rs-delivery-rest-meta.php
```

Créer le dossier `mu-plugins/` s'il n'existe pas. Les *must-use plugins* s'activent seuls,
il n'y a rien à faire dans l'admin. Pour désinstaller, supprimer le fichier : le plugin ne crée
aucune table, ne planifie aucune tâche et ne modifie rien de lui-même.

## Pourquoi

Rolling Stone Hebdo est livré chaque semaine par une application interne qui crée les brouillons
sur le site via l'API REST. Quatre champs obligatoires ne peuvent pas être renseignés ainsi et
doivent aujourd'hui être saisis à la main sur chaque article, soit une vingtaine d'articles par
semaine :

- les champs **Yoast SEO** (requête cible, titre SEO, méta description) ;
- le **Style Music** du thème (metabox `id_sm_metaboxe`, `select[name="liste"]`) ;
- le **Main Music Artist** du thème (metabox `id_mat_metaboxe`, `input#new-mat-tag`) ;
- la note de la **Reviews Box** (plugin Reviewer d'Evographics).

La cause est la même pour les quatre : WordPress n'accepte dans `wp/v2/posts.meta` que les
métadonnées déclarées avec `show_in_rest`. Sur le site, seules 5 clés le sont (ExactMetrics et
`footnotes`), et tout le reste est **ignoré en silence** — la requête réussit, mais rien n'est
enregistré. Vérifiable avec `GET /wp-json/wp/v2/posts?per_page=1`.

## Ce que fait le fichier

1. **Déclare les 3 métas Yoast** (`_yoast_wpseo_focuskw`, `_yoast_wpseo_title`,
   `_yoast_wpseo_metadesc`) avec `show_in_rest`, pour qu'elles soient acceptées à la création du
   brouillon.
2. **`GET /wp-json/rs-delivery/v1/post-meta/{id}`** — lecture seule. Renvoie les métas et les
   termes d'un article. Sert à identifier les clés réelles utilisées par le thème et par Reviewer,
   à partir d'un article déjà renseigné correctement.
3. **`POST /wp-json/rs-delivery/v1/post-meta/{id}`** — écriture, corps `{"meta": {...}}`.

## Garde-fous

- Les trois routes exigent `current_user_can('edit_post', $post_id)` : un compte doit déjà avoir
  le droit d'éditer **cet article précis**. Aucune élévation de privilège.
- L'écriture est restreinte à une liste de préfixes de clés, en dur en haut du fichier :
  `_yoast_wpseo_`, `rwp_`, `sm_`, `_sm_`, `mat_`, `_mat_`. Toute autre clé est refusée et
  retournée dans `refused`. Impossible d'écrire une option du site ou une méta arbitraire.
- Les valeurs sont nettoyées récursivement : seuls chaînes, nombres, booléens et tableaux de
  ceux-ci sont acceptés. Rien de sérialisé, rien d'exécutable.
- Aucun accès fichier, aucune sortie réseau, aucune modification du contenu des articles, aucune
  publication automatique. Le plugin ne touche qu'aux métadonnées.
- Le compte utilisé par l'application est `rs_delivery` (rôle `api_writer`), qui s'authentifie par
  **mot de passe applicatif** — donc uniquement sur l'API REST, jamais sur `wp-admin`.

## Vérification après installation

```bash
# 1. Le namespace doit apparaître
curl -s https://www.rollingstone.fr/wp-json/ | grep -o 'rs-delivery/v1'

# 2. Lecture d'un article de référence (chronique déjà notée)
curl -s -u 'rs_delivery:<mot-de-passe-applicatif>' \
  https://www.rollingstone.fr/wp-json/rs-delivery/v1/post-meta/156730
```

La seconde commande doit renvoyer les métas de l'article, dont celles du plugin Reviewer avec la
note 4. C'est tout ce dont nous avons besoin : nous en déduisons les clés, et l'application prend
le relais sans autre intervention.

## Si une clé sort des préfixes autorisés

Possible pour le Style Music ou le Main Artist, dont on ne connaît pas encore le nom exact.
Dans ce cas il suffit d'ajouter le préfixe constaté au tableau
`RS_DELIVERY_ALLOWED_META_PREFIXES`, en haut du fichier. Nous vous dirons lequel après la
première lecture de diagnostic.

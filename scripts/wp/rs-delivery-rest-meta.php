<?php
/**
 * Plugin Name: RS Delivery — champs REST (Yoast, Reviews Box, Style Music, Main Artist)
 * Description: Permet a RS Hebdo Delivery de renseigner, via l'API REST, les champs que WordPress n'expose pas par defaut sur les brouillons : Yoast SEO, le Style Music et le Main Music Artist du theme, et la note de la Reviews Box (plugin Reviewer). Ecriture strictement reservee aux comptes pouvant editer l'article vise, et limitee a une liste de prefixes de cles fixee ci-dessous.
 * Version: 2.0.0
 * Author: RS Hebdo Delivery
 *
 * INSTALLATION
 *   Copier ce fichier dans wp-content/mu-plugins/ (actif automatiquement, sans
 *   activation dans l'admin). Creer le dossier s'il n'existe pas.
 *
 * DESINSTALLATION
 *   Supprimer le fichier. Le plugin ne cree aucune table, ne planifie aucune
 *   tache, et ne modifie aucune donnee de lui-meme.
 *
 * CE QU'IL NE FAIT PAS
 *   Aucune execution de code arbitraire, aucun acces fichier, aucune sortie
 *   reseau, aucune modification du contenu des articles, aucune publication.
 *   Il n'agit que sur les metadonnees des articles, et uniquement pour un
 *   utilisateur deja autorise a editer l'article concerne.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Prefixes de cles de metadonnees autorises en ecriture.
 *
 * Tout ce qui ne commence pas par l'un d'eux est refuse. C'est la garantie que
 * cet endpoint ne peut pas servir a ecrire n'importe quelle metadonnee, ni a
 * toucher aux options du site.
 *
 *   _yoast_wpseo_  : champs SEO (requete cible, titre, meta description)
 *   rwp_           : plugin Reviewer (Reviews Box)
 *   sm_ / _sm_     : metabox Style Music du theme       (id_sm_metaboxe)
 *   mat_ / _mat_   : metabox Main Music Artist du theme (id_mat_metaboxe)
 */
const RS_DELIVERY_ALLOWED_META_PREFIXES = [
    '_yoast_wpseo_',
    'rwp_',
    'sm_',
    '_sm_',
    'mat_',
    '_mat_',
];

/** Une cle est-elle autorisee en ecriture ? */
function rs_delivery_meta_key_allowed($key) {
    foreach (RS_DELIVERY_ALLOWED_META_PREFIXES as $prefix) {
        if (strpos($key, $prefix) === 0) {
            return true;
        }
    }
    return false;
}

/** Droit commun a toutes les routes : pouvoir editer CET article. */
function rs_delivery_can_edit($request) {
    $post_id = (int) $request['id'];
    if ($post_id <= 0 || !get_post($post_id)) {
        return new WP_Error('rs_delivery_not_found', 'Article introuvable.', ['status' => 404]);
    }
    if (!current_user_can('edit_post', $post_id)) {
        return new WP_Error('rs_delivery_forbidden', 'Droits insuffisants sur cet article.', ['status' => 403]);
    }
    return true;
}

/* ------------------------------------------------------------------------
 * 1. Yoast SEO : metas protegees exposees a wp/v2/posts.meta
 *    Permet a RS Hebdo Delivery de les envoyer directement a la creation du
 *    brouillon, sans appel supplementaire.
 * --------------------------------------------------------------------- */
add_action('init', function () {
    $string_meta = [
        '_yoast_wpseo_focuskw',
        '_yoast_wpseo_title',
        '_yoast_wpseo_metadesc',
    ];

    foreach ($string_meta as $key) {
        register_post_meta('post', $key, [
            'type'              => 'string',
            'single'            => true,
            'show_in_rest'      => true,
            'auth_callback'     => function ($allowed, $meta_key, $post_id) {
                return current_user_can('edit_post', $post_id);
            },
            'sanitize_callback' => 'sanitize_text_field',
        ]);
    }
});

/* ------------------------------------------------------------------------
 * 2. Diagnostic (LECTURE SEULE) : GET /wp-json/rs-delivery/v1/post-meta/{id}
 *
 *    Renvoie toutes les metas d'un article et ses termes de taxonomie. Sert a
 *    identifier les cles reelles de Reviewer, Style Music et Main Music Artist
 *    sur un article deja renseigne a la main (article de reference).
 * --------------------------------------------------------------------- */
add_action('rest_api_init', function () {
    register_rest_route('rs-delivery/v1', '/post-meta/(?P<id>\d+)', [
        'methods'             => 'GET',
        'permission_callback' => 'rs_delivery_can_edit',
        'callback'            => function ($request) {
            $post_id = (int) $request['id'];

            $meta = [];
            foreach (get_post_meta($post_id) as $key => $values) {
                // get_post_meta renvoie des valeurs serialisees : on les
                // deserialise pour que la structure soit lisible cote client.
                $meta[$key] = array_map('maybe_unserialize', $values);
            }

            $terms = [];
            foreach (get_post_taxonomies($post_id) as $taxonomy) {
                $assigned = wp_get_post_terms($post_id, $taxonomy, ['fields' => 'all']);
                if (!is_wp_error($assigned)) {
                    foreach ($assigned as $term) {
                        $terms[$taxonomy][] = [
                            'term_id' => $term->term_id,
                            'slug'    => $term->slug,
                            'name'    => $term->name,
                        ];
                    }
                }
            }

            return [
                'post_id'    => $post_id,
                'post_title' => get_the_title($post_id),
                'meta'       => $meta,
                'terms'      => $terms,
            ];
        },
    ]);

    /* --------------------------------------------------------------------
     * 3. Ecriture ciblee : POST /wp-json/rs-delivery/v1/post-meta/{id}
     *
     *    Corps attendu : {"meta": {"<cle>": <valeur>, ...}}
     *    Seules les cles couvertes par RS_DELIVERY_ALLOWED_META_PREFIXES sont
     *    acceptees ; les autres sont refusees et listees dans la reponse.
     *    Les valeurs peuvent etre des chaines, des nombres ou des tableaux
     *    (la Reviews Box stocke une structure).
     * ----------------------------------------------------------------- */
    register_rest_route('rs-delivery/v1', '/post-meta/(?P<id>\d+)', [
        'methods'             => 'POST',
        'permission_callback' => 'rs_delivery_can_edit',
        'callback'            => function ($request) {
            $post_id = (int) $request['id'];
            $meta    = $request->get_param('meta');

            if (!is_array($meta) || empty($meta)) {
                return new WP_Error(
                    'rs_delivery_bad_request',
                    'Corps attendu : {"meta": {"<cle>": <valeur>}}.',
                    ['status' => 400]
                );
            }

            $written  = [];
            $refused  = [];

            foreach ($meta as $key => $value) {
                $key = (string) $key;

                if (!rs_delivery_meta_key_allowed($key)) {
                    $refused[$key] = 'prefixe non autorise';
                    continue;
                }

                // Nettoyage recursif : on n'accepte que des scalaires et des
                // tableaux de scalaires, jamais d'objet ni de code serialise.
                $clean = rs_delivery_sanitize_value($value);
                if ($clean === null) {
                    $refused[$key] = 'valeur non scalaire';
                    continue;
                }

                update_post_meta($post_id, $key, $clean);
                $written[$key] = $clean;
            }

            // Laisse Yoast, le theme et les plugins recalculer ce qui depend de
            // ces metas (indicateurs SEO, rendu de la Reviews Box, etc.).
            clean_post_cache($post_id);

            return [
                'post_id' => $post_id,
                'written' => $written,
                'refused' => $refused,
            ];
        },
    ]);
});

/**
 * N'autorise que des chaines, nombres, booleens, et tableaux de ceux-ci.
 * Renvoie null si la valeur contient autre chose.
 */
function rs_delivery_sanitize_value($value) {
    if (is_string($value)) {
        return sanitize_text_field($value);
    }
    if (is_int($value) || is_float($value) || is_bool($value)) {
        return $value;
    }
    if (is_array($value)) {
        $out = [];
        foreach ($value as $k => $v) {
            $clean = rs_delivery_sanitize_value($v);
            if ($clean === null) {
                return null;
            }
            $out[sanitize_text_field((string) $k)] = $clean;
        }
        return $out;
    }
    return null;
}

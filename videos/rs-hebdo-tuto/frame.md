# frame.md — charte vidéo RS Hebdo Delivery (tutoriel)

Source de vérité : `frontend/src/index.css` de l'application. La vidéo reconstitue
l'interface réelle ; les valeurs de marque ci-dessous sont strictes, leur
application (tailles, opacités, épaisseurs) est adaptée à la vidéo.

## Concept

Une leçon posée, feuille de papier crème sous une lampe chaude : l'écran de
l'application est le sujet, un grand curseur est l'acteur, la voix off guide.
Chaque scène = un écran reconstitué au centre (cadre navigateur discret), une
zone d'attention entourée d'un liseré rouge le temps de sa phrase, et des
annotations en serif italique qui flottent en marge comme des notes de relecture.

## Palette (hex stricts)

| Rôle | Valeur |
| --- | --- |
| Fond de scène (papier) | `#FBF8F2` |
| Papier 2 (zones, chips) | `#F5F0E6` |
| Surface (cartes, écrans) | `#FFFFFF` |
| Bordure | `#E8E2D2` · forte `#D8D0BD` |
| Encre (texte) | `#16140F` · encre 2 `#2C2A23` |
| Atténué | `#6A6557` · `#6A6557` |
| Rouge Rolling Stone (accent unique) | `#E11D2E` · profond `#B30E1F` · teinte `#FBE4E6` · halo `rgba(225,29,46,0.18)` |
| OK | `#2D7A4B` · teinte `#E2F1E8` |
| Info | `#0E5DAA` · teinte `#DEEAF7` |
| Étoile | `#E6B400` |

Canvas clair, jamais de mode sombre. Le rouge est le seul accent : liserés
d'attention, boutons primaires, chips « EN COURS », points d'obligation.
Halo radial rouge à 12–18 % en fond de scène (jamais de dégradé linéaire plein cadre).
Grain papier léger (SVG feTurbulence, opacité 6–8 %) sur toutes les scènes.

## Typographie (fichiers dans `assets/fonts/`, à déclarer en `@font-face`)

| Rôle | Police | Poids | Taille vidéo |
| --- | --- | --- | --- |
| Titres de scène, annotations | Instrument Serif | 400, italique pour les annotations | 72–120 px titres · 34–44 px annotations |
| Interface reconstituée, texte courant | Geist | 300 / 400 / 500 / 600 / 700 | 22–30 px UI · 26–34 px sous-titres de note |
| Chiffres (compteur de signes, code 2FA, RSH) | Geist Mono | 400 / 500 | 24–36 px |

Une seule police expressive par scène (Instrument Serif) ; Geist recule.
Contraste de graisse : Geist 300 pour le corps de formulaire, 700 pour les
boutons et les chips. Interlettrage -0,02 em sur les titres.

## Composants d'interface (reprise des classes de l'app)

- `rs-card` : fond `#FFFFFF`, bordure 2 px `#E8E2D2`, rayon 14 px, ombre douce `0 24px 60px -20px rgba(20,18,12,0.18)`.
- `rs-btn primary` : fond `#E11D2E`, texte blanc, rayon 10 px, 700, padding 14/24.
- `rs-btn ghost` : transparent, bordure `#D8D0BD`, encre.
- `rs-chip` : pilule 999 px, 13→22 px en vidéo ; `red` fond `#FBE4E6` texte `#B30E1F` ; `ok` fond `#E2F1E8` texte `#2D7A4B` ; `muted` fond `#F5F0E6` texte `#6A6557`.
- Champs : fond `#FFFFFF`, bordure 2 px `#E8E2D2`, focus bordure `#E11D2E` + halo.
- Point d'obligation : `•` rouge après le libellé.
- Cadre navigateur : barre 44 px `#F5F0E6`, trois pastilles `#D8D0BD`, URL `hebdo-rs.up.railway.app` en Geist Mono atténué.

## Motion

- Rythme lent : entrées 0,5–0,8 s, tenues longues, jamais plus d'un mouvement principal à la fois.
- Curseur : composant `oversized-cursor` (variante `dark`), déplacements 0,6–0,9 s en `power2.inOut`, clic = compression 0,12 s + onde.
- Liseré d'attention : rectangle rouge 3 px, rayon 12 px, qui se dessine (`scaleX` puis `scaleY`) et respire légèrement pendant sa phrase, puis se retire.
- Annotations serif : glissent de 24 px avec fondu, restent 2 s minimum.
- Transitions entre scènes : fondu enchaîné 0,6 s sur le même papier ; pas de wipe, pas de 3D.
- Décoratifs ambiants (2–3 par scène) : halo rouge qui respire, filet horizontal fin, mot fantôme « HEBDO » en serif à 6 % qui dérive lentement.

## À ne pas faire

- Pas de capture réelle, pas de données réelles (noms d'artistes fictifs : « Les Marquises », album « Nuit blanche »).
- Pas de texte sous 22 px, pas d'opacité décorative sous 10 %.
- Pas de dégradé texte, pas de néon, pas de gris mort : toutes les neutres sont teintées papier.

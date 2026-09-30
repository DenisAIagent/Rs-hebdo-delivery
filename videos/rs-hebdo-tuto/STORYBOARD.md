---
format: 1920x1080
duration: 35s
message: "Livrer un papier à Rolling Stone Hebdo prend cinq minutes, en quatre étapes guidées, sans email ni pièce jointe."
arc: Ouverture → Connexion et tableau de bord → Rédaction → Correction IA → Envoi et suite → Fermeture
audience: journalistes et pigistes de Rolling Stone France
mode: autonomous
language: fr
captions: disabled
---

Version courte (45 s maximum, voix ElevenLabs « Manon », une seule prise continue `assets/vo45/manon-take1.mp3`). Conventions communes (voir `frame.md`) : canvas papier `#FBF8F2`, halo rouge radial, grain, mot fantôme « HEBDO ». Les écrans de l'application sont **repris des scènes longues déjà construites** dans `compositions/frames/0N-*.html` (même DOM, même CSS, mêmes libellés) : chaque bloc ci-dessous nomme le fichier source à copier ; on ne redessine pas, on **rechorégraphie sur un rythme court** avec le curseur (grand pointeur SVG sombre), les liserés d'attention rouges et une note de marge maximum par scène. Chaque scène est pleine dès sa première image (pas de canvas vide) : le cadre navigateur est déjà en place à t=0, seuls les éléments nommés entrent ensuite. Personnages fictifs : « Camille Roux », « Les Marquises », « Nuit blanche ».

## Frame 1 — Ouverture

- scene: Logo Rolling Stone France, titre RS Hebdo Delivery en serif, quatre pastilles d'étapes qui entrent en cascade
- duration: 6.38s
- poster: 4s
- transition_in: cut
- status: outline
- voiceover: "RS Hebdo Delivery, c'est la nouvelle façon de livrer vos papiers à Rolling Stone France."
- src: compositions/frames/s1-ouverture.html
- blueprint: compose
- rules: spring-pop-entrance, waterfall-entry, svg-path-draw
- focal: le titre « RS Hebdo Delivery »
- source: compositions/frames/01-ouverture.html (reprendre logo, titre, filet, pastilles ; retirer les pictogrammes et l'enveloppe barrée)
- assets: assets/logo-rs-france.png

Scene 1 (0.0–1.3s) : halo en place, filet qui se trace, logo entre à ressort à 0,2 s ; sur « RS Hebdo Delivery » (0,3 → 0,8 s) le titre se compose mot par mot, sous-titre « Édition rédaction » à 1,3 s.
Scene 2 (1.3–4.6s) : sur « la nouvelle façon de livrer vos papiers » (1,5 → 3,4 s) les quatre pastilles 01 → 04 « Type de papier », « Rédaction », « Correction IA », « Vérification & envoi » entrent en cascade (0,35 s d'écart, 1,6 → 2,7 s) sur une ligne à y ≈ 0,7×hauteur, reliées par un filet qui se trace.
Scene 3 (4.6–6.4s) : sur « Rolling Stone France » (3,7 → 4,6 s) le logo pulse une fois très légèrement ; tenue, halo qui respire.

## Frame 2 — Connexion et tableau de bord

- scene: L'écran de connexion se remplit en un souffle puis glisse vers le tableau de bord, liseré rouge sur la carte du numéro en cours puis sur la liste des livraisons
- duration: 5.35s
- poster: 5s
- transition_in: crossfade
- status: outline
- voiceover: "Connectez-vous : votre tableau de bord affiche le numéro en cours et toutes vos livraisons."
- src: compositions/frames/s2-tableau.html
- blueprint: compose
- rules: cursor-click-ripple, dynamic-content-sequencing, waterfall-entry
- focal: la carte rouge « EN COURS · RSH 240 », puis le tableau « Mes livraisons »
- source: compositions/frames/02-connexion.html (carte de connexion, panneau encre) et compositions/frames/03-tableau-de-bord.html (tableau de bord complet, sans le menu déroulant)

Scene 1 (0.0–1.4s) : cadre navigateur avec l'écran de connexion déjà rempli (email « camille.roux@rollingstone.fr », mot de passe en points) ; sur « Connectez-vous » (0,25 → 0,85 s) le curseur presse « Se connecter → » à 0,5 s (clic avec onde), bouton comprimé puis relâché.
Scene 2 (1.4–3.4s) : à 1,4 s le contenu du navigateur se remplace par le tableau de bord (fondu croisé 0,4 s) : barre de navigation, « Bonjour Camille », carte rouge du numéro, carte Dropbox, quatre compteurs et tableau entrent en cascade serrée (0,07 s d'écart) ; sur « le numéro en cours » (2,3 → 3,0 s) liseré d'attention rouge sur la carte « EN COURS · RSH 240 ».
Scene 3 (3.4–5.4s) : sur « toutes vos livraisons » (3,3 → 4,3 s) le liseré glisse sur le tableau « Mes livraisons » (trois lignes), note de marge droite « Vos livraisons » à 3,6 s. Tenue.

## Frame 3 — Rédaction

- scene: Grille des formats, clic sur Chroniques, le formulaire se remplit, une photo se dépose, le compteur de signes monte et passe au vert
- duration: 5.42s
- poster: 4.5s
- transition_in: crossfade
- status: outline
- voiceover: "Choisissez le format, écrivez, ajoutez vos photos. Le compteur de signes veille pour vous."
- src: compositions/frames/s3-redaction.html
- blueprint: compose
- rules: cursor-click-ripple, discrete-text-sequence, cursor-drag, counting-dynamic-scale
- focal: la carte « Chroniques » puis le compteur de signes
- source: compositions/frames/04-etape-1.html (grille des huit formats) et compositions/frames/05-etape-2.html (formulaire Chroniques, zone de dépôt, compteur, vignette pochette.jpg)

Scene 1 (0.0–1.2s) : cadre navigateur avec le fil d'étapes et la grille des huit formats déjà visible ; sur « Choisissez le format » (0,25 → 1,1 s) le curseur clique « Chroniques » à 0,7 s (onde), la carte prend la bordure rouge.
Scene 2 (1.2–3.2s) : à 1,2 s le contenu se remplace par le formulaire Chroniques (fondu 0,35 s) ; sur « écrivez » (1,1 → 1,9 s) le corps du texte se remplit très vite (saisie par blocs, 1,0 s dès 1,4 s) et le titre « Les Marquises — Nuit blanche » se compose ; sur « ajoutez vos photos » (1,9 → 2,9 s) la vignette « pochette.jpg » est glissée depuis la marge droite dans la zone de dépôt (2,0 → 2,8 s) et se pose en mini-carte.
Scene 3 (3.2–5.4s) : sur « Le compteur de signes veille pour vous » (3,0 → 4,7 s) liseré d'attention sur le compteur mono qui monte de 0 à 1 480 / 1 500 (3,2 → 4,3 s) avec sa barre verte et l'étiquette « Bonne longueur » à 4,4 s. Tenue.

## Frame 4 — Correction IA

- scene: Clic sur Corriger le texte avec l'IA, trois coches Orthographe Grammaire Typographie, mots surlignés, cadre Texte final modifiable et retouche d'un mot
- duration: 7.26s
- poster: 5s
- transition_in: crossfade
- status: outline
- voiceover: "En un clic, l'intelligence artificielle relit l'orthographe et la typographie. Vous gardez toujours le dernier mot."
- src: compositions/frames/s4-correction.html
- blueprint: compose
- rules: press-release-spring, asr-keyword-glow, dynamic-content-sequencing, discrete-text-sequence
- focal: le cadre « Texte final (modifiable) »
- source: compositions/frames/06-etape-3.html (carte du texte, bouton, état d'attente, cadre final, boutons « Corriger encore » et « Continuer → »)

Scene 1 (0.0–1.4s) : cadre navigateur, fil d'étapes avec « 3 Correction IA » actif, carte du texte en place ; sur « En un clic » (0,25 → 0,8 s) le curseur presse « Corriger le texte avec l'IA » à 0,6 s (pression avec rebond), liseré d'attention.
Scene 2 (1.4–4.4s) : sur « l'intelligence artificielle relit l'orthographe et la typographie » (0,85 → 4,4 s) les trois lignes « Orthographe ✓ » (2,7 s), « Grammaire ✓ » (3,2 s), « Typographie ✓ » (3,8 s) se cochent ; trois mots du texte s'illuminent en teinte rouge entre 2,8 et 4,2 s.
Scene 3 (4.4–7.3s) : sur « Vous gardez toujours le dernier mot » (4,65 → 6,3 s) le cadre devient « Texte final (modifiable) » avec son liseré fin à 4,7 s ; le curseur clique dans le texte à 5,4 s et remplace « superbe » par « magnifique » caractère par caractère (5,6 → 6,6 s) ; note de marge gauche « Toujours modifiable » à 6,0 s. Tenue.

## Frame 5 — Envoi et suite

- scene: Clic sur Livrer le papier, écran Bravo c'est envoyé, puis trois cartes Dropbox, rollingstone.fr, Rédaction en chef reliées par des filets
- duration: 7.55s
- poster: 4s
- transition_in: crossfade
- status: outline
- voiceover: "Vérifiez, livrez. Votre papier part dans Dropbox, en brouillon sur rollingstone point fr, et la rédaction est prévenue."
- src: compositions/frames/s5-envoi.html
- blueprint: compose
- rules: press-release-spring, spring-pop-entrance, svg-path-draw, waterfall-entry
- focal: l'écran « Bravo, c'est envoyé ! » puis les trois cartes
- source: compositions/frames/07-etape-4.html (récapitulatif coché, bouton « Livrer le papier », écran de succès) et compositions/frames/08-ensuite.html (nœud « Les Marquises — Nuit blanche » et les trois cartes avec leurs filets)

Scene 1 (0.0–1.5s) : cadre navigateur avec le récapitulatif déjà coché (cinq lignes, coches vertes) ; sur « Vérifiez, livrez » (0,25 → 1,2 s) le curseur presse « Livrer le papier » à 0,9 s.
Scene 2 (1.5–2.5s) : à 1,5 s l'écran « Bravo, c'est envoyé ! » remplace le récapitulatif (disque vert et titre à ressort), sans confettis.
Scene 3 (2.5–7.5s) : sur « Votre papier part dans Dropbox » (1,5 → 3,0 s) le navigateur se réduit et glisse à gauche (scale 0,55, centre à 0,28×largeur, 2,4 → 3,0 s) pour devenir le nœud ; trois filets se tracent vers la droite et les cartes entrent à ressort : « Dropbox » à 3,0 s (sur « Dropbox »), « rollingstone.fr · Brouillon · En attente de relecture » à 4,3 s (sur « rollingstone.fr »), « Rédaction en chef » à 5,9 s (sur « la rédaction est prévenue »). Tenue.

## Frame 6 — Fermeture

- scene: Quatre pastilles d'étapes rappelées en un souffle, puis logo Rolling Stone France et signature RS Hebdo Delivery
- duration: 5.58s
- poster: 3s
- transition_in: crossfade
- status: outline
- voiceover: "Cinq minutes, sans email ni pièce jointe. Bienvenue."
- src: compositions/frames/s6-fermeture.html
- blueprint: compose
- rules: spring-pop-entrance, svg-path-draw
- focal: le logo Rolling Stone France
- source: compositions/frames/10-fermeture.html (logo, signature, filet, halo)
- assets: assets/logo-rs-france.png

Scene 1 (0.0–2.4s) : sur « Cinq minutes » (0,25 → 1,0 s) le chiffre « 5 min » en Instrument Serif 160 px se pose au centre à ressort à 0,3 s ; sur « sans email ni pièce jointe » (1,05 → 2,6 s) la ligne Geist « sans email ni pièce jointe » se compose en dessous à 1,1 s.
Scene 2 (2.4–5.5s) : sur « Bienvenue » (3,05 s) le chiffre et la ligne s'effacent (scène finale : sortie autorisée, 2,6 → 3,0 s), le logo entre au centre à 3,0 s, la signature « RS Hebdo Delivery » se compose à 3,5 s, le filet se trace, halo qui s'apaise. Tenue jusqu'au fondu final géré par la racine.

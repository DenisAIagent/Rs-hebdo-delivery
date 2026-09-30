---
format: 1920x1080
duration: 315s
message: "Livrer un papier à Rolling Stone Hebdo prend cinq minutes, en quatre étapes guidées, sans email ni pièce jointe."
arc: Accueil → Connexion → Tableau de bord → Étape 1 → Étape 2 → Étape 3 → Étape 4 → Après l'envoi → Modifier → Fermeture
audience: journalistes et pigistes de Rolling Stone France
mode: autonomous
language: fr
captions: disabled
---

Conventions communes à toutes les scènes (voir `frame.md`) : canvas papier `#FBF8F2`, halo rouge radial qui respire, grain SVG, mot fantôme « HEBDO » en Instrument Serif à 6 %. L'écran de l'application est reconstitué dans un cadre navigateur centré (1500×860 px environ, ancré à 0,08×hauteur) ; le curseur est un grand pointeur macOS sombre (SVG inline, 3× la taille normale) ; la « zone d'attention » est un rectangle rouge 3 px rayon 12 px dessiné en `scaleX` puis `scaleY` qui respire pendant sa phrase ; les « notes de marge » sont des annotations Instrument Serif italique 38 px, encre 2, qui glissent de 24 px avec fondu à droite ou à gauche de l'écran. Personnages fictifs : journaliste « Camille Roux », artiste « Les Marquises », album « Nuit blanche ». Les libellés d'interface sont ceux de l'app, exacts.

## Frame 1 — Ouverture

- scene: Logo Rolling Stone France sur papier, le titre RS Hebdo Delivery se compose, quatre pastilles d'étapes apparaissent une à une
- duration: 22.1s
- poster: 14s
- transition_in: cut
- status: outline
- voiceover: "Bienvenue sur RS Hebdo Delivery, la plateforme de livraison des papiers de Rolling Stone France. En quelques minutes, vous allez apprendre à envoyer vos articles, vos photos et vos chroniques directement à la rédaction. Plus d'email, plus de pièces jointes perdues. Tout se passe ici, en quatre étapes."
- src: compositions/frames/01-ouverture.html
- blueprint: titlecard-reveal
- rules: spring-pop-entrance, waterfall-entry, svg-path-draw
- focal: le titre « RS Hebdo Delivery » en Instrument Serif 120 px
- assets: assets/logo-rs-france.png (600×126, logo « Rolling Stone France » à placer à 420 px de large)

Scene 1 (0.0–3.5s) : papier nu avec halo rouge qui s'installe (halo ambiant), grain, filet horizontal fin qui se trace au tiers supérieur (`svg-path-draw`). Le logo `assets/logo-rs-france.png` arrive par `spring-pop-entrance` (scale 0.92→1, léger dépassement) centré à 0,30×hauteur.
Scene 2 (3.5–9s) : sous le logo, le titre « RS Hebdo Delivery » se compose mot par mot (`waterfall-entry`, 0,25 s d'écart, y 30→0) ; en dessous, la ligne Geist 300 « Édition rédaction » en atténué. Sur « vos articles, vos photos et vos chroniques » (≈ 8–12 s), trois petits pictogrammes linéaires (feuille, image, étoile) glissent l'un après l'autre à droite du titre.
Scene 3 (13–21s) : sur « Plus d'email », un pictogramme d'enveloppe barrée apparaît puis s'efface ; sur « en quatre étapes » (≈ 17 s), quatre pastilles numérotées 01 → 04 avec leurs libellés « Type de papier », « Rédaction », « Correction IA », « Vérification & envoi » entrent en `waterfall-entry` sur une ligne horizontale au bas de la zone (y ≈ 0,72×hauteur), reliées par un filet qui se trace de gauche à droite entre elles (`svg-path-draw`). Tenue jusqu'à la fin.

## Frame 2 — Se connecter

- scene: Écran de connexion reconstitué, le curseur remplit email et mot de passe, puis l'écran 2FA avec six cases qui se remplissent
- duration: 30.8s
- poster: 20s
- transition_in: crossfade
- status: outline
- voiceover: "Commençons par la connexion. Saisissez votre adresse email et votre mot de passe, puis cliquez sur « Se connecter ». Si la double authentification est activée, l'application vous demande ensuite un code à six chiffres. Ouvrez votre application d'authentification, comme Google Authenticator, recopiez le code, et validez avec « Vérifier ». Mot de passe oublié ? Le lien sous le formulaire vous envoie un email pour le réinitialiser."
- src: compositions/frames/02-connexion.html
- blueprint: compose
- rules: cursor-click-ripple, discrete-text-sequence, press-release-spring, dynamic-content-sequencing
- focal: la carte de connexion (520 px de large) au centre du cadre navigateur

Layout de l'écran de connexion (fidèle à l'app) : cadre navigateur ; à gauche un panneau encre `#16140F` (40 % de largeur) avec le logo RS en blanc et la ligne « Hebdo Delivery — édition rédaction » en Instrument Serif italique crème ; à droite sur papier, la carte : eyebrow « Connexion », champ « Email » (placeholder « prenom@rollingstone.fr »), champ « Mot de passe » (placeholder « Votre mot de passe »), bouton primaire rouge « Se connecter → », lien atténué « Mot de passe oublié ? ».
Scene 1 (0.0–3s) : le cadre navigateur entre par entrée à ressort (scale 0.96→1), la carte se compose. Note de marge à gauche : « Étape 0 ».
Scene 2 (3–11s) : sur « Saisissez votre adresse email » le curseur (`cursor-click-ripple`) clique dans le champ Email, la bordure passe rouge, le texte « camille.roux@rollingstone.fr » se tape caractère par caractère (`discrete-text-sequence`, ≈ 45 ms/caractère) ; puis le champ mot de passe se remplit de points ; sur « cliquez sur Se connecter » (≈ 10 s) le curseur presse le bouton (`press-release-spring`), zone d'attention rouge autour du bouton.
Scene 3 (12–24s) : sur « double authentification » (≈ 12,5 s) le contenu de la carte se remplace (`dynamic-content-sequencing`, fondu croisé 0,5 s) par l'écran « Double authentification » : titre, six cases monospace vides 64×80 px, bouton « Vérifier ». Note de marge droite : « Code à 6 chiffres » avec un petit pictogramme de téléphone. Sur « recopiez le code » (≈ 19 s) les six cases se remplissent une à une « 4 8 2 9 1 7 » (0,3 s d'écart), sur « Vérifier » (≈ 22 s) le curseur presse le bouton, zone d'attention.
Scene 4 (24–31s) : sur « Mot de passe oublié ? » (≈ 25 s) la carte revient à l'écran de connexion (fondu croisé) et la zone d'attention se dessine autour du lien « Mot de passe oublié ? » ; une petite enveloppe glisse depuis le lien vers la marge droite avec la note « Email de réinitialisation ». Tenue.

## Frame 3 — Le tableau de bord

- scene: Le tableau de bord se construit zone par zone : carte du numéro en cours, dossier Dropbox, quatre compteurs, liste des livraisons, menu Tous les numéros
- duration: 38.8s
- poster: 24s
- transition_in: crossfade
- status: outline
- voiceover: "Vous arrivez sur votre tableau de bord. En haut, la carte rouge indique le numéro en cours, avec ses dates de bouclage. Juste à côté, votre dossier Dropbox : c'est là que vos papiers sont rangés automatiquement. Les quatre compteurs résument votre activité : papiers livrés, signes écrits, photos envoyées. En dessous, la liste de toutes vos livraisons. Chaque ligne a trois icônes : le dossier pour ouvrir Dropbox, le crayon pour modifier, et le lien vers l'article en ligne. Pour retrouver un ancien numéro, utilisez le menu « Tous les numéros »."
- src: compositions/frames/03-tableau-de-bord.html
- blueprint: compose
- rules: waterfall-entry, counting-dynamic-scale, cursor-click-ripple, dynamic-content-sequencing
- focal: la carte rouge du numéro en cours, puis la liste des livraisons

Layout du tableau de bord (fidèle à l'app) : cadre navigateur ; barre de navigation en haut avec le logo RS à gauche, « Mon espace », « Livrer un papier », et à droite l'avatar « CR » ; titre Instrument Serif « Bonjour Camille » ; rangée du haut : carte rouge teinte `#FBE4E6` avec chip « EN COURS », « RSH 240 », « 26 sept. → 2 oct. 2026 » en mono ; carte blanche « Voir Dropbox » avec icône dossier et chemin « /Hebdo Delivery/RSH240/Camille Roux » ; rangée de quatre compteurs (« Mes papiers 12 », « En cours 2 », « Livrés à temps 100 % », « Signes rédigés 18 420 ») ; tableau « Mes livraisons » avec colonnes Numéro, Type, Titre, Statut, Date, Actions et trois lignes (RSH 240 · Chroniques · « Les Marquises — Nuit blanche » · chip ok « Livré » · 29 sept. ; RSH 239 · Interview 3000 · « Shinedown, la revanche » · Livré · 22 sept. ; RSH 239 · Frenchie · « Rubber Legs » · Livré · 21 sept.), chaque ligne terminée par trois icônes dossier / crayon / lien ; au-dessus du tableau à droite, le bouton ghost « Tous les numéros ▾ ».
Scene 1 (0.0–4s) : cadre navigateur en place, barre de navigation et titre « Bonjour Camille » entrent (`waterfall-entry`). Note de marge gauche : « Votre espace ».
Scene 2 (4–17s) : sur « la carte rouge » (≈ 4,5 s) la carte du numéro entre par entrée à ressort et reçoit la zone d'attention ; sur « dossier Dropbox » (≈ 9 s) la carte Dropbox entre, zone d'attention se déplace dessus ; sur « quatre compteurs » (≈ 13 s) la rangée de compteurs entre en `waterfall-entry` et chaque chiffre compte de 0 à sa valeur (`counting-dynamic-scale`, 1,2 s).
Scene 3 (17–31s) : sur « la liste de toutes vos livraisons » (≈ 18 s) le tableau se peuple ligne par ligne (`waterfall-entry`) ; sur « trois icônes » (≈ 23 s) un zoom d'élément ×1,35 (scale du bloc actions de la première ligne, camera verrouillée) et trois notes de marge courtes se posent successivement à droite : « Dropbox », « Modifier », « Article en ligne », chacune reliée à son icône par un petit filet ; le zoom se relâche à ≈ 30 s.
Scene 4 (31–39s) : sur « Tous les numéros » (≈ 33 s) le curseur clique le bouton (`cursor-click-ripple`), un menu déroulant s'ouvre (`dynamic-content-sequencing`) listant « RSH 240 · en cours », « RSH 239 », « RSH 238 », « RSH 237 » ; zone d'attention autour du menu. Tenue ouverte.

## Frame 4 — Livrer un papier, étape 1

- scene: Clic sur Livrer un papier, écran Confirmer ce numéro, puis la grille des huit types de papier avec leur limite de signes
- duration: 38.5s
- poster: 26s
- transition_in: crossfade
- status: outline
- voiceover: "Pour livrer un papier, cliquez sur « Livrer un papier » dans le menu. Première étape : l'application vous montre le numéro en cours. Cliquez sur « Confirmer ce numéro ». Votre dossier Dropbox est préparé en arrière-plan. Choisissez ensuite le type de papier : sujet de couverture, interview, chronique musique, cinéma, coup de cœur, frenchie, livres et expositions, ou disque de la semaine. Chaque type a sa propre limite de signes, affichée sur sa carte. Attention : changer de type en cours de route vide le formulaire."
- src: compositions/frames/04-etape-1.html
- blueprint: compose
- rules: cursor-click-ripple, press-release-spring, waterfall-entry, asr-keyword-glow
- focal: le bouton « Confirmer ce numéro », puis la grille des types

Layout : cadre navigateur avec la même barre de navigation qu'en Frame 3. Écran « Livrer un papier » : en haut un fil d'étapes horizontal « 1 Type de papier · 2 Rédaction · 3 Correction IA · 4 Vérification & envoi » (l'étape active en rouge) ; carte centrale « Numéro en cours » avec « RSH 240 », les dates, et le bouton primaire « Confirmer ce numéro » ; après confirmation, chip ok « Numéro confirmé » + « Dossier préparé », puis la grille 4×2 des types : « Sujet de couv · 15 000 signes max », « Interview 3000 · 3 000 », « Disque de la semaine · 2 500 », « Chroniques · 1 500 », « Chronique Cinema · 1 500 », « Chronique Coup de Coeur · 2 500 », « Frenchie · 2 500 », « Livres et Expo · 1 500 », chaque carte avec un pictogramme linéaire.
Scene 1 (0.0–5s) : tableau de bord en place (réduit, sans détail), sur « cliquez sur Livrer un papier » (≈ 2 s) le curseur clique l'entrée de menu « Livrer un papier » (`cursor-click-ripple`), zone d'attention ; le contenu se remplace par l'écran « Livrer un papier » (remplacement de contenu, fondu 0,5 s) et le fil d'étapes entre en `waterfall-entry`.
Scene 2 (5–15s) : sur « le numéro en cours » (≈ 7 s) la carte du numéro entre (entrée à ressort) ; sur « Confirmer ce numéro » (≈ 10 s) le curseur presse le bouton (`press-release-spring`) ; sur « préparé en arrière-plan » (≈ 13 s) les chips « Numéro confirmé » puis « Dossier préparé » apparaissent avec une petite coche, note de marge droite : « Dropbox prêt ».
Scene 3 (15–32s) : sur « Choisissez ensuite le type » (≈ 16 s) la grille des huit cartes entre en `waterfall-entry` (0,18 s d'écart) ; à chaque type nommé par la voix (≈ 18 → 27 s, un toutes les 1,2 s environ) la carte correspondante s'illumine brièvement (`asr-keyword-glow`, bordure rouge + fond teinte) dans l'ordre : Sujet de couv, Interview 3000, Chroniques, Chronique Cinema, Chronique Coup de Coeur, Frenchie, Livres et Expo, Disque de la semaine ; sur « limite de signes » (≈ 29 s) les libellés « … signes max » de toutes les cartes se colorent en rouge un instant et une note de marge gauche « Limite par format » se pose.
Scene 4 (32–38.5s) : le curseur se pose sur « Chroniques » et clique, la carte prend la bordure rouge sélectionnée et le chip « Format choisi » apparaît ; sur « Attention » (≈ 34 s) une note de marge droite en rouge « Changer de type vide le formulaire » avec un petit pictogramme d'avertissement. Tenue.

## Frame 5 — Étape 2, la rédaction

- scene: Le formulaire Chroniques se remplit champ par champ : point rouge, titre déduit, compteur de signes, étoiles, zone de dépôt des photos, crédit, puis Continuer
- duration: 62.1s
- poster: 40s
- transition_in: crossfade
- status: outline
- voiceover: "Deuxième étape : la rédaction. Le formulaire s'adapte au type choisi. Les champs marqués d'un point rouge sont obligatoires. Le titre du papier se déduit tout seul, à partir de l'artiste et de l'album. Sous le corps du texte, le compteur de signes vous suit en temps réel. Il passe au rouge si vous dépassez la limite. Pour la note, cliquez à gauche d'une étoile pour une demi-étoile, à droite pour une étoile entière. Vient ensuite la photo. Glissez votre fichier dans la zone, ou cliquez pour le choisir. Les formats JPG, PNG et WebP sont acceptés, jusqu'à vingt-cinq mégaoctets par fichier, et vingt fichiers au maximum. Au moins une photo est demandée sur la plupart des formats. Pour une interview, il en faut deux, ou un lien vers un dossier Drive. N'oubliez pas le crédit photo : le nom du photographe, précédé du signe copyright. Quand tout est rempli, cliquez sur « Continuer »."
- src: compositions/frames/05-etape-2.html
- blueprint: compose
- rules: discrete-text-sequence, cursor-drag, asr-keyword-glow
- focal: le corps du texte et son compteur, puis la zone de dépôt des photos

Layout : cadre navigateur, fil d'étapes avec « 2 Rédaction » actif, chip « Chroniques · 1 500 signes ». Formulaire en deux colonnes : à gauche « Nom de l'artiste • », « Nom de l'album • », « Nombre d'étoiles (sur 5) • » (cinq étoiles vides), « Corps du texte • » (grande zone) avec sous elle un compteur mono « 0 / 1 500 signes » et une fine barre de progression ; à droite « Lien » (champ url), « Photos • » (zone pointillée « Glissez vos photos ici », sous-texte « JPG, PNG, WebP · 25 Mo max · jusqu'à 20 fichiers »), « Crédits » (champ) ; en bas à droite le bouton primaire « Continuer → ». Le titre auto « Les Marquises — Nuit blanche » s'affiche en Instrument Serif au-dessus du formulaire quand artiste et album sont remplis.
Scene 1 (0.0–7s) : le formulaire entre en entrée en cascade (colonne gauche puis droite). Sur « point rouge » (≈ 5 s) un zoom d'élément ×1,6 (zoom d’élément sur le libellé « Nom de l'artiste • », caméra verrouillée) et note de marge gauche « • = obligatoire » ; relâche à ≈ 8 s.
Scene 2 (8–15s) : le curseur clique le champ artiste, « Les Marquises » se tape (`discrete-text-sequence`), puis l'album « Nuit blanche » ; sur « se déduit tout seul » (≈ 11 s) le titre serif « Les Marquises — Nuit blanche » se compose au-dessus, zone d'attention.
Scene 3 (15–26s) : sur « le corps du texte » (≈ 15 s) le curseur clique la grande zone et deux phrases de chronique fictive se tapent rapidement (« Quatrième album, et toujours cette manière de faire vaciller la nuit… ») ; le compteur monte en parallèle (compteur animé, 0 → 1 480), la barre se remplit ; sur « passe au rouge » (≈ 22 s) le compteur dépasse (1 540 / 1 500) et vire rouge avec l'étiquette « Dépassement », puis quelques caractères s'effacent et il revient à 1 480 vert « Bonne longueur ».
Scene 4 (26–34s) : sur « cliquez à gauche d'une étoile » (≈ 27 s) zoom d'élément ×1,8 sur la rangée d'étoiles ; le curseur clique la moitié gauche de la quatrième étoile → 3,5 étoiles se remplissent en `#E6B400` ; sur « à droite pour une étoile entière » (≈ 31 s) il clique la moitié droite → 4 étoiles ; deux mini-notes « clic gauche = ½ » et « clic droit = 1 » ; relâche à ≈ 34 s.
Scene 5 (34–50s) : sur « Vient ensuite la photo » (≈ 35 s) zone d'attention sur la zone de dépôt ; sur « Glissez votre fichier » (≈ 37 s) une vignette de fichier « pochette.jpg » est traînée par le curseur depuis la marge droite jusqu'à la zone (`cursor-drag`), la zone passe en teinte rouge à l'approche, la vignette se dépose et devient une carte miniature avec le nom et « 2,4 Mo » ; sur « JPG, PNG et WebP … vingt-cinq mégaoctets … vingt fichiers » (≈ 40–46 s) le sous-texte de la zone s'illumine mot par mot (`asr-keyword-glow`) ; sur « Au moins une photo » (≈ 46 s) note de marge droite « 1 photo minimum » puis « Interview : 2 photos ou lien Drive ».
Scene 6 (50–62s) : sur « le crédit photo » (≈ 52 s) le curseur clique « Crédits » et « © Marion Delval » se tape ; note de marge « © + nom du photographe » ; sur « Continuer » (≈ 59 s) le curseur presse le bouton (pression du bouton avec rebond), zone d'attention. Tenue.

## Frame 6 — Étape 3, la correction

- scene: Clic sur Corriger le texte avec l'IA, attente courte, corrections surlignées, cadre Texte final modifiable, retouche d'un mot, bouton Corriger encore
- duration: 36.5s
- poster: 22s
- transition_in: crossfade
- status: outline
- voiceover: "Troisième étape : la correction. Cliquez sur « Corriger le texte avec l'IA ». En quelques secondes, l'orthographe, la grammaire et la typographie sont relues, dans le respect de la charte de Rolling Stone. Le texte corrigé s'affiche dans un cadre intitulé « Texte final ». Il reste entièrement modifiable : relisez-le, ajustez ce que vous voulez. Si la correction échoue, votre texte d'origine est conservé, rien n'est perdu. Le bouton « Corriger encore » permet de relancer la correction, jusqu'à trente fois par heure."
- src: compositions/frames/06-etape-3.html
- blueprint: compose
- rules: press-release-spring, asr-keyword-glow, dynamic-content-sequencing, discrete-text-sequence
- focal: le cadre « Texte final (modifiable) »

Layout : cadre navigateur, fil d'étapes avec « 3 Correction IA » actif. Au centre, le texte de la chronique dans une carte, en dessous le bouton primaire « Corriger le texte avec l'IA » ; après correction, la carte devient « Texte final (modifiable) » avec un liseré fin et le compteur « 1 486 / 1 500 signes » ; en bas, bouton ghost « Corriger encore » et bouton primaire « Continuer → ».
Scene 1 (0.0–7s) : la carte du texte entre, sur « Corriger le texte avec l'IA » (≈ 3,5 s) le curseur presse le bouton (`press-release-spring`), zone d'attention.
Scene 2 (7–14s) : sur « En quelques secondes » un état d'attente sobre : trois points qui pulsent dans le bouton et une fine barre qui avance (`agent-progress-theater`, version minimale : trois lignes de statut « Orthographe ✓ », « Grammaire ✓ », « Typographie ✓ » qui se cochent à ≈ 9, 10,5, 12 s en accord avec la voix).
Scene 3 (14–24s) : sur « Le texte corrigé s'affiche » (≈ 15 s) la carte se transforme (`dynamic-content-sequencing`) : trois mots du texte s'illuminent brièvement en teinte rouge (`asr-keyword-glow` : « vaciller », « nuit », un espace avant « ? » devenu insécable) puis le liseré et le libellé « Texte final (modifiable) » se posent, zone d'attention ; sur « ajustez ce que vous voulez » (≈ 21 s) le curseur clique dans le texte et remplace un mot (« superbe » → « magnifique », `discrete-text-sequence`), note de marge gauche « Toujours modifiable ».
Scene 4 (24–36.5s) : sur « Si la correction échoue » (≈ 25 s) un petit bandeau info « Correction automatique indisponible — texte original conservé » apparaît puis se retire (≈ 3 s), note de marge « Rien n'est perdu » ; sur « Corriger encore » (≈ 31 s) zone d'attention sur le bouton ghost et note « 30 corrections / heure » en mono. Tenue.

## Frame 7 — Étape 4, vérifier et envoyer

- scene: Écran récapitulatif coché ligne par ligne, clic sur Livrer le papier, progression lente, écran Bravo c'est envoyé avec confettis discrets
- duration: 23s
- poster: 19s
- transition_in: crossfade
- status: outline
- voiceover: "Dernière étape : la vérification. L'application récapitule tout : le type de papier, le titre, le nombre de signes, les photos. Prenez le temps de relire. Puis cliquez sur « Livrer le papier ». L'envoi prend quelques secondes. Quand l'écran « Bravo, c'est envoyé ! » apparaît, votre papier est livré."
- src: compositions/frames/07-etape-4.html
- blueprint: compose
- rules: waterfall-entry, press-release-spring, stat-bars-and-fills, particle-burst
- focal: le bouton « Livrer le papier », puis l'écran « Bravo, c'est envoyé ! »

Layout : cadre navigateur, fil d'étapes avec « 4 Vérification & envoi » actif. Carte récapitulative : lignes « Format · Chroniques », « Titre · Les Marquises — Nuit blanche », « Signes · 1 486 / 1 500 », « Note · ★★★★ », « Photos · 1 fichier · © Marion Delval », chacune avec une coche verte à droite ; bouton primaire large « Livrer le papier ». Écran de succès : grande coche dans un disque vert teinte, titre Instrument Serif « Bravo, c'est envoyé ! », sous-titre « Papier livré », deux boutons « Retour à l'espace » (ghost) et « Livrer un autre papier » (primaire).
Scene 1 (0.0–10s) : la carte récapitulative entre ; sur « le type de papier, le titre, le nombre de signes, les photos » (≈ 3–8 s) chaque ligne apparaît (`waterfall-entry`) et sa coche verte se dessine à son tour.
Scene 2 (10–16s) : sur « Livrer le papier » (≈ 11,5 s) le curseur presse le bouton (`press-release-spring`) ; le bouton devient une barre de progression lente (`stat-bars-and-fills`, 3 s) avec le libellé « Envoi en cours… ».
Scene 3 (16–23s) : sur « Bravo, c'est envoyé ! » (≈ 17 s) l'écran de succès remplace la carte (entrée à ressort sur le disque vert et le titre) et un jet de confettis discret, 40 particules seedées aux couleurs rouge, encre, étoile et vert (`particle-burst`), retombe en 2 s. Tenue.

## Frame 8 — Ce qui se passe ensuite

- scene: Depuis l'écran Bravo, trois lignes partent vers trois cartes : Dropbox (docx + photos), brouillon rollingstone.fr, email à la rédaction
- duration: 22.5s
- poster: 16s
- transition_in: crossfade
- status: outline
- voiceover: "Que se passe-t-il ensuite ? Votre texte est converti en document Word et déposé dans Dropbox, avec vos photos en qualité originale. Un brouillon est créé sur rollingstone point fr, prêt pour la relecture de la rédaction. Et la rédaction en chef reçoit un email pour la prévenir. Vous n'avez plus rien à faire."
- src: compositions/frames/08-ensuite.html
- blueprint: constellation-hub
- rules: svg-path-draw, spring-pop-entrance, waterfall-entry
- focal: le nœud central « Votre papier » et les trois cartes de destination

Layout : plus d'écran d'application ; sur le papier, au centre gauche (x ≈ 0,3×largeur), un nœud : petite carte « Les Marquises — Nuit blanche » avec la coche verte « Livré » ; à droite, trois cartes empilées verticalement (y ≈ 0,25 / 0,5 / 0,75 de la zone) : « Dropbox » (icône dossier, fichier « RSH240 - Chroniques - Les Marquises.docx » et deux vignettes photo), « rollingstone.fr » (icône globe, chip « Brouillon · En attente de relecture »), « Rédaction en chef » (icône enveloppe, « Nouveau papier livré — RSH 240 »).
Scene 1 (0.0–4s) : le nœud central entre (`spring-pop-entrance`), halo rouge derrière lui (halo ambiant). Titre de scène en serif en haut à gauche : « Et ensuite ? ».
Scene 2 (4–18s) : sur « document Word et déposé dans Dropbox » (≈ 5 s) un filet courbe se trace du nœud vers la carte Dropbox (`svg-path-draw`, 0,8 s) et la carte entre (`spring-pop-entrance`), ses vignettes en `waterfall-entry` ; sur « brouillon » (≈ 11 s) second filet vers la carte rollingstone.fr qui entre ; sur « email » (≈ 15 s) troisième filet vers la carte Rédaction en chef.
Scene 3 (18–22.5s) : sur « Vous n'avez plus rien à faire » (≈ 19 s) une note serif italique en bas à gauche « C'est tout. » se pose, les trois filets pulsent une fois. Tenue.

## Frame 9 — Modifier une livraison

- scene: Retour tableau de bord, clic sur le crayon d'une ligne, formulaire réouvert à l'étape Rédaction avec le texte présent, modification, Enregistrer les modifications, écran Modifications enregistrées
- duration: 25.7s
- poster: 17s
- transition_in: crossfade
- status: outline
- voiceover: "Besoin de corriger quelque chose après l'envoi ? Retournez sur le tableau de bord et cliquez sur le crayon de la ligne concernée. Le formulaire se rouvre à l'étape rédaction, avec votre texte. Modifiez, puis cliquez sur « Enregistrer les modifications ». Le document dans Dropbox est mis à jour. Vos photos restent en place, sauf si vous en ajoutez de nouvelles."
- src: compositions/frames/09-modifier.html
- blueprint: compose
- rules: cursor-click-ripple, coordinate-target-zoom, dynamic-content-sequencing, press-release-spring
- focal: l'icône crayon, puis le bouton « Enregistrer les modifications »

Layout : le tableau de bord de la Frame 3 (même structure, réduit aux éléments nécessaires : barre de navigation, tableau des livraisons avec ses trois lignes et leurs icônes) ; puis le formulaire de la Frame 5 en mode édition : fil d'étapes avec « 2 Rédaction » actif, chip « Modifier un papier », texte déjà présent, bouton primaire « Enregistrer les modifications » ; enfin l'écran de succès « Modifications enregistrées ! » avec sous-titre « Papier modifié ».
Scene 1 (0.0–8s) : tableau de bord en place ; sur « cliquez sur le crayon » (≈ 4 s) zoom d'élément ×1,5 sur les actions de la première ligne (`coordinate-target-zoom`), le curseur clique le crayon (`cursor-click-ripple`), zone d'attention ; relâche.
Scene 2 (8–18s) : sur « se rouvre à l'étape rédaction » (≈ 9 s) le contenu se remplace par le formulaire en mode édition (`dynamic-content-sequencing`), le chip « Modifier un papier » et le texte déjà présent ; note de marge gauche « Texte conservé » ; sur « Modifiez » (≈ 13 s) le curseur clique dans le texte et une phrase courte s'ajoute en fin (saisie caractère par caractère) ; sur « Enregistrer les modifications » (≈ 15,5 s) le curseur presse le bouton (`press-release-spring`).
Scene 3 (18–25.5s) : l'écran « Modifications enregistrées ! » entre (entrée à ressort) ; sur « Dropbox est mis à jour » (≈ 19,5 s) une petite carte Dropbox à droite avec le fichier .docx et un badge « mis à jour » ; sur « Vos photos restent en place » (≈ 22 s) note de marge droite « Photos conservées · remplacées seulement si vous en ajoutez ». Tenue.

## Frame 10 — Fermeture

- scene: Retour tableau de bord, les cartes d'aide Guide écrit et Rédaction en chef s'illuminent, puis Revoir la présentation, fondu vers le logo et la signature RS Hebdo Delivery
- duration: 20.1s
- poster: 16s
- transition_in: crossfade
- status: outline
- voiceover: "Vous savez maintenant tout ce qu'il faut pour livrer vos papiers. Le guide écrit complet est disponible depuis le tableau de bord, et vous pouvez revoir cette présentation à tout moment. Pour toute question, écrivez à la rédaction en chef. Bonne rédaction, et à très vite dans Rolling Stone."
- src: compositions/frames/10-fermeture.html
- blueprint: titlecard-reveal
- rules: asr-keyword-glow, spring-pop-entrance, svg-path-draw
- focal: les trois cartes d'aide, puis le logo Rolling Stone France
- assets: assets/logo-rs-france.png

Layout : bas du tableau de bord : à gauche la carte « Tutoriel » avec le bouton « Revoir la présentation », à droite deux cartes « Documentation · Guide écrit pas-à-pas · Lire » et « Contact · Rédaction en chef · redac@rollingstone.fr ». Puis, plein papier, le logo `assets/logo-rs-france.png` et la signature « RS Hebdo Delivery » en Instrument Serif, filet fin en dessous.
Scene 1 (0.0–11s) : les trois cartes en place, sur « guide écrit » (≈ 3,5 s) zone d'attention + `asr-keyword-glow` sur la carte Guide ; sur « revoir cette présentation » (≈ 7 s) sur la carte Tutoriel ; sur « rédaction en chef » (≈ 10 s) sur la carte Contact.
Scene 2 (11–20s) : sur « Bonne rédaction » (≈ 13 s) les cartes s'effacent en fondu (scène finale : sortie autorisée), le logo entre au centre (`spring-pop-entrance`), la signature « RS Hebdo Delivery » se compose en dessous, un filet se trace (`svg-path-draw`), halo rouge qui s'apaise (halo ambiant) ; fondu général vers le papier nu sur les 1,5 dernières secondes.

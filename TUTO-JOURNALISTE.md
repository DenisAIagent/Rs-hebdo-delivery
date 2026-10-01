# RS Hebdo Delivery — Guide du journaliste

> Tutoriel complet pour livrer vos articles via la plateforme RS Hebdo Delivery.
> Mis à jour le 30 septembre 2026 (interface « édition rédaction », double authentification, photos obligatoires).

---

## Table des matières

1. [Premiers pas](#1-premiers-pas)
2. [Le tableau de bord](#2-le-tableau-de-bord)
3. [Livrer un papier](#3-livrer-un-papier)
4. [La relecture](#4-la-relecture)
5. [Modifier une livraison](#5-modifier-une-livraison)
6. [FAQ & dépannage](#6-faq--dépannage)

---

## User Stories

Chaque fonctionnalité est décrite sous forme de user story pour vous aider à comprendre ce que vous pouvez faire sur la plateforme.

---

### 1. Premiers pas

#### US-01 — Se connecter à la plateforme

> **En tant que** journaliste,
> **je veux** me connecter avec mon email et mon mot de passe,
> **afin d'** accéder à mon espace de livraison.

**Comment faire :**

1. Rendez-vous sur l'URL de la plateforme.
2. Saisissez votre **email** (ex. `prenom@rollingstone.fr`) et votre **mot de passe** (fournis par l'administrateur).
3. Cliquez sur **Se connecter**.
4. Selon la configuration de la rédaction, une étape de **double authentification** peut suivre (voir US-01b). Sinon, vous arrivez directement sur votre tableau de bord.

> Si vous n'avez pas encore de compte, contactez votre administrateur pour qu'il en crée un. Il n'y a pas d'inscription libre.

---

#### US-01b — Activer la double authentification (2FA)

> **En tant que** journaliste,
> **je veux** sécuriser mon compte avec un code à 6 chiffres,
> **afin que** personne d'autre ne puisse livrer en mon nom.

La double authentification (TOTP) est **activée ou non par l'administrateur** pour toute la rédaction. Quand elle est active :

1. **Première fois** : la page « Activez la 2FA pour continuer » affiche un **QR code**. Scannez-le avec une application d'authentification (Google Authenticator, 1Password, Authy…). Si vous ne pouvez pas scanner, cliquez sur la clé affichée sous le QR code pour la copier et saisissez-la manuellement dans l'application.
2. Saisissez le **code à 6 chiffres** affiché par l'application, puis cliquez sur **Activer et continuer**.
3. **Connexions suivantes** : après email et mot de passe, la page « Code de vérification » vous demande le code à 6 chiffres. Cliquez sur **Vérifier**.

> Téléphone perdu ? Contactez un administrateur : il peut réinitialiser votre 2FA depuis l'onglet Journalistes. Vous referez alors l'activation avec un nouveau QR code.

---

#### US-02 — Découvrir la plateforme (présentation)

> **En tant que** nouveau journaliste,
> **je veux** suivre une présentation à ma première connexion,
> **afin de** comprendre rapidement le fonctionnement de la plateforme.

**Comment faire :**

1. Lors de votre première connexion, une présentation s'affiche automatiquement. Elle rappelle les **quatre étapes** de la livraison : choisir le type de papier, rédiger et joindre les visuels, laisser la relecture proposer ses corrections, vérifier et envoyer.
2. Elle rappelle aussi que les champs marqués d'un **point rouge •** sont obligatoires, que chaque type de papier a une limite de signes, et qu'un papier livré reste modifiable.
3. Une fois terminée, elle ne s'affiche plus sur ce navigateur.
4. Pour la revoir : bouton **Revoir la présentation** dans la barre du haut, ou la carte du même nom en bas du tableau de bord.

---

### 2. Le tableau de bord

#### US-03 — Consulter mes livraisons

> **En tant que** journaliste,
> **je veux** voir la liste de toutes mes livraisons,
> **afin de** suivre l'état de mes articles soumis.

**Ce que vous voyez :**

1. En haut, le **numéro en cours** (ex. RSH240, avec ses dates du vendredi au vendredi) et le bouton **Livrer un papier**.
2. Une carte **numéro** : le nombre de papiers déjà livrés pour ce numéro et, le cas échéant, le nombre « encore attendu », ou « Tout est à jour ».
3. Une carte **Dossier Dropbox** : rappel du dossier `Hebdo Delivery / RSHxxx`, synchronisé automatiquement.
4. Quatre compteurs personnels : **Mes papiers**, **Signes rédigés**, **Livrés à temps**, **En cours** (pour le numéro courant).
5. La liste de vos livraisons avec, pour chacune : **Type** de papier, **Titre** (et nombre de signes), **Numéro**, **Date** de livraison, **Statut**.
6. Sur chaque ligne, trois icônes : **dossier** (ouvrir le dossier Dropbox), **crayon** (modifier), **lien externe** (lien numérique, si vous en avez renseigné un).

---

#### US-04 — Filtrer et rechercher mes livraisons

> **En tant que** journaliste,
> **je veux** filtrer mes livraisons par numéro ou par titre,
> **afin de** retrouver facilement un article précis.

**Comment faire :**

1. Au-dessus de la liste, le champ **Rechercher un titre…** filtre en direct sur le titre.
2. Le menu déroulant propose **Tous les numéros** ou un numéro précis (ex. RSH239). Par défaut, le numéro en cours est sélectionné.
3. La liste se met à jour immédiatement.

---

#### US-05 — Lancer une nouvelle livraison

> **En tant que** journaliste,
> **je veux** accéder rapidement au formulaire de livraison,
> **afin de** soumettre un nouvel article.

**Comment faire :**

1. Cliquez sur **Livrer un papier** (en haut du tableau de bord, ou l'entrée **Livrer** de la barre de navigation).
2. Vous arrivez sur le formulaire en 4 étapes : **Type de papier → Rédaction → Relecture → Vérification & envoi**. Un fil d'étapes en haut de page indique où vous en êtes.
3. Un panneau d'aide à droite rappelle le numéro, le compteur de signes et une astuce pour chaque étape.

---

### 3. Livrer un papier

#### US-06 — Confirmer le numéro et choisir le type de papier

> **En tant que** journaliste,
> **je veux** confirmer pour quel numéro je livre puis choisir le format,
> **afin que** le formulaire s'adapte aux champs requis.

**Comment faire :**

1. **Étape 1** : la carte « Vous livrez pour RSHxxx » affiche le numéro en cours et ses dates. Cliquez sur **Confirmer ce numéro**. La plateforme prépare les dossiers Dropbox (« Préparation des dossiers… », quelques secondes).
2. La liste des **types de papier** apparaît alors, chacun avec sa limite de signes :
   - **Sujet de couv** (15 000 signes)
   - **Interview 3000** (3 000 signes)
   - **Disque de la semaine** (2 500 signes)
   - **Chroniques** (1 500 signes)
   - **Chronique Cinéma** (1 500 signes)
   - **Chronique Coup de Coeur** (2 500 signes)
   - **Frenchie** (2 500 signes)
   - **Livres et Expo** (1 500 signes)
3. Cliquez sur le type correspondant : vous passez automatiquement à l'étape Rédaction.
4. Changer de type en cours de route **vide le formulaire** (texte et photos).

> Si aucun numéro n'est programmé (« Aucun numéro programmé. Contactez l'administrateur. »), vous ne pouvez pas livrer : prévenez l'administrateur.

---

#### US-07 — Remplir les champs de contenu

> **En tant que** journaliste,
> **je veux** remplir les champs spécifiques à mon type de papier,
> **afin de** fournir toutes les informations nécessaires à la publication.

**Comment faire :**

1. **Étape 2 — Rédaction** : les champs s'affichent selon le type choisi.
2. Types de champs possibles :
   - **Texte court** : artiste, album, titre du film, réalisateur, accroche, **crédits photo**…
   - **Zone de texte** : chapô, corps du texte.
   - **Lien** (URL) : lien d'écoute, lien numérique, lien Drive photos.
   - **Note étoiles** : de 0,5 à 5 étoiles (clic sur la moitié gauche d'une étoile = demi-étoile, moitié droite = étoile entière ; re-cliquer sur la même valeur remet à zéro).
   - **Photos** : zone de dépôt (voir US-08).
3. Les champs **obligatoires** portent un **point rouge •**.
4. Sur le corps du texte, un **compteur** `x / y signes` s'affiche en direct ; le panneau de droite montre une jauge et un commentaire (« Texte un peu court », « Bonne longueur », « Au taquet », « Dépassement »).
5. Le **titre** de la livraison est déduit automatiquement : l'artiste (Sujet de couv, Interview 3000, Chroniques), l'album ou l'artiste (Disque de la semaine), ou le premier champ texte du formulaire pour les autres formats.

**Champs et photos par type de papier :**

| Type de papier | Champs principaux | Photos |
|----------------|-------------------|--------|
| Sujet de couv | Artiste, accroche, crédits, chapô, corps | Photos **ou** lien Drive (un des deux est obligatoire) |
| Interview 3000 | Artiste, accroche, crédits, chapô, corps | **2 photos minimum** ou lien Drive |
| Disque de la semaine | Artiste, album, accroche, corps, lien | **1 photo minimum** |
| Chroniques | Artiste, album, étoiles, corps, lien | **1 photo minimum** |
| Chronique Cinéma | Film, réalisateur, étoiles, corps, lien | **1 photo minimum** |
| Chronique Coup de Coeur | Artiste, album, étoiles, accroche, corps, lien | **1 photo minimum** |
| Frenchie | Artiste, album, **étoiles (obligatoire)**, accroche, corps, lien | **1 photo minimum** |
| Livres et Expo | Titre, auteur / commissaire, corps, lien | **1 photo, maximum 1** |

> Les champs exacts sont paramétrés par l'administrateur (onglet Types de papier) et peuvent évoluer : faites foi à ce qui s'affiche à l'écran.

---

#### US-08 — Joindre des photos

> **En tant que** journaliste,
> **je veux** joindre des visuels à ma livraison,
> **afin qu'** ils accompagnent mon article dans Dropbox et sur le site.

**Comment faire :**

1. Dans l'étape Rédaction, repérez la zone **Glissez vos photos ici ou cliquez pour les choisir**. Elle indique le minimum demandé par le format (ex. « 2 photos minimum »).
2. **Glissez-déposez** vos fichiers ou cliquez pour parcourir votre ordinateur.
3. Contraintes :
   - Formats acceptés : **JPG, JPEG, PNG, WebP, GIF, HEIC/HEIF, TIFF, BMP, AVIF**. Les SVG, PDF, Word et vidéos sont refusés.
   - **25 Mo maximum** par fichier (le navigateur refuse au-delà, message `nom-du-fichier: File is larger than 25 MB`).
   - **20 fichiers** maximum par envoi, et moins si le format impose un maximum (Livres et Expo : une seule photo, message « Ce format accepte une seule photo »).
4. Chaque photo ajoutée apparaît en vignette avec son nom ; la **croix** la retire.
5. Pour Sujet de couv et Interview 3000, vous pouvez remplacer les photos par un **lien Drive** (champ « Lien Drive photos ») : l'un ou l'autre suffit.
6. Renseignez le champ **Crédits** avec le nom du photographe (© Nom) quand le format le propose.
7. Les photos sont envoyées telles quelles sur Dropbox lors de la livraison.

> Conseil : des JPG de quelques Mo suffisent. Les originaux très lourds ralentissent l'envoi.

---

#### US-09 — Relire et corriger mon texte

> **En tant que** journaliste,
> **je veux** soumettre mon texte à une relecture automatique,
> **afin de** corriger orthographe, grammaire et typographie avant livraison.

**Comment faire :**

1. En bas de l'étape Rédaction, cliquez sur **Relire et corriger le texte**.
2. La plateforme vérifie d'abord les champs obligatoires. S'il en manque, un message **« Champs manquants : … »** liste ce qu'il reste à remplir et les champs concernés passent en rouge.
3. Le bouton affiche **Correction en cours…** (comptez de quelques secondes à une minute et demie pour un Sujet de couv).
4. **Étape 3 — Texte relu et corrigé** : la liste des corrections appliquées s'affiche (`original → corrigé (type)`), puis le **Texte final (modifiable)** dans une zone de saisie libre, avec son compteur de signes.
5. Relisez et **modifiez librement** ce texte : c'est cette version qui sera livrée. La relecture ne touche pas à votre style.
6. Cliquez sur **Tout valider et vérifier** pour passer à l'étape 4, ou **Modifier le texte** pour revenir en arrière.

> Si le service de relecture est indisponible, un message « Correction automatique indisponible — texte original conservé » s'affiche et vous passez quand même à l'étape 3 avec votre texte d'origine.

---

#### US-10 — Vérifier et livrer

> **En tant que** journaliste,
> **je veux** relire un récapitulatif complet avant de livrer,
> **afin de** m'assurer que tout est correct.

**Comment faire :**

1. **Étape 4 — Tout est-il bon ?** : le récapitulatif affiche le format, le numéro, chaque champ renseigné, la note en étoiles, le nombre de photos, le compteur de signes (vert si dans la limite, rouge sinon), un aperçu du corps et les vignettes des visuels.
2. Le panneau de droite affiche une check-list (champs obligatoires, compteur de signes, texte corrigé).
3. Cliquez sur **Livrer le papier** (ou **Corriger encore** pour revenir à l'étape 3).
4. Pendant l'envoi (**Envoi en cours…**), ne fermez pas la page. La plateforme :
   - génère le **fichier Word** (.docx) formaté ;
   - crée les dossiers et **envoie le DOCX et les photos sur Dropbox** ;
   - enregistre la livraison ;
   - crée en parallèle un **brouillon sur le site rollingstone.fr** (marqué « en attente de relecture », invisible du public, à finaliser par la rédaction) ;
   - envoie un **email de notification** à la rédaction.

---

#### US-11 — Recevoir la confirmation de livraison

> **En tant que** journaliste,
> **je veux** recevoir une confirmation après envoi,
> **afin de** savoir que ma livraison a bien été prise en compte.

**Ce qui se passe :**

1. L'écran **« Bravo, c'est envoyé ! »** confirme que votre papier est dans Dropbox et que la rédaction en chef a reçu un email.
2. Trois boutons : **Retour à l'espace**, **Voir dans Dropbox** (ouvre le dossier), **Livrer un autre papier** (repart à l'étape 1, formulaire vide).
3. La livraison apparaît dans votre tableau de bord avec le statut **Livré**.
4. La rédaction reçoit un email dont l'objet est `[RSHxxx] Type de papier — Titre (Votre nom)`, avec le nombre de signes et le lien Dropbox.

---

### 4. La relecture

#### US-12 — Comprendre les corrections proposées

> **En tant que** journaliste,
> **je veux** comprendre ce que la relecture corrige,
> **afin de** relire efficacement le texte final.

Chaque correction listée à l'étape 3 indique son **type** :

| Type | Ce qui est corrigé | Exemple |
|------|--------------------|---------|
| **Orthographe** | Fautes d'orthographe | "language" → "langage" |
| **Grammaire** | Accords, conjugaisons, syntaxe | "les album" → "les albums" |
| **Ponctuation** | Virgules, points, deux-points | Ajout d'une virgule manquante |
| **Style** | Tournures maladroites, répétitions | Reformulation d'une phrase |
| **Typographie** | Espaces insécables, guillemets français | "..." → « ... » |

La correction préserve la structure de vos paragraphes.

---

#### US-13 — Garder la main sur le texte final

> **En tant que** journaliste,
> **je veux** pouvoir revenir sur les corrections,
> **afin de** garder le contrôle éditorial sur mon texte.

**Comment faire :**

1. Les corrections sont **toutes appliquées** dans le « Texte final (modifiable) » : il n'y a pas de validation une par une.
2. Pour refuser une correction, **retapez** simplement le passage comme vous le souhaitez dans la zone de texte.
3. Pour tout reprendre, cliquez sur **Modifier le texte** : vous revenez à l'étape Rédaction avec votre texte d'origine, puis relancez ou non la correction.
4. Vous pouvez demander jusqu'à **30 corrections par heure**.

---

### 5. Modifier une livraison

#### US-14 — Modifier un papier déjà livré

> **En tant que** journaliste,
> **je veux** modifier une livraison existante,
> **afin de** corriger ou mettre à jour mon article après envoi.

**Comment faire :**

1. Sur le tableau de bord, cliquez sur l'icône **crayon** de la livraison.
2. Le formulaire s'ouvre en mode **Modifier un papier**, directement à l'étape Rédaction, avec vos champs **pré-remplis**.
3. Les photos déjà livrées sont rappelées par leur nom (« Images existantes : … »). Si vous **n'ajoutez aucune photo**, elles sont conservées. Si vous en ajoutez, **elles remplacent** la liste précédente.
4. Modifiez, puis cliquez sur **Relire et corriger le texte** (la correction est relancée sur le texte modifié), **Tout valider et vérifier**, puis **Enregistrer les modifications**.
5. Le fichier Word est **régénéré** et **réenvoyé** sur Dropbox, dans le même dossier. L'écran « Modifications enregistrées ! » confirme.

> La modification ne renvoie pas d'email à la rédaction et ne recrée pas de brouillon sur le site : prévenez la rédaction si le changement est important.

---

#### US-15 — Retrouver le dossier Dropbox d'une livraison

> **En tant que** journaliste,
> **je veux** ouvrir le dossier Dropbox d'un papier livré,
> **afin de** vérifier ce qui a été envoyé.

**Comment faire :**

1. Sur le tableau de bord, cliquez sur l'icône **dossier** de la ligne concernée.
2. Le dossier s'ouvre dans un nouvel onglet avec le DOCX et les photos.

---

### 6. FAQ & dépannage

#### US-16 — Comprendre l'arborescence Dropbox

```
Hebdo Delivery/
└── RSH240/
    ├── Sujet de couv/
    │   └── Nom de l'artiste/
    │       ├── RSH240 - Sujet de couv - Artiste.docx
    │       └── photo.jpg
    ├── Chroniques/
    │   └── VotreNom/
    │       ├── RSH240 - Chroniques - Artiste.docx
    │       └── pochette.jpg
    └── ...
```

Le nom du fichier Word suit toujours le modèle `RSHxxx - Type de papier - Titre.docx`.

---

#### US-17 — Comprendre les statuts de livraison

| Statut | Signification |
|--------|---------------|
| **Livré** | L'article a été soumis avec succès (DOCX généré, envoyé sur Dropbox, rédaction notifiée). Il reste modifiable. |

Il n'existe pas de brouillon côté plateforme : tant que vous n'avez pas cliqué sur **Livrer le papier**, rien n'est enregistré. Ne fermez donc pas l'onglet avant la fin.

---

#### US-18 — Gérer les erreurs courantes

| Problème | Solution |
|----------|----------|
| **Connexion impossible** | Vérifiez email / mot de passe. Contactez l'admin si le problème persiste. |
| **Code 2FA refusé** (« Code invalide ou expiré ») | Attendez le code suivant dans l'application et ressaisissez-le. Téléphone perdu : l'admin réinitialise votre 2FA. |
| **« Champs manquants : … »** | Remplissez les champs listés (ils passent en rouge). |
| **Photo refusée** | Vérifiez le format (JPG/PNG/WebP…, pas de SVG ni PDF) et le poids (25 Mo max). |
| **« Ce format accepte une seule photo »** | Livres et Expo : gardez une seule image. |
| **Relecture lente ou indisponible** | Patientez (jusqu'à 1 min 30 pour un long texte). En cas d'échec, votre texte d'origine est conservé et vous pouvez livrer sans correction. |
| **« Trop de corrections demandées »** | Limite de 30 corrections par heure atteinte. Réessayez plus tard. |
| **Dépassement de signes** | Non bloquant, mais réduisez votre texte pour respecter la limite. |
| **« Erreur préparation des dossiers Dropbox »** | Recliquez sur **Confirmer ce numéro** après quelques secondes. |
| **« Erreur lors de la livraison »** | Réessayez. Si cela persiste, contactez l'administrateur en donnant l'heure de l'essai. |

---

## Récapitulatif du parcours journaliste

```
Connexion (+ code 2FA si activé)
    │
    ▼
Tableau de bord ◄────────────────────┐
    │                                │
    ▼                                │
Livrer un papier                     │
    │                                │
    ▼                                │
Étape 1 — Confirmer le numéro        │
          + choisir le type          │
    │                                │
    ▼                                │
Étape 2 — Rédaction + photos         │
    │                                │
    ▼                                │
Étape 3 — Relecture              │
          (texte final modifiable)   │
    │                                │
    ▼                                │
Étape 4 — Vérification & envoi       │
    │                                │
    ▼                                │
« Bravo, c'est envoyé ! » ───────────┘
    │
    ├──► Dropbox (DOCX + photos)
    ├──► Brouillon rollingstone.fr (en attente de relecture)
    └──► Email → Rédaction en chef
```

---

*RS Hebdo Delivery — Rolling Stone France*

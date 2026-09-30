# RS Hebdo Delivery — FAQ & Problèmes connus

> Toutes les questions et problèmes que vous pouvez rencontrer en tant que journaliste sur la plateforme.
> Mise à jour le 30 septembre 2026.

---

## Table des matières

1. [Connexion & compte](#1-connexion--compte)
2. [Dashboard](#2-dashboard)
3. [Formulaire de livraison](#3-formulaire-de-livraison)
4. [Upload d'images](#4-upload-dimages)
5. [Correction IA](#5-correction-ia)
6. [Soumission & Dropbox](#6-soumission--dropbox)
7. [Modification d'une livraison](#7-modification-dune-livraison)
8. [Problèmes réseau & performance](#8-problèmes-réseau--performance)
9. [Navigateur & session](#9-navigateur--session)
10. [Référence rapide des messages d'erreur](#10-référence-rapide-des-messages-derreur)

---

## 1. Connexion & compte

### Q : Je n'arrive pas à me connecter, que faire ?

**Message affiché** : *"Email ou mot de passe incorrect"*

**Causes possibles :**
- Email ou mot de passe erroné (attention aux majuscules et espaces)
- Votre compte n'a pas encore été créé par l'administrateur
- Faute de frappe dans l'adresse email

**Solution :** Vérifiez vos identifiants. Si le problème persiste, contactez l'administrateur pour qu'il vérifie votre compte.

---

### Q : Mon compte est désactivé, comment le réactiver ?

**Message affiché** : *"Compte desactive"*

**Cause :** L'administrateur a désactivé votre compte (champ `is_active` passé à `false`).

**Solution :** Contactez l'administrateur pour qu'il réactive votre accès.

---

### Q : J'étais connecté et je me retrouve sur la page de login

**Cause possible :**
- Votre session a expiré (token d'authentification périmé)
- Vous avez vidé le cache ou les cookies de votre navigateur
- Le navigateur a fermé et la session n'a pas été conservée

**Solution :** Reconnectez-vous avec vos identifiants. Aucune donnée n'est perdue.

---

### Q : Je n'ai pas reçu mes identifiants

**Cause :** Les comptes sont créés manuellement par l'administrateur. Il n'y a pas d'inscription en libre-service.

**Solution :** Contactez l'administrateur pour qu'il crée votre compte avec votre email, nom complet et un mot de passe.

---

### Q : Puis-je changer mon mot de passe ?

Oui. Sur la page de connexion, cliquez sur **"Mot de passe oublié ?"**. Vous recevrez un email contenant un lien de réinitialisation. Ce lien vous redirigera vers un formulaire où vous pourrez définir un nouveau mot de passe.

**Si vous ne recevez pas l'email :**
- Vérifiez vos spams
- Assurez-vous d'utiliser l'email exact avec lequel votre compte a été créé
- Si le problème persiste, contactez l'administrateur

Le nouveau mot de passe doit faire **au moins 6 caractères** et être saisi deux fois à l'identique (*"Les mots de passe ne correspondent pas."*).

---

### Q : On me demande un code à 6 chiffres après la connexion, c'est quoi ?

C'est la **double authentification (2FA)**, activée par l'administrateur pour toute la rédaction.

- **Première fois** : la page « Activez la 2FA pour continuer » affiche un QR code. Scannez-le avec une application d'authentification (Google Authenticator, 1Password, Authy…), saisissez le code à 6 chiffres puis cliquez sur **Activer et continuer**. Si vous ne pouvez pas scanner, cliquez sur la clé sous le QR code pour la copier dans l'application.
- **Ensuite** : à chaque connexion, saisissez le code affiché par l'application et cliquez sur **Vérifier**.

---

### Q : Mon code 2FA est refusé

**Message affiché** : *"Code invalide ou expiré. Réessayez."*

**Causes possibles :**
- Le code a changé pendant la saisie (il se renouvelle toutes les 30 secondes)
- L'heure de votre téléphone est décalée
- Vous avez plusieurs comptes dans l'application et lisez le mauvais

**Solution :** Attendez le code suivant et ressaisissez-le. Si rien ne fonctionne, contactez un administrateur.

---

### Q : J'ai changé ou perdu mon téléphone, je ne peux plus générer le code

Contactez un administrateur : il peut **réinitialiser votre 2FA** depuis l'onglet Journalistes. À la connexion suivante, vous referez l'activation avec un nouveau QR code.

---

## 2. Dashboard

### Q : Je ne vois aucune livraison sur mon Dashboard

**Causes possibles :**
- Vous n'avez pas encore soumis d'article
- Le filtre hebdo sélectionné ne correspond pas à vos livraisons
- Vous êtes connecté avec un autre compte

**Solution :** Vérifiez le menu déroulant au-dessus de la liste (par défaut, le numéro en cours est sélectionné). Choisissez **Tous les numéros** ou le bon numéro. Vérifiez aussi que le champ **Rechercher un titre…** est vide.

---

### Q : Le compteur "En cours" affiche 0 alors que j'ai déjà livré

**Cause :** Ce compteur ne compte que les papiers du **numéro en cours**. Vos livraisons sont peut-être rattachées à un numéro précédent.

**Solution :** Regardez le compteur **Mes papiers** (total depuis votre arrivée) ou changez de numéro dans le menu déroulant.

---

### Q : Que signifient les quatre compteurs en haut du tableau de bord ?

| Compteur | Signification |
|----------|---------------|
| **Mes papiers** | Nombre total de livraisons depuis votre arrivée |
| **Signes rédigés** | Somme des signes de tous vos papiers (avec un équivalent en colonnes magazine) |
| **Livrés à temps** | Pourcentage de vos papiers au statut Livré |
| **En cours** | Nombre de papiers livrés pour le numéro en cours |

---

### Q : Comment revoir la présentation de départ ?

Cliquez sur **Revoir la présentation** dans la barre du haut, ou sur la carte du même nom en bas du tableau de bord.

---

### Q : Quel est le statut de mes livraisons ?

Toutes les livraisons soumises ont le statut **Livré** — cela signifie que le DOCX a été généré, les fichiers envoyés sur Dropbox, et la rédaction notifiée par email. Il n'y a pas de brouillon côté plateforme : rien n'est enregistré tant que vous n'avez pas cliqué sur **Livrer le papier**. Une fois livré, le papier reste **modifiable** (icône crayon).

---

## 3. Formulaire de livraison

### Q : Quel type de papier choisir ?

Chaque type correspond à un format éditorial avec une limite de signes propre :

| Type de papier | Limite de signes |
|----------------|-----------------|
| Sujet de couv | 15 000 |
| Interview 3000 | 3 000 |
| Disque de la semaine | 2 500 |
| Chroniques | 1 500 |
| Chronique Cinéma | 1 500 |
| Chronique Coup de Coeur | 2 500 |
| Frenchie | 2 500 |
| Livres et Expo | 1 500 |

En cas de doute, demandez à votre rédacteur en chef.

---

### Q : Le bouton "Confirmer ce numéro" ne fait rien / affiche une erreur

**Message affiché** : *"Erreur préparation des dossiers Dropbox"*

**Cause :** La plateforme n'a pas réussi à créer les dossiers du numéro sur Dropbox (Dropbox indisponible, réseau).

**Solution :** Attendez quelques secondes et recliquez sur **Confirmer ce numéro**. Cette confirmation est demandée **5 fois par heure maximum** : au-delà, patientez.

---

### Q : "Aucun numéro programmé" s'affiche à l'étape 1

**Cause :** L'administrateur n'a pas encore créé ou activé le numéro de la semaine.

**Solution :** Vous ne pouvez pas livrer tant qu'un numéro n'est pas programmé. Prévenez l'administrateur.

---

### Q : Je ne peux pas lancer la correction / passer à l'étape suivante

**Message affiché** : *"Champs manquants : Artiste, Corps du texte, Photos (1 minimum)…"* et *"Ce champ est obligatoire"* sous chaque champ en rouge

**Cause :** Un ou plusieurs champs obligatoires (marqués d'un **point rouge •**) ne sont pas remplis. La vérification se fait au clic sur **Corriger le texte avec l'IA**.

**Solution :** Remplissez les champs listés dans le message. Ils peuvent être :
- Texte court (artiste, album, accroche...)
- Zone de texte (corps du texte)
- Note étoiles (au moins une demi-étoile)
- Photos (nombre minimum indiqué dans la zone de dépôt)
- Pour Sujet de couv et Interview 3000 : photos **ou** lien Drive (*"Renseignez un lien ou ajoutez des photos ci-dessous"*)

---

### Q : Le message "Champs obligatoires manquants (type, titre, hebdo)" s'affiche à la soumission

**Cause :** Le formulaire a été soumis sans que le type de papier, le titre ou l'hebdo soient correctement sélectionnés.

**Solution :**
- Retournez à l'étape 1 pour vérifier que le type de papier est bien sélectionné
- Remplissez le champ qui sert de titre : l'**artiste** (Sujet de couv, Interview 3000, Chroniques), l'**album** ou l'artiste (Disque de la semaine), ou le premier champ texte du formulaire pour les autres formats
- Vérifiez que le numéro est bien confirmé (normalement automatique)

---

### Q : J'ai dépassé la limite de signes, est-ce bloquant ?

**Message affiché** : *"Dépassement de X signes"* (en rouge), jauge « Dépassement » dans le panneau de droite

**Non, ce n'est pas bloquant.** Le compteur passe en rouge mais la livraison reste possible. Il est toutefois fortement recommandé de respecter la limite pour faciliter le travail de la rédaction. Le panneau de droite vous guide : « Texte un peu court » (moins de la moitié), « Bonne longueur », « Au taquet » (plus de 95 %).

---

### Q : Mes sauts de ligne et paragraphes disparaissent

**Cause :** Le système retire automatiquement les balises HTML du texte pour des raisons de sécurité.

**Ce qui est préservé :**
- Les retours à la ligne simples
- Les sauts de paragraphe (double retour à la ligne)
- Maximum 2 sauts de ligne consécutifs

**Ce qui est supprimé :**
- Les balises HTML (`<b>`, `<i>`, `<br>`, etc.)
- Les espaces insécables (`&nbsp;`) remplacés par des espaces normaux
- Les espaces multiples consécutifs (réduits à un seul)

---

### Q : Mes guillemets et apostrophes ont changé dans le DOCX

**Cause :** Le système de correction IA et de nettoyage convertit certains caractères typographiques :
- Les guillemets droits `"..."` peuvent devenir des guillemets français `« ... »`
- Les apostrophes typographiques sont normalisées

C'est un comportement attendu qui améliore la qualité typographique du texte.

---

### Q : Je ne trouve pas le type de papier dont j'ai besoin

**Cause :** Le type de papier n'a pas été créé ou a été désactivé par l'administrateur.

**Solution :** Contactez l'administrateur pour qu'il crée ou réactive le type de papier souhaité.

---

### Q : La note étoiles ne fonctionne pas / le champ étoiles est vide

**Message affiché** : *"Veuillez sélectionner une note"*

**Solution :** Cliquez sur les étoiles pour attribuer une note de **0,5 à 5** : la moitié gauche d'une étoile donne une demi-étoile, la moitié droite une étoile entière. Recliquer sur la même valeur remet la note à zéro. Si le champ est obligatoire (Chroniques, Chronique Cinéma, Coup de Coeur, Frenchie), il faut au moins une demi-étoile.

---

### Q : À quoi sert le champ "Crédits" ?

Il reçoit le **crédit photo** (© Nom du photographe) des visuels que vous joignez. Il est facultatif mais très utile à la rédaction pour la mise en ligne : renseignez-le dès que vous connaissez l'auteur des photos.

---

### Q : Puis-je changer de type de papier après avoir commencé ?

Oui, avec le bouton **Type de papier** en bas de l'étape Rédaction. Attention : **changer de type vide le formulaire** (texte et photos).

---

## 4. Upload d'images

### Q : Mon image est refusée

**Messages affichés** : *"{filename}: File is larger than 25 MB"*, *"{filename}: File type must be …"*, *"Les images SVG ne sont pas acceptées"*, *"Fichier « x » : contenu non reconnu comme une image valide"*

**Contraintes à respecter :**

| Contrainte | Limite |
|------------|--------|
| Taille max par fichier | **25 Mo** |
| Nombre max de fichiers | **20 photos** par envoi (moins si le format impose un maximum) |
| Formats acceptés | JPG, JPEG, PNG, WebP, GIF, HEIC, HEIF, TIFF, BMP, AVIF |
| Formats refusés | SVG, PDF, Word, vidéos, et tout fichier non-image |

Le serveur vérifie le **contenu réel** du fichier, pas seulement son extension : un PDF renommé en `.jpg` est refusé.

**Solutions :**
- Compressez vos images si elles dépassent 25 Mo
- Convertissez les fichiers non supportés en JPG ou PNG
- Réduisez le nombre d'images

---

### Q : Le message "{X} photo(s) minimum requise(s)" ou "Au moins une photo est requise" s'affiche

**Cause :** Le type de papier sélectionné exige un nombre minimum de photos. Depuis septembre 2026, **tous les formats** demandent au moins une photo :

| Type de papier | Photos |
|----------------|--------|
| Sujet de couv | Photos **ou** lien Drive |
| Interview 3000 | **2 minimum** ou lien Drive |
| Disque de la semaine, Chroniques, Chronique Cinéma, Coup de Coeur, Frenchie | **1 minimum** |
| Livres et Expo | **1 exactement** (maximum 1) |

**Solution :** Ajoutez le nombre de photos requis via la zone de dépôt (glisser-déposer ou clic pour parcourir). Pour Sujet de couv et Interview 3000, un **lien Drive** dans le champ prévu remplace les photos.

---

### Q : "Ce format accepte une seule photo" / "Ce format accepte X photos maximum"

**Cause :** Le format impose un nombre maximum de visuels (Livres et Expo : une seule photo).

**Solution :** Les photos en trop sont ignorées. Retirez celle que vous ne voulez pas (croix sur la vignette) et gardez la bonne.

---

### Q : Je veux remplacer une image déjà uploadée

**En mode création :** Supprimez l'image de la liste (clic sur la croix) puis ajoutez la nouvelle.

**En mode modification :** Les photos existantes sont rappelées par leur nom sous la zone de dépôt (« Images existantes : … »). Ajoutez de nouvelles photos pour **remplacer** la liste. Si vous n'ajoutez rien, les photos déjà sur Dropbox sont conservées.

---

### Q : L'aperçu de l'image ne s'affiche pas

**Cause :** Le navigateur n'a pas réussi à générer l'aperçu (fichier trop volumineux ou format peu courant comme HEIC/TIFF).

**Solution :** L'image sera quand même uploadée correctement même sans aperçu visible. Si vous souhaitez un aperçu, convertissez l'image en JPG ou PNG.

---

### Q : Mon navigateur rame avec beaucoup d'images

**Cause :** Chaque image génère un aperçu en mémoire. 10 fichiers de 20 Mo = 200 Mo de mémoire navigateur.

**Solution :** Réduisez la taille de vos images avant de les uploader (compresser en JPG qualité 80-90%).

---

## 5. Correction IA

### Q : La correction ne fonctionne pas / prend trop de temps

**Message affiché** : *"Correction automatique indisponible — texte original conservé"*

**Causes possibles :**
- Le service IA met plus de **5 minutes** à répondre (délai maximum côté serveur ; un Sujet de couv prend normalement 30 à 90 secondes)
- Le service IA configuré par l'administrateur est indisponible ou saturé
- Le texte dépasse **100 000 signes**
- Problème réseau temporaire

**Ce qui se passe :** vous passez quand même à l'étape 3 avec votre **texte d'origine** dans la zone « Texte final (modifiable) ». Vous pouvez le relire vous-même et livrer sans correction IA.

**Solution :**
- Relisez et livrez, ou revenez en arrière (**Modifier le texte**) et relancez la correction après quelques minutes

---

### Q : L'IA a fusionné ou modifié mes paragraphes

**Cause :** Le système préserve la structure de vos paragraphes via des marqueurs internes. Dans de rares cas, l'IA peut mal interpréter la structure.

**Protection automatique :** Si plus de 50% des sauts de ligne sont perdus, le système revient automatiquement à votre structure originale.

**Solution :** Si le résultat ne vous convient pas, refusez les corrections et soumettez votre texte original.

---

### Q : Puis-je refuser une partie des corrections ?

**Oui, en éditant le texte.** L'étape 3 affiche la liste des corrections appliquées (`original → corrigé (type)`) puis le **Texte final (modifiable)**. Il n'y a pas de validation correction par correction : pour en refuser une, retapez le passage comme vous le souhaitez dans la zone de texte. C'est ce texte final qui est livré.

---

### Q : "Trop de corrections demandées"

**Cause :** Vous avez lancé plus de **30 corrections en une heure**.

**Solution :** Patientez quelques minutes. Vous pouvez livrer sans correction IA entre-temps.

---

### Q : Quels types de corrections l'IA fait-elle ?

| Type | Ce qui est corrigé |
|------|-------------------|
| **Orthographe** | Fautes d'orthographe |
| **Grammaire** | Accords, conjugaisons, syntaxe |
| **Ponctuation** | Virgules, points, deux-points manquants ou superflus |
| **Style** | Tournures maladroites, répétitions |
| **Typographie** | Espaces insécables, guillemets français, tirets |

---

### Q : Le texte corrigé est identique à l'original

**Cause :** Votre texte ne contenait aucune erreur détectable par l'IA. La liste des corrections sera vide.

---

### Q : Mon texte est trop long pour la correction

**Message affiché** : *"Texte trop long (max 100 000 signes)"*

**Solution :** Réduisez la taille de votre texte en dessous de 100 000 caractères. Ce seuil est rarement atteint (le plus long type de papier, Sujet de couv, est limité à 15 000 signes).

---

### Q : La correction me propose un texte vide

**Message affiché** : *"Texte requis"*

**Cause :** Le champ corps de texte est vide au moment de lancer la correction.

**Solution :** Remplissez le champ de texte principal avant de demander la correction.

---

## 6. Soumission & Dropbox

### Q : La soumission échoue avec "Erreur lors de la livraison"

**Causes possibles (par ordre de fréquence) :**

1. **Problème Dropbox** : le service est temporairement indisponible ou le token a expiré
2. **Fichiers trop volumineux** : la somme de toutes les images dépasse la capacité de traitement
3. **Timeout réseau** : connexion trop lente pour envoyer dans les temps (15 min max côté serveur)
4. **Erreur serveur** : problème technique côté backend

**Solutions :**
- Réessayez la livraison (le système fait déjà plusieurs tentatives automatiques en cas d'erreur Dropbox)
- Réduisez la taille/nombre de vos photos
- Vérifiez votre connexion internet
- Si le problème persiste après 2-3 tentatives, contactez l'administrateur en indiquant l'heure : chaque échec est tracé dans les logs de la plateforme

---

### Q : La soumission est très lente

**Cause :** La livraison implique plusieurs opérations séquentielles :
1. Génération du fichier Word (.docx)
2. Création des dossiers sur Dropbox
3. Envoi du DOCX sur Dropbox
4. Envoi de chaque photo sur Dropbox (une par une)
5. Création des liens de partage
6. Enregistrement en base de données
7. Envoi de l'email de notification

En parallèle, un **brouillon** de l'article est créé sur rollingstone.fr (voir ci-dessous) ; cette étape ne ralentit pas et ne bloque jamais votre livraison.

**Temps estimé :** De 10 secondes (texte seul) à plusieurs minutes (photos volumineuses).

**Conseil :** Ne fermez pas la page pendant l'envoi (« Envoi en cours… »). Un délai maximum de 15 minutes est configuré côté serveur.

---

### Q : Mon papier est aussi envoyé sur le site rollingstone.fr ?

Oui, quand l'administrateur a activé cette option. À chaque livraison, la plateforme crée en parallèle un **brouillon** sur le site, marqué « en attente de relecture ». Il n'est **pas visible du public** : la rédaction le relit, complète les champs qu'elle seule maîtrise et décide de la publication. Vous n'avez rien à faire de plus, et un échec de cette étape n'empêche jamais la livraison Dropbox (l'administrateur est prévenu par email).

---

### Q : Où sont mes fichiers sur Dropbox ?

L'arborescence suit cette structure :

```
Hebdo Delivery/
└── RSH240/                                        ← Numéro d'hebdo
    ├── Interview 3000/
    │   └── NomArtiste/                            ← Sous-dossier par sujet
    │       ├── RSH240 - Interview 3000 - NomArtiste.docx
    │       └── photo.jpg
    ├── Chroniques/
    │   └── VotreNom/                              ← Sous-dossier par journaliste
    │       ├── RSH240 - Chroniques - Artiste.docx
    │       └── pochette.jpg
    ├── Disque de la semaine/
    │   └── RSH240 - Disque de la semaine - Album.docx
    └── ...
```

Le fichier Word est toujours nommé `RSHxxx - Type de papier - Titre.docx`.

**Note :** Certains types de papier (Chroniques, Livres et Expo) créent un sous-dossier à votre nom. D'autres types (Interview) créent un sous-dossier au nom du sujet.

---

### Q : Le lien Dropbox ne fonctionne pas

**Causes possibles :**
- Le lien de partage n'a pas pu être généré (erreur Dropbox)
- Le dossier a été déplacé ou supprimé sur Dropbox par un administrateur
- Problème de permissions Dropbox

**Solution :** Contactez l'administrateur. Le fichier est probablement bien uploadé même si le lien ne fonctionne pas.

---

### Q : "Erreur préparation des dossiers Dropbox" s'affiche

**Cause :** La plateforme n'arrive pas à créer la structure de dossiers sur Dropbox avant la soumission.

**Causes techniques :**
- Token Dropbox expiré
- Limite de requêtes Dropbox atteinte
- Problème réseau

**Solution :** Réessayez dans quelques secondes. Le système tente automatiquement 3 retries avec délai croissant.

---

### Q : Mon article a été livré mais la rédaction n'a pas reçu l'email

**Cause :** L'envoi d'email est **non bloquant** : si le service d'email rencontre une erreur, la livraison est quand même enregistrée. L'email part aux administrateurs actifs avec l'objet `[RSHxxx] Type de papier — Titre (Votre nom)`.

**Votre article est bien livré.** Vous pouvez partager le lien Dropbox manuellement ou prévenir la rédaction directement.

---

### Q : J'ai soumis deux fois par erreur

**Cause :** En cas d'erreur partielle (ex: Dropbox OK mais base de données KO), un retry peut créer un doublon dans Dropbox.

**Solution :** Contactez l'administrateur pour qu'il supprime la livraison en double. Les fichiers sur Dropbox devront être nettoyés manuellement.

---

## 7. Modification d'une livraison

### Q : Je ne peux pas modifier la livraison d'un collègue

**Message affiché** : *"Livraison introuvable ou non autorisée"*

**Cause :** Chaque journaliste ne peut modifier que ses propres livraisons. Seul un administrateur peut modifier les livraisons des autres.

---

### Q : Que se passe-t-il quand je modifie une livraison ?

Lors d'une modification (icône **crayon**, puis **Enregistrer les modifications**) :
- Le formulaire s'ouvre directement à l'étape Rédaction, pré-rempli
- Le fichier Word (.docx) est **régénéré** avec le nouveau contenu
- Les fichiers sont **renvoyés** sur Dropbox (même dossier)
- La base de données est **mise à jour**
- La correction IA est relancée sur le texte modifié

**Ce qui ne se passe pas :** aucun nouvel email n'est envoyé à la rédaction, et aucun nouveau brouillon n'est créé sur le site. Prévenez la rédaction si la modification est importante.

**Attention :** Les anciennes versions du DOCX sur Dropbox sont écrasées.

---

### Q : "Erreur lors de la modification"

**Cause :** Une étape de la mise à jour a échoué (Dropbox, réseau, fichier invalide).

**Solution :** Réessayez. Si le problème persiste, contactez l'administrateur en indiquant l'heure.

---

### Q : J'ai modifié ma livraison en même temps qu'un administrateur

**Cause :** Il n'y a pas de mécanisme de verrouillage. Si deux personnes modifient la même livraison simultanément, la dernière sauvegarde écrase la précédente.

**Solution :** Coordonnez-vous avec l'administrateur avant de modifier un article qui pourrait être en cours de relecture.

---

### Q : Je ne retrouve plus ma livraison pour la modifier

**Solutions :**
- Vérifiez le filtre d'hebdo sur le Dashboard (changez pour "Tous")
- Vérifiez que vous êtes connecté avec le bon compte
- La livraison a peut-être été supprimée par un administrateur

---

## 8. Problèmes réseau & performance

### Q : "Too Many Requests" / Erreur 429

**Cause :** Vous avez dépassé la limite de **300 requêtes en 15 minutes**.

**Solution :** Attendez quelques minutes avant de réessayer. Cette limite est rarement atteinte en usage normal.

---

### Q : La page reste bloquée en chargement

**Causes possibles :**
- Connexion internet instable
- Le serveur est temporairement surchargé
- Timeout d'une opération en cours

**Solutions :**
- Rafraîchissez la page (F5 ou Cmd+R)
- Vérifiez votre connexion internet
- Réessayez dans quelques minutes
- Si le problème persiste, contactez l'administrateur

---

### Q : L'upload est très lent sur une connexion Wi-Fi

**Cause :** Les images volumineuses prennent du temps à uploader, surtout sur une connexion lente.

**Conseils :**
- Compressez vos images avant upload (qualité JPG 80-90% suffit)
- Évitez les formats non compressés (TIFF, BMP) : préférez JPG ou PNG
- Si possible, utilisez une connexion filaire pour les envois volumineux
- Ne fermez pas l'onglet pendant l'envoi (délai maximum serveur : 15 minutes)

---

## 9. Navigateur & session

### Q : La présentation de départ s'affiche à chaque connexion

**Cause :** Le marqueur « présentation vue » est stocké dans votre navigateur. Si celui-ci est vidé (nettoyage de cache, navigation privée, changement de navigateur ou d'ordinateur), la présentation se réaffiche.

**Solution :** Parcourez-la à nouveau jusqu'au bout. Vous pouvez aussi la relancer volontairement via **Revoir la présentation**.

---

### Q : Quels navigateurs sont supportés ?

| Navigateur | Support |
|-----------|---------|
| Chrome (récent) | Supporté |
| Firefox (récent) | Supporté |
| Safari (récent) | Supporté |
| Edge (récent) | Supporté |
| Mobile (iOS/Android) | Supporté |
| Internet Explorer 11 | **Non supporté** |

---

### Q : La plateforme fonctionne-t-elle sur mobile ?

**Oui**, la plateforme est accessible depuis un navigateur mobile. Cependant, l'expérience est optimisée pour un écran d'ordinateur, notamment pour :
- Le formulaire multi-étapes
- La liste des corrections et le texte final
- L'upload d'images (glisser-déposer non disponible sur mobile)

---

### Q : J'utilise un ordinateur partagé, y a-t-il des risques ?

**Oui.** Votre session est stockée dans le navigateur. Sur un ordinateur partagé :
- Déconnectez-vous systématiquement après utilisation
- Utilisez la navigation privée si possible
- Videz le cache après utilisation
- La double authentification, si elle est active, protège votre compte même si votre mot de passe est connu

---

## 10. Référence rapide des messages d'erreur

| Message d'erreur | Cause | Action |
|-----------------|-------|--------|
| *Email ou mot de passe incorrect* | Identifiants invalides | Vérifier email/mot de passe |
| *Compte desactive* | Compte désactivé par l'admin | Contacter l'administrateur |
| *Token invalide* | Session expirée | Se reconnecter |
| *Code invalide ou expiré. Réessayez.* | Code 2FA faux ou périmé | Attendre le code suivant |
| *Champs manquants : …* | Champs obligatoires non remplis (au clic sur Corriger) | Remplir les champs listés |
| *Ce champ est obligatoire* | Champ requis non rempli | Remplir le champ |
| *Renseignez un lien ou ajoutez des photos ci-dessous* | Ni photos ni lien Drive (Sujet de couv, Interview 3000) | Fournir l'un des deux |
| *Champs obligatoires manquants* | Type, titre ou hebdo manquant | Vérifier formulaire complet |
| *Aucun numéro programmé* | Pas de numéro actif | Contacter l'administrateur |
| *Dépassement de X signes* | Texte trop long (avertissement) | Réduire le texte (non bloquant) |
| *File type must be …* / *Seules les images sont acceptées* | Fichier non-image | Utiliser JPG/PNG/WebP |
| *Les images SVG ne sont pas acceptées* | Fichier SVG | Convertir en PNG ou JPG |
| *contenu non reconnu comme une image valide* | Fichier corrompu ou renommé | Réexporter l'image |
| *File is larger than 25 MB* | Image trop volumineuse | Compresser l'image |
| *X photo(s) minimum requise(s)* / *Au moins une photo est requise* | Pas assez de photos | Ajouter les photos requises |
| *Ce format accepte une seule photo* | Trop de photos pour le format | Garder une seule photo |
| *Veuillez sélectionner une note* | Note étoiles requise non remplie | Cliquer sur les étoiles |
| *Texte requis* | Texte vide envoyé à la correction | Remplir le champ texte |
| *Texte trop long (max 100 000 signes)* | Texte dépasse 100k caractères | Raccourcir le texte |
| *Correction automatique indisponible* | Timeout ou erreur IA | Relire le texte d'origine ou réessayer |
| *Trop de corrections demandées* | Plus de 30 corrections en 1 h | Attendre |
| *Erreur préparation des dossiers Dropbox* | Dropbox inaccessible | Réessayer dans quelques secondes |
| *Erreur lors de la livraison* | Erreur serveur à la livraison | Réessayer, puis contacter l'admin |
| *Erreur lors de la modification* | Erreur serveur à la mise à jour | Réessayer, puis contacter l'admin |
| *Livraison introuvable* | ID invalide ou livraison supprimée | Vérifier sur le Dashboard |
| *Livraison introuvable ou non autorisée* | Tentative de modifier la livraison d'un autre | Seul l'auteur peut modifier |
| *Hebdo introuvable* | Hebdo sélectionné n'existe plus | Rafraîchir la page |
| *Too Many Requests (429)* | Trop de requêtes en 15 min | Attendre quelques minutes |

---

## Contacts

En cas de problème non résolu par cette FAQ :

- **Problème technique** → Contactez l'administrateur de la plateforme
- **Question éditoriale** → Contactez votre rédacteur en chef (carte **Rédaction en chef** en bas du tableau de bord)
- **Problème de compte** → Contactez l'administrateur pour la création/réactivation de compte

---

*RS Hebdo Delivery — Rolling Stone France*

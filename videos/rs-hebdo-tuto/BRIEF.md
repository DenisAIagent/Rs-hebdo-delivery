---
workflow: general-video
flow: automation
storyboard: no
message: "Livrer un papier à Rolling Stone Hebdo prend cinq minutes, en quatre étapes guidées, sans email ni pièce jointe."
destination: website-embed
aspect: 1920x1080
language: fr
audience: journalistes et pigistes de Rolling Stone France, tous niveaux à l'aise avec le numérique ou non
length: 45s
angle: presentation
voice: elevenlabs-manon
---

## Intent

Vidéo de présentation courte (45 s maximum, demande du 30/09 après une première version de 5 min jugée trop longue) de l'application RS Hebdo Delivery,
affichée automatiquement au premier lancement (page d'onboarding) pour chaque
journaliste. Rythme volontairement lent : chaque écran reste assez longtemps
pour être lu, chaque action est nommée avant d'être montrée. Voix off française
posée, chaleureuse, jamais pressée. Motion design soigné dans la charte de
l'application (papier crème, encre, rouge Rolling Stone, serif éditorial), avec
des reconstitutions animées des écrans réels plutôt que des captures brutes.

## Assets

- ../../frontend/public/logo-rs-france.png — logo Rolling Stone France, scène d'ouverture et de fermeture.
- ../../frontend/src/index.css — palette et typographies de l'app (source de vérité pour frame.md).
- ../../TUTO-JOURNALISTE.md — parcours réel et libellés exacts des boutons (source du script).

## Customizations

- Voix off générée sur ElevenLabs via l'interface web (voix « Manon », modèle Eleven v4, prise 1 de deux), fichier `assets/vo45/manon-take1.mp3` ; la voix système et OpenAI ont été refusées (trop artificielles).
- Reconstitutions d'interface animées (curseur, clics, saisie) pour chaque étape du formulaire.
- Sous-titres non demandés ; à proposer après la première relecture.

## Notes

- Ne montrer que ce que l'application fait réellement (libellés, limites : 25 Mo, 20 fichiers, 30 corrections/heure, statut unique « Livré »).
- Pas de capture d'écran de production (données réelles, connexion) : tout est reconstitué.
- Le fichier final est intégré dans l'onboarding React (`OnboardingPage.tsx`) au premier affichage.

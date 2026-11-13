// Chargeur du chat Crisp. Dans un fichier (et non en ligne dans index.html) pour
// que la politique de securite (CSP) puisse interdire les scripts en ligne.
window.$crisp = [];
window.CRISP_WEBSITE_ID = '217eae2c-1b6f-41ae-b54b-0b02f8c6b8b9';
(function () {
  var s = document.createElement('script');
  s.src = 'https://client.crisp.chat/l.js';
  s.async = true;
  document.head.appendChild(s);
})();

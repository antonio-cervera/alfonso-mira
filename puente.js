// Puente: la app de siempre llama a google.script.run (Apps Script).
// Aquí esas llamadas se envían a Firebase (nube.js define window.__backend).
// Sin encadenamiento opcional, sin fusión nula y sin expresiones regulares literales.
(function () {
  function crearRunner(ok, ko) {
    var r = {
      withSuccessHandler: function (f) { return crearRunner(f, ko); },
      withFailureHandler: function (f) { return crearRunner(ok, f); },
      withUserObject: function () { return crearRunner(ok, ko); }
    };
    var nombres = ['loadData', 'loadEvent', 'getEventRev', 'saveEvent', 'deleteEventDB',
      'verificarClaveCostes', 'loadCostes', 'saveCostes',
      'enviarPuntoMejora', 'loadPuntosMejora', 'actualizarPuntoMejora', 'borrarPuntoMejora'];
    nombres.forEach(function (n) {
      r[n] = function () {
        var args = Array.prototype.slice.call(arguments);
        var b = window.__backend;
        var p;
        if (!b || typeof b[n] !== 'function') p = Promise.reject(new Error('Sin conexión con la base de datos (' + n + ')'));
        else { try { p = Promise.resolve(b[n].apply(null, args)); } catch (e) { p = Promise.reject(e); } }
        p.then(function (res) { if (ok) ok(res); }, function (err) {
          if (ko) ko(err); else console.error(n, err);
        });
      };
    });
    return r;
  }
  window.google = { script: { run: crearRunner(null, null) } };
})();

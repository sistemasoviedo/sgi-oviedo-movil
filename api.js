/* SGI Oviedo móvil - cliente de la API (Apps Script). */
(function () {
  'use strict';
  var CFG = window.SGI_CONFIG || {};

  function ApiError(codigo, mensaje) {
    this.name = 'ApiError'; this.codigo = codigo; this.message = mensaje;
  }
  ApiError.prototype = Object.create(Error.prototype);

  var Api = {
    token: '',
    demo: false,
    reautenticar: null,   // la define app.js: abre el inicio de sesión y resuelve cuando hay token nuevo

    llamar: function (accion, datos, opciones) {
      if (Api.demo) return window.SGIDemo.llamar(accion, datos || {});
      var intento = 0;
      var ir = function () {
        return Api._una(accion, datos, opciones || {}).catch(function (e) {
          if (e.codigo === 'no_autenticado' && intento === 0 && Api.reautenticar) {
            intento++;
            return Api.reautenticar().then(ir);
          }
          throw e;
        });
      };
      return ir();
    },

    _una: function (accion, datos, opciones) {
      var ctl = new AbortController();
      var t = setTimeout(function () { ctl.abort(); }, opciones.timeout || 120000);
      // Sin cabeceras: así el navegador manda text/plain y no hace "preflight" (Apps Script no lo admite).
      return fetch(CFG.API_URL, {
        method: 'POST', redirect: 'follow', signal: ctl.signal,
        body: JSON.stringify({ token: Api.token, accion: accion, datos: datos || {} })
      }).then(function (resp) {
        clearTimeout(t);
        return resp.json().catch(function () {
          throw new ApiError('respuesta', 'El servidor respondió algo inesperado. Verifique la URL de la API en config.js.');
        });
      }, function (e) {
        clearTimeout(t);
        if (e && e.name === 'AbortError') throw new ApiError('timeout', 'El servidor tardó demasiado en responder.');
        throw new ApiError('red', 'Sin conexión con el servidor.');
      }).then(function (j) {
        if (!j.ok) throw new ApiError(j.codigo || 'error', j.mensaje || 'Error desconocido.');
        return j.datos;
      });
    }
  };

  window.SGIApi = Api;
  window.SGIApiError = ApiError;
}());

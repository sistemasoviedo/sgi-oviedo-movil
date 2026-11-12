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

    /* Acciones de solo lectura: si el servidor no responde, el error sale pronto. Las demás esperan más. */
    _LECTURA: { sesion: 1, bootstrap: 1, activo: 1, buscar: 1, revision_resumen: 1, colaborador: 1, accesos_vigentes: 1, gh_pendientes: 1 },

    _una: function (accion, datos, opciones) {
      var ms = opciones.timeout || (Api._LECTURA[accion] ? 45000 : 120000);
      var via = (CFG.TRANSPORTE === 'fetch') ? Api._viaFetch : Api._viaFormulario;
      return via(accion, datos, ms).then(function (j) {
        if (!j || typeof j !== 'object') throw new ApiError('respuesta', 'El servidor respondió algo inesperado.');
        if (!j.ok) throw new ApiError(j.codigo || 'error', j.mensaje || 'Error desconocido.');
        return j.datos;
      });
    },

    /* Transporte normal: fetch con cuerpo text/plain (sin "preflight"). Solo sirve si el servidor devuelve CORS. */
    _viaFetch: function (accion, datos, ms) {
      var ctl = new AbortController();
      var t = setTimeout(function () { ctl.abort(); }, ms);
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
      });
    },

    /* Transporte por defecto: formulario oculto -> iframe oculto -> el servidor responde con postMessage.
       No usa CORS (las implementaciones de un dominio de Workspace no lo incluyen). */
    _viaFormulario: function (accion, datos, ms) {
      return new Promise(function (resolve, reject) {
        var nonce = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
          : 'n' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        var nombre = 'sgi_f_' + nonce;
        var apiOrigen = '';
        try { apiOrigen = new URL(CFG.API_URL).origin; } catch (x) { }

        var iframe = document.createElement('iframe');
        iframe.name = nombre; iframe.title = 'conexion'; iframe.tabIndex = -1;
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';

        var form = document.createElement('form');
        form.method = 'POST'; form.action = CFG.API_URL; form.target = nombre;
        form.acceptCharset = 'UTF-8'; form.style.display = 'none';
        function campo(n, v) { var i = document.createElement('input'); i.type = 'hidden'; i.name = n; i.value = v; form.appendChild(i); }
        campo('sgi_payload', JSON.stringify({ token: Api.token, accion: accion, datos: datos || {} }));
        campo('sgi_nonce', nonce);
        campo('sgi_origen', location.origin);

        var fin = false, temporizador = null;
        function origenPermitido(o) {
          try {
            var u = new URL(o);
            if (apiOrigen && u.origin === apiOrigen) return true;
            return u.protocol === 'https:' && (u.hostname === 'script.google.com' || /(^|\.)googleusercontent\.com$/.test(u.hostname));
          } catch (x) { return false; }
        }
        function terminar(f, valor) {
          if (fin) return; fin = true;
          clearTimeout(temporizador);
          window.removeEventListener('message', alMensaje);
          setTimeout(function () { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); if (form.parentNode) form.parentNode.removeChild(form); }, 0);
          f(valor);
        }
        function alMensaje(ev) {
          if (!origenPermitido(ev.origin)) return;
          var m = ev.data;
          if (!m || typeof m !== 'object' || m.sgi !== 1 || m.nonce !== nonce) return;
          terminar(resolve, m.res);
        }
        window.addEventListener('message', alMensaje);
        temporizador = setTimeout(function () {
          terminar(reject, new ApiError('timeout', 'El servidor no respondió a tiempo. Verifique la conexión y la URL de la API en config.js.'));
        }, ms);

        document.body.appendChild(iframe);
        document.body.appendChild(form);
        try { form.submit(); } catch (e) { terminar(reject, new ApiError('red', 'Sin conexión con el servidor.')); }
      });
    }
  };

  window.SGIApi = Api;
  window.SGIApiError = ApiError;
}());

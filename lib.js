/* SGI Oviedo móvil - funciones puras (sin DOM): se prueban en Node y se usan en el navegador. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.SGILib = fabrica();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Escapa texto para insertarlo en HTML. TODO dato que viene del libro pasa por aquí. */
  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  /** Igual que el servidor: del texto del QR saca el ID del activo (INV-0114, URL con el ID, o número). */
  function extraerId(texto) {
    var t = String(texto || '').trim();
    if (!t) return '';
    var m = t.match(/INV-\d{1,6}/i);
    if (m) return m[0].toUpperCase();
    if (/^\d{1,6}$/.test(t)) return 'INV-' + ('0000' + t).slice(-Math.max(4, t.length));
    return t;
  }

  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function hoy(d) {
    d = d || new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function periodoTexto(p) {
    var m = String(p || '').match(/^(\d{4})-(\d{2})$/);
    return m ? MESES[+m[2] - 1] + ' ' + m[1] : String(p || '');
  }

  /** Lee el contenido de un ID token (solo para mostrar nombre y saber cuándo vence; NO es una verificación). */
  function leerJwt(token) {
    try {
      var b = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      var txt = (typeof atob === 'function') ? decodeURIComponent(escape(atob(b))) : Buffer.from(b, 'base64').toString('utf8');
      return JSON.parse(txt);
    } catch (e) { return null; }
  }

  /* ----------------------------------------------------------------- cola de envío (revisiones) */
  /**
   * Revisiones que no pudieron enviarse por falta de señal. Se guardan en el celular con un idLocal
   * único: si luego se reenvían dos veces, el servidor no las duplica.
   */
  function Cola(almacen, clave) {
    this.al = almacen; this.k = clave || 'sgi_cola';
  }
  Cola.prototype.todo = function () {
    try { return JSON.parse(this.al.getItem(this.k) || '[]'); } catch (e) { return []; }
  };
  Cola.prototype.guardar = function (lista) { this.al.setItem(this.k, JSON.stringify(lista)); };
  Cola.prototype.agregar = function (item) { var l = this.todo(); l.push(item); this.guardar(l); return l.length; };
  Cola.prototype.quitar = function (id) { this.guardar(this.todo().filter(function (x) { return x.id !== id; })); };
  Cola.prototype.cantidad = function () { return this.todo().length; };

  /** Errores que se arreglan solos al reintentar (red, servidor ocupado, sesión vencida). */
  function esReintentable(codigo) {
    return codigo === 'red' || codigo === 'ocupado' || codigo === 'no_autenticado' || codigo === 'timeout';
  }

  /* ------------------------------------------------------------------- armado y validación de formularios */
  function validarMovimiento(f) {
    var e = [];
    if (!f.tipo) e.push('Elija el tipo de movimiento.');
    if (!String(f.usuario || '').trim()) e.push('Indique el colaborador.');
    if (!f.activos || !f.activos.length) e.push('Agregue al menos un activo.');
    if (f.activos && f.activos.length > 50) e.push('Máximo 50 activos por movimiento.');
    return e;
  }
  function armarMovimiento(f) {
    return {
      tipo: f.tipo, usuario: String(f.usuario).trim(), documento: f.documento || '', cargo: f.cargo || '',
      area: f.area || '', jefe: f.jefe || '', fecha: f.fecha || hoy(), estadoFisico: f.estadoFisico || '',
      observaciones: String(f.observaciones || '').trim(), activos: f.activos.slice(), generarActa: !!f.generarActa
    };
  }

  function validarNovedad(f) {
    var e = [];
    if (!String(f.usuario || '').trim()) e.push('Indique el colaborador.');
    if (!f.proceso) e.push('Elija el proceso (ingreso, retiro, etc.).');
    if (!f.lineas || !f.lineas.length) e.push('Agregue al menos una aplicación.');
    (f.lineas || []).forEach(function (l) { if (!l.accion) e.push('Falta la acción en "' + l.aplicacion + '".'); });
    if (f.proceso === 'Ingreso' && !f.nuevo.documento && !f.existe) e.push('Para un ingreso nuevo indique el documento.');
    return e;
  }
  function armarNovedad(f) {
    return {
      usuario: String(f.usuario).trim(), documento: f.documento || '', cargo: f.cargo || '', area: f.area || '',
      jefe: f.jefe || '', correo: f.correo || '', vinculo: f.vinculo || '', proceso: f.proceso, fecha: f.fecha || hoy(),
      generarActa: !!f.generarActa,
      lineas: f.lineas.map(function (l) {
        return { aplicacion: l.aplicacion, disponibilidad: l.disponibilidad || '', rol: l.rol || '', permisos: l.permisos || '',
                 accion: l.accion, ejecutado: !!l.ejecutado, observacion: String(l.observacion || '').trim() };
      })
    };
  }

  /** Decisión sobre una respuesta del formulario de GH, con la forma que espera aplicarRevisionFormulario. */
  function armarDecision(item, e) {
    var d = {
      clave: item.clave, fila: item.fila, marca: item.marca, tipo: item.tipo, solicitante: item.solicitante || '',
      herramientas: item.herramientas || '', decision: e.decision, documento: item.documento, nombre: item.nombre,
      cargo: e.cargo || '', area: e.area || '', jefe: e.jefe || '', correo: e.correo || '', vinculo: e.vinculo || '',
      fecha: item.fecha || ''
    };
    if (e.decision === 'COMPLETAR' && item.fichaSinDoc) { d.filaDestino = item.fichaSinDoc.fila; d.nombreDestino = item.fichaSinDoc.nombre; }
    return d;
  }
  function validarDecision(e) {
    var err = [];
    if (e.decision === 'AGREGAR' && (!e.cargo || !e.area || !e.jefe)) err.push('Para agregar se requieren cargo, área y jefe inmediato.');
    return err;
  }

  return { esc: esc, norm: norm, extraerId: extraerId, uuid: uuid, hoy: hoy, periodoTexto: periodoTexto, leerJwt: leerJwt,
           Cola: Cola, esReintentable: esReintentable, validarMovimiento: validarMovimiento, armarMovimiento: armarMovimiento,
           validarNovedad: validarNovedad, armarNovedad: armarNovedad, armarDecision: armarDecision, validarDecision: validarDecision };
}));

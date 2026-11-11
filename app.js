/* SGI Oviedo móvil - interfaz. Todo dato que viene del libro se inserta con esc() (sin excepciones). */
(function () {
  'use strict';
  var CFG = window.SGI_CONFIG || {};
  var L = window.SGILib, Api = window.SGIApi;
  var DEMO = /[?&]demo=1/.test(location.search) || /^PEGAR/.test(String(CFG.API_URL || ''));
  Api.demo = DEMO;
  var esc = L.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var S = {
    sesion: null, boot: null, resumen: null, vista: 'inicio', escaner: null, hojaAbierta: false,
    fm: null, fn: null, fa: null, gh: null, cola: new L.Cola(localStorage, 'sgi_cola'), esperandoLogin: null,
    procesando: false, ignorarPop: 0, bootT: 0, activoSel: null, qBusq: '', busq: null
  };

  /* ================================================================================= utilidades */
  var tToast = null;
  function toast(msg, tipo, ms) {
    var t = $('#toast'); t.textContent = msg; t.className = 'toast ' + (tipo || ''); t.hidden = false;
    clearTimeout(tToast); tToast = setTimeout(function () { t.hidden = true; }, ms || (tipo === 'err' ? 6000 : 3200));
  }
  function cargando(txt) { $('#vista').innerHTML = '<div class="cargando">' + esc(txt || 'Cargando…') + '</div>'; }
  function opciones(lista, actual, vacio) {
    var out = vacio === false ? '' : '<option value="">' + esc(vacio || '— elija —') + '</option>';
    var hay = false;
    (lista || []).forEach(function (v) { if (v === actual) hay = true; out += '<option' + (v === actual ? ' selected' : '') + '>' + esc(v) + '</option>'; });
    if (actual && !hay) out += '<option selected>' + esc(actual) + '</option>';
    return out;
  }
  function urlSegura(u) { return /^https:\/\//i.test(String(u || '')) ? u : ''; }
  function setPath(raiz, ruta, valor) {
    var p = ruta.split('.'), o = raiz;
    for (var i = 0; i < p.length - 1; i++) { if (!o[p[i]]) o[p[i]] = {}; o = o[p[i]]; }
    o[p[p.length - 1]] = valor;
  }
  function esAdmin() { return S.sesion && S.sesion.rol === 'ADMIN'; }
  function nombreCorto(n) { return String(n || '').split(' ')[0]; }
  function tagEstado(e) {
    var x = L.norm(e), c = '';
    if (x.indexOf('baja') >= 0 || x.indexOf('reparac') >= 0) c = ' rojo';
    else if (x.indexOf('stock') >= 0 || x.indexOf('disponible') >= 0) c = ' azul';
    else if (x.indexOf('prestamo') >= 0) c = ' ambar';
    return '<span class="tag' + c + '">' + esc(e || 'Sin estado') + '</span>';
  }

  /* ================================================================================ hoja inferior */
  function abrirHoja(html) {
    $('#hojaCont').innerHTML = html;
    if (!S.hojaAbierta) { S.hojaAbierta = true; try { history.pushState({ h: 1 }, ''); } catch (e) { } }
    $('#hoja').hidden = false;
    $('.hoja-panel').scrollTop = 0;
  }
  function ocultarHoja() {
    var estaba = S.hojaAbierta;
    S.hojaAbierta = false; $('#hoja').hidden = true; $('#hojaCont').innerHTML = '';
    if (estaba && S.alCerrarHoja) { var f = S.alCerrarHoja; S.alCerrarHoja = null; f(); }
  }
  function cerrarHoja() {
    if (!S.hojaAbierta) return;
    if (history.state && history.state.h) history.back(); else ocultarHoja();
  }
  window.addEventListener('popstate', function () {
    if (S.ignorarPop > 0) { S.ignorarPop--; return; }     // retroceso hecho por el propio código al cerrar la hoja a mano
    if (S.hojaAbierta) ocultarHoja();
  });

  function confirmar(titulo, htmlCuerpo, textoOk) {
    return new Promise(function (res) {
      var resuelto = false;
      var fin = function (v) { if (!resuelto) { resuelto = true; res(v); } };
      abrirHoja('<h2>' + esc(titulo) + '</h2><div class="card">' + htmlCuerpo + '</div>' +
        '<div class="fila"><button class="btn primario" style="flex:1" data-act="conf-si">' + esc(textoOk || 'Confirmar') + '</button>' +
        '<button class="btn" data-act="conf-no">Cancelar</button></div>');
      S.confirmacion = fin;
      S.alCerrarHoja = function () { fin(false); };
    });
  }

  /* ===================================================================================== estado */
  function actualizarEstado() {
    var chip = $('#estado'); var n = S.cola.cantidad();
    var online = DEMO ? !(window.SGIDemo && window.SGIDemo.fallaRed) : navigator.onLine;
    chip.hidden = false;
    if (n > 0) { chip.className = 'chip cola'; chip.textContent = n + ' por enviar'; chip.title = 'Revisiones guardadas en el celular sin enviar'; }
    else { chip.className = 'chip ' + (online ? 'ok' : 'off'); chip.textContent = online ? 'En línea' : 'Sin conexión'; chip.title = ''; }
    var b = $('#banner');
    if (DEMO) { b.hidden = false; b.className = 'banner demo'; b.textContent = 'MODO DEMOSTRACIÓN: datos inventados, no se guarda nada en el sistema.'; }
    else if (!online) { b.hidden = false; b.className = 'banner'; b.textContent = 'Sin conexión. Las revisiones se guardan en el celular y se envían al volver la señal.'; }
    else b.hidden = true;
  }
  window.addEventListener('online', function () { actualizarEstado(); procesarCola(); });
  window.addEventListener('offline', actualizarEstado);

  /* ================================================================================ datos base */
  async function cargarDatos() {
    var r = await Promise.all([Api.llamar('bootstrap'), Api.llamar('revision_resumen')]);
    S.boot = r[0]; S.resumen = r[1]; S.bootT = Date.now();
  }
  async function refrescarResumen() {
    try { S.resumen = await Api.llamar('revision_resumen'); } catch (e) { }
    if (S.vista === 'inicio') vInicio();
    if (S.vista === 'pendientes') vPendientes();
  }
  function listas() { return (S.boot && S.boot.listas) || {}; }

  /* ================================================================================== navegación */
  var ICONOS = {
    inicio: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
    escanear: '<svg viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3"/><path d="M4 12h16"/></svg>',
    buscar: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    formularios: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/></svg>',
    gh: '<svg viewBox="0 0 24 24"><path d="M4 13l3-8h10l3 8v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/></svg>'
  };
  function montarNav() {
    var items = [['inicio', 'Inicio'], ['escanear', 'Escanear'], ['buscar', 'Buscar']];
    if (esAdmin()) { items.push(['formularios', 'Formularios']); items.push(['gh', 'GH']); }
    var nav = $('#nav'); nav.hidden = false;
    nav.innerHTML = items.map(function (i) {
      return '<button type="button" data-nav="' + i[0] + '" id="nav-' + i[0] + '">' + ICONOS[i[0]] + '<span>' + i[1] + '</span></button>';
    }).join('');
  }
  function marcarNav() {
    var base = { pendientes: 'inicio', fmov: 'formularios', fnov: 'formularios', fact: 'formularios' }[S.vista] || S.vista;
    $$('#nav button').forEach(function (b) { b.classList.toggle('act', b.getAttribute('data-nav') === base); });
  }
  function detenerEscaner() { if (S.escaner) { S.escaner.detener(); S.escaner = null; } }
  function irA(vista, p) {
    if (S.vista === 'escanear' && vista !== 'escanear') detenerEscaner();
    S.vista = vista; marcarNav(); window.scrollTo(0, 0);
    var f = { inicio: vInicio, pendientes: vPendientes, escanear: vEscanear, buscar: vBuscar, formularios: vFormularios,
              fmov: vMovimiento, fnov: vNovedad, fact: vActivoForm, gh: vGh }[vista];
    if (f) f(p);
  }

  /* ===================================================================================== INICIO */
  function vInicio() {
    var r = S.resumen;
    if (!r) { cargando(); return; }
    var pct = r.total ? Math.round(r.revisados * 100 / r.total) : 0;
    var html = '<div class="card"><h2>Revisión de inventario · ' + esc(L.periodoTexto(r.periodo)) + '</h2>' +
      '<div class="progreso" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div>' +
      '<div class="numeros"><div class="num"><b>' + r.revisados + '/' + r.total + '</b><span class="mini">revisados (' + pct + '%)</span></div>' +
      '<div class="num' + (r.conNovedad ? ' alerta' : '') + '"><b>' + r.conNovedad + '</b><span class="mini">con novedad</span></div>' +
      '<div class="num"><b>' + r.totalPendientes + '</b><span class="mini">pendientes</span></div></div>' +
      '<div class="fila" style="margin-top:12px"><button class="btn primario" style="flex:1" data-nav="escanear">Escanear equipo</button>' +
      '<button class="btn" data-act="ver-pendientes">Ver pendientes</button></div></div>';
    var n = S.cola.cantidad();
    if (n) html += '<div class="aviso ambar"><b>' + n + ' revisión(es) sin enviar.</b> Están guardadas en este celular.' +
      ' <button class="btn chico" data-act="reintentar-cola" style="margin-left:6px">Enviar ahora</button></div>';
    html += '<div class="card"><h3>Últimas revisiones</h3>';
    if (!r.recientes.length) html += '<p class="vacio">Aún no hay revisiones este mes.</p>';
    else html += '<ul class="lista">' + r.recientes.map(function (x) {
      return '<li><div class="it" data-act="abrir-activo" data-id="' + esc(x.idActivo) + '"><b>' + esc(x.idActivo) + ' · ' + esc(x.nombre) + '</b><small>' +
        esc(x.fecha) + ' · ' + esc(x.por) + '</small></div><span class="tag' + (x.resultado === 'Conforme' ? '' : (x.resultado === 'No encontrado' ? ' rojo' : ' ambar')) + '">' + esc(x.resultado) + '</span></li>';
    }).join('') + '</ul>';
    html += '</div><p class="mini" style="text-align:center">' + esc(S.boot ? S.boot.entidad : '') + '</p>';
    $('#vista').innerHTML = html;
  }

  function vPendientes() {
    var r = S.resumen; if (!r) { cargando(); return; }
    var q = L.norm(S.qPend || '');
    var lista = r.pendientes.filter(function (p) { return !q || L.norm([p.id, p.nombre, p.ubicacion, p.usuario, p.tipo].join(' ')).indexOf(q) >= 0; });
    var html = '<button class="atras" data-nav="inicio">← Volver</button><h2>Pendientes de revisar (' + r.totalPendientes + ')</h2>' +
      '<label class="campo" style="margin-top:8px"><span>Filtrar</span><input type="search" id="qPend" value="' + esc(S.qPend || '') + '" placeholder="Ubicación, nombre, responsable…"></label>';
    if (!lista.length) html += '<p class="vacio">Nada pendiente con ese filtro.</p>';
    var ult = null, abierto = false;
    lista.forEach(function (p) {
      var u = p.ubicacion || 'Sin ubicación';
      if (u !== ult) { if (abierto) html += '</ul></div>'; html += '<div class="card"><h3>' + esc(u) + '</h3><ul class="lista">'; ult = u; abierto = true; }
      html += '<li><div class="it" data-act="abrir-activo" data-id="' + esc(p.id) + '"><b>' + esc(p.id) + ' · ' + esc(p.nombre) + '</b><small>' + esc(p.tipo) + (p.usuario ? ' · ' + esc(p.usuario) : '') + '</small></div></li>';
    });
    if (abierto) html += '</ul></div>';
    $('#vista').innerHTML = html;
    var inp = $('#qPend'); if (inp && S.qPend) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }

  /* ==================================================================================== ESCANEAR */
  function vEscanear() {
    $('#vista').innerHTML =
      '<div class="visor"><video id="video" playsinline muted></video><div class="mira"></div><div class="visor-msg" id="visorMsg">Apunte al código QR del equipo</div></div>' +
      '<div class="fila" style="margin:10px 0"><button class="btn" id="btnLuz" data-act="luz" hidden>Linterna</button>' +
      '<button class="btn" data-act="foto">Foto del QR</button><input type="file" id="fotoQR" accept="image/*" capture="environment" hidden></div>' +
      '<form id="frmManual" class="card"><label class="campo" style="margin:0 0 8px"><span>¿No lee el QR? Escriba el ID, serial o nombre del equipo</span>' +
      '<input type="text" id="manual" placeholder="INV-0114" autocomplete="off" autocapitalize="characters"></label>' +
      '<button class="btn primario bloque" type="submit">Buscar equipo</button></form>';
    iniciarEscaner($('#video'), function (texto) { abrirActivo(texto, { desdeEscaner: true }); }, $('#visorMsg'));
  }
  function iniciarEscaner(video, alLeer, msg) {
    detenerEscaner();
    var e = new window.SGIEscaner(video, alLeer);
    S.escaner = e;
    e.iniciar().then(function () {
      var pista = e.stream && e.stream.getVideoTracks()[0];
      var cap = pista && pista.getCapabilities ? pista.getCapabilities() : {};
      var b = $('#btnLuz'); if (b && cap.torch) b.hidden = false;
    }).catch(function (err) {
      var m = (err && err.name === 'NotAllowedError') ? 'Permiso de cámara denegado. Actívelo en los ajustes del navegador o use "Foto del QR".'
        : (err && err.name === 'NotFoundError') ? 'No se encontró cámara.' : (err && err.message) || 'No se pudo abrir la cámara.';
      if (msg) msg.textContent = m;
      S.escaner = null;
    });
  }
  async function leerFotoQR(archivo) {
    var e = new window.SGIEscaner(document.createElement('video'), function () { });
    try {
      var t = await e.leerArchivo(archivo);
      if (!t) { toast('No se encontró un QR en la foto. Acérquese e inténtelo de nuevo.', 'err'); return; }
      abrirActivo(t, { desdeEscaner: false });
    } catch (x) { toast('No se pudo leer la foto.', 'err'); }
  }

  /* Escáner dentro de una hoja: devuelve el texto leído (para agregar activos a un formulario). */
  function capturarCodigo() {
    return new Promise(function (res) {
      var listo = false;
      abrirHoja('<div class="fila sep"><h2>Escanear activo</h2><button class="btn chico" data-cerrar-hoja>Cerrar</button></div>' +
        '<div class="visor" style="margin-top:8px"><video id="videoH" playsinline muted></video><div class="mira"></div><div class="visor-msg" id="visorMsgH">Apunte al código QR</div></div>' +
        '<form id="frmCaptura" class="card" style="margin-top:10px"><label class="campo" style="margin:0 0 8px"><span>O escriba el ID / serial</span><input type="text" id="capManual" autocomplete="off"></label>' +
        '<button class="btn primario bloque" type="submit">Agregar</button></form>');
      var fin = function (t) { if (listo) return; listo = true; detenerEscaner(); S.alCerrarHoja = null; ocultarHoja(); res(t); };
      S.alCerrarHoja = function () { if (!listo) { listo = true; detenerEscaner(); res(null); } };
      S.capturaFin = fin;
      iniciarEscaner($('#videoH'), function (t) { fin(t); }, $('#visorMsgH'));
    });
  }

  async function abrirActivo(texto, op) {
    op = op || {};
    var id = L.extraerId(texto);
    if (!id) return;
    try {
      var d = await Api.llamar('activo', { texto: texto });
      S.activoSel = d; mostrarActivo(d, op);
    } catch (e) {
      toast(e.message, 'err');
      if (op.desdeEscaner && S.escaner) setTimeout(function () { if (S.escaner) S.escaner.reanudar(); }, 1500);
    }
  }

  function mostrarActivo(d, op) {
    var a = d.activo, b = S.boot || {}, ls = listas();
    var ubics = (b.ubicaciones || []);
    var u = d.ultimaRevision;
    var html = '<div class="fila sep"><div><h2>' + esc(a.ID_ACTIVO) + ' · ' + esc(a.NOMBRE_EQUIPO) + '</h2><span class="muted">' +
      esc([a.TIPO, a.MARCA, a.MODELO].filter(Boolean).join(' · ')) + '</span></div><button class="btn chico" data-cerrar-hoja>Cerrar</button></div>';
    if (d.revisadoEsteMes && u) html += '<div class="aviso verde">Ya revisado este mes: <b>' + esc(u.resultado) + '</b> · ' + esc(u.fecha) + ' · ' + esc(u.por) + '. Puede registrar otra revisión si algo cambió.</div>';
    else if (u) html += '<div class="aviso ambar">Última revisión: ' + esc(u.resultado) + ' · ' + esc(u.fecha) + '. Este mes aún no se revisa.</div>';
    html += '<div class="card"><div class="grid2">' +
      dato('Serial', a.SERIAL) + dato('Estado', a.ESTADO) + dato('Asignado a', a.USUARIO_ASIGNADO) + dato('Área', a.AREA) +
      dato('Ubicación', a.UBICACION) + dato('Actualizado', [a.ULTIMA_ACTUALIZACION, a.ACTUALIZADO_POR].filter(Boolean).join(' · ')) + '</div></div>';
    if (d.movimientos && d.movimientos.length) {
      html += '<details class="card"><summary><b>Movimientos recientes (' + d.movimientos.length + ')</b></summary><ul class="lista">' + d.movimientos.map(function (m) {
        return '<li><div class="it"><b>' + esc(m.tipo) + ' · ' + esc(m.usuario) + '</b><small>' + esc(m.fecha) + ' · ' + esc(m.id) + (m.estadoFisico ? ' · ' + esc(m.estadoFisico) : '') + '</small></div></li>';
      }).join('') + '</ul></details>';
    }
    html += '<h3 style="margin:10px 0 8px">Registrar revisión</h3><form id="frmRev" data-id="' + esc(a.ID_ACTIVO) + '" data-desde="' + (op.desdeEscaner ? '1' : '') + '">' +
      '<div class="seg" role="radiogroup" aria-label="Resultado">' +
      '<label><input type="radio" name="resultado" value="Conforme" checked><span class="ok">Conforme</span></label>' +
      '<label><input type="radio" name="resultado" value="Con novedad"><span class="av">Con novedad</span></label>' +
      '<label><input type="radio" name="resultado" value="No encontrado"><span class="no">No encontrado</span></label></div>' +
      '<label class="campo"><span>Estado físico</span><select name="estadoFisico">' + opciones(ls.estadoFisico, '') + '</select></label>' +
      '<label class="campo"><span>Ubicación donde está ahora</span><input type="text" name="ubicacion" list="dlUbic" value="' + esc(a.UBICACION) + '" data-orig="' + esc(a.UBICACION) + '" autocomplete="off"></label>' +
      '<datalist id="dlUbic">' + ubics.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +
      '<label class="check"><input type="checkbox" name="actualizarUbicacion"> Actualizar la ubicación en el inventario</label>' +
      '<label class="campo"><span>¿Quién lo tiene?</span><input type="text" name="usuarioEncontrado" value="' + esc(a.USUARIO_ASIGNADO) + '" autocomplete="off"></label>' +
      '<label class="campo"><span>Observaciones</span><textarea name="observaciones" maxlength="500" placeholder="Daños, faltantes, rótulo ilegible…"></textarea></label>' +
      '<button class="btn primario bloque" type="submit">' + (op.desdeEscaner ? 'Guardar y escanear otro' : 'Guardar revisión') + '</button></form>';
    if (esAdmin()) {
      html += '<div class="fila" style="margin-top:12px"><button class="btn" style="flex:1" data-act="mov-desde-activo" data-id="' + esc(a.ID_ACTIVO) + '">Entregar / devolver</button>' +
        '<button class="btn" style="flex:1" data-act="editar-activo" data-id="' + esc(a.ID_ACTIVO) + '">Editar datos</button></div>';
    }
    S.alCerrarHoja = function () { if (op.desdeEscaner && S.escaner) S.escaner.reanudar(); };
    abrirHoja(html);
  }
  function dato(k, v) { return '<div class="dato"><small>' + esc(k) + '</small><span>' + (v ? esc(v) : '<span class="muted">—</span>') + '</span></div>'; }

  async function guardarRevisionForm(form) {
    var fd = new FormData(form);
    var datos = {
      idActivo: form.getAttribute('data-id'), resultado: fd.get('resultado'), estadoFisico: fd.get('estadoFisico') || '',
      ubicacion: String(fd.get('ubicacion') || '').trim(), actualizarUbicacion: !!fd.get('actualizarUbicacion'),
      usuarioEncontrado: String(fd.get('usuarioEncontrado') || '').trim(), observaciones: String(fd.get('observaciones') || '').trim(), idLocal: L.uuid()
    };
    var desde = form.getAttribute('data-desde') === '1';
    var btn = $('button[type=submit]', form); btn.disabled = true;
    try {
      var r = await Api.llamar('revision_guardar', datos);
      toast(r.mensaje, 'ok');
      S.alCerrarHoja = function () { if (desde && S.escaner) S.escaner.reanudar(); };
      cerrarHoja(); refrescarResumen();
    } catch (e) {
      if (L.esReintentable(e.codigo)) {
        var n = S.cola.agregar({ id: datos.idLocal, accion: 'revision_guardar', datos: datos, creado: new Date().toISOString(), etiqueta: datos.idActivo });
        toast('Sin conexión con el servidor: la revisión quedó guardada en el celular (' + n + ' por enviar).', '', 5500);
        S.alCerrarHoja = function () { if (desde && S.escaner) S.escaner.reanudar(); };
        cerrarHoja(); actualizarEstado();
      } else { btn.disabled = false; toast(e.message, 'err'); }
    }
  }

  async function procesarCola() {
    if (S.procesando || !S.sesion) return;
    var items = S.cola.todo(); if (!items.length) return;
    S.procesando = true; var enviados = 0, descartados = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      try { await Api.llamar(it.accion, it.datos); S.cola.quitar(it.id); enviados++; }
      catch (e) {
        if (L.esReintentable(e.codigo)) break;      // sigue sin señal: se reintenta luego
        S.cola.quitar(it.id); descartados.push(it.etiqueta + ': ' + e.message);
      }
    }
    S.procesando = false; actualizarEstado();
    if (enviados) { toast(enviados + ' revisión(es) enviada(s).', 'ok'); refrescarResumen(); }
    if (descartados.length) {
      try { localStorage.setItem('sgi_cola_descartes', JSON.stringify(descartados)); } catch (e) { }
      toast('El servidor rechazó ' + descartados.length + ' revisión(es): ' + descartados[0], 'err', 9000);
    }
    if (S.vista === 'inicio') vInicio();
  }

  /* ===================================================================================== BUSCAR */
  function vBuscar() {
    $('#vista').innerHTML = '<label class="campo"><span>Buscar equipo' + (esAdmin() ? ' o colaborador' : '') + '</span>' +
      '<input type="search" id="qBusq" value="' + esc(S.qBusq) + '" placeholder="INV-0114, serial, nombre, ubicación…" autocomplete="off"></label><div id="resBusq"></div>';
    if (S.qBusq) hacerBusqueda(S.qBusq);
    else $('#resBusq').innerHTML = '<p class="vacio">Escriba al menos 2 letras.</p>';
    var i = $('#qBusq'); if (i) i.focus();
  }
  var tBusq = null;
  async function hacerBusqueda(q) {
    var cont = $('#resBusq'); if (!cont) return;
    if (String(q).trim().length < 2) { cont.innerHTML = '<p class="vacio">Escriba al menos 2 letras.</p>'; return; }
    cont.innerHTML = '<div class="cargando">Buscando…</div>';
    try {
      var r = await Api.llamar('buscar', { q: q });
      if ($('#qBusq') && $('#qBusq').value !== q) return;      // llegó tarde
      var h = '';
      if (r.activos.length) h += '<div class="card"><h3>Equipos (' + r.activos.length + ')</h3><ul class="lista">' + r.activos.map(function (a) {
        return '<li><div class="it" data-act="abrir-activo" data-id="' + esc(a.id) + '"><b>' + esc(a.id) + ' · ' + esc(a.nombre) + '</b><small>' +
          esc([a.tipo, a.marca, a.modelo].filter(Boolean).join(' ')) + (a.ubicacion ? ' · ' + esc(a.ubicacion) : '') + (a.usuario ? ' · ' + esc(a.usuario) : '') + '</small></div>' + tagEstado(a.estado) + '</li>';
      }).join('') + '</ul></div>';
      if (r.colaboradores.length) h += '<div class="card"><h3>Colaboradores (' + r.colaboradores.length + ')</h3><ul class="lista">' + r.colaboradores.map(function (c) {
        return '<li><div class="it" data-act="abrir-col" data-nombre="' + esc(c.nombre) + '" data-doc="' + esc(c.documento) + '"><b>' + esc(c.nombre) + '</b><small>' +
          esc([c.cargo, c.area].filter(Boolean).join(' · ')) + '</small></div>' + tagEstado(c.estado) + '</li>';
      }).join('') + '</ul></div>';
      cont.innerHTML = h || '<p class="vacio">Sin resultados para "' + esc(q) + '".</p>';
    } catch (e) { cont.innerHTML = '<div class="aviso rojo">' + esc(e.message) + '</div>'; }
  }

  async function abrirColaborador(nombre, doc) {
    try {
      var d = await Api.llamar('colaborador', { nombre: nombre, documento: doc });
      var f = d.ficha;
      var html = '<div class="fila sep"><div><h2>' + esc(f.nombre) + '</h2><span class="muted">' + esc([f.cargo, f.area].filter(Boolean).join(' · ')) + '</span></div><button class="btn chico" data-cerrar-hoja>Cerrar</button></div>' +
        '<div class="card"><div class="grid2">' + dato('Documento', f.documento) + dato('Estado', f.estado) + dato('Jefe', f.jefe) + dato('Vínculo', f.vinculo) + dato('Correo', f.correo) + dato('Ingreso / retiro', [f.ingreso, f.retiro].filter(Boolean).join(' → ')) + '</div></div>' +
        '<div class="card"><h3>Equipos a su nombre (' + d.activos.length + ')</h3>' + (d.activos.length ? '<ul class="lista">' + d.activos.map(function (a) {
          return '<li><div class="it" data-act="abrir-activo" data-id="' + esc(a.id) + '"><b>' + esc(a.id) + ' · ' + esc(a.nombre) + '</b><small>' + esc(a.tipo) + (a.serial ? ' · ' + esc(a.serial) : '') + '</small></div>' + tagEstado(a.estado) + '</li>';
        }).join('') + '</ul>' : '<p class="muted">Ninguno.</p>') + '</div>' +
        '<div class="card"><h3>Accesos vigentes (' + d.accesos.length + ')</h3>' + (d.accesos.length ? '<ul class="lista">' + d.accesos.map(function (a) {
          return '<li><div class="it"><b>' + esc(a.aplicacion) + '</b><small>' + esc([a.rol, a.permisos, a.disponibilidad].filter(Boolean).join(' · ')) + '</small></div>' + (a.pendiente ? '<span class="tag ambar">Pendiente</span>' : '') + '</li>';
        }).join('') + '</ul>' : '<p class="muted">Ninguno registrado.</p>') + '</div>' +
        '<div class="fila"><button class="btn" style="flex:1" data-act="nov-desde-col" data-nombre="' + esc(f.nombre) + '">Novedad de accesos</button>' +
        '<button class="btn" style="flex:1" data-act="mov-desde-col" data-nombre="' + esc(f.nombre) + '">Entrega / devolución</button></div>';
      abrirHoja(html);
    } catch (e) { toast(e.message, 'err'); }
  }

  /* ================================================================================ FORMULARIOS */
  function vFormularios() {
    if (!esAdmin()) { irA('inicio'); return; }
    $('#vista').innerHTML = '<h2 style="margin-bottom:10px">Formularios</h2>' +
      '<button class="card btn bloque" style="display:block;text-align:left;min-height:0" data-nav="fmov"><h3>Entrega / devolución de equipo</h3><span class="muted">Movimientos de activos y acta firmable.</span></button>' +
      '<button class="card btn bloque" style="display:block;text-align:left;min-height:0" data-nav="fnov"><h3>Novedad de accesos</h3><span class="muted">Ingreso, retiro o cambio de accesos a aplicaciones.</span></button>' +
      '<button class="card btn bloque" style="display:block;text-align:left;min-height:0" data-nav="fact"><h3>Registrar / editar activo</h3><span class="muted">Alta de un equipo o corrección de sus datos.</span></button>';
  }

  function colabPorNombre(n) {
    var x = L.norm(n);
    return ((S.boot && S.boot.colaboradores) || []).filter(function (c) { return L.norm(c.nombre) === x; })[0] || null;
  }
  function activoBoot(id) { return ((S.boot && S.boot.activos) || []).filter(function (a) { return a.id === id; })[0] || null; }
  function dlColaboradores() {
    return '<datalist id="dlCol">' + ((S.boot && S.boot.colaboradores) || []).map(function (c) {
      return '<option value="' + esc(c.nombre) + '">' + esc(c.documento + (c.estado ? ' · ' + c.estado : '')) + '</option>';
    }).join('') + '</datalist>';
  }

  /* ---- Movimiento ---- */
  function nuevoMov() { return { tipo: '', usuario: '', documento: '', cargo: '', area: '', jefe: '', fecha: L.hoy(), estadoFisico: '', observaciones: '', activos: [], generarActa: true }; }
  function vMovimiento(prefill) {
    if (!esAdmin()) return;
    if (prefill === 'nuevo') S.fm = nuevoMov();
    var f = S.fm = S.fm || nuevoMov(); var ls = listas();
    if (prefill && typeof prefill === 'object') {
      if (prefill.activo && f.activos.indexOf(prefill.activo) < 0) f.activos.push(prefill.activo);
      if (prefill.usuario) { f.usuario = prefill.usuario; aplicarColabMov(f); }
    }
    $('#vista').innerHTML = '<button class="atras" data-nav="formularios">← Formularios</button><h2>Entrega / devolución de equipo</h2>' +
      '<form id="frmMov" class="card" style="margin-top:10px" novalidate>' +
      '<label class="campo"><span>Tipo de movimiento *</span><select data-f="fm.tipo">' + opciones(ls.tipoMovimiento, f.tipo) + '</select></label>' +
      '<label class="campo"><span>Colaborador *</span><input type="text" data-f="fm.usuario" data-col="mov" list="dlCol" value="' + esc(f.usuario) + '" autocomplete="off"></label>' + dlColaboradores() +
      '<div id="infoColMov">' + infoColMov(f) + '</div>' +
      '<label class="campo"><span>Fecha</span><input type="date" data-f="fm.fecha" value="' + esc(f.fecha) + '"></label>' +
      '<label class="campo"><span>Estado físico</span><select data-f="fm.estadoFisico">' + opciones(ls.estadoFisico, f.estadoFisico) + '</select></label>' +
      '<div><span class="mini">Activos *</span><div class="chips" id="chipsMov">' + chipsMov(f) + '</div>' +
      '<div class="fila"><button type="button" class="btn chico" data-act="mov-escanear">＋ Escanear QR</button><button type="button" class="btn chico" data-act="mov-buscar">＋ Buscar</button></div>' +
      '<div id="sugMov"></div></div>' +
      '<label class="campo" style="margin-top:12px"><span>Observaciones</span><textarea data-f="fm.observaciones">' + esc(f.observaciones) + '</textarea></label>' +
      '<label class="check"><input type="checkbox" data-f="fm.generarActa"' + (f.generarActa ? ' checked' : '') + '> Generar acta (PDF) y guardarla en Drive</label>' +
      '<button class="btn primario bloque" type="submit" style="margin-top:8px">Registrar movimiento</button></form>';
  }
  function aplicarColabMov(f) {
    var c = colabPorNombre(f.usuario);
    if (c) { f.usuario = c.nombre; f.documento = c.documento; f.cargo = c.cargo || ''; f.area = c.area || ''; f.jefe = c.jefe || ''; }
    else { f.documento = ''; f.cargo = ''; f.area = ''; f.jefe = ''; }
    return c;
  }
  function infoColMov(f) {
    if (!f.usuario) return '';
    if (!f.documento) return '<div class="aviso ambar">No está en COLABORADORES. Si es un ingreso nuevo, primero decida su respuesta en la pestaña GH.</div>';
    return '<div class="aviso verde">' + esc(f.documento) + ' · ' + esc([f.cargo, f.area].filter(Boolean).join(' · ')) + (f.jefe ? ' · Jefe: ' + esc(f.jefe) : '') + '</div>';
  }
  function chipsMov(f) {
    if (!f.activos.length) return '<span class="muted">Ninguno todavía.</span>';
    return f.activos.map(function (id) {
      var a = activoBoot(id);
      return '<span class="chipx">' + esc(id + (a ? ' · ' + a.nombre : '')) + '<button type="button" data-act="mov-quitar" data-id="' + esc(id) + '" aria-label="Quitar ' + esc(id) + '">×</button></span>';
    }).join('');
  }
  function refrescarChipsMov() { var c = $('#chipsMov'); if (c) c.innerHTML = chipsMov(S.fm); }
  async function agregarActivoMov(texto) {
    try {
      var d = await Api.llamar('activo', { texto: texto });
      var id = d.activo.ID_ACTIVO;
      if (S.fm.activos.indexOf(id) >= 0) { toast(id + ' ya está en la lista.'); return; }
      S.fm.activos.push(id);
      if (!activoBoot(id) && S.boot) S.boot.activos.push({ id: id, nombre: d.activo.NOMBRE_EQUIPO, tipo: d.activo.TIPO, estado: d.activo.ESTADO });
      refrescarChipsMov(); toast(id + ' agregado.', 'ok', 1500);
    } catch (e) { toast(e.message, 'err'); }
  }
  async function enviarMovimiento() {
    var f = S.fm, err = L.validarMovimiento(f);
    if (err.length) { toast(err[0], 'err'); return; }
    var ok = await confirmar('Confirmar movimiento',
      '<p><b>' + esc(f.tipo) + '</b> de ' + f.activos.length + ' activo(s) a <b>' + esc(f.usuario) + '</b>.</p><p class="mini">' + esc(f.activos.join(', ')) + '</p>' +
      (f.generarActa ? '<p class="mini">Se generará el acta (PDF)' + ' y, si CONFIG lo indica, se enviará por correo.</p>' : '<p class="mini">No se generará acta.</p>'), 'Registrar');
    if (!ok) return;
    cerrarHoja();
    cargando('Registrando… (si genera acta puede tardar unos segundos)');
    try {
      var r = await Api.llamar('movimiento_guardar', { p: L.armarMovimiento(f) });
      S.fm = null; await cargarDatos();
      mostrarResultado('Movimiento registrado', r.mensaje, r.url, 'fmov');
    } catch (e) { mostrarFalloEscritura(e, 'fmov'); }
  }

  /* ---- Resultado y fallos de escritura (sin reintento automático: evita duplicar movimientos o novedades) ---- */
  function mostrarResultado(titulo, mensaje, url, volverA) {
    var u = urlSegura(url);
    $('#vista').innerHTML = '<div class="card"><h2>' + esc(titulo) + '</h2><p>' + esc(mensaje) + '</p>' +
      (u ? '<a class="btn primario bloque" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">Abrir acta (PDF)</a>' : '') +
      '<button class="btn bloque" style="margin-top:8px" data-nav="' + esc(volverA) + '">Registrar otro</button>' +
      '<button class="btn bloque" style="margin-top:8px" data-nav="inicio">Ir al inicio</button></div>';
  }
  function mostrarFalloEscritura(e, volverA) {
    var incierto = (e.codigo === 'red' || e.codigo === 'timeout');
    $('#vista').innerHTML = '<div class="card"><h2>No se pudo completar</h2><div class="aviso rojo">' + esc(e.message) + '</div>' +
      (incierto ? '<p>No se sabe si el sistema alcanzó a guardarlo. <b>Antes de reintentar, búsquelo</b> (pestaña Buscar o revise el libro) para no duplicarlo.</p>' : '<p>No se guardó nada. Corrija y vuelva a intentarlo.</p>') +
      '<button class="btn primario bloque" data-nav="' + esc(volverA) + '">Volver al formulario</button></div>';
  }

  /* ---- Novedad de accesos ---- */
  function nuevaNov() { return { usuario: '', proceso: '', fecha: L.hoy(), generarActa: true, lineas: [], existe: null, nuevo: { documento: '', cargo: '', area: '', jefe: '', correo: '', vinculo: '' } }; }
  function vNovedad(prefill) {
    if (!esAdmin()) return;
    if (prefill === 'nuevo') S.fn = nuevaNov();
    var f = S.fn = S.fn || nuevaNov(); var ls = listas();
    if (prefill && typeof prefill === 'object') {
      if (prefill.usuario) { f.usuario = prefill.usuario; f.existe = colabPorNombre(f.usuario); }
      if (prefill.proceso) f.proceso = prefill.proceso;
    }
    $('#vista').innerHTML = '<button class="atras" data-nav="formularios">← Formularios</button><h2>Novedad de accesos</h2>' +
      '<form id="frmNov" class="card" style="margin-top:10px" novalidate>' +
      '<label class="campo"><span>Proceso *</span><select data-f="fn.proceso" data-reproc="1">' + opciones(ls.proceso, f.proceso) + '</select></label>' +
      '<label class="campo"><span>Colaborador *</span><input type="text" data-f="fn.usuario" data-col="nov" list="dlCol" value="' + esc(f.usuario) + '" autocomplete="off"></label>' + dlColaboradores() +
      '<div id="bloqueCol">' + bloqueColaborador(f) + '</div>' +
      '<label class="campo"><span>Fecha</span><input type="date" data-f="fn.fecha" value="' + esc(f.fecha) + '"></label>' +
      '<h3 style="margin:6px 0">Aplicaciones</h3><div id="lineasNov">' + lineasNov(f) + '</div>' +
      '<div class="fila"><button type="button" class="btn chico" data-act="nov-agregar-app">＋ Agregar aplicación</button>' +
      '<button type="button" class="btn chico" data-act="nov-cargar-vigentes">Cargar accesos vigentes</button></div>' +
      '<label class="check" style="margin-top:10px"><input type="checkbox" data-f="fn.generarActa"' + (f.generarActa ? ' checked' : '') + '> Generar acta (PDF) y guardarla en Drive</label>' +
      '<button class="btn primario bloque" type="submit" style="margin-top:8px">Registrar novedad</button></form>';
  }
  function bloqueColaborador(f) {
    if (!f.usuario) return '';
    if (f.existe) return '<div class="aviso verde">' + esc(f.existe.documento) + ' · ' + esc([f.existe.cargo, f.existe.area].filter(Boolean).join(' · ')) + ' · ' + esc(f.existe.estado || '') + '</div>';
    var n = f.nuevo, ls = listas();
    return '<div class="aviso ambar">No está en COLABORADORES. Se creará su ficha si el proceso es Ingreso. Complete sus datos:</div>' +
      '<label class="campo"><span>Documento *</span><input type="text" inputmode="numeric" data-f="fn.nuevo.documento" value="' + esc(n.documento) + '"></label>' +
      '<label class="campo"><span>Cargo</span><input type="text" data-f="fn.nuevo.cargo" value="' + esc(n.cargo) + '"></label>' +
      '<label class="campo"><span>Área</span><select data-f="fn.nuevo.area">' + opciones(ls.area, n.area) + '</select></label>' +
      '<label class="campo"><span>Jefe inmediato</span><input type="text" data-f="fn.nuevo.jefe" list="dlCol" value="' + esc(n.jefe) + '"></label>' +
      '<label class="campo"><span>Correo corporativo</span><input type="email" data-f="fn.nuevo.correo" value="' + esc(n.correo) + '"></label>' +
      '<label class="campo"><span>Vínculo</span><select data-f="fn.nuevo.vinculo">' + opciones(ls.vinculo, n.vinculo) + '</select></label>';
  }
  function lineasNov(f) {
    if (!f.lineas.length) return '<p class="muted">Agregue las aplicaciones a activar, modificar o inactivar.</p>';
    var ls = listas();
    return f.lineas.map(function (l, i) {
      return '<div class="linea-app"><h3><span>' + esc(l.aplicacion) + '</span><button type="button" class="btn chico peligro" data-act="nov-quitar" data-i="' + i + '">Quitar</button></h3>' +
        '<div class="grid2"><label class="campo"><span>Acción *</span><select data-f="fn.lineas.' + i + '.accion">' + opciones(ls.accion, l.accion) + '</select></label>' +
        '<label class="campo"><span>Disponibilidad</span><select data-f="fn.lineas.' + i + '.disponibilidad">' + opciones(ls.disponibilidad, l.disponibilidad) + '</select></label>' +
        '<label class="campo"><span>Rol</span><select data-f="fn.lineas.' + i + '.rol">' + opciones(ls.rol, l.rol) + '</select></label>' +
        '<label class="campo"><span>Permisos</span><select data-f="fn.lineas.' + i + '.permisos">' + opciones(ls.permisos, l.permisos) + '</select></label></div>' +
        '<label class="check"><input type="checkbox" data-f="fn.lineas.' + i + '.ejecutado"' + (l.ejecutado ? ' checked' : '') + '> Ya ejecutado en la aplicación</label>' +
        '<label class="campo" style="margin:0"><span>Observación</span><input type="text" data-f="fn.lineas.' + i + '.observacion" value="' + esc(l.observacion || '') + '"></label></div>';
    }).join('');
  }
  function refrescarLineasNov() { var c = $('#lineasNov'); if (c) c.innerHTML = lineasNov(S.fn); }
  function accionPorDefecto() { return S.fn.proceso === 'Retiro' ? 'Inactivar' : 'Activar'; }
  function abrirSelectorApps() {
    var f = S.fn, ya = f.lineas.map(function (l) { return L.norm(l.aplicacion); });
    var apps = ((S.boot && S.boot.apps) || []).filter(function (a) { return ya.indexOf(L.norm(a.aplicacion)) < 0; });
    abrirHoja('<div class="fila sep"><h2>Agregar aplicación</h2><button class="btn chico" data-cerrar-hoja>Cerrar</button></div>' +
      '<label class="campo" style="margin-top:8px"><span>Filtrar</span><input type="search" id="qApp" autocomplete="off"></label><div class="sugerencias" id="listaApps">' + htmlApps(apps, '') + '</div>');
    S.appsDisp = apps;
  }
  function htmlApps(apps, q) {
    var x = L.norm(q);
    var l = apps.filter(function (a) { return !x || L.norm(a.aplicacion).indexOf(x) >= 0; });
    if (!l.length) return '<p class="vacio">Sin aplicaciones.</p>';
    return l.map(function (a) {
      return '<button type="button" data-act="nov-pick-app" data-app="' + esc(a.aplicacion) + '"><b>' + esc(a.aplicacion) + '</b><br><small class="muted">' +
        esc([a.rol, a.permisos, a.criticidad && ('Criticidad ' + a.criticidad)].filter(Boolean).join(' · ')) + '</small></button>';
    }).join('');
  }
  async function cargarVigentes() {
    var f = S.fn;
    if (!f.usuario) { toast('Primero indique el colaborador.', 'err'); return; }
    try {
      var v = await Api.llamar('accesos_vigentes', { nombre: f.usuario });
      if (!v.length) { toast('Esa persona no tiene accesos vigentes registrados.'); return; }
      var ya = f.lineas.map(function (l) { return L.norm(l.aplicacion); }), n = 0;
      v.forEach(function (a) {
        if (ya.indexOf(L.norm(a.aplicacion)) >= 0) return;
        f.lineas.push({ aplicacion: a.aplicacion, disponibilidad: a.disponibilidad, rol: a.rol, permisos: a.permisos, accion: f.proceso === 'Retiro' ? 'Inactivar' : 'Sin cambio', ejecutado: false, observacion: '' }); n++;
      });
      refrescarLineasNov(); toast(n + ' aplicación(es) cargada(s).', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  }
  async function enviarNovedad() {
    var f = S.fn, c = f.existe, n = f.nuevo;
    var plano = { usuario: f.usuario, proceso: f.proceso, lineas: f.lineas, nuevo: n, existe: c };
    var err = L.validarNovedad(plano);
    if (err.length) { toast(err[0], 'err'); return; }
    var datos = Object.assign({}, f, {
      documento: c ? c.documento : n.documento, cargo: c ? c.cargo : n.cargo, area: c ? c.area : n.area,
      jefe: c ? c.jefe : n.jefe, correo: c ? c.correo : n.correo, vinculo: c ? '' : n.vinculo
    });
    var ok = await confirmar('Confirmar novedad',
      '<p><b>' + esc(f.proceso) + '</b> · ' + esc(f.usuario) + '</p><ul class="lista">' + f.lineas.map(function (l) {
        return '<li><div class="it"><b>' + esc(l.aplicacion) + '</b><small>' + esc(l.accion) + (l.ejecutado ? ' · ejecutado' : ' · pendiente') + '</small></div></li>';
      }).join('') + '</ul>' + (f.proceso === 'Retiro' ? '<p class="aviso ambar">Un retiro marca a la persona como Retirada en COLABORADORES.</p>' : ''), 'Registrar');
    if (!ok) return;
    cerrarHoja();
    cargando('Registrando… (si genera acta puede tardar unos segundos)');
    try {
      var r = await Api.llamar('novedad_guardar', { p: L.armarNovedad(datos) });
      S.fn = null; await cargarDatos();
      mostrarResultado('Novedad registrada', r.mensaje, r.url, 'fnov');
    } catch (e) { mostrarFalloEscritura(e, 'fnov'); }
  }

  /* ---- Activo (alta / edición) ---- */
  var CAMPOS_ACTIVO = ['ID_ACTIVO', 'TIPO', 'NOMBRE_EQUIPO', 'MARCA', 'MODELO', 'SERIAL', 'ESTADO', 'UBICACION', 'AREA', 'CLASIFICACION_INFO', 'CIFRADO', 'ANTIVIRUS_ACTIVO', 'OBSERVACIONES'];
  function nuevoAct() { var o = {}; CAMPOS_ACTIVO.forEach(function (k) { o[k] = ''; }); return o; }
  function vActivoForm(prefill) {
    if (!esAdmin()) return;
    if (prefill === 'nuevo') S.fa = nuevoAct();
    var f = S.fa = S.fa || nuevoAct(); var ls = listas(), ub = (S.boot && S.boot.ubicaciones) || [];
    if (prefill && typeof prefill === 'object' && prefill.activo) {
      S.fa = f = nuevoAct(); CAMPOS_ACTIVO.forEach(function (k) { f[k] = prefill.activo[k] || ''; });
    }
    var editando = !!f.ID_ACTIVO;
    var tx = function (k, et, extra) { return '<label class="campo"><span>' + et + '</span><input type="text" data-f="fa.' + k + '" value="' + esc(f[k]) + '" ' + (extra || '') + ' autocomplete="off"></label>'; };
    var se = function (k, et, lista) { return '<label class="campo"><span>' + et + '</span><select data-f="fa.' + k + '">' + opciones(lista, f[k]) + '</select></label>'; };
    $('#vista').innerHTML = '<button class="atras" data-nav="formularios">← Formularios</button><h2>' + (editando ? 'Editar ' + esc(f.ID_ACTIVO) : 'Registrar activo') + '</h2>' +
      (editando ? '<button class="btn chico" data-act="act-nuevo" style="margin:6px 0">Empezar uno nuevo</button>' :
        '<label class="campo" style="margin-top:8px"><span>¿Corregir uno existente? Busque por ID, serial o nombre</span><input type="search" id="qActEd" autocomplete="off"></label><div id="sugActEd"></div>') +
      '<form id="frmAct" class="card" novalidate style="margin-top:8px">' +
      se('TIPO', 'Tipo *', ls.tipoActivo) + tx('NOMBRE_EQUIPO', 'Nombre del equipo *') + tx('MARCA', 'Marca') + tx('MODELO', 'Modelo') + tx('SERIAL', 'Serial') +
      se('ESTADO', 'Estado', ls.estadoActivo) + tx('UBICACION', 'Ubicación', 'list="dlUbicAct"') + '<datalist id="dlUbicAct">' + ub.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>' +
      se('AREA', 'Área', ls.area) + se('CLASIFICACION_INFO', 'Clasificación de la información', ls.clasificacion) + se('CIFRADO', 'Cifrado de disco', ls.siNo) + se('ANTIVIRUS_ACTIVO', 'Antivirus activo', ls.siNo) +
      '<label class="campo"><span>Observaciones</span><textarea data-f="fa.OBSERVACIONES">' + esc(f.OBSERVACIONES) + '</textarea></label>' +
      '<p class="mini">La asignación a una persona se hace con "Entrega / devolución", no desde aquí.</p>' +
      '<button class="btn primario bloque" type="submit">' + (editando ? 'Guardar cambios' : 'Registrar activo') + '</button></form>';
  }
  async function enviarActivo() {
    var f = S.fa;
    if (!f.TIPO || !String(f.NOMBRE_EQUIPO).trim()) { toast('Tipo y nombre del equipo son obligatorios.', 'err'); return; }
    var p = {}; CAMPOS_ACTIVO.forEach(function (k) { var v = String(f[k] || '').trim(); if (v || k === 'ID_ACTIVO') p[k] = v; });
    if (!p.ID_ACTIVO) delete p.ID_ACTIVO;
    var ok = await confirmar(f.ID_ACTIVO ? 'Guardar cambios' : 'Registrar activo', '<p><b>' + esc(f.NOMBRE_EQUIPO) + '</b> · ' + esc(f.TIPO) + (f.SERIAL ? ' · ' + esc(f.SERIAL) : '') + '</p>', 'Guardar');
    if (!ok) return;
    cerrarHoja(); cargando('Guardando…');
    try {
      var r = await Api.llamar('activo_guardar', { activo: p });
      S.fa = null; await cargarDatos();
      mostrarResultado('Listo', r.mensaje, '', 'fact');
    } catch (e) { mostrarFalloEscritura(e, 'fact'); }
  }

  /* ========================================================================== RESPUESTAS DE GH */
  async function vGh(forzar) {
    if (!esAdmin()) { irA('inicio'); return; }
    cargando('Cargando respuestas del formulario…');
    try { S.gh = await Api.llamar('gh_pendientes'); } catch (e) { $('#vista').innerHTML = '<div class="aviso rojo">' + esc(e.message) + '</div>'; return; }
    pintarGh();
  }
  function pintarGh() {
    var g = S.gh;
    var html = '<div class="fila sep"><h2>Respuestas de Gestión Humana</h2><button class="btn chico" data-act="gh-recargar">Actualizar</button></div>' +
      '<p class="muted">' + g.pendientes + ' pendiente(s) de ' + g.totalRespuestas + ' respuestas.</p>';
    if (!g.items.length) html += '<div class="card vacio">No hay respuestas por revisar. ✔</div>';
    g.items.forEach(function (it, i) {
      var colorTipo = L.norm(it.tipo).indexOf('retiro') >= 0 ? ' rojo' : (L.norm(it.tipo).indexOf('ingreso') >= 0 ? '' : ' ambar');
      html += '<div class="card"><div class="fila sep"><h3>' + esc(it.nombre) + '</h3><span class="tag' + colorTipo + '">' + esc(it.tipo) + '</span></div>' +
        '<div class="grid2">' + dato('Documento', it.documento) + dato('Fecha efectiva', it.fecha) + dato('Cargo', it.cargo) + dato('Área', it.area) + dato('Jefe', it.jefe || it.jefeFormulario) + dato('Vínculo', it.vinculo) + '</div>' +
        (it.herramientas ? '<p class="mini">Herramientas: ' + esc(it.herramientas) + '</p>' : '') +
        (it.observaciones ? '<p class="mini">Obs.: ' + esc(it.observaciones) + '</p>' : '') +
        (it.avisos || []).map(function (a) { return '<div class="aviso rojo">' + esc(a) + '</div>'; }).join('') +
        (it.cambios && it.cambios.length ? '<div class="aviso ambar"><b>Cambios:</b><br>' + it.cambios.map(esc).join('<br>') + '</div>' : '') +
        '<p class="mini">Hoy tiene ' + (it.activos || []).length + ' equipo(s) y ' + (it.accesos || []).length + ' acceso(s)' + (it.sugerida ? ' · sugerencia: <b>' + esc(it.sugerida) + '</b>' : '') + '</p>' +
        '<button class="btn primario bloque" data-act="gh-decidir" data-i="' + i + '">Decidir</button></div>';
    });
    $('#vista').innerHTML = html;
  }
  function abrirDecisionGh(i) {
    var it = S.gh.items[i]; if (!it) return;
    var ls = S.gh.listas, permitidas = ['AGREGAR', 'COMPLETAR', 'ACTUALIZAR', 'YA_EXISTE', 'DESCARTAR'].filter(function (d) {
      if (d === 'COMPLETAR') return !!it.fichaSinDoc;
      if (d === 'ACTUALIZAR') return !!it.existe;
      if (d === 'AGREGAR') return !it.existe;
      return true;
    });
    var def = permitidas.indexOf(it.sugerida) >= 0 ? it.sugerida : permitidas[0];
    var etiquetas = { AGREGAR: 'Agregar como nuevo colaborador', COMPLETAR: 'Completar ficha sin documento', ACTUALIZAR: 'Actualizar ficha existente', YA_EXISTE: 'Ya existe (solo marcar revisada)', DESCARTAR: 'Descartar' };
    abrirHoja('<div class="fila sep"><h2>' + esc(it.nombre) + '</h2><button class="btn chico" data-cerrar-hoja>Cerrar</button></div><p class="muted">' + esc(it.tipo) + ' · ' + esc(it.documento) + '</p>' +
      (it.existe ? '<div class="aviso verde">Ficha existente: ' + esc(it.existe.nombre) + ' (' + esc(it.existe.estado) + ')</div>' : '') +
      (it.fichaSinDoc ? '<div class="aviso ambar">Hay una ficha sin documento: ' + esc(it.fichaSinDoc.nombre) + '</div>' : '') +
      '<form id="frmGh" data-i="' + i + '"><label class="campo"><span>Decisión</span><select name="decision">' +
      permitidas.map(function (d) { return '<option value="' + d + '"' + (d === def ? ' selected' : '') + '>' + esc(etiquetas[d]) + '</option>'; }).join('') + '</select></label>' +
      '<label class="campo"><span>Cargo</span><input type="text" name="cargo" value="' + esc(it.cargo) + '"></label>' +
      '<label class="campo"><span>Área</span><select name="area">' + opciones(ls.areas, it.area) + '</select></label>' +
      '<label class="campo"><span>Jefe inmediato</span><select name="jefe">' + opciones(ls.jefes, it.jefe || it.jefeFormulario) + '</select></label>' +
      '<label class="campo"><span>Vínculo</span><select name="vinculo">' + opciones(ls.vinculos, it.vinculo) + '</select></label>' +
      '<label class="campo"><span>Correo corporativo</span><input type="email" name="correo" value="' + esc(it.correo) + '"></label>' +
      '<button class="btn primario bloque" type="submit">Aplicar decisión</button></form>' +
      (L.norm(it.tipo).indexOf('retiro') >= 0 ? '<button class="btn bloque" style="margin-top:8px" data-act="nov-desde-col" data-nombre="' + esc(it.nombre) + '" data-proceso="Retiro">Registrar el retiro (novedad de accesos)</button>' : ''));
  }
  async function enviarDecisionGh(form) {
    var it = S.gh.items[Number(form.getAttribute('data-i'))], fd = new FormData(form);
    var e = { decision: fd.get('decision'), cargo: String(fd.get('cargo') || '').trim(), area: fd.get('area') || '', jefe: fd.get('jefe') || '', vinculo: fd.get('vinculo') || '', correo: String(fd.get('correo') || '').trim() };
    var err = L.validarDecision(e); if (err.length) { toast(err[0], 'err'); return; }
    var btn = $('button[type=submit]', form); btn.disabled = true;
    try {
      var r = await Api.llamar('gh_decidir', { decisiones: [L.armarDecision(it, e)] });
      if (r.errores && r.errores.length) { btn.disabled = false; toast(r.errores[0], 'err', 9000); return; }
      cerrarHoja(); toast('Decisión aplicada: ' + e.decision + '.', 'ok');
      vGh();
    } catch (x) { btn.disabled = false; toast(x.message + (x.codigo === 'red' || x.codigo === 'timeout' ? ' Verifique si quedó aplicada antes de repetir.' : ''), 'err', 9000); }
  }

  /* ============================================================================ SESIÓN / LOGIN */
  function mostrarLogin(msg) {
    $('#login').hidden = false;
    if (msg) $('#loginMsg').textContent = msg;
    $('#loginAyuda').textContent = DEMO ? '' : 'Solo cuentas @' + (CFG.DOMINIO || '') + ' autorizadas.';
  }
  function ocultarLogin() { $('#login').hidden = true; }

  var renovacionT = null;
  function programarRenovacion() {
    var p = L.leerJwt(Api.token); if (!p || !p.exp) return;
    clearTimeout(renovacionT);
    var ms = Math.max(15000, p.exp * 1000 - Date.now() - 5 * 60 * 1000);
    renovacionT = setTimeout(function () { try { window.google.accounts.id.prompt(); } catch (e) { } }, ms);
  }
  function alCredencial(resp) {
    if (!resp || !resp.credential) return;
    Api.token = resp.credential;
    try { sessionStorage.setItem('sgi_token', resp.credential); } catch (e) { }
    programarRenovacion(); ocultarLogin();
    if (S.esperandoLogin) { var f = S.esperandoLogin; S.esperandoLogin = null; f(); }
    else if (!S.sesion) entrar();
  }
  Api.reautenticar = function () {
    return new Promise(function (res) {
      S.esperandoLogin = res;
      try { window.google.accounts.id.prompt(); } catch (e) { }
      setTimeout(function () { if (S.esperandoLogin) mostrarLogin('La sesión venció. Inicie sesión de nuevo para continuar.'); }, 1500);
    });
  };
  function iniciarGoogle(intentos) {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.initialize({ client_id: CFG.CLIENT_ID, callback: alCredencial, auto_select: true, hd: CFG.DOMINIO, cancel_on_tap_outside: false, itp_support: true });
      window.google.accounts.id.renderButton($('#gbtn'), { type: 'standard', theme: 'filled_blue', size: 'large', text: 'signin_with', shape: 'pill', locale: 'es', width: 260 });
      return;
    }
    if ((intentos || 0) > 40) { $('#loginAyuda').textContent = 'No se pudo cargar el inicio de sesión de Google. Revise la conexión.'; return; }
    setTimeout(function () { iniciarGoogle((intentos || 0) + 1); }, 300);
  }

  async function entrar() {
    cargando('Entrando…');
    try {
      S.sesion = await Api.llamar('sesion');
    } catch (e) {
      S.sesion = null;
      if (e.codigo === 'sin_permiso' || e.codigo === 'sin_configurar') {
        $('#vista').innerHTML = '<div class="card"><h2>No se puede entrar</h2><div class="aviso rojo">' + esc(e.message) + '</div><button class="btn bloque" data-act="salir">Usar otra cuenta</button></div>';
        return;
      }
      if (e.codigo === 'no_autenticado') { mostrarLogin('Inicie sesión para continuar.'); return; }
      $('#vista').innerHTML = '<div class="card"><h2>Sin conexión con el sistema</h2><div class="aviso rojo">' + esc(e.message) + '</div><button class="btn primario bloque" data-act="reintentar-entrar">Reintentar</button></div>';
      return;
    }
    try { await cargarDatos(); } catch (e) { $('#vista').innerHTML = '<div class="aviso rojo">' + esc(e.message) + '</div>'; return; }
    var chip = $('#btnUsuario'); chip.hidden = false; chip.textContent = nombreCorto(S.sesion.nombre) + ' · ' + S.sesion.rol;
    $('#titulo').textContent = 'SGI Oviedo';
    montarNav(); actualizarEstado(); irA('inicio'); procesarCola();
  }
  function salir() {
    try { window.google.accounts.id.disableAutoSelect(); } catch (e) { }
    try { sessionStorage.removeItem('sgi_token'); } catch (e) { }
    Api.token = ''; S.sesion = null; location.reload();
  }
  function abrirUsuario() {
    if (!S.sesion) return;
    abrirHoja('<div class="fila sep"><h2>Mi sesión</h2><button class="btn chico" data-cerrar-hoja>Cerrar</button></div>' +
      '<div class="card"><div class="grid2">' + dato('Nombre', S.sesion.nombre) + dato('Rol', S.sesion.rol) + dato('Cuenta', S.sesion.correo) + dato('Versión', S.sesion.version) + '</div></div>' +
      '<button class="btn bloque" data-act="recargar-datos">Actualizar datos del sistema</button>' +
      '<button class="btn peligro bloque" style="margin-top:8px" data-act="salir">Cerrar sesión</button>');
  }

  /* ======================================================================================== eventos */
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-act],[data-nav],[data-cerrar-hoja]'); if (!t) return;
    if (t.hasAttribute('data-cerrar-hoja')) { cerrarHoja(); return; }
    if (t.hasAttribute('data-nav')) { var v = t.getAttribute('data-nav'); if (v === 'fmov') S.fm = S.fm; irA(v); return; }
    var a = t.getAttribute('data-act'), id = t.getAttribute('data-id');
    switch (a) {
      case 'ver-pendientes': S.qPend = ''; irA('pendientes'); break;
      case 'reintentar-cola': procesarCola(); break;
      case 'abrir-activo': cerrarHojaSiAbierta(function () { abrirActivo(id); }); break;
      case 'abrir-col': abrirColaborador(t.getAttribute('data-nombre'), t.getAttribute('data-doc')); break;
      case 'luz': if (S.escaner) S.escaner.linterna(!S.luz).then(function (v) { S.luz = v; }).catch(function (e) { toast(e.message, 'err'); }); break;
      case 'foto': $('#fotoQR').click(); break;
      case 'conf-si': if (S.confirmacion) { var f1 = S.confirmacion; S.confirmacion = null; S.alCerrarHoja = null; f1(true); } break;
      case 'conf-no': if (S.confirmacion) { var f0 = S.confirmacion; S.confirmacion = null; f0(false); } cerrarHoja(); break;
      case 'mov-desde-activo': cerrarHojaSiAbierta(function () { S.fm = S.fm || nuevoMov(); irA('fmov', { activo: id }); }); break;
      case 'editar-activo': cerrarHojaSiAbierta(function () { S.fa = null; irA('fact', { activo: S.activoSel && S.activoSel.activo }); }); break;
      case 'mov-desde-col': cerrarHojaSiAbierta(function () { irA('fmov', { usuario: t.getAttribute('data-nombre') }); }); break;
      case 'nov-desde-col': cerrarHojaSiAbierta(function () { irA('fnov', { usuario: t.getAttribute('data-nombre'), proceso: t.getAttribute('data-proceso') || '' }); }); break;
      case 'mov-escanear': capturarCodigo().then(function (txt) { if (txt) agregarActivoMov(txt); }); break;
      case 'mov-buscar': $('#sugMov').innerHTML = '<input type="search" id="qMovAct" placeholder="ID, serial o nombre" autocomplete="off" style="margin-top:6px"><div class="sugerencias" id="resMovAct" hidden></div>'; $('#qMovAct').focus(); break;
      case 'mov-pick': agregarActivoMov(id); $('#sugMov').innerHTML = ''; break;
      case 'mov-quitar': S.fm.activos = S.fm.activos.filter(function (x) { return x !== id; }); refrescarChipsMov(); break;
      case 'nov-agregar-app': abrirSelectorApps(); break;
      case 'nov-pick-app':
        var app = ((S.boot && S.boot.apps) || []).filter(function (x) { return x.aplicacion === t.getAttribute('data-app'); })[0];
        if (app) { S.fn.lineas.push({ aplicacion: app.aplicacion, disponibilidad: app.disponibilidad || '', rol: app.rol || '', permisos: app.permisos || '', accion: accionPorDefecto(), ejecutado: false, observacion: '' }); }
        cerrarHoja(); refrescarLineasNov(); break;
      case 'nov-quitar': S.fn.lineas.splice(Number(t.getAttribute('data-i')), 1); refrescarLineasNov(); break;
      case 'nov-cargar-vigentes': cargarVigentes(); break;
      case 'act-nuevo': S.fa = nuevoAct(); vActivoForm(); break;
      case 'act-pick': cerrarHojaSiAbierta(null); Api.llamar('activo', { texto: id }).then(function (d) { vActivoForm({ activo: d.activo }); }).catch(function (e) { toast(e.message, 'err'); }); break;
      case 'gh-recargar': vGh(); break;
      case 'gh-decidir': abrirDecisionGh(Number(t.getAttribute('data-i'))); break;
      case 'salir': salir(); break;
      case 'reintentar-entrar': entrar(); break;
      case 'recargar-datos': cerrarHoja(); cargando(); cargarDatos().then(function () { irA(S.vista); toast('Datos actualizados.', 'ok'); }).catch(function (e) { toast(e.message, 'err'); }); break;
    }
  });
  function cerrarHojaSiAbierta(luego) {
    if (S.hojaAbierta) { S.alCerrarHoja = null; var h = $('#hoja'); S.hojaAbierta = false; h.hidden = true; $('#hojaCont').innerHTML = ''; try { if (history.state && history.state.h) { S.ignorarPop = (S.ignorarPop || 0) + 1; history.back(); } } catch (e) { } }
    if (luego) setTimeout(luego, 0);
  }

  $('#btnUsuario').addEventListener('click', abrirUsuario);

  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.id === 'qPend') { S.qPend = t.value; clearTimeout(tBusq); tBusq = setTimeout(vPendientes, 200); return; }
    if (t.id === 'qBusq') { S.qBusq = t.value; clearTimeout(tBusq); tBusq = setTimeout(function () { hacerBusqueda(S.qBusq); }, 380); return; }
    if (t.id === 'qApp') { var l = $('#listaApps'); if (l) l.innerHTML = htmlApps(S.appsDisp || [], t.value); return; }
    if (t.id === 'qMovAct') {
      var r = $('#resMovAct'), q = L.norm(t.value);
      if (q.length < 2) { r.hidden = true; return; }
      var c = ((S.boot && S.boot.activos) || []).filter(function (a) { return L.norm([a.id, a.nombre, a.serial, a.usuario, a.tipo].join(' ')).indexOf(q) >= 0; }).slice(0, 8);
      r.hidden = false;
      r.innerHTML = c.length ? c.map(function (a) { return '<button type="button" data-act="mov-pick" data-id="' + esc(a.id) + '"><b>' + esc(a.id + ' · ' + a.nombre) + '</b><br><small class="muted">' + esc((a.estado || '') + (a.usuario ? ' · ' + a.usuario : '')) + '</small></button>'; }).join('') : '<p class="vacio">Sin coincidencias.</p>';
      return;
    }
    if (t.id === 'qActEd') {
      var sg = $('#sugActEd'), q2 = L.norm(t.value);
      if (q2.length < 2) { sg.innerHTML = ''; return; }
      var c2 = ((S.boot && S.boot.activos) || []).filter(function (a) { return L.norm([a.id, a.nombre, a.serial].join(' ')).indexOf(q2) >= 0; }).slice(0, 8);
      sg.innerHTML = '<div class="sugerencias">' + c2.map(function (a) { return '<button type="button" data-act="act-pick" data-id="' + esc(a.id) + '"><b>' + esc(a.id + ' · ' + a.nombre) + '</b></button>'; }).join('') + '</div>';
      return;
    }
    if (t.name === 'ubicacion' && t.hasAttribute('data-orig')) {
      var chk = $('input[name=actualizarUbicacion]'); if (chk) chk.checked = t.value.trim() !== t.getAttribute('data-orig');
      return;
    }
    var ruta = t.getAttribute && t.getAttribute('data-f');
    if (ruta) setPath(S, ruta, t.type === 'checkbox' ? t.checked : t.value);
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target, ruta = t.getAttribute && t.getAttribute('data-f');
    if (ruta) setPath(S, ruta, t.type === 'checkbox' ? t.checked : t.value);
    if (t.getAttribute && t.getAttribute('data-col') === 'mov') { aplicarColabMov(S.fm); var i = $('#infoColMov'); if (i) i.innerHTML = infoColMov(S.fm); }
    if (t.getAttribute && t.getAttribute('data-col') === 'nov') { S.fn.existe = colabPorNombre(S.fn.usuario); if (S.fn.existe) S.fn.usuario = S.fn.existe.nombre; var b = $('#bloqueCol'); if (b) b.innerHTML = bloqueColaborador(S.fn); }
    if (t.id === 'fotoQR' && t.files && t.files[0]) { leerFotoQR(t.files[0]); t.value = ''; }
    if (t.getAttribute && t.getAttribute('data-reproc')) {
      // Al cambiar el proceso, la acción por defecto de las líneas nuevas cambia; las ya puestas no se tocan.
    }
  });
  document.addEventListener('submit', function (ev) {
    var f = ev.target; ev.preventDefault();
    if (f.id === 'frmRev') guardarRevisionForm(f);
    else if (f.id === 'frmManual') { var v = $('#manual').value.trim(); if (v) abrirActivo(v, { desdeEscaner: true }); }
    else if (f.id === 'frmCaptura') { var c = $('#capManual').value.trim(); if (c && S.capturaFin) S.capturaFin(c); }
    else if (f.id === 'frmMov') enviarMovimiento();
    else if (f.id === 'frmNov') enviarNovedad();
    else if (f.id === 'frmAct') enviarActivo();
    else if (f.id === 'frmGh') enviarDecisionGh(f);
  });

  /* ========================================================================================= inicio */
  function registrarSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    navigator.serviceWorker.register('sw.js').catch(function () { });
  }
  function arrancar() {
    registrarSW(); actualizarEstado();
    if (DEMO) { Api.token = 'demo'; entrar(); return; }
    var t = null; try { t = sessionStorage.getItem('sgi_token'); } catch (e) { }
    var p = t && L.leerJwt(t);
    iniciarGoogle(0);
    if (p && p.exp * 1000 > Date.now() + 60000) { Api.token = t; programarRenovacion(); entrar(); }
    else mostrarLogin();
  }
  window.SGIApp = { S: S, irA: irA, abrirActivo: abrirActivo };   // para pruebas
  arrancar();
}());

/* SGI Oviedo móvil - MODO DEMOSTRACIÓN.
 * Datos inventados y en memoria: sirve para recorrer la app sin conexión al libro. No toca nada real.
 * Se activa con ?demo=1 (o automáticamente mientras config.js no tenga la URL de la API). */
(function () {
  'use strict';
  var rol = /[?&]rol=revisor/i.test(location.search) ? 'REVISOR' : 'ADMIN';
  var hoy = new Date(); var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var HOY = hoy.getFullYear() + '-' + p2(hoy.getMonth() + 1) + '-' + p2(hoy.getDate());
  var PERIODO = HOY.slice(0, 7);

  var activos = [
    ['INV-0001', 'Portátil', 'PC-ADM-01', 'Dell', 'Latitude 5420', 'SN-A1B2C3', 'Asignado', 'Laura Gómez', 'Administración', 'Oficina 2'],
    ['INV-0002', 'Portátil', 'PC-ADM-02', 'Lenovo', 'ThinkPad E14', 'SN-D4E5F6', 'Asignado', 'Mario Ríos', 'Contabilidad', 'Oficina 3'],
    ['INV-0003', 'Escritorio', 'PC-SIS-01', 'HP', 'ProDesk 400', 'SN-G7H8I9', 'Asignado', 'Coordinación de Sistemas', 'Sistemas', 'Cuarto de TI'],
    ['INV-0004', 'Impresora', 'IMP-ADM-01', 'Epson', 'L3250', 'SN-J1K2L3', 'Asignado', 'Administración', 'Administración', 'Oficina 2'],
    ['INV-0005', 'Teléfono IP', 'TEL-REC-01', 'Grandstream', 'GRP2602', 'SN-M4N5O6', 'Asignado', 'Recepción', 'Recepción', 'Recepción'],
    ['INV-0006', 'Portátil', 'PC-STK-01', 'Dell', 'Latitude 3420', 'SN-P7Q8R9', 'Disponible en stock', '', 'Sistemas', 'Cuarto de TI'],
    ['INV-0007', 'Radio', 'RAD-SEG-01', 'Motorola', 'T400', 'SN-S1T2U3', 'Asignado', 'Seguridad', 'Seguridad', 'Portería'],
    ['INV-0008', 'Tablet', 'TAB-MNT-01', 'Samsung', 'Tab A8', 'SN-V4W5X6', 'En reparación', '', 'Mantenimiento', 'Cuarto de TI']
  ].map(function (a) {
    return { ID_ACTIVO: a[0], TIPO: a[1], NOMBRE_EQUIPO: a[2], MARCA: a[3], MODELO: a[4], SERIAL: a[5], ESTADO: a[6],
             USUARIO_ASIGNADO: a[7], DOCUMENTO_USUARIO: a[7] ? '1000' + a[0].slice(-3) : '', AREA: a[8], UBICACION: a[9],
             ULTIMA_ACTUALIZACION: '2026-10-02', ACTUALIZADO_POR: 'sistemas@oviedo.com.co' };
  });
  var colaboradores = [
    { documento: '1000001', nombre: 'Laura Gómez', cargo: 'Asistente administrativa', area: 'Administración', jefe: 'Mauricio Núñez', correo: 'laura@demo.co', estado: 'Activo', vinculo: 'Directo' },
    { documento: '1000002', nombre: 'Mario Ríos', cargo: 'Contador', area: 'Contabilidad', jefe: 'Mauricio Núñez', correo: 'mario@demo.co', estado: 'Activo', vinculo: 'Directo' },
    { documento: '1000003', nombre: 'Sofía Mejía', cargo: 'Auxiliar de mercadeo', area: 'Mercadeo', jefe: 'Paula Aguirre', correo: 'sofia@demo.co', estado: 'Pendiente de ingreso', vinculo: 'Directo' }
  ];
  var apps = [
    { nro: 1, aplicacion: 'Google Workspace', disponibilidad: 'Permanente', rol: 'Usuario', permisos: 'Lectura y escritura', criticidad: 'Alta', mfa: 'Sí' },
    { nro: 2, aplicacion: 'Mantum', disponibilidad: 'Permanente', rol: 'Usuario', permisos: 'Lectura', criticidad: 'Media', mfa: 'No' },
    { nro: 3, aplicacion: 'Ecus-CRM', disponibilidad: 'Permanente', rol: 'Usuario', permisos: 'Lectura y escritura', criticidad: 'Alta', mfa: 'Sí' },
    { nro: 4, aplicacion: 'HGI', disponibilidad: 'Permanente', rol: 'Administrador', permisos: 'Total', criticidad: 'Alta', mfa: 'Sí' }
  ];
  var accesos = { 'LAURA GÓMEZ': [{ aplicacion: 'Google Workspace', disponibilidad: 'Permanente', rol: 'Usuario', permisos: 'Lectura y escritura', pendiente: false }] };
  var revisiones = [
    { id: 'REV-000001', fecha: PERIODO + '-02 09:10', periodo: PERIODO, idActivo: 'INV-0001', nombre: 'PC-ADM-01', resultado: 'Conforme', estadoFisico: 'Bueno', ubicacion: 'Oficina 2', usuarioEncontrado: 'Laura Gómez', observaciones: '', por: 'tecnico@oviedo.com.co', idLocal: 'demo-1' }
  ];
  var movimientos = [{ id: 'MOV-0001', fecha: '2026-09-15', tipo: 'Entrega', usuario: 'Laura Gómez', estadoFisico: 'Bueno' }];
  var gh = [
    { clave: '2026-11-06 10:00:00|1000003', fila: 18, revisada: '', marca: '2026-11-06 10:00:00', solicitante: 'gh@demo.co', tipo: 'Ingreso', fecha: '2026-11-09',
      nombre: 'Sofía Mejía', documento: '1000003', cargo: 'Auxiliar de mercadeo', area: 'Mercadeo', jefeFormulario: 'Paula Aguirre', jefe: 'Paula Aguirre',
      correo: 'sofia@demo.co', vinculo: 'Directo', herramientas: 'Correo, CRM', observaciones: '', existe: null, fichaSinDoc: null,
      activos: [], accesos: [], cambios: [], avisos: [], sugerida: 'AGREGAR' },
    { clave: '2026-10-30 08:30:00|1000002', fila: 17, revisada: '', marca: '2026-10-30 08:30:00', solicitante: 'gh@demo.co', tipo: 'Retiro', fecha: '2026-10-30',
      nombre: 'Mario Ríos', documento: '1000002', cargo: '', area: '', jefeFormulario: '', jefe: '', correo: '', vinculo: '', herramientas: '', observaciones: 'Renuncia',
      existe: { nombre: 'Mario Ríos', estado: 'Activo', fila: 3 }, fichaSinDoc: null, activos: ['INV-0002 Portátil'], accesos: ['Google Workspace'],
      cambios: [], avisos: ['RETIRO SIN GESTIONAR: sigue en estado Activo con 1 acceso(s) vigente(s) y 1 activo(s) a su nombre.'], sugerida: 'YA_EXISTE' }
  ];

  function copia(x) { return JSON.parse(JSON.stringify(x)); }
  function ficha(a) { var o = copia(a); if (rol !== 'ADMIN') delete o.DOCUMENTO_USUARIO; return o; }
  function buscarActivo(t) {
    var id = window.SGILib.extraerId(t).toUpperCase();
    return activos.filter(function (a) { return a.ID_ACTIVO === id || a.SERIAL.toUpperCase() === id || a.NOMBRE_EQUIPO.toUpperCase() === id; })[0];
  }
  function err(codigo, mensaje) { var e = new window.SGIApiError(codigo, mensaje); return e; }
  function norm(s) { return window.SGILib.norm(s); }

  var acciones = {
    sesion: function () { return { correo: rol === 'ADMIN' ? 'sistemas@demo.co' : 'tecnico@demo.co', nombre: rol === 'ADMIN' ? 'Coordinación de Sistemas (demo)' : 'Auxiliar TI (demo)', rol: rol, version: 'demo', entidad: 'CENTRO COMERCIAL OVIEDO P.H. (DEMO)', hoy: HOY, periodo: PERIODO }; },
    bootstrap: function () {
      var b = {
        activos: activos.map(function (a) { return { id: a.ID_ACTIVO, tipo: a.TIPO, nombre: a.NOMBRE_EQUIPO, marca: a.MARCA, modelo: a.MODELO, serial: a.SERIAL, estado: a.ESTADO, usuario: a.USUARIO_ASIGNADO }; }),
        colaboradores: rol === 'ADMIN' ? copia(colaboradores) : [], apps: rol === 'ADMIN' ? copia(apps) : [],
        listas: { tipoActivo: ['Portátil', 'Escritorio', 'Impresora', 'Teléfono IP', 'Radio', 'Tablet'], estadoActivo: ['Asignado', 'Disponible en stock', 'En préstamo', 'En reparación', 'Dado de baja'],
          estadoFisico: ['Bueno', 'Regular', 'Malo'], tipoMovimiento: ['Entrega', 'Devolución', 'Reasignación', 'Préstamo temporal', 'Mantenimiento', 'Baja'],
          proceso: ['Ingreso', 'Retiro', 'Cambio de cargo', 'Modificación'], accion: ['Activar', 'Inactivar', 'Modificar', 'Sin cambio'],
          rol: ['Usuario', 'Administrador', 'Solo lectura'], permisos: ['Lectura', 'Lectura y escritura', 'Total'], disponibilidad: ['Permanente', 'Temporal'],
          area: ['Administración', 'Contabilidad', 'Mercadeo', 'Sistemas', 'Seguridad', 'Recepción', 'Mantenimiento'], clasificacion: ['Pública', 'Interna', 'Confidencial'],
          siNo: ['Sí', 'No'], vinculo: ['Directo', 'Temporal', 'Contratista'] },
        entidad: 'CENTRO COMERCIAL OVIEDO P.H. (DEMO)', hoy: HOY, ubicaciones: ['Cuarto de TI', 'Oficina 2', 'Oficina 3', 'Portería', 'Recepción'],
        resultadosRevision: ['Conforme', 'Con novedad', 'No encontrado']
      };
      return b;
    },
    activo: function (d) {
      var a = buscarActivo(d.texto || d.id);
      if (!a) throw err('no_encontrado', 'No existe un activo con "' + (d.texto || d.id) + '".');
      var rs = revisiones.filter(function (r) { return r.idActivo === a.ID_ACTIVO; });
      return { activo: ficha(a), ultimaRevision: rs.length ? rs[rs.length - 1] : null, revisadoEsteMes: rs.some(function (r) { return r.periodo === PERIODO; }),
               movimientos: movimientos.filter(function () { return a.ID_ACTIVO === 'INV-0001'; }) };
    },
    buscar: function (d) {
      var q = norm(d.q); if (q.length < 2) return { activos: [], colaboradores: [] };
      return {
        activos: activos.filter(function (a) { return norm([a.ID_ACTIVO, a.NOMBRE_EQUIPO, a.SERIAL, a.MARCA, a.MODELO, a.USUARIO_ASIGNADO, a.UBICACION].join(' ')).indexOf(q) >= 0; })
          .map(function (a) { return { id: a.ID_ACTIVO, nombre: a.NOMBRE_EQUIPO, tipo: a.TIPO, marca: a.MARCA, modelo: a.MODELO, serial: a.SERIAL, estado: a.ESTADO, usuario: a.USUARIO_ASIGNADO, ubicacion: a.UBICACION }; }),
        colaboradores: rol !== 'ADMIN' ? [] : colaboradores.filter(function (c) { return norm(c.nombre + ' ' + c.documento).indexOf(q) >= 0; })
          .map(function (c) { return { nombre: c.nombre, documento: c.documento, cargo: c.cargo, area: c.area, estado: c.estado }; })
      };
    },
    revision_resumen: function () {
      var univ = activos.filter(function (a) { return a.ESTADO !== 'Dado de baja'; });
      var ult = {}; revisiones.forEach(function (r) { if (r.periodo === PERIODO) ult[r.idActivo] = r; });
      var pend = univ.filter(function (a) { return !ult[a.ID_ACTIVO]; }).map(function (a) { return { id: a.ID_ACTIVO, nombre: a.NOMBRE_EQUIPO, tipo: a.TIPO, ubicacion: a.UBICACION, usuario: a.USUARIO_ASIGNADO }; });
      var rev = Object.keys(ult).length;
      return { periodo: PERIODO, total: univ.length, revisados: rev, conNovedad: Object.keys(ult).filter(function (k) { return ult[k].resultado !== 'Conforme'; }).length,
               pendientes: pend, totalPendientes: pend.length, recientes: revisiones.slice(-10).reverse() };
    },
    revision_guardar: function (d) {
      if (window.SGIDemo.fallaRed) throw err('red', 'Sin conexión con el servidor.');
      var a = buscarActivo(d.idActivo); if (!a) throw err('no_encontrado', 'No existe el activo.');
      var previa = d.idLocal && revisiones.filter(function (r) { return r.idLocal === d.idLocal; })[0];
      if (previa) return { id: previa.id, duplicado: true, mensaje: 'Esta revisión ya estaba registrada (' + previa.id + ').' };
      var id = 'REV-' + ('000000' + (revisiones.length + 1)).slice(-6);
      revisiones.push({ id: id, fecha: HOY + ' 12:00', periodo: PERIODO, idActivo: a.ID_ACTIVO, nombre: a.NOMBRE_EQUIPO, resultado: d.resultado, estadoFisico: d.estadoFisico || '',
        ubicacion: d.ubicacion || '', usuarioEncontrado: d.usuarioEncontrado || '', observaciones: d.observaciones || '', por: 'demo', idLocal: d.idLocal || '' });
      var extra = '';
      if (d.actualizarUbicacion && d.ubicacion) { a.UBICACION = d.ubicacion; extra = ' Ubicación actualizada en el inventario.'; }
      return { id: id, duplicado: false, idActivo: a.ID_ACTIVO, mensaje: 'Revisión ' + id + ' registrada para ' + a.ID_ACTIVO + '.' + extra };
    },
    colaborador: function (d) {
      var c = colaboradores.filter(function (x) { return x.nombre.toUpperCase() === String(d.nombre || '').toUpperCase() || x.documento === d.documento; })[0];
      if (!c) throw err('no_encontrado', 'No se encontró al colaborador.');
      return { ficha: { documento: c.documento, nombre: c.nombre, correo: c.correo, cargo: c.cargo, area: c.area, jefe: c.jefe, vinculo: c.vinculo, estado: c.estado, ingreso: '', retiro: '' },
               activos: activos.filter(function (a) { return a.USUARIO_ASIGNADO.toUpperCase() === c.nombre.toUpperCase(); }).map(function (a) { return { id: a.ID_ACTIVO, nombre: a.NOMBRE_EQUIPO, tipo: a.TIPO, serial: a.SERIAL, estado: a.ESTADO }; }),
               accesos: accesos[c.nombre.toUpperCase()] || [] };
    },
    accesos_vigentes: function (d) { return accesos[String(d.nombre || '').toUpperCase()] || []; },
    activo_guardar: function (d) {
      var p = d.activo;
      if (p.ID_ACTIVO) { var a = buscarActivo(p.ID_ACTIVO); Object.keys(p).forEach(function (k) { if (p[k] !== '') a[k] = p[k]; }); return { mensaje: 'Activo ' + p.ID_ACTIVO + ' actualizado.' }; }
      var id = 'INV-' + ('0000' + (activos.length + 1)).slice(-4);
      activos.push(Object.assign({ ID_ACTIVO: id, TIPO: '', NOMBRE_EQUIPO: '', MARCA: '', MODELO: '', SERIAL: '', ESTADO: '', USUARIO_ASIGNADO: '', DOCUMENTO_USUARIO: '', AREA: '', UBICACION: '', ULTIMA_ACTUALIZACION: HOY, ACTUALIZADO_POR: 'demo' }, p));
      return { mensaje: 'Activo registrado con el código ' + id + '.' };
    },
    movimiento_guardar: function (d) {
      var p = d.p; if (!p.activos || !p.activos.length) throw err('error', 'Seleccione al menos un activo.');
      p.activos.forEach(function (id) { var a = buscarActivo(id); if (a) { a.ESTADO = p.tipo === 'Devolución' ? 'Disponible en stock' : 'Asignado'; a.USUARIO_ASIGNADO = p.tipo === 'Devolución' ? '' : p.usuario; } });
      return { mensaje: 'Movimiento registrado (' + p.activos.length + ' activo(s)).' + (p.generarActa ? ' Acta ACT-0099 generada.' : ''), url: p.generarActa ? 'https://example.com/acta-demo.pdf' : '' };
    },
    novedad_guardar: function (d) {
      var p = d.p; if (!p.lineas || !p.lineas.length) throw err('error', 'Seleccione al menos una aplicación.');
      return { mensaje: 'Novedad NOV-0015 registrada con ' + p.lineas.length + ' línea(s).' + (p.generarActa ? ' Acta ACT-0100 generada.' : ''), url: p.generarActa ? 'https://example.com/acta-demo.pdf' : '' };
    },
    gh_pendientes: function () {
      var pend = gh.filter(function (x) { return !x.revisada; });
      return { items: copia(pend), seleccion: false, totalRespuestas: gh.length, pendientes: pend.length, fichasSinDocumento: 0,
               listas: { areas: ['Administración', 'Contabilidad', 'Mercadeo', 'Sistemas'], vinculos: ['Directo', 'Temporal', 'Contratista'], jefes: ['Mauricio Núñez', 'Paula Aguirre'] } };
    },
    gh_decidir: function (d) {
      var res = { agregados: [], actualizados: [], revisadas: 0, errores: [] };
      d.decisiones.forEach(function (x) {
        var it = gh.filter(function (g) { return g.clave === x.clave; })[0];
        if (!it || it.revisada) { res.errores.push(x.nombre + ': ya había sido revisada.'); return; }
        it.revisada = x.decision; res.revisadas++;
        if (x.decision === 'AGREGAR') res.agregados.push({ nombre: x.nombre, documento: x.documento, herramientas: x.herramientas });
      });
      return res;
    }
  };

  window.SGIDemo = {
    fallaRed: false,
    llamar: function (accion, datos) {
      return new Promise(function (ok, ko) {
        setTimeout(function () {
          try { if (!acciones[accion]) throw err('accion_invalida', 'Acción no reconocida.'); ok(copia(acciones[accion](datos || {}))); }
          catch (e) { ko(e); }
        }, 120);
      });
    }
  };
}());

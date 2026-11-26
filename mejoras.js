// Alfonso Mira · Planning — mejoras NUE-01 a NUE-11 (sobre la app de siempre)
// Sin encadenamiento opcional, sin fusión nula y sin expresiones regulares literales.
(function () {
  'use strict';

  // ═════════ Utilidades ═════════
  function evActual() { return (typeof currentEventId !== 'undefined' && currentEventId && appData.events[currentEventId]) ? appData.events[currentEventId] : null; }
  function enVision() { return typeof modoVision !== 'undefined' && modoVision; }
  function guardarEv() { if (!enVision()) scheduleSave(); }
  function api() { return window.__am || null; }
  function puedePlan() { const a = api(); return a ? a.puedePlanificar() : false; }
  function puedeEditar() { const a = api(); return a ? a.puedeEditar() : false; }
  function aviso(t, e) { const a = api(); if (a) a.aviso(t, e); else console.log(t); }
  function esc(v) {
    return String(v === undefined || v === null ? '' : v)
      .split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;').split("'").join('&#39;');
  }
  function txt(v) { return v === undefined || v === null ? '' : String(v).trim(); }
  function num(v) { const n = parseFloat(String(v === undefined || v === null ? '' : v).split(',').join('.')); return isNaN(n) ? 0 : n; }
  function sinAcentos(s) { return String(s || '').normalize('NFD').split('').filter(function (c) { const k = c.charCodeAt(0); return k < 0x300 || k > 0x36f; }).join(''); }
  function normNombre(s) { return sinAcentos(String(s || '').toUpperCase()).split(' ').filter(function (x) { return x; }).join(' '); }
  function limpiaNombre(s) { return String(s || '').toUpperCase().split(' ').filter(function (x) { return x; }).join(' '); }
  function fechaCorta(iso) { const p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : (iso || '—'); }
  function isoDe(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  const DIAS = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function envolver(nombre, antes, despues) {
    const orig = window[nombre];
    if (typeof orig !== 'function') return;
    window[nombre] = function () {
      if (antes) { try { antes.apply(this, arguments); } catch (e) { console.warn('Mejora (antes de ' + nombre + ')', e); } }
      const r = orig.apply(this, arguments);
      if (despues) { try { despues.apply(this, arguments); } catch (e) { console.warn('Mejora (después de ' + nombre + ')', e); } }
      return r;
    };
  }
  function reducirImagen(fichero, max) {
    return new Promise(function (ok, ko) {
      const fr = new FileReader();
      fr.onload = function () {
        const img = new Image();
        img.onload = function () {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          ok(c.toDataURL('image/webp', 0.82));
        };
        img.onerror = ko; img.src = fr.result;
      };
      fr.onerror = ko; fr.readAsDataURL(fichero);
    });
  }
  function cabecera(titulo, sub, conImprimir) {
    const e = evActual();
    const s = sub !== undefined ? sub : (e ? (txt(e.boda) + ' · ' + fechaCorta(e.fecha) + ' · ' + txt(e.ubicacion)) : 'Planning profesional de eventos');
    return '<div class="inf-cab hoja-cab am-cab"><div><div class="inf-cab-t">' + esc(titulo) + '</div><div class="inf-cab-s">' + esc(s) + '</div></div>' +
      '<div class="inf-cab-r"><div class="inf-logo">ALFONSO MIRA</div>' + (conImprimir === false ? '' : '<button class="inf-print-btn" onclick="amImprimir(this)"><i class="fa-solid fa-print mr-1"></i>IMPRIMIR / PDF</button>') + '</div></div>';
  }
  window.amImprimir = function (btn) {
    const vista = btn.closest('.am-vista');
    if (!vista) return;
    document.body.classList.add('am-imprimiendo'); vista.classList.add('am-print');
    const fin = function () { document.body.classList.remove('am-imprimiendo'); vista.classList.remove('am-print'); window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    window.print();
  };

  // Ventana propia (formularios)
  function modal(html) {
    let m = document.getElementById('am-modal');
    if (!m) {
      m = document.createElement('div'); m.id = 'am-modal'; m.className = 'am-modal am-oculto';
      m.innerHTML = '<div class="am-modal-caja" id="am-modal-caja"></div>';
      document.body.appendChild(m);
      m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-am-cerrar]')) cerrarModal(); });
    }
    document.getElementById('am-modal-caja').innerHTML = html;
    m.classList.remove('am-oculto');
  }
  function cerrarModal() { const m = document.getElementById('am-modal'); if (m) m.classList.add('am-oculto'); }

  // ═════════ Vistas nuevas y menú ═════════
  const VISTAS = {
    'am-planning': { titulo: 'PLANNING SEMANAL', nivel: 'top', render: function () { renderPlanning(); } },
    'am-misbodas': { titulo: 'MIS BODAS', nivel: 'top', render: function () { renderMisBodas(); } },
    'am-personal': { titulo: 'PERSONAL', nivel: 'top', render: function () { renderDirectorio(); } },
    'am-papelera': { titulo: 'PAPELERA', nivel: 'top', render: function () { renderPapelera(); } },
    'am-copias': { titulo: 'COPIA DE SEGURIDAD', nivel: 'top', render: function () { renderCopias(); } },
    'am-ceremonia': { titulo: 'CEREMONIA', nivel: 'jsw', render: function () { renderCeremonia(); } },
    'am-finca': { titulo: 'FICHA DE LA FINCA', nivel: 'jsw', render: function () { renderFinca(); } },
    'am-minutas': { titulo: 'MINUTAS PARA IMPRIMIR', nivel: 'jsw', render: function () { renderMinutas(); } },
    'am-control': { titulo: 'CONTROL DE DOCUMENTACIÓN', nivel: 'jsw', render: function () { renderControl(); } },
    'am-cronograma': { titulo: 'CRONOGRAMA LOGÍSTICA', nivel: 'top', render: function () { renderCronograma(); } },
    'am-planococtel': { titulo: 'PLANO CÓCTEL', nivel: 'coord', render: function () { renderPlanoCoctel(); } }
  };
  function crearMenu() {
    const historico = document.getElementById('tab-historico');
    if (historico && !document.getElementById('tab-am-planning')) {
      historico.insertAdjacentHTML('afterend',
        '<button onclick="switchTab(\'am-misbodas\')" id="tab-am-misbodas" class="nav-btn am-solo-equipo"><i class="fa-solid fa-user-clock w-6 text-center mr-2"></i> MIS BODAS</button>' +
        '<button onclick="switchTab(\'am-planning\')" id="tab-am-planning" class="nav-btn"><i class="fa-solid fa-calendar-week w-6 text-center mr-2"></i> PLANNING SEMANAL</button>' +
        '<button onclick="switchTab(\'am-cronograma\')" id="tab-am-cronograma" class="nav-btn"><i class="fa-solid fa-list-check w-6 text-center mr-2"></i> CRONOGRAMA LOGÍSTICA</button>' +
        '<button onclick="switchTab(\'am-personal\')" id="tab-am-personal" class="nav-btn am-solo-plan"><i class="fa-solid fa-address-book w-6 text-center mr-2"></i> PERSONAL</button>' +
        '<button onclick="switchTab(\'am-papelera\')" id="tab-am-papelera" class="nav-btn am-solo-admin"><i class="fa-solid fa-trash-can-arrow-up w-6 text-center mr-2"></i> PAPELERA</button>' +
        '<button onclick="switchTab(\'am-copias\')" id="tab-am-copias" class="nav-btn am-solo-admin"><i class="fa-solid fa-shield-halved w-6 text-center mr-2"></i> COPIA DE SEGURIDAD</button>');
    }
    const sub = 'nav-btn py-1.5 px-3 text-xs text-gray-500';
    const prot = document.getElementById('tab-jsw-protocolo');
    if (prot && !document.getElementById('tab-am-ceremonia')) prot.insertAdjacentHTML('afterend', '<button onclick="switchTab(\'am-ceremonia\')" id="tab-am-ceremonia" class="' + sub + '">CEREMONIA</button>');
    const ficha = document.getElementById('tab-jsw-fichainfo');
    if (ficha && !document.getElementById('tab-am-finca')) ficha.insertAdjacentHTML('afterend', '<button onclick="switchTab(\'am-finca\')" id="tab-am-finca" class="' + sub + '">FICHA DE LA FINCA</button>');
    const mcam = document.getElementById('tab-jsw-minutacamareros');
    if (mcam && !document.getElementById('tab-am-minutas')) mcam.insertAdjacentHTML('afterend', '<button onclick="switchTab(\'am-minutas\')" id="tab-am-minutas" class="' + sub + '"><i class="fa-solid fa-print mr-1"></i>MINUTAS PARA IMPRIMIR</button>' +
      '<button onclick="switchTab(\'am-control\')" id="tab-am-control" class="' + sub + '"><i class="fa-solid fa-clipboard-check mr-1"></i>CONTROL DOCUMENTACIÓN</button>');
    const plano = document.getElementById('tab-plano');
    if (plano && !document.getElementById('tab-am-planococtel')) plano.insertAdjacentHTML('afterend', '<button onclick="switchTab(\'am-planococtel\')" id="tab-am-planococtel" class="' + sub + '">PLANO CÓCTEL</button>');
    const main = document.querySelector('main');
    Object.keys(VISTAS).forEach(function (id) {
      if (document.getElementById('view-' + id)) return;
      main.insertAdjacentHTML('beforeend', '<div id="view-' + id + '" class="w-full h-full hidden overflow-y-auto custom-scrollbar am-vista"><div class="am-wrap" id="am-root-' + id + '"></div></div>');
    });
  }
  (function () {
    const orig = window.switchTab;
    window.switchTab = function (tabId) {
      Object.keys(VISTAS).forEach(function (id) { const v = document.getElementById('view-' + id); if (v) v.classList.add('hidden'); });
      if (!VISTAS[tabId]) return orig.apply(this, arguments);
      orig.call(this, '__am');
      try { lastTabId = tabId; } catch (e) {}
      const def = VISTAS[tabId];
      const btn = document.getElementById('tab-' + tabId);
      if (btn) btn.classList.add(def.nivel === 'top' ? 'nav-active' : 'subnav-level3-active');
      if (def.nivel !== 'top') {
        const md = document.getElementById('menu-documentacion'); if (md) md.classList.remove('hidden');
        const mm = document.getElementById(def.nivel === 'jsw' ? 'menu-jsw' : 'menu-coordinadores'); if (mm) mm.classList.remove('hidden');
        if (!evActual()) { orig.call(this, 'historico'); return; }
      }
      document.getElementById('view-' + tabId).classList.remove('hidden');
      def.render();
    };
  })();

  // ═════════ NUE-01 y NUE-02 · Equipos desde Protocolo y fórmulas ═════════
  // Reglas sacadas de las fórmulas del Excel original (HOJA DE EQUIPOS); se pueden cambiar en «Reglas de cálculo»
  const REGLAS_BASE = {
    pax_por_mesa_coctel: 10, altas_pct: 75, pax_por_lebrillo: 20, pax_por_lebrillo_completo: 18,
    pax_por_punto_vino_jlv: 200, pax_por_punto_vino_catering: 150,
    pax_por_unidad_jamon: 100, pax_por_punto_jamon: 150, pax_por_punto_quesos: 150,
    pinchos_por_bandeja_mesa: 8, pinchos_por_bandeja_pasada: 10,
    pinzas_por_plato_pinceado: 2, pax_por_pinza: 4, pescados_por_pala: 20,
    ped_vaso_ducale: 135, ped_copa_tinto: 110, ped_copa_blanco: 135, ped_copa_cava: 90, ped_vaso_sidra: 270,
    ped_tenedor_trinchero: 180, ped_cuchillo_trinchero: 180, ped_cuchara_postre: 180, ped_cuchara_cafe: 180, ped_redondeo: 5
  };
  let REGLAS = Object.assign({}, REGLAS_BASE);
  function p_(p, k) { return txt(p[k]); }
  function invitadosDe(e) {
    const p = e.protocolo || {};
    let inv = 0;
    try { const def = prtComensalesDef(p); if (def.fila >= 0) inv = def.total + (parseInt(def.dudas, 10) || 0); } catch (err) {}
    if (!inv) { try { inv = jswTotals(e).invitados; } catch (err) {} }
    return inv || 0;
  }
  function coctelMismo(p) { return p_(p, 'coctel_bebida').toUpperCase().indexOf('MISMO') === 0; }
  const MAPA = [
    ['ig_tinto', 'beb_comida_tinto'], ['ig_blanco', 'beb_comida_blanco'], ['ig_cava', 'beb_comida_espumoso'], ['ig_otro', 'beb_comida_otro'],
    ['ig_cc_tinto', function (p) { return p_(p, coctelMismo(p) ? 'beb_comida_tinto' : 'beb_coctel_tinto'); }],
    ['ig_cc_blanco', function (p) { return p_(p, coctelMismo(p) ? 'beb_comida_blanco' : 'beb_coctel_blanco'); }],
    ['ig_cc_espumoso', function (p) { return p_(p, coctelMismo(p) ? 'beb_comida_espumoso' : 'beb_coctel_espumoso'); }],
    ['ig_otras_a', 'beb_otras'],
    ['ig_esp_1a', 'bl_be_0'], ['ig_esp_1b', 'bl_be_1'], ['ig_esp_2a', 'bl_be_2'], ['ig_esp_2b', 'bl_be_3'], ['ig_esp_3a', 'bl_be_4'], ['ig_esp_3b', 'bl_be_5'],
    ['ig_fumar', 'fumar'], ['ig_fumar_desde', 'fumar_desde'], ['ig_tipo_coctel', 'tipo_coctel'], ['ig_munecos', 'munecos'],
    ['ig_contrayentes_coctel', 'contr_participan'], ['ig_tiempo_demora', 'contr_demora'],
    ['ig_brindis', 'brindis'], ['ig_brindis_ubicacion', 'brindis_ubi'], ['ig_brindis_pax', 'brindis_pax'], ['ig_brindis_otro_lugar', 'brindis_otro'], ['ig_brindis_bebida', 'brindis_bebida'],
    ['ig_resopo_tipo', 'res_tipo'], ['ig_resopo_montaje', 'res_montaje'], ['ig_resopo_necesidades', 'res_necesidades'], ['ig_resopo_hora', 'res_hora'],
    ['ig_resopo_ubi_jlv', 'res_ubi_jlv'], ['ig_resopo_pax', 'res_pax'], ['ig_resopo_ubi_cat', 'res_ubi_cat'],
    ['ig_jlv_coctel', 'esp_coctel_jlv'], ['ig_cat_coctel', 'esp_coctel_cat'], ['ig_jlv_banquete', 'esp_banquete_jlv'], ['ig_cat_banquete', 'esp_banquete_cat'],
    ['nsa_pasillo', 'pasillo'], ['nsa_presi_sola', 'presi_sola'], ['nsa_presi_pax', 'pax_presi'], ['nsa_presi_dcha', 'pax_presi_dcha'], ['nsa_presi_izda', 'pax_presi_izda'],
    ['ncc_tipo_coctel', 'tipo_coctel'], ['nsa_mul_n_pescado', 'n_2opcion'], ['ncc_taburetes', 'mob_taburetes'], ['ncc_taburetes_cant', 'mob_taburetes_cant'], ['nco_pinchos', 'n_pinchos'],
    ['nbl_modalidad', 'bl_tipo'], ['nbl_horas', 'bl_horas_contratadas'], ['nbl_copas_mesa', 'bl_copas_mesa'], ['nbl_copas_horas', 'bl_cant_horas'],
    ['nbl_ubi_jlv', 'bl_ubi_jlv'], ['nbl_ubi_cat', 'bl_ubi_cat'], ['nbl_tipo_vaso', 'bl_tipo_vaso'],
    ['nbl_coct_tipo', 'coc_tipo'], ['nbl_coct_ubi', 'coc_ubicacion'], ['nbl_coct_hora', 'coc_hora_cita'], ['nbl_coct_contacto', 'coc_contacto'],
    ['nbl_coct_necesidades', 'coc_necesidades'], ['nbl_coct_zona', 'coc_zona']
  ];
  // Más enlaces de la Hoja de Equipos del Excel (celdas azules = vienen de Protocolo)
  MAPA.push(
    ['contacto', 'finca_contacto'], ['telefono', 'finca_tlfno'], ['evento', 'tipo_evento'], ['ubicacion', 'sitio'],
    ['ig_jlv_acceso_inv', 'acc_invitados_jlv'], ['ig_cat_acceso_inv', 'acc_invitados_cat'], ['ig_jlv_acceso_sala', 'acc_sala_jlv'], ['ig_cat_acceso_sala', 'acc_sala_cat'],
    ['ig_jlv_entrada_cont', 'recepcion_jlv'], ['ig_cat_acceso_cont', 'recepcion_cat'], ['ig_jlv_entrada_cont_sala', 'acc_sala_contr_jlv'], ['ig_cat_acceso_cont_sala', 'acc_sala_contr_cat'],
    ['ig_mesa_tarta', 'pedir_tarta'], ['ig_cc_otros', function (p) { return p_(p, coctelMismo(p) ? 'beb_comida_otro' : 'beb_coctel_otro'); }],
    ['nsa_obs_bebidas', 'beb_comida_otro'], ['nsa_copas_mesa', 'bl_copas_mesa'], ['nsa_presi_ubi_jlv', 'ubi_presi_jlv'], ['nsa_presi_ubi_cat', 'ubi_presi_cat'],
    ['ncc_tipo_mesas', 'mob_tipo_mesa'], ['ncc_aguas', 'mob_aguas'], ['ncc_aguas_tipo', 'mob_aguas_uso'], ['ncc_foodtruck', 'mob_foodtruck'], ['ncc_foodtruck_uso', 'mob_foodtruck_uso'],
    ['ncc_sonido', 'av_sonido_coctel'], ['ncc_sonido_nec', 'av_necesidades'], ['nof_carro', 'det_camarera'], ['nof_mesa_tarta', 'pedir_tarta']
  );
  ['ncc_', 'nco_'].forEach(function (pre) {
    MAPA.push([pre + 'jamon_desc', 'jamon_tipo'], [pre + 'jamon_tipo', 'jamon_servicio'], [pre + 'jamon_unidades', 'jamon_unidades'], [pre + 'jamon_puntos', 'jamon_puntos'],
      [pre + 'jamon_resopo', 'jamon_resopo'], [pre + 'jamon_resopo_cant', 'jamon_resopo_cant'],
      [pre + 'quesos_desc', 'quesos_tipo'], [pre + 'quesos_tipo', 'quesos_servicio'], [pre + 'quesos_asistidos', 'quesos_asistidos'], [pre + 'quesos_resopo', 'quesos_resopo']);
    for (let i = 1; i <= 5; i++) MAPA.push([pre + 'sc' + i + '_nombre', 'sc_' + (i - 1) + '_pincho'], [pre + 'sc' + i + '_puntos', 'sc_' + (i - 1) + '_puntos']);
  });
  // Ceremonia (NUE-04) → Equipos
  const MAPA_CER = [['ig_ceremonia', 'hay'], ['ig_hora_ceremonia', 'hora'], ['ig_recepcion_ceremonia', 'recepcion'], ['ig_recepcion_bebida', 'bebida'],
    ['ig_pasar_sillas', 'pasar_sillas'], ['ig_sillas_cantidad', 'sillas'], ['ig_jlv_ceremonia', 'espacio_jlv'], ['ig_cat_ceremonia', 'espacio_cat']];
  const FUENTES_FORMULA = ['ncc_n_mesas', 'ncc_mesas_altas', 'ncc_tipo_coctel', 'ncc_vino_catering', 'nco_pinchos', 'nsa_pinceados_cant', 'nsa_rangos', 'nsa_con_pinza_cant',
    'nsa_pinzas_1', 'nsa_pinzas_2', 'nsa_pinzas_pan', 'nsa_pinzas_otras', 'nsa_mul_n_pescado'];
  const FORMULA_TXT = {};

  function autoRellenar(e) {
    if (!e) return [];
    const m = ensureJefeSalaManual(e);
    if (!m._auto || typeof m._auto !== 'object') m._auto = {};
    const cambios = [];
    if (limpiarFormatos(e)) cambios.push('_formatos');
    const p = e.protocolo || {};
    function poner(clave, valor) {
      const v = txt(valor);
      const gestionado = m._auto[clave] !== undefined && txt(m[clave]) === txt(m._auto[clave]);
      if (v === '') {
        if (gestionado) { m[clave] = ''; delete m._auto[clave]; cambios.push(clave); }
        return;
      }
      if (txt(m[clave]) === '' || gestionado) {
        if (txt(m[clave]) !== v || m._auto[clave] !== v) { m[clave] = v; m._auto[clave] = v; cambios.push(clave); }
      }
    }
    MAPA.forEach(function (x) { poner(x[0], typeof x[1] === 'function' ? x[1](p) : p_(p, x[1])); });
    const cer = e.ceremonia || {};
    MAPA_CER.forEach(function (x) { poner(x[0], cer[x[1]]); });
    // Fórmulas (las del Excel original, con reglas editables)
    const R = REGLAS;
    const div = function (a, b) { return num(b) > 0 ? a / num(b) : 0; };
    const arriba = function (v) { return v > 0 ? Math.ceil(v - 1e-9) : ''; };
    const inv = invitadosDe(e);
    function calc(clave, valor, texto) { FORMULA_TXT[clave] = texto; poner(clave, valor); }
    // Cóctel: mesas, altas/bajas, lebrillos, puntos de vino, ceniceros
    const tipo = txt(m.ncc_tipo_coctel || p.tipo_coctel).toUpperCase();
    const mesas = tipo && inv ? 2 * Math.ceil(div(inv, R.pax_por_mesa_coctel) / 2) : 0;
    calc('ncc_n_mesas', mesas || '', 'Invitados ÷ ' + R.pax_por_mesa_coctel + ', redondeado al par superior (si hay tipo de cóctel)');
    const nMesas = num(m.ncc_n_mesas);
    const altasCalc = nMesas > 0 ? Math.round(nMesas * num(R.altas_pct) / 100) : '';
    calc('ncc_mesas_altas', altasCalc, R.altas_pct + ' % de las mesas del cóctel');
    const altas = num(m.ncc_mesas_altas);
    calc('ncc_mesas_bajas', nMesas > 0 ? Math.max(0, nMesas - altas) : '', 'Mesas del cóctel − mesas altas');
    const completo = tipo.indexOf('COMPLETO') >= 0;
    calc('ncc_lebrillos', tipo && inv ? arriba(div(inv, completo ? R.pax_por_lebrillo_completo : R.pax_por_lebrillo)) : '',
      'Invitados ÷ ' + R.pax_por_lebrillo + ' (÷ ' + R.pax_por_lebrillo_completo + ' si es menú completo), hacia arriba');
    const vinoCat = txt(m.ncc_vino_catering) ? txt(m.ncc_vino_catering) === 'SI' : e.lugar_tipo === 'BODA FINCA';
    calc('ncc_puntos_vino', inv ? Math.max(1, Math.round(div(inv, vinoCat ? R.pax_por_punto_vino_catering : R.pax_por_punto_vino_jlv))) : '',
      'Invitados ÷ ' + R.pax_por_punto_vino_jlv + ' en JLV o ÷ ' + R.pax_por_punto_vino_catering + ' en catering');
    calc('ncc_ceniceros', p_(p, 'fumar').toUpperCase() === 'SI' ? 'SI' : '', 'SI cuando en Protocolo se permite fumar');
    // Showcooking: jamón y quesos
    const hayJamon = p_(p, 'jamon_tipo') !== '' || p_(p, 'jamon_servicio') !== '';
    ['ncc_', 'nco_'].forEach(function (pre) {
      if (p_(p, 'jamon_unidades') === '') calc(pre + 'jamon_unidades', hayJamon && inv ? arriba(div(inv, R.pax_por_unidad_jamon)) : '', 'Invitados ÷ ' + R.pax_por_unidad_jamon + ', hacia arriba');
      if (p_(p, 'jamon_puntos') === '') calc(pre + 'jamon_puntos', hayJamon && inv ? arriba(div(inv, R.pax_por_punto_jamon)) : '', 'Invitados ÷ ' + R.pax_por_punto_jamon + ', hacia arriba');
      const hayQueso = p_(p, 'quesos_tipo') !== '' || p_(p, 'quesos_servicio') !== '';
      if (p_(p, 'quesos_puntos') === '') calc(pre + 'quesos_puntos', hayQueso && inv ? arriba(div(inv, R.pax_por_punto_quesos)) : '', 'Invitados ÷ ' + R.pax_por_punto_quesos + ', hacia arriba');
      else calc(pre + 'quesos_puntos', p_(p, 'quesos_puntos'), 'De Protocolo');
    });
    // Cocina: bandejas
    const altasF = num(m.ncc_mesas_altas), bajasF = num(m.ncc_mesas_bajas);
    calc('nco_bandejas_mesa', nMesas || '', 'Una bandeja por mesa del cóctel');
    calc('nco_bandejas_altas', nMesas ? altasF : '', 'Mesas altas del cóctel');
    calc('nco_bandejas_bajas', nMesas ? bajasF : '', 'Mesas bajas del cóctel');
    const pinchos = num(m.nco_pinchos);
    const pasadas = pinchos ? Math.max(0, Math.ceil(div(pinchos - num(m.nco_bandejas_mesa) * num(R.pinchos_por_bandeja_mesa), R.pinchos_por_bandeja_pasada))) : '';
    calc('nco_bandejas_pasadas', pasadas, '(Pinchos − bandejas a mesa × ' + R.pinchos_por_bandeja_mesa + ') ÷ ' + R.pinchos_por_bandeja_pasada + ', hacia arriba');
    // Sala: pinzas y palas
    const rangos = num(m.nsa_rangos);
    calc('nsa_pinzas_1', num(m.nsa_pinceados_cant) && rangos ? num(m.nsa_pinceados_cant) * num(R.pinzas_por_plato_pinceado) * rangos : '',
      'Platos pinceados × ' + R.pinzas_por_plato_pinceado + ' × rangos');
    calc('nsa_pinzas_2', num(m.nsa_con_pinza_cant) && inv ? arriba(num(m.nsa_con_pinza_cant) * div(inv, R.pax_por_pinza)) : '',
      'Platos con pinza × invitados ÷ ' + R.pax_por_pinza + ', hacia arriba');
    calc('nsa_pinzas_pan', rangos || '', 'Una por rango');
    const total = ['nsa_pinzas_1', 'nsa_pinzas_2', 'nsa_pinzas_pan', 'nsa_pinzas_otras'].reduce(function (a2, k) { return a2 + num(m[k]); }, 0);
    calc('nsa_total_pinzas', total || '', 'Pinceados + con pinza + pan + otras');
    const pescado = num(m.nsa_mul_n_pescado);
    calc('nsa_platos_palas', pescado ? arriba(div(pescado, R.pescados_por_pala)) : '', 'Nº de pescados ÷ ' + R.pescados_por_pala + ', hacia arriba');
    calc('nsa_mul_cantidad', txt(m.nsa_mul_otras).toUpperCase().indexOf('S') === 0 && inv ? inv : '', 'Igual al nº de invitados (si hay otras muletillas)');
    return cambios;
  }
  function selectorCampo(clave) {
    return '[oninput^="saveJefeSalaManual(\'' + clave + '\'"], [onchange^="saveJefeSalaManual(\'' + clave + '\'"]';
  }
  function marcarAutos() {
    const e = evActual(); if (!e || !e.jefesala_manual) return;
    const m = e.jefesala_manual, a = m._auto || {};
    const vista = document.getElementById('view-coordinadores-equipos'); if (!vista) return;
    vista.querySelectorAll('.am-auto').forEach(function (el) { el.classList.remove('am-auto'); el.removeAttribute('title'); });
    Object.keys(a).forEach(function (k) {
      if (txt(m[k]) !== txt(a[k])) return;
      vista.querySelectorAll(selectorCampo(k)).forEach(function (el) {
        el.classList.add('am-auto');
        el.title = (FORMULA_TXT[k] ? 'Calculado: ' + FORMULA_TXT[k] : 'Viene de Protocolo o Ceremonia') + '. Escribe encima para corregirlo a mano.';
        if (el.tagName === 'SELECT' && el.value !== txt(m[k])) {
          if (!Array.prototype.some.call(el.options, function (o) { return o.value === txt(m[k]); })) el.insertAdjacentHTML('beforeend', '<option value="' + esc(m[k]) + '">' + esc(m[k]) + '</option>');
          el.value = txt(m[k]);
        }
      });
    });
    pintarBarraReglas(vista);
  }
  function pintarBarraReglas(vista) {
    const cont = vista.querySelector('.subcontent-coordequipos:not(.hidden)') || vista;
    if (cont.querySelector('.am-barra-auto')) return;
    cont.insertAdjacentHTML('afterbegin', '<div class="am-barra-auto"><span><i class="fa-solid fa-wand-magic-sparkles"></i> Los campos en <b class="am-muestra">verde claro</b> se rellenan solos desde Protocolo, Ceremonia o con las fórmulas. Si escribes encima, manda tu valor.</span>' +
      (puedePlan() ? '<button onclick="amReglas()" class="am-btn">Reglas de cálculo</button>' : '') + '</div>');
  }
  const REGLAS_TXT = [
    ['Cóctel', [['pax_por_mesa_coctel', 'Invitados por mesa de cóctel', 'Nº de mesas = invitados ÷ este número, redondeado al par superior.'],
      ['altas_pct', 'Mesas altas (%)', 'El resto son bajas. Se puede corregir el nº de altas a mano.'],
      ['pax_por_lebrillo', 'Invitados por lebrillo', 'Cóctel corto, medio o largo.'], ['pax_por_lebrillo_completo', 'Invitados por lebrillo (menú completo)', ''],
      ['pax_por_punto_vino_jlv', 'Invitados por punto de vino en JLV', ''], ['pax_por_punto_vino_catering', 'Invitados por punto de vino en catering', '']]],
    ['Showcooking', [['pax_por_unidad_jamon', 'Invitados por jamón', 'Solo si hay jamón y Protocolo no indica las unidades.'],
      ['pax_por_punto_jamon', 'Invitados por punto de jamón', ''], ['pax_por_punto_quesos', 'Invitados por punto de quesos', '']]],
    ['Cocina', [['pinchos_por_bandeja_mesa', 'Pinchos por bandeja a mesa', 'Se descuentan de los pinchos antes de calcular las pasadas.'],
      ['pinchos_por_bandeja_pasada', 'Pinchos por bandeja pasada', 'Pasadas = (pinchos − bandejas a mesa × pinchos por bandeja) ÷ este número.']]],
    ['Sala', [['pinzas_por_plato_pinceado', 'Pinzas por plato pinceado', 'Pinzas = platos pinceados × este número × rangos. Pan: 1 por rango.'],
      ['pax_por_pinza', 'Invitados por pinza (platos con pinza)', 'Pinzas = platos con pinza × invitados ÷ este número.'],
      ['pescados_por_pala', 'Pescados por plato de palas', 'Platos de palas = nº de pescados ÷ este número.']]],
    ['Pedido de material (unidades por cada 100 invitados; 0 = no calcular)', [['ped_vaso_ducale', 'Vaso ducale', 'Valores iniciales tomados de un pedido real de octubre. Solo rellenan cantidades vacías.'],
      ['ped_copa_tinto', 'Copa vino tinto', ''], ['ped_copa_blanco', 'Copa vino blanco', ''], ['ped_copa_cava', 'Copa cava', ''], ['ped_vaso_sidra', 'Vaso sidra', ''],
      ['ped_tenedor_trinchero', 'Tenedor trinchero', ''], ['ped_cuchillo_trinchero', 'Cuchillo trinchero', ''], ['ped_cuchara_postre', 'Cuchara postre', ''], ['ped_cuchara_cafe', 'Cuchara café', ''],
      ['ped_redondeo', 'Redondear hacia arriba a múltiplos de', 'Pala de pescado = nº de pescados de Protocolo (2ª opción).']]]
  ];
  window.amReglas = function () {
    const r = REGLAS;
    let h = '<div class="am-modal-cab"><h2>Reglas de cálculo</h2><button class="am-x" data-am-cerrar>✕</button></div>' +
      '<p class="am-suave">Son las fórmulas de la Hoja de Equipos del Excel original. Se aplican a todas las bodas y cada valor calculado se puede corregir a mano. «Invitados» = número definitivo de Protocolo (adultos, niños, cadetes, staff y dudas); si no está, los pax del plano.</p>';
    REGLAS_TXT.forEach(function (g) {
      h += '<h3 class="am-reglas-h">' + g[0] + '</h3><div class="am-reglas">';
      g[1].forEach(function (x) { h += '<label class="am-campo">' + x[1] + '<input type="number" min="0" step="1" id="am-r-' + x[0] + '" value="' + esc(r[x[0]]) + '">' + (x[2] ? '<small>' + x[2] + '</small>' : '') + '</label>'; });
      h += '</div>';
    });
    h += '<div class="am-fila am-fin"><button class="am-btn" onclick="amReglasBase()">Valores del Excel</button><button class="am-btn am-prin" onclick="amReglasGuardar()">Guardar</button></div>';
    modal(h);
  };
  window.amReglasBase = function () { Object.keys(REGLAS_BASE).forEach(function (k) { const i = document.getElementById('am-r-' + k); if (i) i.value = REGLAS_BASE[k]; }); };
  window.amReglasGuardar = function () {
    const n = {};
    Object.keys(REGLAS_BASE).forEach(function (k) { n[k] = num(document.getElementById('am-r-' + k).value); });
    REGLAS = n;
    api().guardar('config', 'reglas', n).then(function () { aviso('Reglas guardadas.'); }).catch(function () {});
    cerrarModal();
    const e = evActual(); if (e && autoRellenar(e).length) guardarEv();
    try { switchSubTab('coordequipos', 'jefesala'); } catch (err) {}
  };
  function antesEquipos() { const e = evActual(); if (e && autoRellenar(e).length) guardarEv(); }
  envolver('renderJefeSalaView', antesEquipos, function () { setTimeout(marcarAutos, 0); });
  envolver('renderJswReplica', antesEquipos, null);
  (function () {
    const orig = window.saveJefeSalaManual;
    window.saveJefeSalaManual = function (clave, valor) {
      const r = orig.apply(this, arguments);
      try {
        const e = evActual(); if (!e) return r;
        const m = e.jefesala_manual;
        if (m && m._auto && m._auto[clave] !== undefined && txt(valor) !== txt(m._auto[clave])) {
          document.querySelectorAll(selectorCampo(clave)).forEach(function (el) { el.classList.remove('am-auto'); el.removeAttribute('title'); });
        }
        if (FUENTES_FORMULA.indexOf(clave) >= 0) {
          const cambios = autoRellenar(e);
          cambios.forEach(function (k) {
            document.querySelectorAll(selectorCampo(k)).forEach(function (el) { if (el !== document.activeElement) el.value = txt(m[k]); });
          });
          if (cambios.length) { guardarEv(); marcarAutos(); }
        }
      } catch (err) { console.warn(err); }
      return r;
    };
  })();

  // ═════════ NUE-03 · Aviso si no coinciden comensales y plano ═════════
  function textoAvisoComensales(e) {
    if (!e) return '';
    const p = e.protocolo || {};
    const d = prtComensalesDef(p);
    if (d.fila < 0) return '';
    let adP = 0, ninP = 0, stP = 0;
    (e.items || []).forEach(function (i) {
      if (i.entity !== 'mesa') return;
      if (i.isStaff) stP += parseInt(i.adultos, 10) || 0; else adP += (parseInt(i.adultos, 10) || 0) + (parseInt(i.cadetes, 10) || 0);
      ninP += parseInt(i.ninos, 10) || 0;
    });
    const adProt = (parseInt(d.adultos, 10) || 0) + (parseInt(d.cadetes, 10) || 0);
    const ninProt = parseInt(d.ninos, 10) || 0;
    const stProt = parseInt(d.staf, 10) || 0;
    if (!(e.items || []).some(function (i) { return i.entity === 'mesa'; })) return '';
    const dif = [];
    if (adProt !== adP) dif.push('adultos + cadetes: Protocolo ' + adProt + ' · plano ' + adP);
    if (ninProt !== ninP) dif.push('niños: Protocolo ' + ninProt + ' · plano ' + ninP);
    if (stProt !== stP) dif.push('staff: Protocolo ' + stProt + ' · plano ' + stP);
    if (!dif.length) return '';
    return '<div class="am-alerta"><i class="fa-solid fa-triangle-exclamation"></i><div><b>El número definitivo de comensales no coincide con el plano.</b><br>' + dif.map(esc).join(' &nbsp;·&nbsp; ') +
      '<br><small>Revisa MESAS SALA en Protocolo o los datos de las mesas del plano.</small></div></div>';
  }
  function pintarAviso(idCont, antesDe, idAviso) {
    const viejo = document.getElementById(idAviso); if (viejo) viejo.remove();
    const html = textoAvisoComensales(evActual());
    if (!html) return;
    const ref = document.getElementById(antesDe) || document.getElementById(idCont);
    if (!ref) return;
    const div = document.createElement('div'); div.id = idAviso; div.innerHTML = html;
    if (ref.id === antesDe) ref.parentNode.insertBefore(div, ref); else ref.insertBefore(div, ref.firstChild);
  }

  // ═════════ NUE-11 · Formatos correctos (teléfonos y mesas) ═════════
  function limpiarTel(v) {
    let s = txt(v);
    if (!s) return s;
    if (s.length > 2 && s.slice(-2) === '.0' && !isNaN(Number(s.slice(0, -2)))) s = s.slice(0, -2);
    const dig = s.split('').filter(function (c) { return c >= '0' && c <= '9'; }).join('');
    if (dig.length === 9 && dig === s.split(' ').join('')) s = dig.slice(0, 3) + ' ' + dig.slice(3, 6) + ' ' + dig.slice(6);
    return s;
  }
  function esClaveTel(k) { return k.indexOf('tlf') >= 0 || k.indexOf('tlfno') >= 0 || k === 'telefono' || k.slice(-9) === '_telefono'; }
  function limpiarFormatos(e) {
    let cambio = false;
    [e.protocolo, e.jefesala_manual].forEach(function (o) {
      if (!o) return;
      Object.keys(o).forEach(function (k) {
        if (!esClaveTel(k) || typeof o[k] === 'object') return;
        const n = limpiarTel(o[k]);
        if (n !== txt(o[k]) && txt(o[k]) !== '') { o[k] = n; cambio = true; }
      });
    });
    return cambio;
  }
  function mesasDelPlano(e) {
    const l = [];
    (e.items || []).forEach(function (i) {
      if (i.entity !== 'mesa' || i.isStaff) return;
      l.push(i.isPresidencial ? 'PRESIDENCIAL' : String(i.calcNumber || i.numFijo || ''));
    });
    return l.filter(function (x) { return x; }).sort(function (a, b) { if (a === 'PRESIDENCIAL') return -1; if (b === 'PRESIDENCIAL') return 1; return num(a) - num(b); });
  }
  function selectoresMesa() {
    const e = evActual(); if (!e) return;
    const mesas = mesasDelPlano(e);
    if (!mesas.length) return;
    const vista = document.getElementById('view-jsw-protocolo'); if (!vista) return;
    vista.querySelectorAll('input.prt-in[oninput^="prtSet(\'me_"]').forEach(function (inp) {
      const h = inp.getAttribute('oninput');
      const clave = h.substring(h.indexOf("'") + 1, h.indexOf("'", h.indexOf("'") + 1));
      if (clave.slice(-5) !== '_mesa') return;
      const actual = txt((e.protocolo || {})[clave]);
      let op = '<option value=""></option>';
      let esta = actual === '';
      mesas.forEach(function (m) { const sel = actual.toUpperCase() === m || (actual.toUpperCase().indexOf('PRESI') === 0 && m === 'PRESIDENCIAL'); if (sel) esta = true; op += '<option value="' + esc(m) + '"' + (sel ? ' selected' : '') + '>' + (m === 'PRESIDENCIAL' ? 'PRESI' : 'M' + esc(m)) + '</option>'; });
      if (!esta) op += '<option value="' + esc(actual) + '" selected>' + esc(actual) + ' (revisar)</option>';
      const s = document.createElement('select');
      s.className = 'prt-sel am-mesa-sel'; s.disabled = inp.disabled;
      s.setAttribute('onchange', "prtSet('" + clave + "', this.value)");
      s.title = 'Mesas del plano';
      s.innerHTML = op;
      inp.replaceWith(s);
    });
  }
  envolver('renderProtocolo', function () { const e = evActual(); if (e && limpiarFormatos(e)) guardarEv(); }, function () {
    selectoresMesa();
    pintarAviso('content-jswprotocolo-protocolo', null, 'am-aviso-com-prot');
  });

  // ═════════ NUE-08 · Rangos de camareros en el plano ═════════
  function etiquetaMesa(i) { return i.isPresidencial ? 'PRESI' : (i.isStaff ? 'STAFF' : String(i.calcNumber || i.numFijo || '?')); }
  function pintarRangos() {
    const e = evActual();
    const capaMesas = document.getElementById('layer-mesas');
    let capa = document.getElementById('am-rangos-capa');
    let panel = document.getElementById('am-rangos');
    const enCamareros = typeof currentPlanoMode !== 'undefined' && currentPlanoMode === 'camareros';
    if (!e || !capaMesas) return;
    if (!capa) { capa = document.createElement('div'); capa.id = 'am-rangos-capa'; capa.className = 'am-rangos-capa'; capaMesas.parentNode.appendChild(capa); }
    if (!panel) {
      const ley = document.getElementById('plano-leyenda');
      if (!ley) return;
      panel = document.createElement('div'); panel.id = 'am-rangos'; panel.className = 'am-rangos';
      ley.parentNode.insertBefore(panel, ley.nextSibling);
    }
    capa.classList.toggle('am-oculto', !enCamareros);
    panel.classList.toggle('am-oculto', !enCamareros);
    if (!enCamareros) return;
    if (!Array.isArray(e.rangos)) e.rangos = [];
    const porId = {};
    (e.items || []).forEach(function (i) { if (i.entity === 'mesa') porId[i.id] = i; });
    let h = '';
    e.rangos.forEach(function (r) {
      (r.mesas || []).forEach(function (id) {
        const i = porId[id]; if (!i) return;
        h += '<div class="am-rango-chip" style="left:' + (i.x + i.w / 2) + 'px;top:' + (i.y + i.h + 4) + 'px">R' + esc(r.n) + (r.camarero ? ' · ' + esc(String(r.camarero).split(' ')[0]) : '') + (r.tipo ? ' ' + esc(r.tipo) : '') + '</div>';
      });
    });
    capa.innerHTML = h;
    const mesas = (e.items || []).filter(function (i) { return i.entity === 'mesa' && !i.isStaff; })
      .sort(function (a, b) { if (a.isPresidencial) return -1; if (b.isPresidencial) return 1; return (a.calcNumber || a.numFijo || 0) - (b.calcNumber || b.numFijo || 0); });
    const nombres = (e.camareros || []).filter(function (c) { return txt(c.nombre); }).map(function (c) { return txt(c.nombre); });
    let t = '<div class="am-rangos-cab"><h3><i class="fa-solid fa-people-arrows"></i> RANGOS DE CAMAREROS</h3>' +
      '<button class="am-btn am-prin" onclick="amRangoNuevo()">+ Añadir rango</button></div>' +
      '<p class="am-suave">Cada rango agrupa las mesas que atiende un camarero (P = comida, B = bebida). Aparecen bajo cada mesa en el plano de camareros.</p>';
    if (!e.rangos.length) t += '<p class="am-vacio">Todavía no hay rangos.</p>';
    e.rangos.forEach(function (r, ri) {
      t += '<div class="am-rango"><div class="am-rango-fila">' +
        '<label>RANGO <input type="number" min="1" value="' + esc(r.n) + '" onchange="amRango(' + ri + ',\'n\',this.value)"></label>' +
        '<label>CAMARERO <select onchange="amRango(' + ri + ',\'camarero\',this.value)"><option value=""></option>' +
        nombres.map(function (n) { return '<option' + (n === r.camarero ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') +
        (r.camarero && nombres.indexOf(r.camarero) < 0 ? '<option selected>' + esc(r.camarero) + '</option>' : '') + '</select></label>' +
        '<label>TIPO <select onchange="amRango(' + ri + ',\'tipo\',this.value)">' + ['', 'P', 'B', 'P/B'].map(function (x) { return '<option' + (x === r.tipo ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' +
        '<button class="am-btn am-peligro" onclick="amRangoBorrar(' + ri + ')"><i class="fa-solid fa-trash"></i></button></div><div class="am-mesas">' +
        mesas.map(function (i) { const on = (r.mesas || []).indexOf(i.id) >= 0; return '<button class="am-mesa' + (on ? ' on' : '') + '" onclick="amRangoMesa(' + ri + ',\'' + i.id + '\')">' + esc(etiquetaMesa(i)) + '</button>'; }).join('') +
        '</div></div>';
    });
    panel.innerHTML = t;
  }
  window.amRangoNuevo = function () { const e = evActual(); if (!e) return; if (!Array.isArray(e.rangos)) e.rangos = []; e.rangos.push({ n: e.rangos.length + 1, camarero: '', tipo: '', mesas: [] }); guardarEv(); pintarRangos(); };
  window.amRango = function (ri, k, v) { const e = evActual(); if (!e || !e.rangos[ri]) return; e.rangos[ri][k] = k === 'n' ? (parseInt(v, 10) || '') : v; guardarEv(); pintarRangos(); };
  window.amRangoBorrar = function (ri) { const e = evActual(); if (!e) return; e.rangos.splice(ri, 1); guardarEv(); pintarRangos(); };
  window.amRangoMesa = function (ri, id) {
    const e = evActual(); if (!e || !e.rangos[ri]) return;
    const l = e.rangos[ri].mesas || (e.rangos[ri].mesas = []);
    const k = l.map(String).indexOf(String(id));
    if (k >= 0) l.splice(k, 1); else {
      e.rangos.forEach(function (r) { r.mesas = (r.mesas || []).filter(function (x) { return String(x) !== String(id); }); });
      const it = (e.items || []).filter(function (i) { return String(i.id) === String(id); })[0];
      e.rangos[ri].mesas.push(it ? it.id : id);
    }
    guardarEv(); pintarRangos();
  };
  envolver('renderCanvas', null, function () { pintarRangos(); pintarAviso(null, 'plano-auto-bar', 'am-aviso-com-plano'); });
  envolver('switchPlanoMode', null, function () { pintarRangos(); });


  // ═════════ Estrella de menús especiales por mesa, calculada desde Protocolo (PLA-19) ═════════
  function especialesPorMesa(e) {
    const p = e.protocolo || {}, cuenta = {};
    Object.keys(p).forEach(function (k) {
      if (k.indexOf('me_') !== 0 || k.slice(-7) !== '_nombre' || !txt(p[k])) return;
      const mesa = txt(p[k.slice(0, -7) + '_mesa']).toUpperCase();
      if (!mesa) return;
      const clave = mesa.indexOf('PRESI') === 0 ? 'PRESIDENCIAL' : mesa;
      cuenta[clave] = (cuenta[clave] || 0) + 1;
    });
    return cuenta;
  }
  function sincronizarEspeciales() {
    const e = evActual(); if (!e) return false;
    const c = especialesPorMesa(e);
    const hay = Object.keys(c).length > 0;
    let cambio = false;
    (e.items || []).forEach(function (i) {
      if (i.entity !== 'mesa' || i.isStaff) return;
      const lab = i.isPresidencial ? 'PRESIDENCIAL' : String(i.calcNumber || i.numFijo || '');
      const n = c[lab] || 0;
      if (hay && (i._espAuto || !i.especiales) && i.especiales !== n) { i.especiales = n; i._espAuto = true; cambio = true; }
      else if (!hay && i._espAuto && i.especiales) { i.especiales = 0; cambio = true; }
    });
    return cambio;
  }
  envolver('renderCanvas', function () { if (sincronizarEspeciales()) guardarEv(); }, null);


  // ═════════ Pedido material y Material: cabeceras que se rellenan solas ═════════
  function autoCampos(obj, mapa) {
    if (!obj._auto || typeof obj._auto !== 'object') obj._auto = {};
    let cambio = false;
    Object.keys(mapa).forEach(function (k) {
      const v = txt(mapa[k]);
      const gest = obj._auto[k] !== undefined && txt(obj[k]) === txt(obj._auto[k]);
      if (v === '') { if (gest) { obj[k] = ''; delete obj._auto[k]; cambio = true; } return; }
      if (txt(obj[k]) === '' || gest) { if (txt(obj[k]) !== v || obj._auto[k] !== v) { obj[k] = v; obj._auto[k] = v; cambio = true; } }
    });
    return cambio;
  }
  function personaDe(e, resp) { try { return jswNames(e, resp); } catch (err) { return ''; } }
  envolver('renderPedidoMaterial', function (root, e) {
    e = e || evActual(); if (!e) return;
    const d = getPedidoData(e); if (!d.fields) d.fields = {};
    const p = e.protocolo || {};
    const fic = e.finca_token && fincasCache[e.finca_token] ? (fincasCache[e.finca_token].ficha || {}) : {};
    if (e.finca_token && !fincasCache[e.finca_token]) leerFinca(e.finca_token).then(function (x) { if (x && x.ficha) { try { renderSimpleDocument('pedido', 'pedido'); } catch (err) {} } });
    if (autoCampos(d.fields, {
      fechaEntrega: fic.montaje_fecha || '', fechaRecogida: fic.recogida_fecha || '',
      responsableServicio: personaDe(e, 'JEFE/A SALA'),
      coordinador: personaDe(e, 'COORDINADOR/A') || p_(p, 'coordinador'),
      telefonoFinca: limpiarTel(p_(p, 'finca_tlfno') || fic.telefono || '')
    })) guardarEv();
    if (pedidoCantidades(e, d)) guardarEv();
  }, function () { setTimeout(marcarPedido, 0); });
  const PED_REGLA = { 'VASO DUCALE': 'ped_vaso_ducale', 'COPA VINO TINTO': 'ped_copa_tinto', 'COPA VINO BLANCO': 'ped_copa_blanco', 'COPA CAVA': 'ped_copa_cava',
    'VASO SIDRA': 'ped_vaso_sidra', 'TENEDOR TRINCHERO': 'ped_tenedor_trinchero', 'CUCHILLO TRINCHERO': 'ped_cuchillo_trinchero', 'CUCHARA POSTRE': 'ped_cuchara_postre', 'CUCHARA CAFE': 'ped_cuchara_cafe' };
  const PED_TXT = {};
  function pedidoCantidades(e, d) {
    const inv = invitadosDe(e), p = e.protocolo || {};
    const red = Math.max(1, num(REGLAS.ped_redondeo) || 1);
    const pescado = num((e.jefesala_manual || {}).nsa_mul_n_pescado) || num(p.n_2opcion);
    let cambio = false;
    (d.rows || []).forEach(function (r) {
      const art = normNombre(r.articulo);
      let v = '', t = '';
      if (art === 'PALA PESCADO') { v = pescado || ''; t = 'Nº de pescados (2ª opción) de Protocolo'; }
      else if (PED_REGLA[art] && num(REGLAS[PED_REGLA[art]]) > 0 && inv) {
        v = Math.ceil(inv * num(REGLAS[PED_REGLA[art]]) / 100 / red - 1e-9) * red;
        t = 'Invitados (' + inv + ') × ' + REGLAS[PED_REGLA[art]] + ' ÷ 100, redondeado a ' + red;
      } else return;
      PED_TXT[art] = t;
      if (autoCampos(r, { cantidad: v })) cambio = true;
    });
    return cambio;
  }
  function marcarPedido() {
    const e = evActual(); if (!e) return;
    const d = getPedidoData(e);
    document.querySelectorAll('[onchange^="updatePedidoRow("]').forEach(function (el) {
      const a = el.getAttribute('onchange') || '';
      if (a.indexOf("'cantidad'") < 0) return;
      const i = parseInt(a.slice('updatePedidoRow('.length), 10);
      const r = d.rows[i]; if (!r) return;
      const auto = r._auto && r._auto.cantidad !== undefined && txt(r.cantidad) === txt(r._auto.cantidad);
      el.classList.toggle('am-auto', !!auto);
      if (auto) el.title = 'Calculado: ' + (PED_TXT[normNombre(r.articulo)] || '') + '. Si escribes otro valor, manda el tuyo.'; else el.removeAttribute('title');
    });
  }

  // ═════════ Protocolo: campos que repetían otro dato ═════════
  // Buffet de quesos · PAX CONTRATADOS = adultos del número definitivo (en el Excel: =C34)
  envolver('renderProtocolo', function () {
    const e = evActual(); if (!e || enVision()) return;
    if (!e.protocolo) e.protocolo = {};
    let ad = '';
    try { const def = prtComensalesDef(e.protocolo); if (def.fila >= 0) ad = def.adultos; } catch (err) {}
    if (autoCampos(e.protocolo, { quesos_pax: ad })) guardarEv();
  }, null);

  // ═════════ Menús especiales: varias personas en un mismo nombre ═════════
  // En la hoja de Google, CANTIDAD cuenta los nombres separados por comas, «y» o saltos de línea.
  function partirNombres(s) {
    let t = String(s || '');
    ['\n', ',', ';', '/', '+', ' y ', ' Y ', ' e ', ' E '].forEach(function (sep) { t = t.split(sep).join('|'); });
    return t.split('|').map(function (x) { return x.trim(); }).filter(function (x) { return x; });
  }
  (function () {
    const orig = window.meBoxes;
    if (typeof orig !== 'function') return;
    window.meBoxes = function () {
      const cajas = orig.apply(this, arguments);
      (cajas || []).forEach(function (b) {
        const l = [];
        (b.personas || []).forEach(function (x) {
          const n = partirNombres(x.nombre);
          if (n.length < 2) { l.push(x); return; }
          n.forEach(function (nom) { l.push(Object.assign({}, x, { nombre: nom })); });
        });
        b.personas = l;
      });
      return cajas;
    };
  })();
  envolver('renderMaterialesView', function () {
    const e = evActual(); if (!e || !e.materiales) return;
    if (autoCampos(e.materiales, { coordinador: personaDe(e, 'COORDINADOR/A') || p_(e.protocolo || {}, 'coordinador') })) guardarEv();
  }, null);

  // ═════════ NUE-04 · Ceremonia ═════════
  function cer() { const e = evActual(); if (!e.ceremonia || typeof e.ceremonia !== 'object') e.ceremonia = {}; return e.ceremonia; }
  function cI(k, label, tipo, ancho) { const c = cer(); return '<label class="am-campo' + (ancho ? ' am-' + ancho : '') + '">' + label + '<input type="' + (tipo || 'text') + '" data-cer="' + k + '" value="' + esc(c[k]) + '"></label>'; }
  function cS(k, label, ops, ancho) { const c = cer(); return '<label class="am-campo' + (ancho ? ' am-' + ancho : '') + '">' + label + '<select data-cer="' + k + '"><option value=""></option>' + ops.map(function (o) { return '<option' + (c[k] === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></label>'; }
  function cT(k, label) { const c = cer(); return '<label class="am-campo am-total">' + label + '<textarea rows="3" data-cer="' + k + '">' + esc(c[k]) + '</textarea></label>'; }
  function cTabla(k, titulo, cols) {
    const c = cer(); if (!Array.isArray(c[k])) c[k] = [];
    let h = '<div class="am-bloque"><div class="am-bloque-cab"><h3>' + titulo + '</h3><button class="am-btn" onclick="amCerFila(\'' + k + '\')">+ Añadir fila</button></div><table class="am-tabla"><thead><tr><th class="am-n">#</th>' +
      cols.map(function (x) { return '<th>' + x[1] + '</th>'; }).join('') + '<th></th></tr></thead><tbody>';
    if (!c[k].length) h += '<tr><td colspan="' + (cols.length + 2) + '" class="am-vacio">Sin filas.</td></tr>';
    c[k].forEach(function (f, i) {
      h += '<tr><td class="am-n">' + (i + 1) + '</td>' + cols.map(function (x) { return '<td><input data-cer-tabla="' + k + '" data-i="' + i + '" data-k="' + x[0] + '" value="' + esc(f[x[0]]) + '"></td>'; }).join('') +
        '<td><button class="am-x" onclick="amCerBorrar(\'' + k + '\',' + i + ')">✕</button></td></tr>';
    });
    return h + '</tbody></table></div>';
  }
  function renderCeremonia() {
    const root = document.getElementById('am-root-am-ceremonia');
    const c = cer();
    let h = cabecera('CEREMONIA');
    h += '<div class="am-bloque"><h3>Datos de la ceremonia</h3><div class="am-rejilla">' +
      cS('hay', 'Hay ceremonia', ['SI', 'NO']) + cS('tipo', 'Tipo', ['CIVIL', 'RELIGIOSA', 'SIMBÓLICA', 'OTRA']) + cI('hora', 'Hora', 'time') +
      cI('espacio_jlv', 'Espacio en JLV') + cI('espacio_cat', 'Espacio en catering') + cI('duracion', 'Duración prevista (min)', 'number') +
      cI('ceremoniante', 'Ceremoniante / oficiante') + cI('ceremoniante_tlf', 'Teléfono del oficiante', 'tel') + cI('coordinador', 'Coordina la ceremonia') +
      cI('recepcion', 'Recepción de invitados') + cI('bebida', 'Bebida de recepción') + cS('pasar_sillas', 'Pasar sillas al cóctel', ['SI', 'NO']) +
      cI('sillas', 'Nº de sillas', 'number') + cI('mesa_ceremonia', 'Mesa / altar') + cI('decoracion', 'Decoración de ceremonia') + '</div></div>';
    h += cTabla('cortejo', 'Cortejo (orden de entrada)', [['persona', 'Persona'], ['rol', 'Rol (padrino, damas, pajes…)'], ['acompana', 'Acompañado de'], ['notas', 'Notas']]);
    h += cTabla('ganchos', 'Lecturas, ganchos y momentos', [['momento', 'Momento'], ['texto', 'Lectura / acción'], ['persona', 'Quién'], ['notas', 'Notas']]);
    h += cTabla('escaleta', 'Escaleta musical', [['momento', 'Momento'], ['cancion', 'Canción'], ['interprete', 'Quién la pone / toca'], ['notas', 'Notas']]);
    h += '<div class="am-bloque"><h3>Pirotecnia, efectos y prohibiciones</h3><div class="am-rejilla">' +
      cS('pirotecnia', 'Pirotecnia o efectos', ['SI', 'NO']) + cI('piro_tipo', 'Tipo (bengalas, chispas frías, humo…)') + cI('piro_hora', 'Momento / hora') +
      cI('piro_empresa', 'Empresa') + cI('piro_contacto', 'Contacto', 'tel') + cS('lanzamiento', 'Lanzamiento a la salida', ['NINGUNO', 'ARROZ', 'PÉTALOS', 'BURBUJAS', 'CONFETI', 'OTRO']) +
      cT('prohibiciones', 'Prohibiciones de la finca o de los novios (confeti, fuego, drones…)') + '</div></div>';
    h += '<div class="am-bloque"><div class="am-bloque-cab"><h3>Plano de la ceremonia</h3><label class="am-btn">Subir imagen<input type="file" accept="image/*" class="am-oculto" onchange="amCerPlano(this)"></label>' +
      (c.plano ? '<button class="am-btn am-peligro" onclick="amCerPlanoQuitar()">Quitar</button>' : '') + '</div>' +
      (c.plano ? '<img class="am-plano-img" src="' + c.plano + '" alt="Plano de la ceremonia">' : '<p class="am-vacio">Sube una foto o un dibujo del montaje de la ceremonia.</p>') + '</div>';
    h += '<div class="am-bloque">' + cT('notas', 'Notas') + '</div>';
    h += '<p class="am-suave">Hay ceremonia, hora, recepción, bebida, sillas y espacios pasan solos a EQUIPOS › JEFE SALA.</p>';
    root.innerHTML = h;
  }
  document.addEventListener('change', function (e) {
    const t = e.target;
    if (t.matches && t.matches('[data-cer]')) { const k = t.getAttribute('data-cer'); cer()[k] = t.tagName === 'SELECT' || t.type !== 'text' ? t.value : t.value.toUpperCase(); if (t.type === 'text') t.value = cer()[k]; guardarEv(); }
    if (t.matches && t.matches('[data-cer-tabla]')) { const l = cer()[t.getAttribute('data-cer-tabla')]; const f = l[parseInt(t.getAttribute('data-i'), 10)]; if (f) { f[t.getAttribute('data-k')] = t.value.toUpperCase(); t.value = f[t.getAttribute('data-k')]; guardarEv(); } }
  });
  window.amCerFila = function (k) { const c = cer(); if (!Array.isArray(c[k])) c[k] = []; c[k].push({}); guardarEv(); renderCeremonia(); };
  window.amCerBorrar = function (k, i) { cer()[k].splice(i, 1); guardarEv(); renderCeremonia(); };
  window.amCerPlano = function (inp) { if (!inp.files[0]) return; reducirImagen(inp.files[0], 1400).then(function (d) { cer().plano = d; guardarEv(); renderCeremonia(); }).catch(function () { aviso('No se ha podido leer la imagen.', true); }); };
  window.amCerPlanoQuitar = function () { delete cer().plano; guardarEv(); renderCeremonia(); };

  // ═════════ NUE-05 · Ficha de la finca ═════════
  const FICHA = window.AM_FICHA_FINCA;
  const fincasCache = {};
  function enlaceFinca(t) { return location.origin + location.pathname.split('index.html').join('') + 'finca.html?f=' + t; }
  async function leerFinca(t) {
    if (!t) return null;
    try { const d = await api().leer('fincas', t); fincasCache[t] = d; return d; } catch (e) { return fincasCache[t] || null; }
  }
  function htmlFicha(d, editable) {
    const f = (d && d.ficha) || {};
    let h = '';
    FICHA.forEach(function (sec) {
      h += '<div class="am-bloque"><h3>' + esc(sec.titulo) + '</h3><div class="am-rejilla">';
      sec.campos.forEach(function (c) {
        const v = f[c[0]] === undefined ? '' : f[c[0]];
        const cls = 'am-campo' + (c[2] === 'texto' ? ' am-total' : '');
        if (!editable) { h += '<div class="' + cls + '">' + esc(c[1]) + '<div class="am-valor">' + (txt(v) ? esc(v).split('\n').join('<br>') : '—') + '</div></div>'; return; }
        if (c[2] === 'texto') h += '<label class="' + cls + '">' + esc(c[1]) + '<textarea rows="3" data-finca="' + c[0] + '">' + esc(v) + '</textarea></label>';
        else if (c[2] === 'sino') h += '<label class="' + cls + '">' + esc(c[1]) + '<select data-finca="' + c[0] + '"><option></option><option' + (v === 'SI' ? ' selected' : '') + '>SI</option><option' + (v === 'NO' ? ' selected' : '') + '>NO</option></select></label>';
        else h += '<label class="' + cls + '">' + esc(c[1]) + '<input type="' + (c[2] || 'text') + '" data-finca="' + c[0] + '" value="' + esc(v) + '"></label>';
      });
      h += '</div></div>';
    });
    return h;
  }
  async function renderFinca() {
    const root = document.getElementById('am-root-am-finca');
    const e = evActual();
    let h = cabecera('FICHA DE LA FINCA');
    if (e.lugar_tipo === 'BODA JARDINES LA VID' || txt(e.ubicacion) === 'JARDINES LA VID') {
      root.innerHTML = h + '<div class="am-bloque"><p>Esta boda es en <b>Jardines La Vid</b>: no necesita ficha de finca.</p></div>'; return;
    }
    if (!e.finca_token) {
      root.innerHTML = h + '<div class="am-bloque"><h3>La finca rellena su ficha con un enlace</h3><p>La finca recibe un enlace, sin cuenta ni contraseña, y rellena horarios, potencia eléctrica, material, qué se puede dejar y cuándo recogerlo, normas y firma. La ficha queda guardada para las próximas bodas en <b>' + esc(e.ubicacion || 'esta finca') + '</b>.</p>' +
        (puedePlan() ? '<button class="am-btn am-prin" onclick="amFincaCrear()">Crear enlace para la finca</button>' : '<p class="am-suave">Pide a gestión que cree el enlace.</p>') + '</div>';
      return;
    }
    root.innerHTML = h + '<div class="am-bloque"><p class="am-suave">Cargando ficha…</p></div>';
    const d = await leerFinca(e.finca_token);
    const url = enlaceFinca(e.finca_token);
    h += '<div class="am-bloque"><div class="am-bloque-cab"><h3>' + esc((d && d.nombre) || e.ubicacion) + '</h3>' +
      (d && d.firmadoEn ? '<span class="am-estado ok">Firmada por ' + esc(d.firmadoPor || 'la finca') + ' · ' + esc(d.firmadoEn) + '</span>' : '<span class="am-estado pend">Pendiente de que la finca la rellene y firme</span>') + '</div>' +
      '<div class="am-enlace"><input readonly value="' + esc(url) + '" id="am-finca-url"><button class="am-btn am-prin" onclick="amCopiar(\'am-finca-url\')">Copiar enlace</button>' +
      '<a class="am-btn" target="_blank" rel="noopener" href="' + esc(url) + '">Abrir</a><button class="am-btn" onclick="switchTab(\'am-finca\')">Actualizar</button></div>' +
      '<p class="am-suave">Envía este enlace a la finca por WhatsApp o correo. Quien tenga el enlace puede rellenar la ficha.</p></div>';
    const editable = puedePlan() && !enVision();
    h += htmlFicha(d, editable);
    if (d && d.firma) h += '<div class="am-bloque"><h3>Firma de la finca</h3><img src="' + d.firma + '" class="am-firma" alt="Firma"></div>';
    if (editable) h += '<div class="am-fila am-fin"><button class="am-btn am-prin" onclick="amFincaGuardar()">Guardar cambios de la ficha</button></div>';
    root.innerHTML = h;
  }
  window.amCopiar = function (id) { const i = document.getElementById(id); i.select(); try { navigator.clipboard.writeText(i.value); } catch (e) { document.execCommand('copy'); } aviso('Enlace copiado.'); };
  window.amFincaCrear = async function () {
    const e = evActual(); if (!e) return;
    const nombre = txt(e.nombre_finca || e.ubicacion).toUpperCase();
    try {
      const ya = await api().listar('fincas', 'nombre', nombre);
      let t;
      if (ya.length) t = ya[0].id;
      else { t = api().nuevoId(); await api().guardar('fincas', t, { nombre: nombre, ficha: {}, creadoPor: api().nombre() }); }
      e.finca_token = t; guardarEv();
      aviso(ya.length ? 'Esta finca ya tenía ficha: se ha enlazado.' : 'Enlace creado.');
      renderFinca();
    } catch (err) { aviso('No se ha podido crear el enlace.', true); }
  };
  window.amFincaGuardar = async function () {
    const e = evActual(); if (!e || !e.finca_token) return;
    const d = (await leerFinca(e.finca_token)) || {};
    const f = Object.assign({}, d.ficha || {});
    document.querySelectorAll('#am-root-am-finca [data-finca]').forEach(function (el) { f[el.getAttribute('data-finca')] = el.value; });
    await api().guardar('fincas', e.finca_token, { ficha: f });
    aviso('Ficha guardada.'); renderFinca();
  };

  // ═════════ NUE-06 · Planning semanal de montaje ═════════
  let semana = null;
  function lunesDe(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return x; }
  async function renderPlanning() {
    if (!semana) semana = lunesDe(new Date());
    const root = document.getElementById('am-root-am-planning');
    const dias = [];
    for (let i = 0; i < 7; i++) { const d = new Date(semana); d.setDate(d.getDate() + i); dias.push(d); }
    const ini = isoDe(dias[0]), fin = isoDe(dias[6]);
    const desde = new Date(semana); desde.setDate(desde.getDate() - 14);
    const hasta = new Date(semana); hasta.setDate(hasta.getDate() + 21);
    const evs = Object.keys(appData.events).map(function (id) { const x = appData.events[id]; return { id: id, e: x }; })
      .filter(function (o) { return o.e.fecha && o.e.fecha >= isoDe(desde) && o.e.fecha <= isoDe(hasta); });
    const tokens = evs.map(function (o) { return o.e.finca_token; }).filter(function (t) { return t && !fincasCache[t]; });
    if (tokens.length) { await Promise.all(tokens.map(leerFinca)); }
    const tareas = {};
    function add(fecha, t) { if (!fecha || fecha < ini || fecha > fin) return; (tareas[fecha] = tareas[fecha] || []).push(t); }
    evs.forEach(function (o) {
      const e = o.e, p = e.protocolo || {};
      const fic = e.finca_token && fincasCache[e.finca_token] ? (fincasCache[e.finca_token].ficha || {}) : {};
      const tot = (typeof calcularTotalesEvento === 'function') ? calcularTotalesEvento(e.items || []) : { pax: 0, ninos: 0 };
      add(e.fecha, { tipo: 'boda', hora: txt(e.hora), titulo: txt(e.boda), lugar: txt(e.ubicacion), det: tot.pax + ' pax' + (tot.ninos ? ' + ' + tot.ninos + ' niños' : ''), id: o.id });
      add(fic.montaje_fecha, { tipo: 'montaje', hora: txt(fic.montaje_hora), titulo: 'Montaje · ' + txt(e.boda), lugar: txt(e.ubicacion), det: 'Acceso para montaje (ficha de la finca)', id: o.id });
      add(fic.recogida_fecha, { tipo: 'recogida', hora: txt(fic.recogida_hora), titulo: 'Recogida · ' + txt(e.boda), lugar: txt(e.ubicacion), det: 'Recogida de material (ficha de la finca)', id: o.id });
      add(p.deco_fecha, { tipo: 'deco', hora: txt(p.deco_hora), titulo: 'Decoración · ' + txt(e.boda), lugar: txt(e.ubicacion), det: txt(p.deco_decorador) || 'Montaje de decoración', id: o.id });
      add(p.deco_fecha_rec, { tipo: 'recogida', hora: txt(p.deco_hora_rec), titulo: 'Recogida deco · ' + txt(e.boda), lugar: txt(e.ubicacion), det: txt(p.deco_decorador), id: o.id });
      add(p.det_fecha, { tipo: 'detalles', hora: txt(p.det_hora), titulo: 'Recepción de detalles · ' + txt(e.boda), lugar: txt(e.ubicacion), det: '', id: o.id });
    });
    const titulo = dias[0].getDate() + ' de ' + MESES[dias[0].getMonth()] + ' – ' + dias[6].getDate() + ' de ' + MESES[dias[6].getMonth()] + ' de ' + dias[6].getFullYear();
    let h = cabecera('PLANNING SEMANAL', 'Montajes, bodas y recogidas de la semana');
    h += '<div class="am-semana-nav"><button class="am-btn" onclick="amSemana(-1)">‹ Semana anterior</button><div class="am-semana-t">' + esc(titulo) + '</div>' +
      '<button class="am-btn" onclick="amSemana(0)">Esta semana</button><button class="am-btn" onclick="amSemana(1)">Semana siguiente ›</button></div>';
    h += '<div class="am-leyenda-sem"><span class="t-boda">Boda</span><span class="t-montaje">Montaje</span><span class="t-deco">Decoración</span><span class="t-detalles">Detalles</span><span class="t-recogida">Recogida</span></div><div class="am-semana">';
    const hoy = isoDe(new Date());
    dias.forEach(function (d, i) {
      const iso = isoDe(d);
      const l = (tareas[iso] || []).sort(function (a, b) { return a.hora.localeCompare(b.hora); });
      h += '<div class="am-dia' + (iso === hoy ? ' hoy' : '') + (i >= 5 ? ' finde' : '') + '"><div class="am-dia-cab"><b>' + DIAS[i] + '</b><span>' + d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3) + '</span></div>';
      if (!l.length) h += '<div class="am-vacio">—</div>';
      l.forEach(function (t) {
        h += '<div class="am-tarea t-' + t.tipo + '" onclick="abrirEvento(\'' + t.id + '\', true)" title="Abrir la boda"><div class="am-tarea-h">' + esc(t.hora || '--:--') + '</div><div class="am-tarea-t">' + esc(t.titulo) + '</div>' +
          (t.lugar ? '<div class="am-tarea-d"><i class="fa-solid fa-location-dot"></i> ' + esc(t.lugar) + '</div>' : '') + (t.det ? '<div class="am-tarea-d">' + esc(t.det) + '</div>' : '') + '</div>';
      });
      h += '</div>';
    });
    h += '</div><p class="am-suave">Las fechas de montaje y recogida salen de la FICHA DE LA FINCA; las de decoración y detalles, de PROTOCOLO.</p>';
    if (verPersonal()) {
      if (!DIR.length && puedePlan()) { try { await cargarDirectorio(); } catch (err) {} }
      h += personalSemana(dias, evs);
    }
    root.innerHTML = h;
  }
  // Personal de la semana: sustituye la hoja a mano (una columna por boda, hora de entrada y confirmación)
  function personalSemana(dias, evs) {
    const edita = puedePlan() && !enVision();
    let h = '<div class="am-bloque"><h3 class="am-reglas-h">PERSONAL DE LA SEMANA</h3>' +
      '<p class="am-suave">Sale del LISTADO DE PERSONAL de cada boda. Marca la casilla cuando la persona confirme. En rojo, quien está en dos bodas el mismo día.</p>';
    let alguno = false;
    dias.forEach(function (d, i) {
      const iso = isoDe(d);
      const delDia = evs.filter(function (o) { return o.e.fecha === iso; });
      if (!delDia.length) return;
      alguno = true;
      const cuenta = {};
      delDia.forEach(function (o) { (o.e.camareros || []).forEach(function (c) { const k = normNombre(c.nombre); if (k) cuenta[k] = (cuenta[k] || 0) + 1; }); });
      h += '<div class="am-ps-dia"><div class="am-ps-dia-t">' + DIAS[i] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()] + '</div><div class="am-ps-cols">';
      delDia.forEach(function (o) {
        const cams = (o.e.camareros || []).filter(function (c) { return txt(c.nombre); })
          .sort(function (a, b) { return (txt(a.entrada) || '99').localeCompare(txt(b.entrada) || '99') || txt(a.nombre).localeCompare(txt(b.nombre)); });
        const conf = cams.filter(function (c) { return c.confirmado; }).length;
        h += '<div class="am-ps-col"><div class="am-ps-cab" onclick="abrirEvento(\'' + o.id + '\', true)" title="Abrir la boda"><b>' + esc(o.e.boda) + '</b><span>' + esc(txt(o.e.hora) || '--:--') + ' · ' + esc(o.e.ubicacion) + '</span>' +
          '<span class="am-ps-n' + (cams.length && conf === cams.length ? ' ok' : '') + '">' + conf + ' / ' + cams.length + ' confirmados</span></div>';
        if (!cams.length) h += '<div class="am-vacio">Sin personal en el listado</div>';
        cams.forEach(function (c) {
          const dup = cuenta[normNombre(c.nombre)] > 1;
          h += '<label class="am-ps-fila' + (dup ? ' dup' : '') + (c.confirmado ? ' conf' : '') + '"' + (dup ? ' title="Está en dos bodas el mismo día"' : '') + '>' +
            '<input type="checkbox"' + (c.confirmado ? ' checked' : '') + (edita ? '' : ' disabled') + ' onchange="amConfirmar(\'' + o.id + '\',' + esc(JSON.stringify(c.id)) + ',this.checked)">' +
            '<span class="am-ps-h">' + esc(txt(c.entrada) || '--:--') + '</span><span class="am-ps-nom">' + esc(txt(c.nombre).toUpperCase()) + '</span><span class="am-ps-eq">' + esc(txt(c.equipo) && txt(c.equipo) !== '-' ? txt(c.equipo) : txt(c.responsabilidad).toUpperCase()) + '</span></label>';
        });
        h += '</div>';
      });
      if (DIR.length) {
        const libres = DIR.filter(function (p) {
          const claves = [normNombre(p.nombre)].concat((p.alias || []).map(normNombre));
          return !claves.some(function (k) { return cuenta[k]; });
        }).map(function (p) { return txt(p.nombre).toUpperCase(); }).sort();
        h += '<div class="am-ps-col am-ps-libres"><div class="am-ps-cab"><b>SIN ASIGNAR</b><span>' + libres.length + ' personas del directorio</span></div>' +
          (libres.length ? '<div class="am-ps-chips">' + libres.map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('') + '</div>' : '<div class="am-vacio">—</div>') + '</div>';
      }
      h += '</div></div>';
    });
    if (!alguno) h += '<div class="am-vacio">No hay bodas esta semana.</div>';
    return h + '</div>';
  }
  window.amConfirmar = function (evId, camId, si) {
    const e = appData.events[evId]; if (!e || !puedePlan()) return;
    const c = (e.camareros || []).filter(function (x) { return x.id === camId; })[0]; if (!c) return;
    c.confirmado = !!si;
    try { pendingSaveIds.add(evId); updateSaveIndicator(); saveEventNow(evId); } catch (err) { console.warn(err); }
    renderPlanning();
  };
  window.amSemana = function (d) { if (d === 0) semana = lunesDe(new Date()); else { semana = new Date(semana); semana.setDate(semana.getDate() + 7 * d); } renderPlanning(); };

  // ═════════ Minutas para imprimir (4 por A4, recortables) ═════════
  // Personal: delante el plano de la boda; detrás su cuadro de tareas, la minuta de camareros y los menús especiales.
  // Minuta de la boda y minutas especiales: con el logo oficial, tantas copias como mesas o personas.
  let mnModo = 'personal', mnDoble = true, mnFolio = true, mnSel = null, mnCopias = {};
  const MN_W = 105, MN_H = 148.5; // mm
  function mmPx(mm) { return mm * 96 / 25.4; }
  function sinControles(nodo) {
    nodo.querySelectorAll('select').forEach(function (sel) {
      const o = sel.options[sel.selectedIndex];
      const sp = document.createElement('span'); sp.className = 'am-mn-val'; sp.textContent = o ? o.text : '';
      sel.parentNode.replaceChild(sp, sel);
    });
    nodo.querySelectorAll('input, textarea').forEach(function (i) {
      const sp = document.createElement('span'); sp.className = 'am-mn-val'; sp.textContent = i.type === 'checkbox' ? (i.checked ? '☑' : '☐') : i.value;
      i.parentNode.replaceChild(sp, i);
    });
    nodo.querySelectorAll('button, .delete-btn, .ctrl-handle, .no-print, .am-btn').forEach(function (b) { b.remove(); });
    nodo.querySelectorAll('[id]').forEach(function (x) { x.removeAttribute('id'); });
    nodo.removeAttribute('id');
    return nodo;
  }
  function clonar(sel) { const n = document.querySelector(sel); return n ? sinControles(n.cloneNode(true)) : null; }
  function textoFecha(iso) {
    const p = String(iso || '').split('-'); if (p.length !== 3) return txt(iso);
    return parseInt(p[2], 10) + ' de ' + MESES[parseInt(p[1], 10) - 1] + ' de ' + p[0];
  }
  // Recorta el plano a lo que ocupan las mesas y decide si se gira para aprovechar la tarjeta
  function planoRecortado() {
    const e = evActual();
    let prev = 'principal';
    try { prev = currentPlanoMode; switchPlanoMode('camareros'); renderCanvas(); } catch (err) {}
    const lienzo = document.getElementById('canvas-plano');
    if (!lienzo) return null;
    const c = sinControles(lienzo.cloneNode(true));
    const lab = c.querySelector('.absolute.top-4.left-4'); if (lab) lab.remove(); // rótulo «SALA / CARPA»
    // Los cuadros de personal por zona salen del plano (tapaban mesas y platos) y van debajo como leyenda
    let leyZonas = null;
    const zcs = Array.prototype.slice.call(c.querySelectorAll('.zone-card')).concat(Array.prototype.slice.call(document.querySelectorAll('#plano-rangos .zone-card')));
    if (zcs.length) {
      leyZonas = document.createElement('div');
      leyZonas.className = 'am-mn-zonas';
      zcs.forEach(function (z) {
        const k = z.cloneNode(true);
        k.style.position = 'static'; k.style.left = ''; k.style.top = ''; k.style.boxShadow = 'none';
        const t = k.firstElementChild; k.setAttribute('data-zona', t ? txt(t.textContent).toUpperCase() : '');
        leyZonas.appendChild(k); z.remove();
      });
    }
    c.style.width = '900px'; c.style.height = '600px';
    Array.prototype.forEach.call(c.children, function (capa) { capa.style.position = 'absolute'; capa.style.left = '0'; capa.style.top = '0'; capa.style.width = '900px'; capa.style.height = '600px'; });
    const ley = clonar('#plano-leyenda');
    const tot = {};
    ['p4', 'p3', 'p2'].forEach(function (k) { const b = document.getElementById('tot-' + k + '-badge'); tot[k] = b ? txt(b.textContent) : ''; });
    try { switchPlanoMode(prev); renderCanvas(); } catch (err) {}
    // medir fuera de pantalla
    const caja = document.createElement('div');
    caja.style.cssText = 'position:fixed;left:-20000px;top:0;width:900px;height:600px;';
    c.style.position = 'relative'; c.style.margin = '0'; c.style.boxShadow = 'none';
    caja.appendChild(c); document.body.appendChild(caja);
    const base = c.getBoundingClientRect();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    c.querySelectorAll('*').forEach(function (el) {
      const r = el.getBoundingClientRect(); if (!r.width && !r.height) return;
      if (r.width > 880 && r.height > 580) return; // capas a tamaño completo
      x0 = Math.min(x0, r.left - base.left); y0 = Math.min(y0, r.top - base.top); x1 = Math.max(x1, r.right - base.left); y1 = Math.max(y1, r.bottom - base.top);
    });
    caja.remove();
    if (x1 < x0) { x0 = 0; y0 = 0; x1 = 900; y1 = 600; }
    const m = 12; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(900, x1 + m); y1 = Math.min(600, y1 + m);
    c.classList.remove('plan-grid'); c.style.border = '0'; c.style.borderRadius = '0';
    return { nodo: c, x0: x0, y0: y0, w: x1 - x0, h: y1 - y0, ley: leyZonas, tot: tot, e: e };
  }
  function encajarPlano(cont, P, alto) {
    // cont: div de ancho fijo (px) donde cabe el plano; alto disponible (px)
    const W = cont.clientWidth, H = alto;
    const sN = Math.min(W / P.w, H / P.h), sR = Math.min(W / P.h, H / P.w);
    const girar = sR > sN * 1.12;
    const s = girar ? sR : sN;
    const vis = document.createElement('div');
    const vw = (girar ? P.h : P.w) * s, vh = (girar ? P.w : P.h) * s;
    vis.style.cssText = 'position:relative;overflow:hidden;margin:0 auto;width:' + vw + 'px;height:' + vh + 'px;';
    const n = P.nodo.cloneNode(true);
    n.style.position = 'absolute'; n.style.left = '0'; n.style.top = '0'; n.style.transformOrigin = '0 0';
    n.style.transform = girar
      ? 'translate(' + (P.h * s) + 'px,0) rotate(90deg) scale(' + s + ') translate(' + (-P.x0) + 'px,' + (-P.y0) + 'px)'
      : 'scale(' + s + ') translate(' + (-P.x0) + 'px,' + (-P.y0) + 'px)';
    vis.appendChild(n); cont.appendChild(vis);
  }
  // Bloques apilados que se reducen para caber en la tarjeta
  function apilar(destino, bloques) {
    // Los bloques «fijo» mantienen su escala (ancho completo); el resto se reduce para caber en el hueco que queda
    const W = destino.clientWidth, H = destino.clientHeight;
    const cajas = bloques.filter(function (b) { return b; }).map(function (b) {
      const cj = document.createElement('div'); cj.className = 'am-mn-bloque';
      const inn = document.createElement('div'); inn.style.width = (b.ancho || W) + 'px'; inn.style.transformOrigin = '0 0';
      inn.appendChild(b.nodo); cj.appendChild(inn); destino.appendChild(cj);
      return { cj: cj, inn: inn, w: b.ancho || W, fijo: !!b.fijo, llenar: !!b.llenar, max: b.max || 1.6, s: Math.min(b.max || 1.6, W / (b.ancho || W)) };
    });
    cajas.forEach(function (c) { if (c.llenar) { c.inn.style.width = c.w + 'px'; const hh = c.inn.scrollHeight; c.s = Math.min(c.max, W / c.w, (H - 6) / hh); } });
    let fijo = 0, flex = 0;
    cajas.forEach(function (c) { c.h = c.inn.scrollHeight; if (c.fijo) fijo += c.h * c.s; else flex += c.h * c.s; });
    const gap = cajas.length * 4;
    let fF = 1, fX = 1;
    if (fijo + flex + gap > H) {
      if (fijo + gap < H * 0.7 && flex > 0) fX = Math.max(0.2, (H - fijo - gap) / flex);
      else { fF = fX = (H - gap) / (fijo + flex); }
    }
    cajas.forEach(function (c) {
      const s = c.s * (c.fijo ? fF : fX);
      c.inn.style.transform = 'scale(' + s + ')'; c.cj.style.height = Math.ceil(c.h * s) + 'px'; c.cj.style.width = W + 'px';
      if (s * c.w < W) c.inn.style.marginLeft = ((W - s * c.w) / 2) + 'px';
    });
  }
  function tarjeta(clase) {
    const t = document.createElement('div'); t.className = 'am-mn' + (clase ? ' ' + clase : '');
    const i = document.createElement('div'); i.className = 'am-mn-in'; t.appendChild(i);
    return { t: t, i: i };
  }
  function hoja(hojas, tarjetas, porHoja) {
    const n = porHoja || 4;
    for (let k = 0; k < tarjetas.length; k += n) {
      const h = document.createElement('div'); h.className = 'am-hoja' + (n === 1 ? ' am-hoja-1' : '');
      tarjetas.slice(k, k + n).forEach(function (t) { h.appendChild(t || tarjeta('vacia').t); });
      hojas.appendChild(h);
    }
  }
  // Resumen de comensales (plano) + listado de menús especiales con persona y mesa
  function comensalesNodo(e) {
    let r = null; try { r = rbComensales(e); } catch (err) {}
    let cajas = []; try { cajas = meBoxes(e); } catch (err) {}
    const d = document.createElement('div'); d.className = 'am-mn-com';
    let h = '<div class="am-mn-com-t">COMENSALES</div>';
    if (r) h += '<div class="am-mn-com-k">' + [['PAX', r.pax], ['ADULTOS', r.adultos], ['CADETES', r.cadetes], ['STAFF', r.staff], ['NIÑOS', r.ninos], ['TRONAS', r.tronas]].map(function (x) { return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>';
    h += '<div class="am-mn-com-t">MENÚS ESPECIALES</div>';
    if (!cajas.length) h += '<div class="am-mn-com-v">Sin menús especiales.</div>';
    else h += '<table class="am-mn-com-tab"><tr><th>MESA</th><th>NOMBRE</th><th>MENÚ</th></tr>' + [].concat.apply([], cajas.map(function (b) {
      return b.personas.map(function (x) { return { mesa: txt(x.mesa), nombre: txt(x.nombre), b: b }; });
    })).sort(function (a, b) { return (parseInt(a.mesa, 10) || 999) - (parseInt(b.mesa, 10) || 999); }).map(function (x) {
      return '<tr><td class="am-c"><b>' + esc(x.mesa || '—') + '</b></td><td>' + esc(x.nombre) + '</td><td><span style="border-left:5px solid ' + x.b.color + ';padding-left:4px;">' + esc(txt(x.b.tipo) || 'ESPECIAL') + (txt(x.b.menu) ? ' · ' + esc(txt(x.b.menu)) : '') + '</span></td></tr>';
    }).join('') + '</table>';
    d.innerHTML = h;
    return d;
  }
  function especialesNota(e) {
    let cajas = []; try { cajas = meBoxes(e); } catch (err) {}
    if (!cajas.length) return null;
    const d = document.createElement('div'); d.className = 'am-mn-esp';
    d.innerHTML = '<b>MENÚS ESPECIALES:</b> ' + cajas.map(function (b) {
      return '<span style="border-left:4px solid ' + b.color + ';padding-left:3px;">' + esc(b.tipo || 'ESPECIAL') + ' (' + esc(b.menu) + '): ' +
        b.personas.map(function (x) { return esc(x.nombre) + (x.mesa ? ' M' + esc(x.mesa) : ''); }).join(', ') + '</span>';
    }).join(' · ');
    return d;
  }
  function personasMinuta(e) {
    const vistos = {}, out = [];
    let lista = []; try { lista = tsCamareros(e); } catch (err) {}
    lista.forEach(function (x, i) { vistos[x.cam.id] = 1; out.push({ cam: x.cam, idx: i, equipo: x.equipo }); });
    (e.camareros || []).forEach(function (c) { if (txt(c.nombre) && !vistos[c.id]) out.push({ cam: c, idx: -1, equipo: txt(c.equipo) || txt(c.responsabilidad) }); });
    return out;
  }
  function renderMinutas() {
    const root = document.getElementById('am-root-am-minutas');
    const e = evActual(); if (!e) return;
    const pers = personasMinuta(e);
    if (!mnSel || mnSel._ev !== currentEventId) { mnSel = { _ev: currentEventId }; pers.forEach(function (p) { mnSel[p.cam.id] = true; }); mnCopias = {}; }
    let esp = []; try { esp = getMinutasEspeciales(e); } catch (err) {}
    const mesas = (e.items || []).filter(function (i) { return i.entity === 'mesa'; }).length;
    if (mnCopias.boda === undefined) mnCopias.boda = mesas || 10;
    let h = cabecera('MINUTAS PARA IMPRIMIR', undefined, false);
    h += '<div class="am-mn-modos">' + [['personal', 'Personal: plano + tareas'], ['boda', 'Minuta de la boda'], ['especiales', 'Minutas especiales']].map(function (m) {
      return '<button class="am-btn' + (mnModo === m[0] ? ' am-prin' : '') + '" onclick="amMnModo(\'' + m[0] + '\')">' + m[1] + '</button>'; }).join('') +
      '<button class="am-btn am-prin am-mn-imp" onclick="amMnImprimir()"><i class="fa-solid fa-print mr-1"></i>IMPRIMIR</button></div>';
    h += '<div class="am-bloque am-mn-opc">';
    if (mnModo === 'personal') {
      h += '<p class="am-suave">Una hoja por persona del LISTADO DE PERSONAL: <b>delante el plano</b> con su rango marcado y <b>detrás la minuta</b> de camareros, el resumen de comensales con los menús especiales y <b>sus tareas</b> (las de la hoja de equipo incluidas).</p>' +
        '<div class="am-mn-modos">' + [[true, 'Un folio por persona (A4)'], [false, '4 por A4 (tamaño A6)']].map(function (f) { return '<button class="am-btn' + (mnFolio === f[0] ? ' am-prin' : '') + '" onclick="amMnFolio(' + f[0] + ')">' + f[1] + '</button>'; }).join('') + '</div>' +
        '<label class="am-mn-chk"><input type="checkbox"' + (mnDoble ? ' checked' : '') + ' onchange="amMnDoble(this.checked)"> Doble cara (en la impresora: «Imprimir en ambas caras · borde largo»)</label>' +
        '<div class="am-mn-pers">' + pers.map(function (p) { return '<label><input type="checkbox"' + (mnSel[p.cam.id] ? ' checked' : '') + ' onchange="amMnPers(' + esc(JSON.stringify(p.cam.id)) + ',this.checked)"> ' + esc(txt(p.cam.nombre).toUpperCase()) + ' <small>' + esc(p.equipo) + '</small></label>'; }).join('') + '</div>';
    } else if (mnModo === 'boda') {
      h += '<p class="am-suave">La minuta de la boda con el logo, 4 por A4. Por defecto, una por mesa del plano.</p><label class="am-campo am-mn-num">Copias<input type="number" min="1" value="' + mnCopias.boda + '" onchange="amMnCopias(\'boda\',this.value)"></label>';
    } else {
      h += esp.length ? '<p class="am-suave">Una minuta por persona de cada menú especial, 4 por A4.</p><div class="am-mn-pers">' + esp.map(function (m, i) {
        const def = Math.max(1, (m.personas || []).length); if (mnCopias['e' + i] === undefined) mnCopias['e' + i] = def;
        return '<label class="am-campo am-mn-num" style="border-left:5px solid ' + m.color + ';padding-left:6px;">' + esc(m.titulo || 'Menú especial') + '<input type="number" min="0" value="' + mnCopias['e' + i] + '" onchange="amMnCopias(\'e' + i + '\',this.value)"></label>'; }).join('') + '</div>'
        : '<p class="am-suave">No hay menús especiales en Protocolo.</p>';
    }
    h += '</div><div class="am-mn-prev"><div id="am-hojas"></div></div>';
    root.innerHTML = h;
    setTimeout(function () { componer(e, pers, esp); }, 30);
  }
  function componer(e, pers, esp) {
    const hojas = document.getElementById('am-hojas'); if (!hojas) return;
    hojas.innerHTML = '';
    const caras = [];
    if (mnModo === 'personal') {
      const P = planoRecortado();
      let fichas = [];
      try { renderTareasServicio(); fichas = Array.prototype.slice.call(document.querySelectorAll('#jsw-root-tareas .ts-card')); } catch (err) {}
      let mc = null;
      try { const pv = currentMinutaCamarerosTab; currentMinutaCamarerosTab = 'principal'; renderMinutaCamareros(); mc = clonar('#mc-paper-content'); currentMinutaCamarerosTab = pv; } catch (err) {}
      if (mc && mc.firstElementChild && mc.firstElementChild.querySelector('h1, img')) mc.firstElementChild.remove();
      const elegidos = pers.filter(function (p) { return mnSel[p.cam.id]; });
      const del = [], tra = [];
      elegidos.forEach(function (p) {
        // Delante: plano
        const a = tarjeta('frente' + (mnFolio ? ' folio' : '')); a.t._p = p; del.push(a.t);
        a.i.innerHTML = '<div class="am-mn-cab"><b>' + esc(txt(p.cam.nombre).toUpperCase()) + '</b><span>' + esc(p.equipo) + '</span></div><div class="am-mn-plano"></div>' +
          '<div class="am-mn-pie"><span class="am-mn-pl p4">' + esc(P ? P.tot.p4 : '') + ' platos de 4</span><span class="am-mn-pl p3">' + esc(P ? P.tot.p3 : '') + ' de 3</span><span class="am-mn-pl p2">' + esc(P ? P.tot.p2 : '') + ' de 2</span>' +
          '<span class="am-mn-boda">' + esc(txt(e.boda)) + ' · ' + esc(fechaCorta(e.fecha)) + (e.hora ? ' · ' + esc(e.hora) : '') + '</span></div>';
        // Detrás: tareas + minuta + especiales
        const b = tarjeta('dorso' + (mnFolio ? ' folio' : '')); tra.push(b.t);
        b.i.innerHTML = '<div class="am-mn-cab"><b>' + esc(txt(p.cam.nombre).toUpperCase()) + '</b><span>' + esc(txt(e.boda)) + ' · ' + esc(fechaCorta(e.fecha)) + '</span></div><div class="am-mn-cuerpo"></div>';
        b.t._p = p;

      });
      // colocar en el DOM para poder medir
      if (mnFolio) {
        // Un folio por persona: hoja 1 = plano, hoja 2 = dorso (en doble cara salen en el mismo papel)
        del.forEach(function (t, k) { hoja(hojas, [t], 1); hojas.lastChild.classList.add('cara-a'); hoja(hojas, [tra[k]], 1); hojas.lastChild.classList.add('cara-b'); });
      } else {
      hoja(hojas, del.slice());
      if (mnDoble) {
        const espejo = [];
        for (let k = 0; k < tra.length; k += 4) { const g = tra.slice(k, k + 4); while (g.length < 4) g.push(null); espejo.push(g[1], g[0], g[3], g[2]); }
        hoja(hojas, espejo);
        // reordenar: frente1, dorso1, frente2, dorso2…
        const hs = Array.prototype.slice.call(hojas.children), n = hs.length / 2;
        hojas.innerHTML = ''; for (let k = 0; k < n; k++) { hojas.appendChild(hs[k]); hs[k].classList.add('cara-a'); hojas.appendChild(hs[k + n]); hs[k + n].classList.add('cara-b'); }
      } else hoja(hojas, tra);
      }
      del.forEach(function (t) {
        const zona = t.querySelector('.am-mn-plano'); if (!P) { zona.innerHTML = '<div class="am-vacio">Sin plano</div>'; return; }
        const alto = t.querySelector('.am-mn-in').clientHeight - t.querySelector('.am-mn-cab').offsetHeight - t.querySelector('.am-mn-pie').offsetHeight - (P.ley ? 0 : 0) - 6;
        encajarPlano(zona, P, alto * (P.ley ? 0.82 : 1));
        if (P.ley) { const lz = document.createElement('div'); lz.className = 'am-mn-ley'; lz.style.height = (alto * 0.17) + 'px'; zona.appendChild(lz); const ly = P.ley.cloneNode(true); const mz = txt(t._p && t._p.cam ? t._p.cam.zona : ''); if (mz) Array.prototype.forEach.call(ly.children, function (k) { if ((' ' + k.getAttribute('data-zona') + ' ').indexOf(' ' + mz + ' ') >= 0) k.classList.add('am-mn-zona-mia'); }); apilar(lz, [{ nodo: ly, ancho: 900 }]); }
      });
      tra.forEach(function (t) {
        const p = t._p, cuerpo = t.querySelector('.am-mn-cuerpo');
        cuerpo.style.height = (t.querySelector('.am-mn-in').clientHeight - t.querySelector('.am-mn-cab').offsetHeight - 4) + 'px';
        const f = p.idx >= 0 && fichas[p.idx] ? sinControles(fichas[p.idx].cloneNode(true)) : null;
        const minuta = mc ? mc.cloneNode(true) : null; if (minuta) minuta.classList.add('am-mn-compacto');
        let sinFicha = null;
        if (!f) { try { sinFicha = document.createElement('div'); sinFicha.className = 'ts-card'; sinFicha.innerHTML = tsHojaHtml(e, p.cam); } catch (err) { sinFicha = null; } }
        if (mnFolio) {
          // Arriba: minuta | comensales y menús especiales · Abajo: sus tareas
          const fila = document.createElement('div'); fila.className = 'am-mn-fila';
          const c1 = document.createElement('div'); c1.className = 'am-mn-col'; if (minuta) c1.appendChild(minuta);
          const c2 = document.createElement('div'); c2.className = 'am-mn-col'; c2.appendChild(comensalesNodo(e));
          fila.appendChild(c1); fila.appendChild(c2);
          const tit = document.createElement('div'); tit.className = 'am-mn-com-t'; tit.textContent = 'MIS TAREAS';
          const tareas = document.createElement('div'); tareas.appendChild(tit); tareas.appendChild(f || sinFicha || document.createElement('div'));
          apilar(cuerpo, [{ nodo: fila, ancho: 760, max: 1 }, { nodo: tareas, ancho: 760, fijo: true, max: 1 }]);
        } else {
          apilar(cuerpo, [f ? { nodo: f, ancho: 760, fijo: true } : (sinFicha ? { nodo: sinFicha, ancho: 380, max: 1.25 } : null), minuta ? { nodo: minuta, ancho: 380, max: 1.25 } : null, { nodo: especialesNota(e) || document.createElement('div'), ancho: 380, max: 1.25 }]);
        }
      });
    } else if (mnModo === 'boda') {
      let mb = null;
      try { const pv = currentMinutaTab; currentMinutaTab = 'principal'; renderMinutaPreview(); mb = clonar('#minuta-paper-content'); currentMinutaTab = pv; renderMinutaPreview(); } catch (err) {}
      const n = Math.max(1, parseInt(mnCopias.boda, 10) || 1), l = [];
      for (let k = 0; k < n; k++) { const a = tarjeta('minuta'); a.t._n = mb; l.push(a.t); }
      hoja(hojas, l);
      l.forEach(function (t) { if (t._n) apilar(t.querySelector('.am-mn-in'), [{ nodo: t._n.cloneNode(true), ancho: 330, llenar: true, max: 1.4 }]); });
    } else {
      const l = [];
      esp.forEach(function (m, i) {
        const tmp = document.createElement('div');
        tmp.innerHTML = minutaCuerpoHtml(e, m.data, (e.minuta_logo && e.minuta_logo.especiales) || null, { titulo: m.titulo, color: m.color, personas: m.personas });
        const n = Math.max(0, parseInt(mnCopias['e' + i], 10) || 0);
        for (let k = 0; k < n; k++) { const a = tarjeta('minuta'); a.t.style.borderTop = '5px solid ' + m.color; a.t._n = tmp; l.push(a.t); }
      });
      hoja(hojas, l);
      l.forEach(function (t) { apilar(t.querySelector('.am-mn-in'), [{ nodo: t._n.cloneNode(true), ancho: 330, llenar: true, max: 1.4 }]); });
    }
    if (!hojas.children.length) hojas.innerHTML = '<div class="am-vacio">Nada que imprimir.</div>';
  }
  window.amMnModo = function (m) { mnModo = m; renderMinutas(); };
  window.amMnDoble = function (v) { mnDoble = !!v; renderMinutas(); };
  window.amMnFolio = function (v) { mnFolio = !!v; renderMinutas(); };
  window.amMnPers = function (id, v) { mnSel[id] = !!v; renderMinutas(); };
  window.amMnCopias = function (k, v) { mnCopias[k] = Math.max(0, parseInt(v, 10) || 0); renderMinutas(); };
  window.amMnImprimir = function () {
    const hojas = document.getElementById('am-hojas'); if (!hojas || !hojas.querySelector('.am-hoja')) return;
    const vuelta = hojas.parentNode;
    const st = document.createElement('style'); st.id = 'am-page-mn';
    st.textContent = '@media print { @page { size: A4 portrait; margin: 0; } }';
    document.head.appendChild(st);
    document.body.appendChild(hojas); document.body.classList.add('am-hojas-modo');
    const fin = function () {
      document.body.classList.remove('am-hojas-modo'); vuelta.appendChild(hojas); st.remove();
      window.removeEventListener('afterprint', fin);
    };
    window.addEventListener('afterprint', fin);
    window.print();
  };

  // ═════════ Control de documentación (hoja FEEDBACK DOCU BODAS) ═════════
  // Cada ítem se comprueba solo con lo que ya hay en la app. RRHH o el jefe de sala dan el visto bueno y deciden la gratificación.
  function ctlChk(e, kind, tk) {
    let r = null; try { r = evHojasCheck(kind, tk, e); } catch (err) { return null; }
    const s = e.evaluaciones || {};
    if (s[kind + '_' + tk + '_real'] === 'SI') return { v: 'SI', d: 'Marcada como realizada' };
    if (!r || !r.total) return null;
    if (r.pct >= 100) return { v: 'SI', d: r.hechas + ' de ' + r.total + ' tareas' };
    return { v: r.hechas ? 'PARCIAL' : 'NO', d: r.hechas + ' de ' + r.total + ' tareas (' + r.pct + ' %)' };
  }
  function ctlEquipo(e, kind) {
    const s = e.evaluaciones || {};
    if (s[kind + '_equipo_real'] === 'SI') return { v: 'SI', d: 'Marcada como realizada' };
    const f = (s[kind + '_equipo_filas'] || []).filter(function (x) { return txt(x.nombre); });
    const hechas = f.filter(function (x) { return txt(x.mejora) || txt(x.fortaleza); }).length;
    if (!f.length) return { v: 'NO', d: 'Sin personas evaluadas' };
    return { v: hechas >= f.length ? 'SI' : (hechas ? 'PARCIAL' : 'NO'), d: hechas + ' de ' + f.length + ' personas evaluadas' };
  }
  function ctlConsumo(e, k) { const c = e[k] || {}; return (txt(c.responsable) || txt(c.hora_fin)) ? { v: 'SI', d: 'Responsable: ' + (txt(c.responsable) || '—') } : { v: 'NO', d: 'Sin responsable ni hora de cierre' }; }
  function ctlRecuento(e, k) {
    const l = ((e.materiales || {})[k] || []).filter(function (x) { return txt(x.articulo); });
    const con = l.filter(function (x) { return txt(x.unidades) !== ''; }).length;
    if (!l.length) return { v: 'NO', d: 'Sin artículos' };
    return { v: con >= l.length ? 'SI' : (con ? 'PARCIAL' : 'NO'), d: con + ' de ' + l.length + ' artículos contados' };
  }
  function ctlTiming(e) { const s = e.evaluaciones || {}; const t = Object.assign({}, s.wedding_timing || {}, s.jefesala_timing || {}); const n = Object.keys(t).filter(function (k) { return t[k] && t[k].h; }).length; return n ? { v: 'SI', d: n + ' horas anotadas' } : { v: 'NO', d: 'Sin horas en el Timing' }; }
  function ctlPlano(e) { const n = (e.items || []).filter(function (i) { return i.entity === 'mesa'; }).length; return n ? { v: 'SI', d: n + ' mesas en el plano' } : { v: 'NO', d: 'Plano vacío' }; }
  function ctlEquipos(e) {
    const m = e.jefesala_manual || {}, er = e.equipos_realizada || {};
    const k = ['ig_realizada', 'nsa_realizada', 'ncc_realizada', 'nco_realizada', 'nof_realizada', 'nbl_realizada'];
    const si = k.filter(function (x) { return txt(m[x]).toUpperCase().indexOf('S') === 0; }).length;
    if (er.jefesala || si === k.length) return { v: 'SI', d: 'Hoja de equipos realizada' };
    return { v: si ? 'PARCIAL' : 'NO', d: si + ' de ' + k.length + ' bloques marcados como realizados' };
  }
  function ctlEspeciales(e) { let n = 0; try { n = meBoxes(e).length; } catch (err) {} return n ? { v: 'SI', d: n + ' cuadros de menús especiales' } : { v: 'NA', d: 'Sin menús especiales en Protocolo' }; }
  function ctlProtocolo(e) { const n = Object.keys(e.protocolo || {}).filter(function (k) { return txt(e.protocolo[k]) && k.charAt(0) !== '_'; }).length; return n > 15 ? { v: 'SI', d: n + ' datos en Protocolo' } : { v: n ? 'PARCIAL' : 'NO', d: n + ' datos en Protocolo' }; }
  const AUTO_APP = function (f) { return function (e) { const r = f(e); return r.v === 'SI' ? { v: 'SI', d: 'Disponible al momento en la app' } : r; }; };
  const CTL_ROLES = [
    { k: 'jefesala', t: 'JEFE/A DE SALA', vb: 'VISTO BUENO RRHH', resp: 'JEFE/A SALA', items: [
      ['Accesos coordinadores', null], ['Plano realizado', ctlPlano], ['Plano subido a carpeta coordinadores', AUTO_APP(ctlPlano)],
      ['Equipos realizados', ctlEquipos], ['Equipos subidos a carpeta de coordinadores', AUTO_APP(ctlEquipos)],
      ['Check list de preservicio', function (e) { return ctlChk(e, 'jefesala', 'pre'); }], ['Check list de post servicio', function (e) { return ctlChk(e, 'jefesala', 'post'); }],
      ['Evaluación de personal', function (e) { return ctlEquipo(e, 'jefesala'); }], ['Correo de informe final de boda (incidencias, puntos de mejora, feedback cliente)', null]] },
    { k: 'wedding', t: 'WEDDING PLANNER', vb: 'VISTO BUENO JEFE DE SALA', resp: 'WEDDING', items: [
      ['Plano realizado subido', ctlPlano], ['Tabla de menús especiales', ctlEspeciales], ['Plantilla de protocolo subida', ctlProtocolo],
      ['Check list de preservicio', function (e) { return ctlChk(e, 'wedding', 'pre'); }], ['Check list servicio', function (e) { return ctlChk(e, 'wedding', 'serv'); }],
      ['Check list de post servicio', function (e) { return ctlChk(e, 'wedding', 'post'); }], ['Timing del evento', ctlTiming], ['Entrega de fotos, vídeos y testimonios', null],
      ['Evaluación del Jefe de sala', function (e) { return ctlChk(e, 'jefesala', 'serv') || ctlEquipo(e, 'jefesala'); }], ['Correo de informe final de boda', null]] },
    { k: 'sala', t: 'COORDINADOR/A SALA', vb: 'VISTO BUENO JEFE DE SALA', eq: 'SALA', items: [
      ['Check list de preservicio', function (e) { return ctlChk(e, 'coordinador', 'pre'); }], ['Check list de post servicio', function (e) { return ctlChk(e, 'coordinador', 'post'); }],
      ['Evaluación de personal', function (e) { return ctlEquipo(e, 'coordinador'); }], ['Recuento de mantelería', function (e) { return ctlRecuento(e, 'manteleria'); }],
      ['Recuento material alquiler (catering)', function (e) { return ctlRecuento(e, 'cuberteria'); }], ['Consumo', function (e) { return ctlConsumo(e, 'consumos_comida'); }]] },
    { k: 'coctel', t: 'COORDINADOR/A CÓCTEL', vb: 'VISTO BUENO JEFE DE SALA', eq: 'COCTEL', items: [
      ['Check list de preservicio', function (e) { return ctlChk(e, 'coctel', 'pre'); }], ['Check list de post servicio', function (e) { return ctlChk(e, 'coctel', 'post'); }],
      ['Evaluación de personal', function (e) { return ctlEquipo(e, 'coctel'); }], ['Recuento de mantelería', function (e) { return ctlRecuento(e, 'manteleria'); }],
      ['Recuento material alquiler (catering)', function (e) { return ctlRecuento(e, 'cuberteria'); }], ['Consumo', function (e) { return ctlConsumo(e, 'consumos_cocktail'); }]] },
    { k: 'office', t: 'COORDINADOR/A OFFICE', vb: 'VISTO BUENO JEFE DE SALA', eq: 'OFFICE', items: [
      ['Check list de preservicio', function (e) { return ctlChk(e, 'office', 'pre'); }], ['Check list de post servicio', function (e) { return ctlChk(e, 'office', 'post'); }],
      ['Evaluación de personal', function (e) { return ctlEquipo(e, 'office'); }], ['Recuento material alquiler (catering)', function (e) { return ctlRecuento(e, 'cuberteria'); }], ['Consumo', null]] },
    { k: 'cocina', t: 'COORDINADOR/A COCINA', vb: 'VISTO BUENO JEFE DE SALA', eq: 'COCINA', items: [
      ['Check list de preservicio', function (e) { return ctlChk(e, 'cocina', 'pre'); }], ['Check list de post servicio', function (e) { return ctlChk(e, 'cocina', 'post'); }],
      ['Evaluación de personal', function (e) { return ctlEquipo(e, 'cocina'); }], ['Recuento material alquiler (catering)', function (e) { return ctlRecuento(e, 'cuberteria'); }]] },
    { k: 'barra', t: 'COORDINADOR/A BARRA', vb: 'VISTO BUENO JEFE DE SALA', eq: 'BARRA', items: [
      ['Check list de preservicio', function (e) { return ctlChk(e, 'barralibre', 'pre'); }], ['Check list de post servicio', function (e) { return ctlChk(e, 'barralibre', 'post'); }],
      ['Evaluación de personal', function (e) { return ctlEquipo(e, 'barralibre'); }], ['Consumos', function (e) { return ctlConsumo(e, 'consumos_barra'); }]] }
  ];
  function ctlNombre(e, r) {
    if (r.resp) { const n = personaDe(e, r.resp === 'WEDDING' ? 'WEDDING' : r.resp); if (n) return n; }
    if (r.eq) { try { const l = tsCamareros(e).filter(function (x) { return x.leader && normNombre(x.equipo).indexOf(r.eq) >= 0; }); if (l.length) return txt(l[0].cam.nombre); } catch (err) {} }
    return '';
  }
  function ctl(e) { if (!e.control_doc || typeof e.control_doc !== 'object') e.control_doc = {}; return e.control_doc; }
  const CTL_TXT = { SI: 'SÍ', NO: 'NO', PARCIAL: 'A MEDIAS', NA: 'NO APLICA' };
  function ctlEstado(e) {
    const c = ctl(e), out = {};
    CTL_ROLES.forEach(function (r) {
      const d = c[r.k] || {}; const its = d.items || {};
      const filas = r.items.map(function (it, i) {
        const auto = it[1] ? it[1](e) : null; const man = its[i] || {};
        const v = txt(man.v) || (auto ? auto.v : '');
        return { t: it[0], auto: auto, man: txt(man.v), v: v, obs: txt(man.obs) };
      });
      const cuenta = filas.filter(function (f) { return f.v !== 'NA'; });
      const ok = cuenta.filter(function (f) { return f.v === 'SI'; }).length;
      out[r.k] = { filas: filas, ok: ok, total: cuenta.length, completo: ok === cuenta.length && cuenta.length > 0, d: d };
    });
    return out;
  }
  function renderControl() {
    const root = document.getElementById('am-root-am-control');
    const e = evActual(); if (!e) return;
    const est = ctlEstado(e), edita = puedePlan() && !enVision();
    let h = cabecera('CONTROL DE DOCUMENTACIÓN');
    h += '<p class="am-suave">Cada ítem se comprueba solo con lo que se ha rellenado en la app (check lists, evaluaciones, plano, equipos, recuentos, consumos y timing). Puedes corregir el estado a mano: manda lo que elijas. La gratificación se propone sola cuando todo está hecho.</p>';
    h += '<div class="am-ctl-kpis">' + CTL_ROLES.map(function (r) { const x = est[r.k]; return '<div class="am-ctl-kpi' + (x.completo ? ' ok' : '') + '"><span>' + esc(r.t) + '</span><b>' + x.ok + ' / ' + x.total + '</b></div>'; }).join('') + '</div>';
    CTL_ROLES.forEach(function (r) {
      const x = est[r.k], d = x.d;
      const grat = txt(d.gratif) || (x.completo ? 'SI' : '');
      h += '<div class="am-bloque am-ctl"><div class="am-ctl-cab"><div><b>' + esc(r.t) + ':</b> <input class="am-ctl-in" placeholder="Nombre" value="' + esc(txt(d.nombre) || ctlNombre(e, r)) + '" ' + (edita ? 'onchange="amCtl(\'' + r.k + '\',\'nombre\',this.value)"' : 'disabled') + '></div>' +
        '<div class="am-ctl-vb">' + esc(r.vb) + ': <input class="am-ctl-in" placeholder="Firma / nombre" value="' + esc(txt(d.vb)) + '" ' + (edita ? 'onchange="amCtl(\'' + r.k + '\',\'vb\',this.value)"' : 'disabled') + '></div></div>';
      h += '<table class="am-tabla am-ctl-tab"><thead><tr><th>ÍTEM DE CONTROL</th><th>COMPROBACIÓN AUTOMÁTICA</th><th class="am-c">CONTROL DE ACCIÓN</th><th>OBSERVACIONES</th></tr></thead><tbody>';
      x.filas.forEach(function (f, i) {
        const a = f.auto;
        h += '<tr><td><b>' + esc(f.t) + '</b></td><td>' + (a ? '<span class="am-ctl-b ' + a.v + '">' + CTL_TXT[a.v] + '</span> <small>' + esc(a.d) + '</small>' : '<small class="am-suave">Se marca a mano</small>') + '</td>' +
          '<td class="am-c"><select class="am-ctl-sel ' + esc(f.v) + '" ' + (edita ? 'onchange="amCtlItem(\'' + r.k + '\',' + i + ',\'v\',this.value)"' : 'disabled') + '><option value="">' + (a ? 'Automático (' + CTL_TXT[a.v] + ')' : '—') + '</option>' +
          ['SI', 'NO', 'PARCIAL', 'NA'].map(function (o) { return '<option value="' + o + '"' + (f.man === o ? ' selected' : '') + '>' + CTL_TXT[o] + '</option>'; }).join('') + '</select></td>' +
          '<td><input class="am-ctl-in" value="' + esc(f.obs) + '" placeholder="' + (f.v === 'NO' || f.v === 'PARCIAL' ? 'Justificar por qué' : '') + '" ' + (edita ? 'onchange="amCtlItem(\'' + r.k + '\',' + i + ',\'obs\',this.value)"' : 'disabled') + '></td></tr>';
      });
      h += '</tbody></table><div class="am-ctl-pie"><span>' + x.ok + ' de ' + x.total + ' hechos</span><label>COBRO DE GRATIFICACIÓN: <select class="am-ctl-sel ' + grat + '" ' + (edita ? 'onchange="amCtl(\'' + r.k + '\',\'gratif\',this.value)"' : 'disabled') + '><option value="">' + (x.completo ? 'SÍ (propuesta)' : 'Pendiente') + '</option><option value="SI"' + (txt(d.gratif) === 'SI' ? ' selected' : '') + '>SÍ</option><option value="NO"' + (txt(d.gratif) === 'NO' ? ' selected' : '') + '>NO</option></select></label></div></div>';
    });
    root.innerHTML = h + '<div class="am-fila am-fin"><button class="inf-print-btn" onclick="amImprimir(this)"><i class="fa-solid fa-print mr-1"></i>IMPRIMIR / PDF</button></div>';
  }
  window.amCtl = function (rol, k, v) { const c = ctl(evActual()); c[rol] = c[rol] || {}; c[rol][k] = v; guardarEv(); renderControl(); };
  window.amCtlItem = function (rol, i, k, v) { const c = ctl(evActual()); c[rol] = c[rol] || {}; c[rol].items = c[rol].items || {}; c[rol].items[i] = c[rol].items[i] || {}; c[rol].items[i][k] = v; guardarEv(); renderControl(); };

  // ═════════ Cronograma de logística semanal (plantilla REVE01-22) ═════════
  const CR_AREAS = { 'CÓCTEL': '#6AA84F', 'SALA': '#3D85C6', 'COCINA': '#E69138', 'OFFICE': '#F6B26B', 'PLANIFICACIÓN': '#8E7CC3', 'DESMONTAJE Y CIERRE': '#7A7163' };
  const CR_ESTADOS = ['Pendiente', 'En proceso', 'Realizada', 'Incidencia'];
  const CR_PRIO = ['Baja', 'Media', 'Alta (crítica)'];
  const CR_BASE = [
    ['CÓCTEL', 'LUNES', 'Limpieza y vaciado de ceniceros metálicos pilares salón', 'Equipo montaje', 'Baja'],
    ['CÓCTEL', 'LUNES', 'Colocación y orden del material de catering', 'Encargado logística', 'Media'],
    ['CÓCTEL', 'JUEVES', 'Limpieza gruesa zona cóctel', 'Equipo montaje', 'Media'],
    ['CÓCTEL', 'JUEVES', 'Encender botellero barra cóctel/office', 'Bartender / Coctelería', 'Alta (crítica)'],
    ['CÓCTEL', 'JUEVES-VIERNES', 'Montaje estructura sombraje', 'Equipo montaje', 'Alta (crítica)'],
    ['CÓCTEL', 'JUEVES-VIERNES', 'Revisar, limpiar y ubicar caravana', 'Encargado logística', 'Media'],
    ['CÓCTEL', 'JUEVES-VIERNES', 'Material para ceremonia', 'Maître / Jefa de sala', 'Alta (crítica)'],
    ['CÓCTEL', 'JUEVES-VIERNES', 'Material para cóctel', 'Bartender / Coctelería', 'Alta (crítica)'],
    ['SALA', 'LUNES', 'Limpieza carpa, barrido, fregado y limpieza mesas auxiliares', 'Equipo montaje', 'Media'],
    ['SALA', 'LUNES', 'Clasificación-contabilizar mantelería, mesas evento, auxiliares, de todos los salones y catering (libreta de control)', 'Encargado logística', 'Alta (crítica)'],
    ['SALA', 'LUNES', 'Preparación esqueleto evento próximo', 'Equipo montaje', 'Media'],
    ['SALA', 'MIÉRCOLES', 'Colocar mantelería en esqueleto siguiendo plano montaje (si no llega la del evento, poner la nuestra para imagen de venta y visitas de novios)', 'Maître / Jefa de sala', 'Alta (crítica)'],
    ['SALA', 'JUEVES', 'Material organizado y ordenado listo para montaje', 'Encargado logística', 'Media'],
    ['SALA', 'JUEVES', 'Isla bien ordenada y limpia', 'Maître / Jefa de sala', 'Media'],
    ['SALA', 'JUEVES', 'Colocación de material que no es para montaje en su lugar', 'Equipo montaje', 'Baja'],
    ['SALA', 'JUEVES', 'Encender cámaras', 'Encargado logística', 'Alta (crítica)'],
    ['SALA', 'VIERNES', 'Colocar mantelería en mesas auxiliares y cámaras', 'Maître / Jefa de sala', 'Media'],
    ['SALA', 'VIERNES', 'Montaje de la sala (marcaje, cristalería, minutas y meseros)', 'Maître / Jefa de sala', 'Alta (crítica)'],
    ['COCINA', 'JUEVES', 'Barra y mueble de barra libre limpio y ordenado', 'Bartender / Coctelería', 'Media'],
    ['COCINA', 'VIERNES', 'Cubiertos repasados y ordenados', 'Responsable office', 'Alta (crítica)'],
    ['OFFICE', 'LUNES', 'Revisión y organización de almacenes y limpieza', 'Responsable office', 'Media'],
    ['OFFICE', 'LUNES', 'Mesas limpias de emplate office-banquete', 'Jefe de cocina', 'Alta (crítica)'],
    ['OFFICE', 'LUNES', 'Material de limpieza en su sitio y completo', 'Responsable office', 'Baja'],
    ['OFFICE', 'LUNES', 'Revisión material, faltas, pedidos, roturas y puntos de mejora', 'Encargado logística', 'Alta (crítica)'],
    ['OFFICE', 'MIÉRCOLES', 'Atender proveedores, recepción de mercancías-bebidas y su distribución por zonas según eventos', 'Encargado logística', 'Alta (crítica)'],
    ['OFFICE', 'MIÉRCOLES', 'Recepción de mantelería y supervisar con hojas de protocolo de los eventos y cantidades con proveedor', 'Maître / Jefa de sala', 'Alta (crítica)'],
    ['OFFICE', 'JUEVES', 'Colocar bebida y cargar cámaras de salones y de almacenamiento, comprobar funcionamiento (gallinero)', 'Encargado logística', 'Alta (crítica)'],
    ['OFFICE', 'VIERNES', 'Copas repasadas y ordenadas', 'Responsable office', 'Alta (crítica)'],
    ['PLANIFICACIÓN', 'JUEVES', 'Valoración de la situación de la puesta a punto y decidir', 'Responsable eventos', 'Alta (crítica)'],
    ['PLANIFICACIÓN', 'VIERNES', 'Control de alérgenos, intolerancias y menús especiales (seating y marcaje en plano)', 'Maître / Jefa de sala', 'Alta (crítica)'],
    ['SALA', 'SÁBADO (DÍA D)', 'Prueba de sonido, iluminación ambiental, climatización y audiovisual ceremonia/banquete', 'Responsable eventos', 'Alta (crítica)'],
    ['SALA', 'SÁBADO (DÍA D)', 'Briefing operativo con equipo de sala y extras (reparto rangos, timing, alérgenos y protocolo)', 'Maître / Jefa de sala', 'Alta (crítica)'],
    ['COCINA', 'SÁBADO (DÍA D)', 'Verificación pase caliente, calientaplatos, regeneración y circuito marcha hacia adelante', 'Jefe de cocina', 'Alta (crítica)'],
    ['DESMONTAJE Y CIERRE', 'SÁBADO (DÍA D)', 'Desbarase selectivo, clasificación de menaje sucio en bateas y control de roturas', 'Responsable office', 'Media'],
    ['DESMONTAJE Y CIERRE', 'DOMINGO (POST-EVENTO)', 'Cierre de evento: inventario de devolución de mantelería, control excedentes APPCC y acta final', 'Encargado logística', 'Media']
  ];
  let crSemana = null, crDoc = null, crPlantilla = null, crFiltro = '';
  function crBase() { return CR_BASE.map(function (x, i) { return { id: 'LOG-' + ('0' + (i + 1)).slice(-2), area: x[0], dia: x[1], tarea: x[2], resp: x[3], prio: x[4] }; }); }
  async function crCargar() {
    const a = api();
    if (!crPlantilla) { try { const p = await a.leer('config', 'cronograma'); crPlantilla = p && Array.isArray(p.tareas) && p.tareas.length ? p.tareas : crBase(); } catch (err) { crPlantilla = crBase(); } }
    try { crDoc = await a.leer('cronograma', isoDe(crSemana)); } catch (err) { crDoc = null; }
    if (!crDoc || !Array.isArray(crDoc.tareas)) crDoc = { semana: isoDe(crSemana), tareas: crPlantilla.map(function (t) { return Object.assign({ estado: 'Pendiente', firma: '', obs: '' }, t); }), nuevo: true };
  }
  async function renderCronograma() {
    if (!crSemana) crSemana = lunesDe(new Date());
    const root = document.getElementById('am-root-am-cronograma');
    root.innerHTML = cabecera('CRONOGRAMA LOGÍSTICA', 'Checklist operativo de preservicio, montaje y cierre · REVE01-22', false) + '<div class="am-vacio">Cargando…</div>';
    await crCargar();
    const edita = api() && api().puedeEditar() && !enVision();
    const fin = new Date(crSemana); fin.setDate(fin.getDate() + 6);
    const evs = Object.keys(appData.events).map(function (id) { return appData.events[id]; }).filter(function (e) { return e.fecha >= isoDe(crSemana) && e.fecha <= isoDe(fin); })
      .sort(function (a, b) { return String(a.fecha + a.hora).localeCompare(String(b.fecha + b.hora)); });
    const T = crDoc.tareas;
    const n = { 'Realizada': 0, 'En proceso': 0, 'Pendiente': 0, 'Incidencia': 0 };
    T.forEach(function (t) { n[t.estado] = (n[t.estado] || 0) + 1; });
    const pct = T.length ? Math.round(n['Realizada'] / T.length * 1000) / 10 : 0;
    let h = cabecera('CRONOGRAMA LOGÍSTICA', 'Checklist operativo de preservicio, montaje y cierre · REVE01-22', false);
    h += '<div class="am-semana-nav"><button class="am-btn" onclick="amCrSemana(-1)">‹ Semana anterior</button><div class="am-semana-t">Semana del ' + crSemana.getDate() + ' de ' + MESES[crSemana.getMonth()] + ' al ' + fin.getDate() + ' de ' + MESES[fin.getMonth()] + '</div><button class="am-btn" onclick="amCrSemana(0)">Esta semana</button><button class="am-btn" onclick="amCrSemana(1)">Semana siguiente ›</button></div>';
    h += '<div class="am-bloque am-cr-cab"><div><b>Eventos de la semana</b>' + (evs.length ? evs.map(function (e) { let t = { pax: 0, ninos: 0 }; try { t = calcularTotalesEvento(e.items || []); } catch (err) {} return '<div>' + esc(DIAS[(new Date(e.fecha + 'T12:00').getDay() + 6) % 7]) + ' ' + esc(fechaCorta(e.fecha)) + ' · ' + esc(e.hora || '--:--') + ' · <b>' + esc(e.boda) + '</b> · ' + esc(e.ubicacion) + ' · ' + (invitadosDe(e) || t.pax) + ' comensales</div>'; }).join('') : '<div class="am-suave">Sin bodas esta semana</div>') + '</div>' +
      '<div class="am-cr-campos">' + [['salon', 'Salón'], ['resp_sala', 'Resp. sala'], ['encargado', 'Encargado logística']].map(function (c) { return '<label class="am-campo">' + c[1] + '<input value="' + esc(crDoc[c[0]]) + '" ' + (edita ? 'onchange="amCrCampo(\'' + c[0] + '\',this.value)"' : 'disabled') + '></label>'; }).join('') + '</div></div>';
    h += '<div class="am-ctl-kpis"><div class="am-ctl-kpi ok"><span>% AVANCE</span><b>' + String(pct).split('.').join(',') + ' %</b><i style="width:' + pct + '%"></i></div><div class="am-ctl-kpi"><span>REALIZADAS</span><b>' + n['Realizada'] + ' de ' + T.length + '</b></div><div class="am-ctl-kpi"><span>EN PROCESO</span><b>' + n['En proceso'] + '</b></div><div class="am-ctl-kpi"><span>PENDIENTES</span><b>' + n['Pendiente'] + '</b></div><div class="am-ctl-kpi' + (n['Incidencia'] ? ' mal' : '') + '"><span>INCIDENCIAS</span><b>' + n['Incidencia'] + '</b></div></div>';
    h += '<div class="am-fila"><select class="am-buscar" onchange="amCrFiltro(this.value)"><option value="">Todas las áreas</option>' + Object.keys(CR_AREAS).map(function (a) { return '<option' + (crFiltro === a ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '<option value="__p"' + (crFiltro === '__p' ? ' selected' : '') + '>Solo pendientes</option></select>' +
      (puedePlan() ? '<button class="am-btn" onclick="amCrPlantilla()">Editar tareas de la plantilla</button>' : '') + '<button class="inf-print-btn" onclick="amImprimir(this)"><i class="fa-solid fa-print mr-1"></i>IMPRIMIR / PDF</button></div>';
    h += '<div class="am-bloque am-sinpad"><table class="am-tabla am-cr-tab"><thead><tr><th>ID</th><th>ÁREA</th><th>DÍA</th><th>TAREA</th><th>RESPONSABLE</th><th>PRIORIDAD</th><th>ESTADO</th><th>HORA / FIRMA</th><th>OBSERVACIONES / INCIDENCIAS</th></tr></thead><tbody>';
    T.forEach(function (t, i) {
      if (crFiltro === '__p' && t.estado === 'Realizada') return;
      if (crFiltro && crFiltro !== '__p' && t.area !== crFiltro) return;
      h += '<tr class="cr-' + esc(normNombre(t.estado).split(' ').join('-').toLowerCase()) + '"><td>' + esc(t.id) + '</td><td><span class="am-cr-area" style="background:' + (CR_AREAS[t.area] || '#999') + '">' + esc(t.area) + '</span></td><td><b>' + esc(t.dia) + '</b></td><td class="am-cr-t">' + esc(t.tarea) + '</td><td>' + esc(t.resp) + '</td>' +
        '<td><span class="am-cr-prio' + (t.prio.indexOf('Alta') === 0 ? ' alta' : '') + '">' + esc(t.prio) + '</span></td>' +
        '<td><select class="am-cr-est" ' + (edita ? 'onchange="amCrEstado(' + i + ',this.value)"' : 'disabled') + '>' + CR_ESTADOS.map(function (s2) { return '<option' + (t.estado === s2 ? ' selected' : '') + '>' + s2 + '</option>'; }).join('') + '</select></td>' +
        '<td>' + esc(t.firma) + '</td><td><input class="am-ctl-in" value="' + esc(t.obs) + '" ' + (edita ? 'onchange="amCrObs(' + i + ',this.value)"' : 'disabled') + '></td></tr>';
    });
    h += '</tbody></table></div><div class="am-cr-firmas"><div>FIRMA ENCARGADO/A LOGÍSTICA</div><div>FIRMA RESPONSABLE DE EVENTOS / MAÎTRE</div></div>';
    root.innerHTML = h;
  }
  async function crGuardar() {
    const d = Object.assign({}, crDoc); delete d.nuevo;
    try { await api().guardar('cronograma', isoDe(crSemana), d, true); crDoc.nuevo = false; } catch (err) { aviso('No se pudo guardar el cronograma: ' + (err.message || err), true); }
  }
  function iniciales() { const n = txt(api() ? api().nombre() : ''); return n ? n.split(' ').filter(function (x) { return x; }).map(function (x) { return x.charAt(0).toUpperCase() + '.'; }).join('') : ''; }
  window.amCrSemana = function (d) { if (d === 0) crSemana = lunesDe(new Date()); else { crSemana = new Date(crSemana); crSemana.setDate(crSemana.getDate() + 7 * d); } renderCronograma(); };
  window.amCrFiltro = function (v) { crFiltro = v; renderCronograma(); };
  window.amCrCampo = function (k, v) { crDoc[k] = v; crGuardar(); };
  window.amCrObs = function (i, v) { crDoc.tareas[i].obs = v; crGuardar(); };
  window.amCrEstado = function (i, v) {
    const t = crDoc.tareas[i]; t.estado = v;
    if (v === 'Realizada') { const d = new Date(); t.firma = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ' - ' + iniciales(); } else if (v === 'Pendiente') t.firma = '';
    crGuardar().then(renderCronograma);
  };
  window.amCrPlantilla = function () {
    let h = '<div class="am-modal-cab"><h2>Tareas de la plantilla</h2><button class="am-x" data-am-cerrar>✕</button></div><p class="am-suave">Se usan para las semanas nuevas. Las semanas ya empezadas no cambian. Deja la tarea vacía para quitarla.</p><div class="am-cr-pl">';
    crPlantilla.concat([{ id: '', area: 'SALA', dia: '', tarea: '', resp: '', prio: 'Media' }]).forEach(function (t, i) {
      h += '<div class="am-cr-pl-f" data-i="' + i + '"><select data-k="area">' + Object.keys(CR_AREAS).map(function (a) { return '<option' + (t.area === a ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select>' +
        '<input data-k="dia" value="' + esc(t.dia) + '" placeholder="Día"><input data-k="tarea" value="' + esc(t.tarea) + '" placeholder="Tarea nueva…"><input data-k="resp" value="' + esc(t.resp) + '" placeholder="Responsable">' +
        '<select data-k="prio">' + CR_PRIO.map(function (p) { return '<option' + (t.prio.toLowerCase() === p.toLowerCase() ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select></div>';
    });
    h += '</div><div class="am-fila am-fin"><button class="am-btn" onclick="amCrPlantillaBase()">Volver a la plantilla original</button><button class="am-btn am-prin" onclick="amCrPlantillaGuardar()">Guardar</button></div>';
    modal(h);
  };
  window.amCrPlantillaBase = async function () { if (!confirm('¿Volver a las 35 tareas de la plantilla original?')) return; crPlantilla = crBase(); await api().guardar('config', 'cronograma', { tareas: crPlantilla }, true); cerrarModal(); aviso('Plantilla restaurada.'); };
  window.amCrPlantillaGuardar = async function () {
    const l = [];
    document.querySelectorAll('.am-cr-pl-f').forEach(function (f) {
      const t = {}; f.querySelectorAll('[data-k]').forEach(function (x) { t[x.getAttribute('data-k')] = txt(x.value); });
      if (t.tarea) l.push(t);
    });
    l.forEach(function (t, i) { t.id = 'LOG-' + ('0' + (i + 1)).slice(-2); });
    crPlantilla = l;
    try { await api().guardar('config', 'cronograma', { tareas: l }, true); aviso('Plantilla guardada.'); } catch (err) { aviso('No se pudo guardar: ' + (err.message || err), true); }
    cerrarModal();
    if (crDoc && crDoc.nuevo) renderCronograma();
  };

  // ═════════ Plano: foto de fondo bajo la cuadrícula (plano de la finca, pilares…) ═════════
  function pintarFondoPlano() {
    const e = evActual(); const lz = document.getElementById('canvas-plano'); if (!e || !lz) return;
    let capa = lz.querySelector('.am-plano-fondo');
    if (e.plano_fondo) {
      if (!capa) { capa = document.createElement('div'); capa.className = 'am-plano-fondo'; lz.insertBefore(capa, lz.firstChild); }
      capa.style.backgroundImage = 'url(' + e.plano_fondo + ')';
      capa.style.opacity = String(e.plano_fondo_op === undefined ? 0.55 : e.plano_fondo_op);
    } else if (capa) capa.remove();
    const panel = document.getElementById('plano-assets-panel');
    if (panel && !panel.querySelector('.am-fondo-ctl')) panel.insertAdjacentHTML('beforeend', '<div class="am-fondo-ctl"></div>');
    const ctl = panel ? panel.querySelector('.am-fondo-ctl') : null;
    if (ctl) {
      const op = Math.round((e.plano_fondo_op === undefined ? 0.55 : e.plano_fondo_op) * 100);
      ctl.innerHTML = '<b>FOTO DE FONDO DEL PLANO</b><span class="am-suave">El plano de la finca o una foto de la sala, debajo de la cuadrícula.</span>' +
        '<label class="am-btn">' + (e.plano_fondo ? 'Cambiar foto' : 'Subir foto') + '<input type="file" accept="image/*" class="am-oculto" onchange="amFondoPlano(this)"></label>' +
        (e.plano_fondo ? '<label>Transparencia <input type="range" min="10" max="100" value="' + op + '" oninput="amFondoOp(this.value)"></label><button class="am-btn am-peligro" onclick="amFondoQuitar()">Quitar foto</button>' : '');
    }
  }
  envolver('renderCanvas', null, pintarFondoPlano);
  window.amFondoPlano = async function (inp) {
    const f = inp.files && inp.files[0]; if (!f) return;
    try { const e = evActual(); e.plano_fondo = await reducirImagen(f, 1400); guardarEv(); pintarFondoPlano(); } catch (err) { aviso('No se ha podido cargar la imagen.', true); }
  };
  window.amFondoOp = function (v) { const e = evActual(); e.plano_fondo_op = Math.max(0.1, Math.min(1, num(v) / 100)); const c = document.querySelector('#canvas-plano .am-plano-fondo'); if (c) c.style.opacity = String(e.plano_fondo_op); guardarEv(); };
  window.amFondoQuitar = function () { const e = evActual(); delete e.plano_fondo; delete e.plano_fondo_op; guardarEv(); pintarFondoPlano(); };

  // ═════════ Costes: subir un Excel con los precios y descargar la lista ═════════
  function sheetJS() {
    return new Promise(function (ok, ko) {
      if (window.XLSX) { ok(window.XLSX); return; }
      const s = document.createElement('script'); s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      s.onload = function () { ok(window.XLSX); }; s.onerror = function () { ko(new Error('No se ha podido cargar el lector de Excel (¿sin conexión?).')); };
      document.head.appendChild(s);
    });
  }
  function numES(v) {
    if (typeof v === 'number') return v;
    let t = txt(v).split('€').join('').split(' ').join('');
    if (t.indexOf(',') >= 0 && t.indexOf('.') >= 0) t = t.split('.').join('');
    t = t.split(',').join('.');
    const n = parseFloat(t); return isNaN(n) ? null : n;
  }
  // Reconoce las columnas por su título, estén en el orden que estén
  const COL_COSTES = [['cat', ['CATEGORIA', 'DESCRIPCION', 'SECTOR', 'FAMILIA', 'GRUPO']], ['tipo', ['TIPO', 'ARTICULO', 'PRODUCTO', 'MARCA', 'REFERENCIA', 'NOMBRE']],
    ['coste', ['COSTE', 'PRECIO', 'IMPORTE', 'PVP', 'TARIFA']], ['iva', ['IVA']], ['unidad', ['UNIDAD', 'FORMATO']], ['cantidad', ['UDS', 'UNIDADES', 'CANTIDAD', 'CAJA']]];
  function leerHojaCostes(X, hoja, nombreHoja) {
    const filas = X.utils.sheet_to_json(hoja, { header: 1, defval: '' });
    let cab = -1, mapa = null;
    for (let r = 0; r < Math.min(15, filas.length); r++) {
      const m = {}; filas[r].forEach(function (c, i) { const t = normNombre(c);
        COL_COSTES.forEach(function (d) { if (m[d[0]] === undefined && d[1].some(function (k) { return t.indexOf(k) === 0 || t === k; })) m[d[0]] = i; }); });
      if (m.tipo !== undefined && m.coste !== undefined) { cab = r; mapa = m; break; }
    }
    if (cab < 0) return [];
    const out = [];
    for (let r = cab + 1; r < filas.length; r++) {
      const f = filas[r], tipo = txt(f[mapa.tipo]).toUpperCase(), coste = numES(f[mapa.coste]);
      if (!tipo || coste === null) continue;
      const cat = mapa.cat !== undefined && txt(f[mapa.cat]) ? txt(f[mapa.cat]) : nombreHoja;
      const it = { cat: cat, tipo: tipo, coste: Math.round(coste * 10000) / 10000 };
      if (mapa.iva !== undefined && numES(f[mapa.iva]) !== null) { let iv = numES(f[mapa.iva]); if (iv > 0 && iv < 1) iv = iv * 100; it.iva = Math.round(iv); }
      if (mapa.unidad !== undefined && txt(f[mapa.unidad])) it.unidad = txt(f[mapa.unidad]).toLowerCase();
      if (mapa.cantidad !== undefined && numES(f[mapa.cantidad]) !== null) it.cantidad = numES(f[mapa.cantidad]);
      out.push(it);
    }
    return out;
  }
  let costesPend = null;
  window.amCostesExcel = async function (inp) {
    const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
    try {
      const X = await sheetJS();
      const wb = X.read(await f.arrayBuffer(), { type: 'array' });
      let filas = [];
      wb.SheetNames.forEach(function (n) { filas = filas.concat(leerHojaCostes(X, wb.Sheets[n], n)); });
      if (!filas.length) { aviso('No he encontrado precios. El Excel necesita al menos una columna de artículo (TIPO, ARTÍCULO o PRODUCTO) y otra de precio (COSTE o PRECIO).', true); return; }
      const lista = COSTES_LISTA.categorias || [];
      const res = { nuevos: [], cambios: [], iguales: 0 };
      filas.forEach(function (x) {
        const ck = consumoSectorKey(x.cat) || 'OTROS';
        const c = lista.filter(function (c2) { return consumoSectorKey(c2.nombre) === ck; })[0];
        const it = c ? (c.items || []).filter(function (i) { return txt(i.tipo).toUpperCase() === x.tipo; })[0] : null;
        x.ck = ck;
        if (!it) res.nuevos.push(x);
        else if (Number(it.coste) !== x.coste || (x.iva !== undefined && Number(it.iva) !== x.iva)) res.cambios.push({ x: x, antes: it.coste });
        else res.iguales++;
      });
      costesPend = filas;
      let h = '<div class="am-modal-cab"><h2>Precios del Excel</h2><button class="am-x" data-am-cerrar>✕</button></div>' +
        '<p><b>' + esc(f.name) + '</b>: ' + filas.length + ' artículos leídos.</p><div class="am-ctl-kpis"><div class="am-ctl-kpi ok"><span>PRECIOS QUE CAMBIAN</span><b>' + res.cambios.length + '</b></div><div class="am-ctl-kpi"><span>ARTÍCULOS NUEVOS</span><b>' + res.nuevos.length + '</b></div><div class="am-ctl-kpi"><span>SIN CAMBIOS</span><b>' + res.iguales + '</b></div></div>';
      if (res.cambios.length) h += '<h3 class="am-reglas-h">Cambios de precio</h3><div class="am-cr-pl"><table class="am-tabla"><tr><th>Categoría</th><th>Artículo</th><th>Antes</th><th>Ahora</th></tr>' + res.cambios.slice(0, 200).map(function (c) { return '<tr><td>' + esc(c.x.ck) + '</td><td>' + esc(c.x.tipo) + '</td><td>' + esc(c.antes) + ' €</td><td><b>' + esc(c.x.coste) + ' €</b></td></tr>'; }).join('') + '</table></div>';
      if (res.nuevos.length) h += '<h3 class="am-reglas-h">Artículos nuevos</h3><div class="am-cr-pl"><table class="am-tabla"><tr><th>Categoría</th><th>Artículo</th><th>Precio</th></tr>' + res.nuevos.slice(0, 200).map(function (x) { return '<tr><td>' + esc(x.ck) + '</td><td>' + esc(x.tipo) + '</td><td>' + esc(x.coste) + ' €</td></tr>'; }).join('') + '</table></div>';
      h += '<p class="am-suave">No se borra nada: se actualizan los precios de los artículos que ya existen y se añaden los nuevos. Las bodas con los costes ya cerrados no cambian.</p><div class="am-fila am-fin"><button class="am-btn" data-am-cerrar>Cancelar</button><button class="am-btn am-prin" onclick="amCostesAplicar()">Aplicar precios</button></div>';
      modal(h);
    } catch (err) { aviso('No se ha podido leer el Excel: ' + (err.message || err), true); }
  };
  window.amCostesAplicar = function () {
    if (!costesPend) return;
    const lista = COSTES_LISTA.categorias = COSTES_LISTA.categorias || [];
    costesPend.forEach(function (x) {
      let c = lista.filter(function (c2) { return consumoSectorKey(c2.nombre) === x.ck; })[0];
      if (!c) { c = { nombre: x.ck, items: [] }; lista.push(c); }
      c.items = c.items || [];
      let it = c.items.filter(function (i) { return txt(i.tipo).toUpperCase() === x.tipo; })[0];
      if (!it) { it = { id: Date.now() + Math.random(), tipo: x.tipo, coste: 0, iva: 21, unidad: 'botellas', cantidad: 1 }; c.items.push(it); }
      it.coste = x.coste;
      if (x.iva !== undefined) it.iva = x.iva;
      if (x.unidad) it.unidad = x.unidad;
      if (x.cantidad !== undefined) it.cantidad = x.cantidad;
    });
    const n = costesPend.length; costesPend = null;
    cerrarModal(); costesGuardar(); renderCostes(); aviso(n + ' precios aplicados.');
  };
  window.amCostesDescargar = async function () {
    try {
      const X = await sheetJS();
      const filas = [['CATEGORIA', 'TIPO', 'UNIDAD', 'UDS/CAJA', 'COSTE', 'IVA']];
      (COSTES_LISTA.categorias || []).forEach(function (c) { (c.items || []).forEach(function (it) { filas.push([c.nombre, it.tipo, it.unidad, it.cantidad, it.coste, it.iva]); }); });
      const ws = X.utils.aoa_to_sheet(filas); ws['!cols'] = [{ wch: 18 }, { wch: 34 }, { wch: 10 }, { wch: 9 }, { wch: 9 }, { wch: 6 }];
      const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'COSTES');
      X.writeFile(wb, 'Costes Alfonso Mira.xlsx');
    } catch (err) { aviso('No se ha podido crear el Excel: ' + (err.message || err), true); }
  };
  envolver('renderCostes', null, function () {
    const r = document.getElementById('costes-root'); if (!r || r.querySelector('.am-costes-xls')) return;
    const b = r.querySelector('[onclick="costesImportar()"]'); if (!b) return;
    b.insertAdjacentHTML('beforebegin', '<label class="am-costes-xls px-3 py-2 rounded-lg bg-white border text-xs font-black text-slate-700 hover:bg-slate-50 cursor-pointer"><i class="fa-solid fa-file-excel mr-1"></i>SUBIR EXCEL DE PRECIOS<input type="file" accept=".xlsx,.xls,.csv,.ods" class="am-oculto" onchange="amCostesExcel(this)"></label>' +
      '<button class="am-costes-xls px-3 py-2 rounded-lg bg-white border text-xs font-black text-slate-700 hover:bg-slate-50" onclick="amCostesDescargar()"><i class="fa-solid fa-download mr-1"></i>DESCARGAR EXCEL</button>');
  });

  // ═════════ Imprimir todo: cada hoja aprovecha la página ═════════
  // Elige la orientación con la que la hoja ocupa menos páginas sin perder tamaño de letra,
  // y si se pasa poco de un número entero de páginas la reduce lo justo para no dejar una página casi vacía.
  (function () {
    const orig = window.hojaBloques;
    if (typeof orig !== 'function' || typeof PZ_PAPEL === 'undefined') return;
    function encajar(b) {
      const P0 = b.horizontal ? PZ_PAPEL.h : PZ_PAPEL.v;
      const z0 = b.zoom || 1;
      const W = P0.w / z0; // ancho natural del contenido
      const opc = [PZ_PAPEL.h, PZ_PAPEL.v].map(function (P) {
        const z = Math.min(1, P.w / W);
        const h = pzMedir(b.nodo, W) * z;
        let pags = h / P.h, zz = z;
        const k = Math.max(1, Math.floor(pags));
        if (pags > k && pags <= k + 0.45) { zz = Math.max(z * 0.7, z * k / pags * 0.985); pags = k; }
        return { P: P, z: zz, pags: Math.ceil(pags - 1e-6), horizontal: P === PZ_PAPEL.h };
      });
      opc.sort(function (x, y) { return x.pags - y.pags || y.z - x.z; });
      const m = opc[0], otra = opc[1];
      // con igual número de páginas, la orientación que deja la letra más grande
      const elegida = (m.pags === otra.pags && otra.z > m.z) ? otra : (m.z >= otra.z * 0.78 ? m : otra);
      b.horizontal = elegida.horizontal; b.zoom = elegida.z;
    }
    window.hojaBloques = function () {
      const bl = orig.apply(this, arguments) || [];
      bl.forEach(function (b) { try { if (!b.fijo) encajar(b); } catch (err) {} });
      return bl;
    };
  })();

  // ═════════ Consumos sin precios para quien no es de gestión ═════════
  // Coordinadores y jefe de sala rellenan los consumos, pero los costes, totales en € y el panel de control solo los ve gestión.
  function marcarCostesConsumos() {
    ['cocktail-table-body', 'comida-table-body', 'barra-bebidas-body', 'barra-otros-body'].forEach(function (id) {
      const t = document.getElementById(id); if (t && t.closest('table')) t.closest('table').classList.add('am-tab-consumo');
    });
    document.querySelectorAll('#view-coordinadores-consumos .bg-gray-800.rounded-xl').forEach(function (b) { b.classList.add('am-total-euros'); });
  }
  marcarCostesConsumos();
  (function () {
    const orig = window.costesBannerHtml;
    if (typeof orig !== 'function') return;
    window.costesBannerHtml = function () { return puedePlan() ? orig.apply(this, arguments) : ''; };
  })();

  // ═════════ Listado de personal (horarios y pagos): solo administración, gestión y jefe de sala ═════════
  function rolActual() { const a = api(); return a ? a.rol() : ''; }
  function verPersonal() { return ['admin', 'gestor', 'jefesala'].indexOf(rolActual()) >= 0; }
  (function () {
    const orig = window.switchTab;
    window.switchTab = function (tabId) {
      if (tabId === 'camareros-listado' && api() && !verPersonal()) { aviso('El listado de personal (horarios y pagos) solo lo ven administración, gestión y jefe de sala.'); return; }
      return orig.apply(this, arguments);
    };
  })();

  // ═════════ MIS BODAS: el histórico de cada persona ═════════
  function palabrasNom(t) { return normNombre(t).split('.').join('').split(' ').filter(function (x) { return x; }); }
  function miPuesto(e) {
    const yo = palabrasNom(api() ? api().nombre() : '');
    if (!yo.length) return null;
    const c = (e.camareros || []).filter(function (x) {
      const p = palabrasNom(x && x.nombre); if (!p.length) return false;
      if (p.join(' ') === yo.join(' ')) return true;
      return p.length >= 2 && p.every(function (w) { return yo.indexOf(w) >= 0; });
    })[0];
    return c || null;
  }
  let mbFiltro = '', mbAnio = '';
  function renderMisBodas() {
    const root = document.getElementById('am-root-am-misbodas');
    const hoy = isoDe(new Date());
    const l = Object.keys(appData.events).map(function (id) { const e = appData.events[id]; const c = miPuesto(e); return c ? { id: id, e: e, c: c } : null; })
      .filter(function (x) { return x; }).sort(function (a, b) { return String(b.e.fecha).localeCompare(String(a.e.fecha)); });
    const anios = []; l.forEach(function (x) { const a = String(x.e.fecha || '').slice(0, 4); if (a && anios.indexOf(a) < 0) anios.push(a); });
    const f = normNombre(mbFiltro);
    const vis = l.filter(function (x) { return (!mbAnio || String(x.e.fecha).slice(0, 4) === mbAnio) && (!f || normNombre(x.e.boda + ' ' + x.e.ubicacion).indexOf(f) >= 0); });
    const prox = l.filter(function (x) { return x.e.fecha >= hoy; }).length;
    let h = cabecera('MIS BODAS', (api() ? api().nombre() : '') + ' · todas las bodas en las que has trabajado', false);
    h += '<div class="am-ctl-kpis"><div class="am-ctl-kpi ok"><span>BODAS EN TOTAL</span><b>' + l.length + '</b></div><div class="am-ctl-kpi"><span>PRÓXIMAS</span><b>' + prox + '</b></div><div class="am-ctl-kpi"><span>CELEBRADAS</span><b>' + (l.length - prox) + '</b></div></div>';
    h += '<div class="am-fila"><input class="am-buscar" placeholder="Buscar por boda o lugar" value="' + esc(mbFiltro) + '" oninput="amMbFiltro(this.value)"><select class="am-buscar" style="max-width:160px" onchange="amMbAnio(this.value)"><option value="">Todos los años</option>' +
      anios.map(function (a) { return '<option' + (a === mbAnio ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select></div>';
    h += '<div class="am-bloque am-sinpad"><table class="am-tabla"><thead><tr><th>Fecha</th><th>Boda</th><th>Lugar</th><th>Mi función</th><th>Equipo · rango</th><th class="am-c">Estado</th><th></th></tr></thead><tbody>';
    if (!vis.length) h += '<tr><td colspan="7" class="am-vacio">' + (l.length ? 'Sin resultados.' : 'Todavía no apareces en ninguna boda. Tu nombre de usuario tiene que coincidir con el del Listado de personal; si no te salen tus bodas, avisa a gestión.') + '</td></tr>';
    vis.forEach(function (x) {
      const futura = x.e.fecha >= hoy;
      h += '<tr><td><b>' + esc(fechaCorta(x.e.fecha)) + '</b>' + (x.e.hora ? ' · ' + esc(x.e.hora) : '') + '</td><td><b>' + esc(x.e.boda) + '</b></td><td>' + esc(x.e.ubicacion) + '</td>' +
        '<td>' + esc(txt(x.c.responsabilidad).toUpperCase()) + '</td><td>' + esc([txt(x.c.equipo), txt(x.c.zona)].filter(function (v) { return v && v !== '-'; }).join(' · ')) + '</td>' +
        '<td class="am-c"><span class="am-ctl-b ' + (futura ? 'PARCIAL' : 'SI') + '">' + (futura ? 'PRÓXIMA' : 'CELEBRADA') + '</span></td>' +
        '<td><button class="am-btn am-prin" onclick="abrirEvento(\'' + x.id + '\', ' + (puedeEditar() ? 'false' : 'true') + ')">Abrir</button></td></tr>';
    });
    root.innerHTML = h + '</tbody></table></div>';
  }
  window.amMbFiltro = function (v) { mbFiltro = v; renderMisBodas(); const i = document.querySelector('#am-root-am-misbodas .am-buscar'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } };
  window.amMbAnio = function (v) { mbAnio = v; renderMisBodas(); };

  // ═════════ Copia de seguridad (solo administración) ═════════
  // Firebase gratuito no guarda copias automáticas: esto descarga TODO a un archivo y permite restaurarlo.
  const CP_COLECCIONES = ['eventos', 'personal', 'fincas', 'cronograma', 'puntos_mejora'];
  const CP_CONFIG = ['costes', 'reglas', 'cronograma'];
  function fechaLarga(d) { return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear() + ' a las ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function aFecha(v) { if (!v) return null; if (typeof v.toDate === 'function') return v.toDate(); if (v.seconds !== undefined) return new Date(v.seconds * 1000); const d = new Date(v); return isNaN(d) ? null : d; }
  // Las fechas guardadas ({seconds, nanoseconds}) vuelven a ser fechas al restaurar
  function revivir(o) {
    if (Array.isArray(o)) return o.map(revivir);
    if (o && typeof o === 'object') {
      const k = Object.keys(o);
      if (k.indexOf('seconds') >= 0 && k.indexOf('nanoseconds') >= 0 && k.length <= 3) return new Date(o.seconds * 1000 + Math.round(o.nanoseconds / 1e6));
      const r = {}; k.forEach(function (x) { r[x] = revivir(o[x]); }); return r;
    }
    return o;
  }
  async function renderCopias() {
    const root = document.getElementById('am-root-am-copias');
    let info = null; try { info = await api().leer('config', 'backup'); } catch (e) {}
    const ult = info ? aFecha(info.ultima) : null;
    const dias = ult ? Math.floor((Date.now() - ult.getTime()) / 86400000) : null;
    let h = cabecera('COPIA DE SEGURIDAD', 'Todas las bodas, costes, personal, fincas y configuración en un archivo', false);
    h += '<div class="am-ctl-kpis"><div class="am-ctl-kpi' + (dias !== null && dias <= 7 ? ' ok' : ' mal') + '"><span>ÚLTIMA COPIA</span><b>' + (ult ? esc(fechaLarga(ult)) : 'Nunca') + '</b></div>' +
      '<div class="am-ctl-kpi"><span>HACE</span><b>' + (dias === null ? '—' : dias + (dias === 1 ? ' día' : ' días')) + '</b></div></div>';
    h += '<div class="am-bloque"><p>Firebase, en el plan gratuito, <b>no guarda copias automáticas</b>. La papelera recupera bodas borradas durante 30 días, pero si un dato se estropea o se borra de la papelera, solo esta copia permite recuperarlo.</p>' +
      '<p class="am-suave">Recomendado: una copia cada semana, guardada en Google Drive o en un pendrive. La app te avisa si pasan más de 7 días.</p>' +
      '<div class="am-fila"><button class="am-btn am-prin" onclick="amCopiaDescargar(this)"><i class="fa-solid fa-download mr-1"></i>Descargar copia ahora</button>' +
      '<label class="am-btn"><i class="fa-solid fa-upload mr-1"></i>Restaurar desde un archivo<input type="file" accept=".json" class="am-oculto" onchange="amCopiaRestaurar(this)"></label></div></div>';
    root.innerHTML = h;
  }
  window.amCopiaDescargar = async function (btn) {
    const a = api(); if (!a || !a.esAdmin()) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Preparando la copia…'; }
    try {
      const copia = { app: 'Alfonso Mira · Planning', version: 1, creada: new Date().toISOString(), por: a.nombre(), colecciones: {}, config: {} };
      for (let i = 0; i < CP_COLECCIONES.length; i++) {
        const c = CP_COLECCIONES[i]; let l = [];
        try { l = await a.listar(c); } catch (e) { l = []; }
        copia.colecciones[c] = l;
      }
      for (let i = 0; i < CP_CONFIG.length; i++) { try { const d = await a.leer('config', CP_CONFIG[i]); if (d) copia.config[CP_CONFIG[i]] = d; } catch (e) {} }
      const blob = new Blob([JSON.stringify(copia)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), el = document.createElement('a');
      const d = new Date();
      el.href = url; el.download = 'Copia Alfonso Mira ' + isoDe(d) + ' ' + ('0' + d.getHours()).slice(-2) + 'h' + ('0' + d.getMinutes()).slice(-2) + '.json';
      document.body.appendChild(el); el.click(); el.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      await a.guardar('config', 'backup', { ultima: d, por: a.nombre(), bodas: copia.colecciones.eventos.length });
      aviso('Copia descargada: ' + copia.colecciones.eventos.length + ' bodas y ' + Math.round(blob.size / 1024) + ' KB.');
    } catch (e) { aviso('No se ha podido hacer la copia: ' + (e.message || e), true); }
    renderCopias();
  };
  let cpPend = null;
  window.amCopiaRestaurar = async function (inp) {
    const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
    try {
      const c = JSON.parse(await f.text());
      if (!c || !c.colecciones || !Array.isArray(c.colecciones.eventos)) { aviso('Ese archivo no es una copia de esta app.', true); return; }
      cpPend = c;
      const n = function (k) { return (c.colecciones[k] || []).length; };
      modal('<div class="am-modal-cab"><h2>Restaurar copia</h2><button class="am-x" data-am-cerrar>✕</button></div>' +
        '<p>Copia del <b>' + esc(fechaLarga(new Date(c.creada))) + '</b> hecha por ' + esc(c.por || '—') + '.</p>' +
        '<div class="am-ctl-kpis"><div class="am-ctl-kpi"><span>BODAS</span><b>' + n('eventos') + '</b></div><div class="am-ctl-kpi"><span>PERSONAL</span><b>' + n('personal') + '</b></div><div class="am-ctl-kpi"><span>FINCAS</span><b>' + n('fincas') + '</b></div><div class="am-ctl-kpi"><span>SEMANAS CRONOGRAMA</span><b>' + n('cronograma') + '</b></div></div>' +
        '<p><b>Atención:</b> cada boda y cada dato de la copia sustituye a su versión actual. Lo que se haya creado después de la copia y no esté en ella se queda como está.</p>' +
        '<label class="am-mn-chk"><input type="checkbox" id="am-cp-solo-bodas"> Restaurar solo las bodas</label>' +
        '<div class="am-fila am-fin"><button class="am-btn" data-am-cerrar>Cancelar</button><button class="am-btn am-peligro" onclick="amCopiaAplicar(this)">Restaurar</button></div>');
    } catch (e) { aviso('No se ha podido leer el archivo: ' + (e.message || e), true); }
  };
  window.amCopiaAplicar = async function (btn) {
    const c = cpPend, a = api(); if (!c || !a || !a.esAdmin()) return;
    if (!confirm('¿Seguro que quieres restaurar la copia? Los datos actuales que estén en la copia se sustituirán.')) return;
    const soloBodas = document.getElementById('am-cp-solo-bodas') && document.getElementById('am-cp-solo-bodas').checked;
    btn.disabled = true;
    let ok = 0, mal = 0;
    const cols = soloBodas ? ['eventos'] : CP_COLECCIONES;
    for (let i = 0; i < cols.length; i++) {
      const l = c.colecciones[cols[i]] || [];
      for (let j = 0; j < l.length; j++) {
        const d = revivir(l[j]); const id = d.id; delete d.id; if (!id) continue;
        btn.textContent = 'Restaurando ' + (ok + mal + 1) + '…';
        try { await a.guardar(cols[i], id, d, true); ok++; } catch (e) { mal++; }
      }
    }
    if (!soloBodas) Object.keys(c.config || {}).forEach(function (k) { if (CP_CONFIG.indexOf(k) >= 0) a.guardar('config', k, revivir(c.config[k]), true).catch(function () {}); });
    cpPend = null; cerrarModal();
    aviso(ok + ' datos restaurados' + (mal ? ', ' + mal + ' con error' : '') + '. Recarga la app para ver los cambios.', !!mal);
  };
  // Aviso semanal al administrador
  function avisoCopia() {
    const a = api(); if (!a || !a.esAdmin()) return;
    a.leer('config', 'backup').then(function (b) {
      const u = b ? aFecha(b.ultima) : null;
      const d = u ? Math.floor((Date.now() - u.getTime()) / 86400000) : null;
      if (d === null || d > 7) {
        aviso(d === null ? 'Aún no hay ninguna copia de seguridad. Hazla en COPIA DE SEGURIDAD.' : 'Hace ' + d + ' días de la última copia de seguridad. Conviene hacer una nueva.');
        const t = document.getElementById('tab-am-copias'); if (t) t.classList.add('am-aviso-copia');
      }
    }).catch(function () {});
  }

  // ═════════ NUE-07 · Plano del cóctel ═════════
  const PC_TIPOS = [
    ['JAMÓN', '#8C3B4E', 120, 50], ['ANDALUZA', '#B5651D', 120, 50], ['QUESOS', '#C48A1E', 120, 50], ['BARRA', '#3F5A2E', 180, 45],
    ['SHOWCOOKING', '#9E3D18', 120, 50], ['CANTANTE / MÚSICA', '#6B5236', 110, 60], ['ENTRADA', '#4A443A', 110, 40], ['MESA ALTA', '#7E9A68', 44, 44],
    ['MESA BAJA', '#A39A8A', 50, 50], ['AGUAS', '#5E8A42', 90, 40], ['OFFICE', '#7A7163', 110, 50], ['TEXTO', '', 150, 36]
  ];
  let pcSel = null;
  function pc() { const e = evActual(); if (!e.plano_coctel || typeof e.plano_coctel !== 'object') e.plano_coctel = { items: [], fondo: '' }; if (!Array.isArray(e.plano_coctel.items)) e.plano_coctel.items = []; return e.plano_coctel; }
  function renderPlanoCoctel() {
    const root = document.getElementById('am-root-am-planococtel');
    const d = pc();
    let h = cabecera('PLANO CÓCTEL');
    h += '<div class="am-pc-barra">' + PC_TIPOS.map(function (t, i) { return '<button class="am-pc-add" style="--c:' + (t[1] || '#1F1B16') + '" onclick="amPcAdd(' + i + ')">+ ' + esc(t[0]) + '</button>'; }).join('') + '</div>';
    h += '<div class="am-pc-herr"><label class="am-btn">Imagen de fondo<input type="file" accept="image/*" class="am-oculto" onchange="amPcFondo(this)"></label>' +
      (d.fondo ? '<button class="am-btn" onclick="amPcFondoQuitar()">Quitar fondo</button>' : '') +
      '<span class="am-suave">Arrastra para mover · esquina para cambiar el tamaño · doble clic para cambiar el texto · Supr para borrar</span>' +
      '<button class="am-btn am-peligro" onclick="amPcBorrarSel()">Borrar seleccionado</button></div>';
    h += '<div class="am-pc-lienzo plan-grid" id="am-pc-lienzo" style="' + (d.fondo ? 'background-image:url(' + d.fondo + ');background-size:contain;background-repeat:no-repeat;background-position:center;' : '') + '">';
    d.items.forEach(function (it) {
      const esTexto = it.tipo === 'TEXTO';
      const redondo = it.tipo === 'MESA ALTA';
      h += '<div class="am-pc-it' + (esTexto ? ' texto' : '') + (redondo ? ' redondo' : '') + (pcSel === it.id ? ' sel' : '') + '" data-id="' + it.id + '" style="left:' + it.x + 'px;top:' + it.y + 'px;width:' + it.w + 'px;height:' + it.h + 'px;' + (esTexto ? '' : 'background:' + it.color + ';') + '">' +
        '<span>' + esc(it.texto || it.tipo) + '</span><i class="am-pc-tir"></i></div>';
    });
    h += '</div>';
    const cuenta = {};
    d.items.forEach(function (it) { if (it.tipo !== 'TEXTO') cuenta[it.tipo] = (cuenta[it.tipo] || 0) + 1; });
    h += '<div class="am-pc-resumen">' + (Object.keys(cuenta).length ? Object.keys(cuenta).map(function (k) { return '<span>' + esc(k) + ' × ' + cuenta[k] + '</span>'; }).join('') : '<span class="am-suave">Añade los puntos del cóctel con los botones de arriba.</span>') + '</div>';
    root.innerHTML = h;
    conectarLienzo();
  }
  function conectarLienzo() {
    const lz = document.getElementById('am-pc-lienzo'); if (!lz) return;
    let arr = null;
    lz.addEventListener('pointerdown', function (ev) {
      if (enVision()) return;
      const el = ev.target.closest('.am-pc-it');
      if (!el) { pcSel = null; lz.querySelectorAll('.am-pc-it.sel').forEach(function (x) { x.classList.remove('sel'); }); return; }
      const it = pc().items.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; if (!it) return;
      pcSel = it.id;
      lz.querySelectorAll('.am-pc-it.sel').forEach(function (x) { x.classList.remove('sel'); }); el.classList.add('sel');
      arr = { it: it, el: el, x: ev.clientX, y: ev.clientY, ox: it.x, oy: it.y, ow: it.w, oh: it.h, tam: ev.target.classList.contains('am-pc-tir') };
      el.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });
    lz.addEventListener('pointermove', function (ev) {
      if (!arr) return;
      const dx = ev.clientX - arr.x, dy = ev.clientY - arr.y;
      if (arr.tam) { arr.it.w = Math.max(30, Math.round(arr.ow + dx)); arr.it.h = Math.max(24, Math.round(arr.oh + dy)); arr.el.style.width = arr.it.w + 'px'; arr.el.style.height = arr.it.h + 'px'; }
      else { arr.it.x = Math.max(0, Math.min(900 - arr.it.w, Math.round(arr.ox + dx))); arr.it.y = Math.max(0, Math.min(600 - arr.it.h, Math.round(arr.oy + dy))); arr.el.style.left = arr.it.x + 'px'; arr.el.style.top = arr.it.y + 'px'; }
    });
    lz.addEventListener('pointerup', function () { if (arr) { arr = null; guardarEv(); } });
    lz.addEventListener('dblclick', function (ev) {
      if (enVision()) return;
      const el = ev.target.closest('.am-pc-it'); if (!el) return;
      const it = pc().items.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0]; if (!it) return;
      const sp = el.querySelector('span');
      sp.contentEditable = 'true'; sp.focus();
      const r = document.createRange(); r.selectNodeContents(sp); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      const fin = function () { sp.contentEditable = 'false'; it.texto = sp.textContent.trim().toUpperCase() || it.tipo; sp.textContent = it.texto; guardarEv(); sp.removeEventListener('blur', fin); };
      sp.addEventListener('blur', fin);
      sp.addEventListener('keydown', function (k) { if (k.key === 'Enter') { k.preventDefault(); sp.blur(); } });
    });
  }
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Delete' || !pcSel) return;
    const v = document.getElementById('view-am-planococtel');
    if (!v || v.classList.contains('hidden')) return;
    const a = document.activeElement; if (a && (a.isContentEditable || a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
    window.amPcBorrarSel();
  });
  window.amPcAdd = function (i) {
    if (enVision()) return;
    const t = PC_TIPOS[i], d = pc();
    const n = d.items.length;
    d.items.push({ id: 'pc' + Date.now().toString(36) + Math.floor(Math.random() * 1000), tipo: t[0], texto: t[0], color: t[1], x: 40 + (n * 24) % 600, y: 40 + (n * 18) % 400, w: t[2], h: t[3] });
    pcSel = d.items[d.items.length - 1].id;
    guardarEv(); renderPlanoCoctel();
  };
  window.amPcBorrarSel = function () { if (!pcSel || enVision()) return; const d = pc(); d.items = d.items.filter(function (x) { return x.id !== pcSel; }); pcSel = null; guardarEv(); renderPlanoCoctel(); };
  window.amPcFondo = function (inp) { if (!inp.files[0]) return; reducirImagen(inp.files[0], 1400).then(function (u) { pc().fondo = u; guardarEv(); renderPlanoCoctel(); }); };
  window.amPcFondoQuitar = function () { pc().fondo = ''; guardarEv(); renderPlanoCoctel(); };

  // ═════════ NUE-09 · Usar una boda como plantilla limpia ═════════
  const NO_COPIAR = ['c0_', 'c1_', 'c2_', 'c3_', 'c4_', 'c5_', 'c6_', 'c7_', 'chofer', 'fotografo', 'videografo', 'coord_', 'finca_', 's0_', 's1_', 's2_', 's3_', 's4_', 's5_',
    'me_', 'mo_', 'det_', 'deco_fecha', 'deco_hora', 'nombres_minuta', 'v_', 'notas_', 'bl_bebida_c', 'momento', 'otro_evento', '_opts'];
  function copiable(k) { if (k.indexOf('_tlf') >= 0 || k.indexOf('_contacto') >= 0 || k.slice(-4) === '_tlf') return false; return !NO_COPIAR.some(function (p) { return k.indexOf(p) === 0; }); }
  let idFicha = null;
  envolver('openHistoricoModal', function (id) { idFicha = id; }, function () {
    const b = document.getElementById('btn-ir-edicion');
    if (b && !document.getElementById('am-btn-plantilla') && puedePlan()) {
      b.insertAdjacentHTML('afterend', '<button id="am-btn-plantilla" onclick="amPlantilla()" class="am-btn am-btn-plantilla"><i class="fa-solid fa-copy mr-1"></i> Usar como plantilla</button>');
    }
  });
  window.amPlantilla = function () {
    const src = appData.events[idFicha]; if (!src) return;
    try { closeHistoricoModal(); } catch (e) {}
    modal('<div class="am-modal-cab"><h2>Nueva boda desde plantilla</h2><button class="am-x" data-am-cerrar>✕</button></div>' +
      '<p class="am-suave">Se copia la configuración de <b>' + esc(src.boda) + '</b>: menú, bebidas, mesas de sala, montaje, lencería, mobiliario, barra libre, coctelería y audiovisuales. <b>No</b> se copian nombres, teléfonos, invitados, menús especiales, momentos, seating, personal, consumos ni evaluaciones.</p>' +
      '<label class="am-campo">Nombre de la boda *<input id="am-pl-boda"></label>' +
      '<label class="am-campo">Lugar *<select id="am-pl-lugar" onchange="document.getElementById(\'am-pl-finca-c\').classList.toggle(\'am-oculto\', this.value !== \'BODA FINCA\')"><option value="">Elige…</option><option>BODA JARDINES LA VID</option><option>BODA FINCA</option></select></label>' +
      '<label class="am-campo am-oculto" id="am-pl-finca-c">Nombre de la finca *<input id="am-pl-finca"></label>' +
      '<label class="am-campo">Fecha *<input id="am-pl-fecha" type="date"></label><label class="am-campo">Hora<input id="am-pl-hora" type="time"></label>' +
      '<p class="am-msg" id="am-pl-msg"></p><div class="am-fila am-fin"><button class="am-btn" data-am-cerrar>Cancelar</button><button class="am-btn am-prin" onclick="amPlantillaCrear()">Crear boda</button></div>');
  };
  window.amPlantillaCrear = function () {
    const src = appData.events[idFicha];
    const boda = txt(document.getElementById('am-pl-boda').value), lugar = document.getElementById('am-pl-lugar').value;
    const finca = txt(document.getElementById('am-pl-finca').value), fecha = document.getElementById('am-pl-fecha').value;
    const msg = document.getElementById('am-pl-msg');
    if (!boda || !lugar || !fecha || (lugar === 'BODA FINCA' && !finca)) { msg.textContent = 'Rellena nombre, lugar, fecha y, si es finca, su nombre.'; return; }
    document.getElementById('init-boda').value = boda; document.getElementById('init-lugar').value = lugar;
    document.getElementById('init-ubi').value = finca; document.getElementById('init-fecha').value = fecha;
    document.getElementById('init-hora').value = document.getElementById('am-pl-hora').value;
    cerrarModal();
    confirmarNuevoRegistro();
    const e = evActual(); if (!e) return;
    const p = {};
    Object.keys(src.protocolo || {}).forEach(function (k) { if (copiable(k)) p[k] = JSON.parse(JSON.stringify(src.protocolo[k])); });
    p.lugar = lugar;
    e.protocolo = p;
    try { planoSyncProtocolo(e); } catch (err) {}
    scheduleSave();
    aviso('Boda creada desde la plantilla de ' + src.boda + '.');
    switchTab('jsw-protocolo');
  };

  // ═════════ NUE-10 · Directorio único de personal ═════════
  let DIR = [];
  let dirSincronizado = false;
  async function cargarDirectorio() { try { DIR = await api().listar('personal'); } catch (e) { DIR = []; } pintarDatalist(); }
  function pintarDatalist() {
    let dl = document.getElementById('am-dl-personal');
    if (!dl) { dl = document.createElement('datalist'); dl.id = 'am-dl-personal'; document.body.appendChild(dl); }
    dl.innerHTML = DIR.slice().sort(function (a, b) { return String(a.nombre).localeCompare(String(b.nombre)); }).map(function (p) { return '<option value="' + esc(p.nombre) + '">'; }).join('');
  }
  function lev(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = []; for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return prev[n];
  }
  function buscarPersona(nombre) {
    const n = normNombre(nombre); if (!n) return null;
    let exacta = null, cercana = null, mejor = 99;
    DIR.forEach(function (p) {
      [p.nombre].concat(p.alias || []).forEach(function (a) {
        const x = normNombre(a);
        if (x === n) exacta = p;
        const d = lev(x, n);
        const tokA = x.split(' '), tokB = n.split(' ');
        const mismoNombre = tokA[0] === tokB[0] && tokA.length > 1 && tokB.length > 1 && lev(tokA[tokA.length - 1], tokB[tokB.length - 1]) <= 2;
        const umbral = Math.max(2, Math.floor(Math.max(x.length, n.length) / 6));
        if ((d <= umbral || mismoNombre) && d < mejor) { mejor = d; cercana = p; }
      });
    });
    return exacta ? { p: exacta, exacta: true } : (cercana ? { p: cercana, exacta: false } : null);
  }
  envolver('renderCamarerosView', null, function () {
    document.querySelectorAll('#view-camareros-listado input[onblur^="updateCamarero("]').forEach(function (i) {
      if ((i.getAttribute('onblur') || '').indexOf("'nombre'") > 0) { i.setAttribute('data-am-combo', '1'); i.setAttribute('autocomplete', 'off'); }
    });
  });
  // Selector de nombres del directorio: se filtra mientras escribes o eliges directamente de la lista
  (function () {
    let caja = null, inp = null, opciones = [], sel = -1;
    function cerrar() { if (caja) caja.style.display = 'none'; inp = null; opciones = []; sel = -1; }
    function camIdDe(i) {
      const a = i.getAttribute('onblur') || ''; const k = a.indexOf('(');
      return k < 0 ? null : a.slice(k + 1, a.indexOf(',', k)).trim();
    }
    function pintar() {
      if (!inp) return;
      if (!caja) { caja = document.createElement('div'); caja.className = 'am-combo'; document.body.appendChild(caja);
        caja.addEventListener('mousedown', function (e) { const o = e.target.closest('[data-i]'); e.preventDefault(); if (o) elegir(+o.getAttribute('data-i')); }); }
      const f = normNombre(inp.value);
      const lista = DIR.map(function (p) {
        const textos = [p.nombre].concat(p.alias || []).map(normNombre);
        let rango = f ? 9 : 1;
        textos.forEach(function (t) {
          if (!f) return;
          if (t.indexOf(f) === 0) rango = Math.min(rango, 0);
          else if (t.indexOf(' ' + f) >= 0) rango = Math.min(rango, 1);
          else if (t.indexOf(f) >= 0) rango = Math.min(rango, 2);
        });
        return { p: p, r: rango };
      }).filter(function (x) { return x.r < 9; })
        .sort(function (a, b) { return a.r - b.r || String(a.p.nombre).localeCompare(String(b.p.nombre)); }).slice(0, 60);
      opciones = lista.map(function (x) { return x.p; });
      if (sel >= opciones.length) sel = opciones.length - 1;
      if (!DIR.length) { caja.innerHTML = '<div class="am-combo-vacio">El directorio de PERSONAL está vacío.</div>'; }
      else if (!opciones.length) { caja.innerHTML = '<div class="am-combo-vacio">No está en el directorio. Se guardará tal como lo escribes.</div>'; }
      else caja.innerHTML = opciones.map(function (p, i) {
        return '<div class="am-combo-op' + (i === sel ? ' am-combo-sel' : '') + '" data-i="' + i + '"><span>' + esc(p.nombre) + (p.uid ? ' <i class="fa-solid fa-user-check am-combo-u" title="Usuario de la app"></i>' : '') + '</span>' +
          (p.equipo ? '<em>' + esc(p.equipo) + '</em>' : '') + '</div>';
      }).join('');
      const r = inp.getBoundingClientRect();
      const alto = Math.min(300, window.innerHeight - r.bottom - 12);
      caja.style.left = r.left + 'px'; caja.style.width = Math.max(r.width, 280) + 'px';
      if (alto < 140) { caja.style.top = ''; caja.style.bottom = (window.innerHeight - r.top + 4) + 'px'; caja.style.maxHeight = Math.min(300, r.top - 12) + 'px'; }
      else { caja.style.bottom = ''; caja.style.top = (r.bottom + 4) + 'px'; caja.style.maxHeight = alto + 'px'; }
      caja.style.display = 'block';
      const s2 = caja.querySelector('.am-combo-sel'); if (s2) s2.scrollIntoView({ block: 'nearest' });
    }
    function elegir(i) {
      const p = opciones[i]; const campo = inp; if (!p || !campo) return;
      const id = camIdDe(campo);
      campo.value = p.nombre; cerrar(); campo.blur();
      if (p.equipo && id !== null) setTimeout(function () {
        const e = evActual(); const c = e && (e.camareros || []).filter(function (x) { return String(x.id) === String(id); })[0];
        if (c && c.equipo !== p.equipo) { window.updateCamarero(c.id, 'equipo', p.equipo); try { renderCamarerosView(); } catch (err) {} }
      }, 50);
    }
    document.addEventListener('focusin', function (e) {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-am-combo')) { inp = t; sel = -1; pintar(); } else if (caja && !(caja.contains && caja.contains(t))) cerrar();
    });
    document.addEventListener('focusout', function (e) { if (e.target === inp) setTimeout(function () { if (document.activeElement !== inp) cerrar(); }, 120); });
    document.addEventListener('input', function (e) { if (e.target === inp) { sel = 0; pintar(); } });
    document.addEventListener('keydown', function (e) {
      if (e.target !== inp || !caja || caja.style.display === 'none') return;
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(opciones.length - 1, sel + 1); pintar(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); pintar(); }
      else if (e.key === 'Enter') { if (sel >= 0 && opciones[sel]) { e.preventDefault(); elegir(sel); } else { inp.blur(); } }
      else if (e.key === 'Escape') { cerrar(); }
    });
    window.addEventListener('scroll', function () { if (inp) pintar(); }, true);
    window.addEventListener('resize', function () { if (inp) pintar(); });
  })();
  (function () {
    const orig = window.updateCamarero;
    if (typeof orig !== 'function') return;
    window.updateCamarero = function (id, campo, valor) {
      if (campo !== 'nombre' || !txt(valor)) return orig.apply(this, arguments);
      const r = buscarPersona(valor);
      if (r && r.exacta && r.p.nombre !== txt(valor).toUpperCase()) { arguments[2] = r.p.nombre; }
      const res = orig.apply(this, arguments);
      if (r && !r.exacta) {
        modal('<div class="am-modal-cab"><h2>¿Es la misma persona?</h2><button class="am-x" data-am-cerrar>✕</button></div>' +
          '<p>Has escrito <b>' + esc(txt(valor).toUpperCase()) + '</b>. En el directorio existe <b>' + esc(r.p.nombre) + '</b>.</p>' +
          '<div class="am-fila am-fin"><button class="am-btn" data-am-cerrar>No, es otra persona</button><button class="am-btn am-prin" onclick="amUnificar()">Sí, usar ' + esc(r.p.nombre) + '</button></div>');
        window.__amPend = { camId: String(id), personaId: r.p.id, escrito: limpiaNombre(valor) };
      } else if (!r && puedePlan()) {
        aviso(txt(valor).toUpperCase() + ' no está en el directorio de personal. Puedes añadirlo en PERSONAL.');
      }
      return res;
    };
  })();
  window.amUnificar = function () {
    const pend = window.__amPend || {}; const camId = pend.camId, personaId = pend.personaId, escrito = pend.escrito;
    const p = DIR.filter(function (x) { return x.id === personaId; })[0]; if (!p) return;
    cerrarModal();
    const e = evActual();
    const c = e && (e.camareros || []).filter(function (x) { return String(x.id) === String(camId); })[0];
    if (c) { c.nombre = p.nombre; guardarEv(); try { renderCamarerosView(); } catch (err) {} }
    if (puedePlan()) {
      const al = (p.alias || []).slice(); if (al.indexOf(escrito) < 0) al.push(escrito);
      p.alias = al; api().guardar('personal', p.id, { alias: al }).catch(function () {});
    }
  };
  function historialDe(p) {
    const claves = [p.nombre].concat(p.alias || []).map(normNombre);
    const l = [];
    Object.keys(appData.events).forEach(function (id) {
      const e = appData.events[id];
      (e.camareros || []).forEach(function (c) { if (claves.indexOf(normNombre(c.nombre)) >= 0) l.push({ id: id, fecha: e.fecha, boda: e.boda, resp: c.responsabilidad, equipo: c.equipo }); });
    });
    return l.sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); });
  }
  let filtroDir = '';
  async function renderDirectorio() {
    const root = document.getElementById('am-root-am-personal');
    if (!puedePlan()) { root.innerHTML = cabecera('PERSONAL', '', false) + '<div class="am-bloque">Solo administración y gestión.</div>'; return; }
    if (!dirSincronizado && window.__sincronizarDirectorio) { dirSincronizado = true; try { await window.__sincronizarDirectorio(); } catch (e) {} }
    await cargarDirectorio();
    const f = normNombre(filtroDir);
    const lista = DIR.filter(function (p) { return !f || normNombre(p.nombre + ' ' + (p.alias || []).join(' ') + ' ' + (p.equipo || '')).indexOf(f) >= 0; })
      .sort(function (a, b) { return String(a.nombre).localeCompare(String(b.nombre)); });
    let h = cabecera('DIRECTORIO DE PERSONAL', 'Un nombre único por persona, con su histórico de bodas', false);
    h += '<div class="am-fila"><input class="am-buscar" placeholder="Buscar por nombre, alias o equipo" value="' + esc(filtroDir) + '" oninput="amDirFiltro(this.value)">' +
      '<button class="am-btn am-prin" onclick="amPersona()">+ Añadir persona</button><button class="am-btn" onclick="amDirImportar()">Importar nombres de las bodas</button></div>';
    h += '<div class="am-bloque am-sinpad"><table class="am-tabla"><thead><tr><th>Nombre</th><th>Teléfono</th><th>Equipo habitual</th><th>También escrito como</th><th class="am-c">Bodas</th><th>Última</th><th></th></tr></thead><tbody>';
    if (!lista.length) h += '<tr><td colspan="7" class="am-vacio">' + (DIR.length ? 'Sin resultados.' : 'El directorio está vacío. Pulsa «Importar nombres de las bodas» para empezar.') + '</td></tr>';
    lista.forEach(function (p) {
      const hi = historialDe(p);
      h += '<tr><td><b>' + esc(p.nombre) + '</b>' + (p.uid ? ' <span class="am-chip-usuario" title="' + esc(p.email || '') + '"><i class="fa-solid fa-user-check"></i> usuario</span>' : '') + '</td><td>' + esc(p.telefono || '') + '</td><td>' + esc(p.equipo || '') + '</td><td class="am-suave">' + esc((p.alias || []).join(', ')) + '</td>' +
        '<td class="am-c"><button class="am-enlace-btn" onclick="amHistorial(\'' + p.id + '\')">' + hi.length + '</button></td><td>' + (hi[0] ? esc(fechaCorta(hi[0].fecha)) : '—') + '</td>' +
        '<td class="am-acc"><button class="am-btn" onclick="amPersona(\'' + p.id + '\')">Editar</button><button class="am-btn" onclick="amFusionar(\'' + p.id + '\')" title="Solo si es la misma persona escrita de dos formas (p. ej. JUAN T y J. TARRAGA)">Es duplicado de…</button></td></tr>';
    });
    root.innerHTML = h + '</tbody></table></div>';
  }
  window.amDirFiltro = function (v) { filtroDir = v; clearTimeout(window.__amDirT); window.__amDirT = setTimeout(function () { renderDirectorio().then(function () { const i = document.querySelector('.am-buscar'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }); }, 250); };
  window.amPersona = function (id) {
    const p = id ? DIR.filter(function (x) { return x.id === id; })[0] : {};
    modal('<div class="am-modal-cab"><h2>' + (id ? 'Editar persona' : 'Nueva persona') + '</h2><button class="am-x" data-am-cerrar>✕</button></div>' +
      '<label class="am-campo">Nombre *<input id="am-p-nombre" value="' + esc(p.nombre || '') + '"></label>' +
      '<label class="am-campo">Teléfono<input id="am-p-tel" type="tel" value="' + esc(p.telefono || '') + '"></label>' +
      '<label class="am-campo">Equipo habitual<select id="am-p-equipo">' + ['', 'SALA', 'COCTEL', 'COCINA', 'OFFICE', 'BARRA'].map(function (x) { return '<option' + (x === (p.equipo || '') ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' +
      '<label class="am-campo">También escrito como (separado por comas)<input id="am-p-alias" value="' + esc((p.alias || []).join(', ')) + '"></label>' +
      '<div class="am-fila am-fin">' + (id ? '<button class="am-btn am-peligro" onclick="amPersonaBorrar(\'' + id + '\')">Eliminar</button>' : '') + '<button class="am-btn" data-am-cerrar>Cancelar</button><button class="am-btn am-prin" onclick="amPersonaGuardar(\'' + (id || '') + '\')">Guardar</button></div>');
  };
  window.amPersonaGuardar = async function (id) {
    const nombre = limpiaNombre(document.getElementById('am-p-nombre').value);
    if (!nombre) return;
    const datos = { nombre: nombre, telefono: limpiarTel(document.getElementById('am-p-tel').value), equipo: document.getElementById('am-p-equipo').value,
      alias: document.getElementById('am-p-alias').value.split(',').map(limpiaNombre).filter(function (x) { return x && x !== nombre; }) };
    const nuevo = id || ('p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36));
    await api().guardar('personal', nuevo, datos);
    cerrarModal(); renderDirectorio();
  };
  window.amPersonaBorrar = async function (id) { if (!confirm('¿Eliminar esta persona del directorio? Las bodas no cambian.')) return; await api().borrar('personal', id); cerrarModal(); renderDirectorio(); };
  window.amFusionar = function (id) {
    const p = DIR.filter(function (x) { return x.id === id; })[0];
    modal('<div class="am-modal-cab"><h2>' + esc(p.nombre) + ' está repetido</h2><button class="am-x" data-am-cerrar>✕</button></div>' +
      '<p class="am-suave">Úsalo solo cuando la misma persona aparece dos veces en el directorio con distinto nombre (por ejemplo «JUAN T» y «J. TARRAGA»). No tiene nada que ver con los equipos de cada boda. Elige el nombre correcto: ' + esc(p.nombre) + ' quedará como otra forma de escribirlo, se borrará la ficha repetida y las bodas pasadas se corregirán.</p>' +
      '<label class="am-campo">Nombre correcto<select id="am-f-dest">' + DIR.filter(function (x) { return x.id !== id; }).sort(function (a, b) { return String(a.nombre).localeCompare(String(b.nombre)); }).map(function (x) { return '<option value="' + x.id + '">' + esc(x.nombre) + '</option>'; }).join('') + '</select></label>' +
      '<div class="am-fila am-fin"><button class="am-btn" data-am-cerrar>Cancelar</button><button class="am-btn am-prin" onclick="amFusionarOk(\'' + id + '\')">Quitar duplicado</button></div>');
  };
  window.amFusionarOk = async function (id) {
    const o = DIR.filter(function (x) { return x.id === id; })[0];
    const d = DIR.filter(function (x) { return x.id === document.getElementById('am-f-dest').value; })[0];
    if (!o || !d) return;
    const alias = (d.alias || []).concat([o.nombre], o.alias || []).filter(function (x, i, a) { return x && x !== d.nombre && a.indexOf(x) === i; });
    await api().guardar('personal', d.id, { alias: alias, telefono: d.telefono || o.telefono || '', equipo: d.equipo || o.equipo || '' });
    await api().borrar('personal', o.id);
    // Corrige el nombre en las bodas donde aparece
    const claves = [o.nombre].concat(o.alias || []).map(normNombre);
    let n = 0;
    const actual = typeof currentEventId !== 'undefined' ? currentEventId : null;
    Object.keys(appData.events).forEach(function (eid) {
      const e = appData.events[eid]; let cambio = false;
      (e.camareros || []).forEach(function (c) { if (claves.indexOf(normNombre(c.nombre)) >= 0) { c.nombre = d.nombre; cambio = true; n++; } });
      if (cambio && puedeEditar()) { try { currentEventId = eid; scheduleSave(); flushSaves(); } catch (err) {} }
    });
    try { currentEventId = actual; } catch (err) {}
    cerrarModal(); aviso('Unidos. Nombre corregido en ' + n + ' fila(s) de personal.'); renderDirectorio();
  };
  window.amHistorial = function (id) {
    const p = DIR.filter(function (x) { return x.id === id; })[0]; const hi = historialDe(p);
    modal('<div class="am-modal-cab"><h2>' + esc(p.nombre) + '</h2><button class="am-x" data-am-cerrar>✕</button></div>' +
      '<table class="am-tabla"><thead><tr><th>Fecha</th><th>Boda</th><th>Responsabilidad</th><th>Equipo</th></tr></thead><tbody>' +
      (hi.length ? hi.map(function (x) { return '<tr><td>' + esc(fechaCorta(x.fecha)) + '</td><td>' + esc(x.boda) + '</td><td>' + esc(x.resp) + '</td><td>' + esc(x.equipo) + '</td></tr>'; }).join('') : '<tr><td colspan="4" class="am-vacio">Sin bodas.</td></tr>') + '</tbody></table>');
  };
  window.amDirImportar = async function () {
    const vistos = {};
    Object.keys(appData.events).forEach(function (id) { (appData.events[id].camareros || []).forEach(function (c) { const n = limpiaNombre(c.nombre); if (n && !buscarPersona(n)) vistos[n] = vistos[n] || c.equipo || ''; }); });
    const nombres = Object.keys(vistos).sort();
    if (!nombres.length) { aviso('Todos los nombres de las bodas ya están en el directorio.'); return; }
    modal('<div class="am-modal-cab"><h2>Importar nombres</h2><button class="am-x" data-am-cerrar>✕</button></div><p class="am-suave">Marca los que quieres añadir. Si dos nombres son la misma persona, añade solo uno y luego usa «Es duplicado de…».</p>' +
      '<div class="am-lista-imp">' + nombres.map(function (n, i) { return '<label><input type="checkbox" checked data-imp="' + i + '"> ' + esc(n) + ' <span class="am-suave">' + esc(vistos[n]) + '</span></label>'; }).join('') + '</div>' +
      '<div class="am-fila am-fin"><button class="am-btn" data-am-cerrar>Cancelar</button><button class="am-btn am-prin" id="am-imp-ok">Añadir</button></div>');
    document.getElementById('am-imp-ok').onclick = async function () {
      this.disabled = true;
      const sel = Array.prototype.filter.call(document.querySelectorAll('[data-imp]'), function (c) { return c.checked; }).map(function (c) { return nombres[parseInt(c.getAttribute('data-imp'), 10)]; });
      for (let i = 0; i < sel.length; i++) await api().guardar('personal', 'p' + Date.now().toString(36) + i, { nombre: sel[i], telefono: '', equipo: String(vistos[sel[i]] || '').toUpperCase(), alias: [] });
      cerrarModal(); aviso(sel.length + ' persona(s) añadidas.'); renderDirectorio();
    };
  };



  // ═════════ Papelera de bodas (30 días, solo administrador) ═════════
  function diasDesde(ts) { if (!ts || typeof ts.toDate !== 'function') return 0; return Math.floor((Date.now() - ts.toDate().getTime()) / 86400000); }
  async function renderPapelera() {
    const root = document.getElementById('am-root-am-papelera');
    let h = cabecera('PAPELERA', 'Bodas eliminadas · se pueden recuperar durante 30 días', false);
    const a = api();
    if (!a || !a.esAdmin()) { root.innerHTML = h + '<div class="am-bloque">Solo el administrador.</div>'; return; }
    root.innerHTML = h + '<div class="am-bloque am-suave">Cargando…</div>';
    let l = [];
    try { l = await a.listar('eventos', 'papelera', true); } catch (e) { root.innerHTML = h + '<div class="am-bloque">No se ha podido leer la papelera.</div>'; return; }
    // Borrado definitivo automático a los 30 días
    const caducadas = l.filter(function (x) { return diasDesde(x.papeleraEn) > 30; });
    for (let i = 0; i < caducadas.length; i++) { try { await a.borrar('eventos', caducadas[i].id); } catch (e) {} }
    l = l.filter(function (x) { return diasDesde(x.papeleraEn) <= 30; }).sort(function (x, y) { return diasDesde(x.papeleraEn) - diasDesde(y.papeleraEn); });
    h += '<div class="am-bloque am-sinpad"><table class="am-tabla"><thead><tr><th>Boda</th><th>Fecha</th><th>Eliminada hace</th><th>Se borra en</th><th></th></tr></thead><tbody>';
    if (!l.length) h += '<tr><td colspan="5" class="am-vacio">La papelera está vacía.</td></tr>';
    l.forEach(function (x) {
      const d = diasDesde(x.papeleraEn);
      h += '<tr><td><b>' + esc(x.boda || 'Sin nombre') + '</b></td><td>' + esc(fechaCorta(x.fecha)) + '</td><td>' + (d === 0 ? 'hoy' : d + ' día(s)') + '</td><td>' + (30 - d) + ' día(s)</td>' +
        '<td class="am-acc"><button class="am-btn am-prin" onclick="amRecuperar(\'' + x.id + '\')">Recuperar</button><button class="am-btn am-peligro" onclick="amBorrarYa(\'' + x.id + '\')">Borrar ya</button></td></tr>';
    });
    root.innerHTML = h + '</tbody></table></div>';
  }
  window.amRecuperar = async function (id) {
    await api().guardar('eventos', id, { papelera: false, session: 'papelera' });
    aviso('Boda recuperada.');
    try { cargarDatosIniciales(1); } catch (e) {}
    renderPapelera();
  };
  window.amBorrarYa = async function (id) {
    if (!confirm('¿Borrar esta boda definitivamente? No se podrá recuperar.')) return;
    await api().borrar('eventos', id); aviso('Boda borrada definitivamente.'); renderPapelera();
  };

  // ═════════ «Imprimir todo» incluye las hojas nuevas ═════════
  (function () {
    const orig = window.pzGrupos;
    if (typeof orig !== 'function') return;
    window.pzGrupos = function () {
      const g = orig.apply(this, arguments);
      const paso = function (id, espera) { return { vista: '', espera: espera || 350, ir: function () { switchTab(id); }, src: function () { return document.getElementById('am-root-' + id); } }; };
      const nuevos = [
        { id: 'am-ceremonia', t: 'CEREMONIA', pasos: function () { return [paso('am-ceremonia')]; } },
        { id: 'am-finca', t: 'FICHA DE LA FINCA', pasos: function () { const e = evActual(); return e && e.finca_token ? [paso('am-finca', 1500)] : []; } },
        { id: 'am-planococtel', t: 'PLANO CÓCTEL', pasos: function () { const e = evActual(); return e && e.plano_coctel && (e.plano_coctel.items || []).length ? [paso('am-planococtel')] : []; } },
        { id: 'am-control', t: 'CONTROL DE DOCUMENTACIÓN', pasos: function () { return [paso('am-control')]; } }
      ].filter(function (x) { return x.pasos().length > 0; });
      if (!verPersonal()) { const ip = g.findIndex(function (x) { return x.id === 'personal'; }); if (ip >= 0) g.splice(ip, 1); }
      let i = g.findIndex(function (x) { return x.id === 'protocolo'; });
      if (i < 0) i = g.length - 1;
      g.splice.apply(g, [i + 1, 0].concat(nuevos));
      return g;
    };
  })();

  // ═════════ Arranque (lo llama nube.js tras iniciar sesión) ═════════
  // Móvil: menú lateral desplegable con barra superior
  function barraMovil() {
    if (document.getElementById('am-barra-movil')) return;
    document.body.insertAdjacentHTML('afterbegin', '<div id="am-barra-movil" class="am-barra-movil"><button class="am-hamb" onclick="amMenuMovil()" aria-label="Menú"><i class="fa-solid fa-bars"></i></button><img src="img/logo-am-marfil.png" alt="Alfonso Mira"><span id="am-barra-titulo"></span></div><div class="am-velo" onclick="amMenuMovil(false)"></div>');
    const aside = document.querySelector('body > aside');
    if (aside) aside.addEventListener('click', function (e) {
      const b = e.target.closest('button'); if (!b) return;
      if ((b.getAttribute('onclick') || '').indexOf('toggleMenu') >= 0) return;
      setTimeout(function () { amMenuMovil(false); }, 60);
    });
  }
  window.amMenuMovil = function (v) { document.body.classList.toggle('am-menu-abierto', v === undefined ? !document.body.classList.contains('am-menu-abierto') : !!v); };
  window.__mejorasArranque = function () {
    barraMovil();
    crearMenu();
    const a = api();
    if (a) {
      a.leer('config', 'reglas').then(function (r) { if (r) Object.keys(REGLAS_BASE).forEach(function (k) { if (r[k] !== undefined) REGLAS[k] = num(r[k]); }); }).catch(function () {});
      cargarDirectorio();
      setTimeout(avisoCopia, 4000);
    }
  };
})();

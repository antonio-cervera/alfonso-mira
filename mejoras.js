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
    'am-personal': { titulo: 'PERSONAL', nivel: 'top', render: function () { renderDirectorio(); } },
    'am-ceremonia': { titulo: 'CEREMONIA', nivel: 'jsw', render: function () { renderCeremonia(); } },
    'am-finca': { titulo: 'FICHA DE LA FINCA', nivel: 'jsw', render: function () { renderFinca(); } },
    'am-planococtel': { titulo: 'PLANO CÓCTEL', nivel: 'coord', render: function () { renderPlanoCoctel(); } }
  };
  function crearMenu() {
    const historico = document.getElementById('tab-historico');
    if (historico && !document.getElementById('tab-am-planning')) {
      historico.insertAdjacentHTML('afterend',
        '<button onclick="switchTab(\'am-planning\')" id="tab-am-planning" class="nav-btn"><i class="fa-solid fa-calendar-week w-6 text-center mr-2"></i> PLANNING SEMANAL</button>' +
        '<button onclick="switchTab(\'am-personal\')" id="tab-am-personal" class="nav-btn am-solo-plan"><i class="fa-solid fa-address-book w-6 text-center mr-2"></i> PERSONAL</button>');
    }
    const sub = 'nav-btn py-1.5 px-3 text-xs text-gray-500';
    const prot = document.getElementById('tab-jsw-protocolo');
    if (prot && !document.getElementById('tab-am-ceremonia')) prot.insertAdjacentHTML('afterend', '<button onclick="switchTab(\'am-ceremonia\')" id="tab-am-ceremonia" class="' + sub + '">CEREMONIA</button>');
    const ficha = document.getElementById('tab-jsw-fichainfo');
    if (ficha && !document.getElementById('tab-am-finca')) ficha.insertAdjacentHTML('afterend', '<button onclick="switchTab(\'am-finca\')" id="tab-am-finca" class="' + sub + '">FICHA DE LA FINCA</button>');
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
  const REGLAS_BASE = { altas_pct: 75, bandejas_por_mesa: 1, pax_por_bandeja_pasada: 25, pax_por_punto_jamon: 150, pax_por_pala: 20 };
  let REGLAS = Object.assign({}, REGLAS_BASE);
  function p_(p, k) { return txt(p[k]); }
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
    ['ncc_tipo_coctel', 'tipo_coctel'], ['ncc_taburetes', 'mob_taburetes'], ['ncc_taburetes_cant', 'mob_taburetes_cant'], ['nco_pinchos', 'n_pinchos'],
    ['nbl_modalidad', 'bl_tipo'], ['nbl_horas', 'bl_horas_contratadas'], ['nbl_copas_mesa', 'bl_copas_mesa'], ['nbl_copas_horas', 'bl_cant_horas'],
    ['nbl_ubi_jlv', 'bl_ubi_jlv'], ['nbl_ubi_cat', 'bl_ubi_cat'], ['nbl_tipo_vaso', 'bl_tipo_vaso'],
    ['nbl_coct_tipo', 'coc_tipo'], ['nbl_coct_ubi', 'coc_ubicacion'], ['nbl_coct_hora', 'coc_hora_cita'], ['nbl_coct_contacto', 'coc_contacto'],
    ['nbl_coct_necesidades', 'coc_necesidades'], ['nbl_coct_zona', 'coc_zona']
  ];
  ['ncc_', 'nco_'].forEach(function (pre) {
    MAPA.push([pre + 'jamon_tipo', 'jamon_tipo'], [pre + 'jamon_unidades', 'jamon_unidades'], [pre + 'jamon_puntos', 'jamon_puntos'],
      [pre + 'jamon_resopo', 'jamon_resopo'], [pre + 'jamon_resopo_cant', 'jamon_resopo_cant']);
  });
  // Ceremonia (NUE-04) → Equipos
  const MAPA_CER = [['ig_ceremonia', 'hay'], ['ig_hora_ceremonia', 'hora'], ['ig_recepcion_ceremonia', 'recepcion'], ['ig_recepcion_bebida', 'bebida'],
    ['ig_pasar_sillas', 'pasar_sillas'], ['ig_sillas_cantidad', 'sillas'], ['ig_jlv_ceremonia', 'espacio_jlv'], ['ig_cat_ceremonia', 'espacio_cat']];
  const FUENTES_FORMULA = ['ncc_n_mesas', 'nsa_pinzas_1', 'nsa_pinzas_2', 'nsa_pinzas_pan', 'nsa_pinzas_otras', 'nsa_mul_n_pescado'];

  function autoRellenar(e) {
    if (!e) return [];
    const m = ensureJefeSalaManual(e);
    if (!m._auto || typeof m._auto !== 'object') m._auto = {};
    const p = e.protocolo || {};
    const cambios = [];
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
    // Fórmulas (reglas editables)
    const tot = jswTotals(e);
    const invitados = tot.invitados;
    const nMesas = num(m.ncc_n_mesas);
    if (nMesas > 0) {
      const altas = Math.round(nMesas * num(REGLAS.altas_pct) / 100);
      poner('ncc_mesas_altas', altas); poner('ncc_mesas_bajas', nMesas - altas);
      const b = num(REGLAS.bandejas_por_mesa);
      poner('nco_bandejas_altas', altas * b); poner('nco_bandejas_bajas', (nMesas - altas) * b); poner('nco_bandejas_mesa', nMesas * b);
    } else { ['ncc_mesas_altas', 'ncc_mesas_bajas', 'nco_bandejas_altas', 'nco_bandejas_bajas', 'nco_bandejas_mesa'].forEach(function (k) { poner(k, ''); }); }
    poner('nco_bandejas_pasadas', invitados > 0 && num(REGLAS.pax_por_bandeja_pasada) > 0 ? Math.ceil(invitados / num(REGLAS.pax_por_bandeja_pasada)) : '');
    const hayJamon = p_(p, 'jamon_tipo') !== '' || p_(p, 'jamon_unidades') !== '';
    if (hayJamon && p_(p, 'jamon_puntos') === '' && invitados > 0 && num(REGLAS.pax_por_punto_jamon) > 0) {
      const pj = Math.ceil(invitados / num(REGLAS.pax_por_punto_jamon));
      poner('ncc_jamon_puntos', pj); poner('nco_jamon_puntos', pj);
    }
    const pinzas = ['nsa_pinzas_1', 'nsa_pinzas_2', 'nsa_pinzas_pan', 'nsa_pinzas_otras'].reduce(function (a, k) { return a + num(m[k]); }, 0);
    poner('nsa_total_pinzas', pinzas > 0 ? pinzas : '');
    const pescado = num(m.nsa_mul_n_pescado);
    poner('nsa_platos_palas', pescado > 0 && num(REGLAS.pax_por_pala) > 0 ? Math.ceil(pescado / num(REGLAS.pax_por_pala)) : '');
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
        el.title = 'Automático (Protocolo, Ceremonia o cálculo). Escribe encima para corregirlo a mano.';
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
  window.amReglas = function () {
    const r = REGLAS;
    const f = function (k, l, ayuda) { return '<label class="am-campo">' + l + '<input type="number" min="0" step="1" id="am-r-' + k + '" value="' + esc(r[k]) + '"><small>' + ayuda + '</small></label>'; };
    modal('<div class="am-modal-cab"><h2>Reglas de cálculo</h2><button class="am-x" data-am-cerrar>✕</button></div>' +
      '<p class="am-suave">Se aplican a todas las bodas. Los valores calculados siempre se pueden corregir a mano en cada boda.</p>' +
      f('altas_pct', 'Mesas altas en el cóctel (%)', 'El resto son mesas bajas. Excel: 75 % altas / 25 % bajas.') +
      f('bandejas_por_mesa', 'Bandejas por mesa de cóctel', 'Bandejas a mesas altas y bajas = mesas × este número.') +
      f('pax_por_bandeja_pasada', 'Invitados por bandeja pasada', 'Bandejas pasadas = invitados ÷ este número (redondeo hacia arriba).') +
      f('pax_por_punto_jamon', 'Invitados por punto de jamón', 'Solo si hay jamón y Protocolo no indica los puntos.') +
      f('pax_por_pala', 'Platos de pescado por plato de palas', 'Platos de palas = nº pescado ÷ este número.') +
      '<p class="am-suave">Total de pinzas = suma de pinzas de pinceados, con pinza, pan y otras.</p>' +
      '<div class="am-fila am-fin"><button class="am-btn" onclick="amReglasBase()">Valores iniciales</button><button class="am-btn am-prin" onclick="amReglasGuardar()">Guardar</button></div>');
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
        (puedePlan() ? '<button class="am-btn am-prin" onclick="amFincaCrear()">Crear enlace para la finca</button>' : '<p class="am-suave">Pide a coordinación que cree el enlace.</p>') + '</div>';
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
    root.innerHTML = h;
  }
  window.amSemana = function (d) { if (d === 0) semana = lunesDe(new Date()); else { semana = new Date(semana); semana.setDate(semana.getDate() + 7 * d); } renderPlanning(); };

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
      if ((i.getAttribute('onblur') || '').indexOf("'nombre'") > 0) i.setAttribute('list', 'am-dl-personal');
    });
  });
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
    if (!puedePlan()) { root.innerHTML = cabecera('PERSONAL', '', false) + '<div class="am-bloque">Solo administración y coordinación.</div>'; return; }
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
      h += '<tr><td><b>' + esc(p.nombre) + '</b></td><td>' + esc(p.telefono || '') + '</td><td>' + esc(p.equipo || '') + '</td><td class="am-suave">' + esc((p.alias || []).join(', ')) + '</td>' +
        '<td class="am-c"><button class="am-enlace-btn" onclick="amHistorial(\'' + p.id + '\')">' + hi.length + '</button></td><td>' + (hi[0] ? esc(fechaCorta(hi[0].fecha)) : '—') + '</td>' +
        '<td class="am-acc"><button class="am-btn" onclick="amPersona(\'' + p.id + '\')">Editar</button><button class="am-btn" onclick="amFusionar(\'' + p.id + '\')">Unir con…</button></td></tr>';
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
    modal('<div class="am-modal-cab"><h2>Unir ' + esc(p.nombre) + ' con…</h2><button class="am-x" data-am-cerrar>✕</button></div>' +
      '<p class="am-suave">Elige el nombre correcto. ' + esc(p.nombre) + ' pasará a ser una forma alternativa de escribirlo y las bodas se actualizarán.</p>' +
      '<label class="am-campo">Nombre correcto<select id="am-f-dest">' + DIR.filter(function (x) { return x.id !== id; }).sort(function (a, b) { return String(a.nombre).localeCompare(String(b.nombre)); }).map(function (x) { return '<option value="' + x.id + '">' + esc(x.nombre) + '</option>'; }).join('') + '</select></label>' +
      '<div class="am-fila am-fin"><button class="am-btn" data-am-cerrar>Cancelar</button><button class="am-btn am-prin" onclick="amFusionarOk(\'' + id + '\')">Unir</button></div>');
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
    modal('<div class="am-modal-cab"><h2>Importar nombres</h2><button class="am-x" data-am-cerrar>✕</button></div><p class="am-suave">Marca los que quieres añadir. Si dos nombres son la misma persona, añade solo uno y luego usa «Unir con…».</p>' +
      '<div class="am-lista-imp">' + nombres.map(function (n, i) { return '<label><input type="checkbox" checked data-imp="' + i + '"> ' + esc(n) + ' <span class="am-suave">' + esc(vistos[n]) + '</span></label>'; }).join('') + '</div>' +
      '<div class="am-fila am-fin"><button class="am-btn" data-am-cerrar>Cancelar</button><button class="am-btn am-prin" id="am-imp-ok">Añadir</button></div>');
    document.getElementById('am-imp-ok').onclick = async function () {
      this.disabled = true;
      const sel = Array.prototype.filter.call(document.querySelectorAll('[data-imp]'), function (c) { return c.checked; }).map(function (c) { return nombres[parseInt(c.getAttribute('data-imp'), 10)]; });
      for (let i = 0; i < sel.length; i++) await api().guardar('personal', 'p' + Date.now().toString(36) + i, { nombre: sel[i], telefono: '', equipo: String(vistos[sel[i]] || '').toUpperCase(), alias: [] });
      cerrarModal(); aviso(sel.length + ' persona(s) añadidas.'); renderDirectorio();
    };
  };

  // ═════════ Arranque (lo llama nube.js tras iniciar sesión) ═════════
  window.__mejorasArranque = function () {
    crearMenu();
    const a = api();
    if (a) {
      a.leer('config', 'reglas').then(function (r) { if (r) Object.keys(REGLAS_BASE).forEach(function (k) { if (r[k] !== undefined) REGLAS[k] = num(r[k]); }); }).catch(function () {});
      cargarDirectorio();
    }
  };
})();

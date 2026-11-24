// Alfonso Mira · Planning — v0.1
// Reglas de estilo: sin encadenamiento opcional, sin fusión nula y sin expresiones regulares literales.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, updateDoc, collection, onSnapshot, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

// ───────── Arranque de Firebase ─────────
const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);
auth.languageCode = 'es';
let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  db = initializeFirestore(app, {});
}

// ───────── Constantes ─────────
const ROLES = {
  admin: 'Administrador', coordinador: 'Coordinador', jefesala: 'Jefe de sala',
  cocina: 'Cocina', camarero: 'Camarero', pendiente: 'Pendiente'
};
const ROLES_PLAN = ['admin', 'coordinador'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const LUGAR_JLV = 'JARDINES LA VID';
const PESTANAS = [
  ['datos', 'Datos generales'], ['protocolo', 'Protocolo'], ['plano', 'Plano'],
  ['especiales', 'Menús especiales'], ['minuta', 'Minuta'], ['equipos', 'Equipos'],
  ['montaje', 'Montaje'], ['pedidos', 'Pedidos'], ['evaluacion', 'Evaluación'], ['informe', 'Informe']
];

// ───────── Estado ─────────
const S = {
  user: null, perfil: null, eventos: [], cargados: false,
  unsubPerfil: null, unsubEventos: null, unsubUsuarios: null, unsubEvento: null,
  usuarios: [], pendientes: 0, online: navigator.onLine,
  cal: { modo: 'anio', anio: new Date().getFullYear(), mes: new Date().getMonth() },
  hist: { texto: '', fecha: '' },
  evento: null, eventoId: null, pestana: 'datos', soloLectura: true
};

// ───────── Utilidades ─────────
function $(id) { return document.getElementById(id); }
function esc(v) {
  return String(v === undefined || v === null ? '' : v)
    .split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;')
    .split('"').join('&quot;').split("'").join('&#39;');
}
function mostrar(id) {
  ['pantalla-carga', 'pantalla-login', 'pantalla-pendiente', 'app'].forEach(function (x) {
    $(x).classList.toggle('oculto', x !== id);
  });
}
let avisoTimer = null;
function aviso(txt, error) {
  const a = $('aviso');
  a.textContent = txt;
  a.style.background = error ? 'var(--rojo)' : 'var(--tinta)';
  a.classList.remove('oculto');
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(function () { a.classList.add('oculto'); }, error ? 6000 : 3000);
}
window.addEventListener('error', function (e) { aviso('Error: ' + (e.message || 'desconocido'), true); });
window.addEventListener('unhandledrejection', function (e) {
  const r = e.reason;
  aviso('Error: ' + (r && r.message ? r.message : String(r)), true);
});
function pad(n) { return (n < 10 ? '0' : '') + n; }
function isoDe(a, m, d) { return a + '-' + pad(m + 1) + '-' + pad(d); }
function hoyIso() { const h = new Date(); return isoDe(h.getFullYear(), h.getMonth(), h.getDate()); }
function partes(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const p = iso.split('-');
  if (p.length !== 3) return null;
  return { a: parseInt(p[0], 10), m: parseInt(p[1], 10) - 1, d: parseInt(p[2], 10) };
}
function fechaCorta(iso) { const p = partes(iso); return p ? pad(p.d) + '/' + pad(p.m + 1) + '/' + p.a : 'Borrador sin fecha'; }
function fechaLarga(iso) {
  const p = partes(iso);
  if (!p) return 'Sin fecha';
  const dw = (new Date(p.a, p.m, p.d).getDay() + 6) % 7;
  return DIAS_LARGOS[dw] + ', ' + p.d + ' de ' + MESES[p.m] + ' de ' + p.a;
}
function num(v) { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
function mayus(v) { return String(v || '').trim().toUpperCase(); }
function ubicacion(ev) { return ev.lugar === 'FINCA' ? (ev.finca || 'FINCA') : LUGAR_JLV; }
function puedePlanificar() { return S.perfil && ROLES_PLAN.indexOf(S.perfil.rol) >= 0; }
function esAdmin() { return S.perfil && S.perfil.rol === 'admin'; }
function iniciales(n) {
  const p = String(n || '?').trim().split(' ');
  return ((p[0] || '?').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
}
function eventosDelDia(iso) {
  return S.eventos.filter(function (e) { return e.fecha === iso; })
    .sort(function (a, b) { return String(a.hora || '').localeCompare(String(b.hora || '')); });
}
function colorChip(i) { return i % 4 === 0 ? '' : ' c' + (i % 4); }

// ───────── Estado de sincronización (GEN-05) ─────────
function pintarSync() {
  const el = $('estado-sync');
  const txt = el.querySelector('.txt');
  el.classList.remove('ok', 'pend', 'off');
  if (!S.online) { el.classList.add('off'); txt.textContent = S.pendientes ? 'Sin conexión · ' + S.pendientes + ' guardado(s) en el dispositivo' : 'Sin conexión'; }
  else if (S.pendientes) { el.classList.add('pend'); txt.textContent = 'Sincronizando…'; }
  else { el.classList.add('ok'); txt.textContent = 'Al día'; }
}
window.addEventListener('online', function () { S.online = true; pintarSync(); });
window.addEventListener('offline', function () { S.online = false; pintarSync(); });
window.addEventListener('beforeunload', function (e) {
  if (S.pendientes > 0 && S.online) { e.preventDefault(); e.returnValue = ''; }
});
function seguir(promesa) {
  S.pendientes++; pintarSync();
  return promesa.then(function (r) { S.pendientes--; pintarSync(); return r; },
    function (err) { S.pendientes--; pintarSync(); aviso('No se ha podido guardar: ' + traducirError(err), true); throw err; });
}

function traducirError(err) {
  const c = err && err.code ? err.code : '';
  const m = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/invalid-email': 'El correo no es válido.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
    'auth/popup-closed-by-user': 'Has cerrado la ventana de Google.',
    'auth/network-request-failed': 'Sin conexión a internet.',
    'permission-denied': 'No tienes permiso para esta acción.'
  };
  return m[c] || (err && err.message ? err.message : 'Error desconocido');
}

// ───────── Acceso ─────────
const proveedor = new GoogleAuthProvider();
proveedor.setCustomParameters({ prompt: 'select_account' });
getRedirectResult(auth).catch(function (e) { $('login-msg').textContent = traducirError(e); });

$('btn-google').addEventListener('click', function () {
  $('login-msg').textContent = '';
  signInWithPopup(auth, proveedor).catch(function (e) {
    if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
      signInWithRedirect(auth, proveedor);
    } else { $('login-msg').textContent = traducirError(e); }
  });
});
function entrarCorreo() {
  const email = $('login-email').value.trim();
  const pass = $('login-pass').value;
  if (!email || !pass) { $('login-msg').textContent = 'Escribe el correo y la contraseña.'; return; }
  $('btn-email').disabled = true;
  signInWithEmailAndPassword(auth, email, pass)
    .catch(function (e) { $('login-msg').textContent = traducirError(e); })
    .then(function () { $('btn-email').disabled = false; });
}
$('btn-email').addEventListener('click', entrarCorreo);
$('login-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') entrarCorreo(); });
$('btn-olvido').addEventListener('click', function () {
  const email = $('login-email').value.trim();
  if (!email) { $('login-msg').textContent = 'Escribe tu correo arriba y vuelve a pulsar.'; return; }
  sendPasswordResetEmail(auth, email)
    .then(function () { $('login-msg').style.color = 'var(--verde)'; $('login-msg').textContent = 'Te hemos enviado un correo para crear una contraseña nueva.'; })
    .catch(function (e) { $('login-msg').style.color = ''; $('login-msg').textContent = traducirError(e); });
});
document.addEventListener('click', function (e) {
  const b = e.target.closest('[data-accion="salir"]');
  if (b) { signOut(auth); }
});

function limpiarSuscripciones() {
  ['unsubPerfil', 'unsubEventos', 'unsubUsuarios', 'unsubEvento'].forEach(function (k) {
    if (S[k]) { S[k](); S[k] = null; }
  });
}

onAuthStateChanged(auth, function (user) {
  limpiarSuscripciones();
  S.user = user; S.perfil = null; S.eventos = []; S.cargados = false;
  if (!user) { mostrar('pantalla-login'); return; }
  mostrar('pantalla-carga');
  prepararPerfil(user).catch(function (e) {
    aviso('No se ha podido cargar tu perfil: ' + traducirError(e), true);
    mostrar('pantalla-login');
  });
});

// Primer usuario = administrador; los siguientes quedan «pendiente».
async function prepararPerfil(user) {
  const refU = doc(db, 'users', user.uid);
  let snap = await getDoc(refU);
  if (!snap.exists()) {
    const nombre = mayus(user.displayName || String(user.email || '').split('@')[0]);
    const refB = doc(db, 'config', 'bootstrap');
    const b = await getDoc(refB);
    if (!b.exists()) {
      const lote = writeBatch(db);
      lote.set(refU, { nombre: nombre, email: user.email || '', rol: 'admin', creado: serverTimestamp() });
      lote.set(refB, { adminUid: user.uid });
      await lote.commit();
    } else {
      await setDoc(refU, { nombre: nombre, email: user.email || '', rol: 'pendiente', creado: serverTimestamp() });
    }
  }
  S.unsubPerfil = onSnapshot(refU, function (s) {
    if (!s.exists()) { signOut(auth); return; }
    const anterior = S.perfil ? S.perfil.rol : null;
    S.perfil = s.data();
    if (S.perfil.rol === 'pendiente') {
      if (S.unsubEventos) { S.unsubEventos(); S.unsubEventos = null; }
      $('pendiente-email').textContent = S.user.email || '';
      mostrar('pantalla-pendiente');
      return;
    }
    pintarUsuario();
    if (anterior !== S.perfil.rol) arrancarApp();
  }, function (e) { aviso(traducirError(e), true); });
}

function pintarUsuario() {
  $('usuario-nombre').textContent = S.perfil.nombre || S.user.email;
  $('usuario-rol').textContent = ROLES[S.perfil.rol] || S.perfil.rol;
  $('usuario-avatar').textContent = iniciales(S.perfil.nombre);
  document.querySelectorAll('.solo-admin').forEach(function (x) { x.classList.toggle('oculto', !esAdmin()); });
}

function arrancarApp() {
  mostrar('app');
  pintarSync();
  if (S.unsubEventos) S.unsubEventos();
  S.unsubEventos = onSnapshot(collection(db, 'eventos'), function (qs) {
    const lista = [];
    qs.forEach(function (d) {
      const x = d.data();
      if (x.papelera) return;
      x.id = d.id;
      lista.push(x);
    });
    S.eventos = lista;
    S.cargados = true;
    if (vistaActual() !== 'evento') render();
  }, function (e) { aviso('No se pueden leer las bodas: ' + traducirError(e), true); });
  if (!location.hash) location.hash = '#/calendario';
  render();
}

// ───────── Enrutado ─────────
function rutas() { return location.hash.replace('#/', '').split('/'); }
function vistaActual() { return rutas()[0] || 'calendario'; }
window.addEventListener('hashchange', function () { if (S.perfil && S.perfil.rol !== 'pendiente') render(); });

function render() {
  ocultarPopover();
  const r = rutas();
  const v = r[0] || 'calendario';
  document.querySelectorAll('.menu-item').forEach(function (a) { a.classList.toggle('activo', a.getAttribute('data-vista') === v); });
  if (v !== 'evento' && S.unsubEvento) { S.unsubEvento(); S.unsubEvento = null; S.eventoId = null; }
  if (v !== 'usuarios' && S.unsubUsuarios) { S.unsubUsuarios(); S.unsubUsuarios = null; }
  if (v === 'historico') return vistaHistorico();
  if (v === 'usuarios') return esAdmin() ? vistaUsuarios() : (location.hash = '#/calendario');
  if (v === 'evento') return vistaEvento(r[1], r[2] || 'datos', r[3] === 'editar');
  return vistaCalendario();
}

// ───────── Calendario (CAL-01…CAL-10) ─────────
function vistaCalendario() {
  const c = S.cal;
  const enPeriodo = S.eventos.filter(function (e) {
    const p = partes(e.fecha);
    return p && p.a === c.anio && (c.modo === 'anio' || p.m === c.mes);
  }).length;
  const periodo = c.modo === 'anio' ? String(c.anio) : MESES[c.mes] + ' ' + c.anio;
  let h = '<div class="cabecera"><div><h1 class="titulo">Calendario</h1>' +
    '<div class="subtitulo">Pulsa un día: una boda abre su ficha, varias abren el histórico de ese día y un día libre crea una boda.</div></div>' +
    '<div class="fila">' + (puedePlanificar() ? '<button class="btn btn-principal" data-cal="nueva">+ Nueva boda</button>' : '') + '</div></div>';
  h += '<div class="cabecera"><div class="cal-nav">' +
    '<button class="btn btn-secundario" data-cal="prev" aria-label="Anterior">‹</button>' +
    '<div class="cal-periodo">' + esc(periodo.charAt(0).toUpperCase() + periodo.slice(1)) + '</div>' +
    '<button class="btn btn-secundario" data-cal="next" aria-label="Siguiente">›</button>' +
    (c.modo === 'mes' ? '<button class="btn btn-secundario" data-cal="anio">Año</button>' : '') +
    '<button class="btn btn-secundario" data-cal="hoy">Hoy</button></div>' +
    '<span class="chip">' + enPeriodo + ' evento' + (enPeriodo === 1 ? '' : 's') + ' · ' + esc(periodo) + '</span></div>';
  h += c.modo === 'anio' ? htmlAnio() : htmlMes();
  if (!S.cargados) h += '<p class="texto-suave">Cargando bodas…</p>';
  $('contenido').innerHTML = h;
}

function htmlAnio() {
  const hoy = hoyIso();
  let h = '<div class="cal-anio">';
  for (let m = 0; m < 12; m++) {
    const n = S.eventos.filter(function (e) { const p = partes(e.fecha); return p && p.a === S.cal.anio && p.m === m; }).length;
    h += '<div class="cal-mes" data-mes="' + m + '" title="Ver mes"><div class="cal-mes-cab"><span class="cal-mes-nombre">' + MESES[m] + '</span>' +
      (n ? '<span class="cal-mes-n">' + n + '</span>' : '') + '</div><div class="cal-mini">';
    DIAS_CORTOS.forEach(function (d) { h += '<span class="dsem">' + d + '</span>'; });
    const primero = (new Date(S.cal.anio, m, 1).getDay() + 6) % 7;
    const total = new Date(S.cal.anio, m + 1, 0).getDate();
    for (let i = 0; i < primero; i++) h += '<span></span>';
    for (let d = 1; d <= total; d++) {
      const iso = isoDe(S.cal.anio, m, d);
      const evs = eventosDelDia(iso);
      let cls = 'cal-dia';
      if (evs.length) cls += ' ev';
      if (evs.length > 1) cls += ' multi';
      if (iso === hoy) cls += ' hoy';
      h += '<button class="' + cls + '" data-dia="' + iso + '"' + (evs.length > 1 ? ' data-n="' + evs.length + '"' : '') + '>' + d + '</button>';
    }
    h += '</div></div>';
  }
  return h + '</div>';
}

function htmlMes() {
  const a = S.cal.anio, m = S.cal.mes, hoy = hoyIso();
  let h = '<div class="cal-mesgrande">';
  DIAS_LARGOS.forEach(function (d) { h += '<div class="cal-cab">' + d.slice(0, 3) + '</div>'; });
  const primero = (new Date(a, m, 1).getDay() + 6) % 7;
  const total = new Date(a, m + 1, 0).getDate();
  for (let i = 0; i < primero; i++) h += '<div class="cal-celda vacia"></div>';
  for (let d = 1; d <= total; d++) {
    const iso = isoDe(a, m, d);
    const dw = (primero + d - 1) % 7;
    const evs = eventosDelDia(iso);
    let cls = 'cal-celda';
    if (dw >= 5) cls += ' finde';
    if (iso === hoy) cls += ' hoy';
    h += '<div class="' + cls + '" data-dia="' + iso + '"><span class="cal-num">' + d + '</span>';
    evs.slice(0, 3).forEach(function (e, i) {
      h += '<button class="cal-chip' + colorChip(i) + '" data-ev="' + e.id + '">' + esc((e.hora ? e.hora + ' · ' : '') + (e.nombre || 'Sin nombre')) + '</button>';
    });
    if (evs.length > 3) h += '<button class="cal-chip mas" data-dia-lista="' + iso + '">+' + (evs.length - 3) + ' más</button>';
    h += '</div>';
  }
  return h + '</div>';
}

function clicDia(iso) {
  const evs = eventosDelDia(iso);
  if (evs.length === 1) return abrirFicha(evs[0].id);
  if (evs.length > 1) { S.hist.fecha = iso; S.hist.texto = ''; location.hash = '#/historico'; return; }
  if (puedePlanificar()) return modalNueva(iso);
  aviso('No hay bodas ese día.');
}

$('contenido').addEventListener('click', function (e) {
  const t = e.target;
  const cal = t.closest('[data-cal]');
  if (cal) {
    const acc = cal.getAttribute('data-cal');
    const c = S.cal;
    if (acc === 'nueva') return modalNueva('');
    if (acc === 'anio') c.modo = 'anio';
    if (acc === 'hoy') { const h = new Date(); c.anio = h.getFullYear(); c.mes = h.getMonth(); }
    if (acc === 'prev' || acc === 'next') {
      const s = acc === 'prev' ? -1 : 1;
      if (c.modo === 'anio') c.anio += s;
      else { c.mes += s; if (c.mes < 0) { c.mes = 11; c.anio--; } if (c.mes > 11) { c.mes = 0; c.anio++; } }
    }
    return vistaCalendario();
  }
  const chip = t.closest('[data-ev]');
  if (chip) { e.stopPropagation(); return abrirFicha(chip.getAttribute('data-ev')); }
  const mas = t.closest('[data-dia-lista]');
  if (mas) { S.hist.fecha = mas.getAttribute('data-dia-lista'); S.hist.texto = ''; location.hash = '#/historico'; return; }
  const dia = t.closest('[data-dia]');
  if (dia) { e.stopPropagation(); return clicDia(dia.getAttribute('data-dia')); }
  const mes = t.closest('[data-mes]');
  if (mes) { S.cal.modo = 'mes'; S.cal.mes = parseInt(mes.getAttribute('data-mes'), 10); return vistaCalendario(); }
});

// Emergente al pasar el cursor (CAL-04)
function ocultarPopover() { $('popover').classList.add('oculto'); }
$('contenido').addEventListener('mouseover', function (e) {
  const dia = e.target.closest('[data-dia]');
  if (!dia) { ocultarPopover(); return; }
  const evs = eventosDelDia(dia.getAttribute('data-dia'));
  if (!evs.length) { ocultarPopover(); return; }
  let h = '<div class="pop-cab"><span>' + esc(fechaLarga(dia.getAttribute('data-dia'))) + '</span><span>' + evs.length + '</span></div>';
  evs.slice(0, 4).forEach(function (ev) {
    const ni = num(ev.ninos);
    h += '<div class="pop-ev"><b>' + esc((ev.hora ? ev.hora + ' · ' : '') + (ev.nombre || 'Sin nombre')) + '</b>' +
      num(ev.adultos) + ' pax' + (ni ? ' + ' + ni + ' niños' : '') + ' · ' + esc(ubicacion(ev)) + '</div>';
  });
  const p = $('popover');
  p.innerHTML = h;
  p.classList.remove('oculto');
  const r = dia.getBoundingClientRect();
  let x = r.left + r.width / 2 - 140;
  x = Math.max(8, Math.min(x, window.innerWidth - 288));
  let y = r.bottom + 8;
  if (y + p.offsetHeight > window.innerHeight - 8) y = r.top - p.offsetHeight - 8;
  p.style.left = x + 'px';
  p.style.top = y + 'px';
});
$('contenido').addEventListener('mouseleave', ocultarPopover);

// ───────── Histórico (HIS-01…HIS-04) ─────────
function vistaHistorico() {
  let h = '<div class="cabecera"><div><h1 class="titulo">Histórico</h1><div class="subtitulo">Todas las bodas, de la más reciente a la más antigua.</div></div>' +
    (puedePlanificar() ? '<button class="btn btn-principal" id="h-nueva">+ Nueva boda</button>' : '') + '</div>' +
    '<div class="buscador"><input id="h-texto" type="search" placeholder="Buscar por nombre o ubicación" value="' + esc(S.hist.texto) + '">' +
    '<input id="h-fecha" type="date" value="' + esc(S.hist.fecha) + '">' +
    '<button class="btn btn-secundario" id="h-limpiar">Limpiar filtros</button></div>' +
    '<div class="tabla-caja" id="h-tabla"></div>';
  $('contenido').innerHTML = h;
  $('h-texto').addEventListener('input', function () { S.hist.texto = this.value; pintarTablaHist(); });
  $('h-fecha').addEventListener('change', function () { S.hist.fecha = this.value; pintarTablaHist(); });
  $('h-limpiar').addEventListener('click', function () { S.hist.texto = ''; S.hist.fecha = ''; vistaHistorico(); });
  if ($('h-nueva')) $('h-nueva').addEventListener('click', function () { modalNueva(''); });
  pintarTablaHist();
}

function pintarTablaHist() {
  const txt = S.hist.texto.trim().toUpperCase();
  const lista = S.eventos.filter(function (e) {
    if (!e.nombre && !e.fecha) return false; // HIS-02: borradores vacíos fuera
    if (S.hist.fecha && e.fecha !== S.hist.fecha) return false;
    if (txt && (String(e.nombre || '') + ' ' + ubicacion(e)).toUpperCase().indexOf(txt) < 0) return false;
    return true;
  }).sort(function (a, b) {
    const c = String(b.fecha || '').localeCompare(String(a.fecha || ''));
    return c !== 0 ? c : String(a.hora || '').localeCompare(String(b.hora || ''));
  });
  if (!lista.length) { $('h-tabla').innerHTML = '<div class="vacio">' + (S.cargados ? 'No hay bodas con esos filtros.' : 'Cargando…') + '</div>'; return; }
  let h = '<table class="tabla"><thead><tr><th>Fecha</th><th>Boda</th><th>Ubicación</th><th>Asistentes</th>' + (esAdmin() ? '<th></th>' : '') + '</tr></thead><tbody>';
  lista.forEach(function (e) {
    const ni = num(e.ninos);
    h += '<tr class="clic" data-fila="' + e.id + '"><td>' + esc(fechaCorta(e.fecha)) + (e.hora ? ' · ' + esc(e.hora) : '') + '</td>' +
      '<td><b>' + esc(e.nombre || 'Sin nombre') + '</b></td><td>' + esc(ubicacion(e)) + '</td>' +
      '<td>' + num(e.adultos) + ' adultos' + (ni ? ' · ' + ni + ' niños' : '') + '</td>' +
      (esAdmin() ? '<td><button class="btn btn-secundario" data-borrar="' + e.id + '">Eliminar</button></td>' : '') + '</tr>';
  });
  $('h-tabla').innerHTML = h + '</tbody></table>';
  $('h-tabla').onclick = function (ev) {
    const b = ev.target.closest('[data-borrar]');
    if (b) { ev.stopPropagation(); return confirmarBorrado(b.getAttribute('data-borrar')); }
    const f = ev.target.closest('[data-fila]');
    if (f) abrirFicha(f.getAttribute('data-fila'));
  };
}

// ───────── Ventanas ─────────
function abrirModal(html) {
  $('modal-caja').innerHTML = html;
  $('modal').classList.remove('oculto');
  const primero = $('modal-caja').querySelector('input, select, button');
  if (primero) primero.focus();
}
function cerrarModal() { $('modal').classList.add('oculto'); $('modal-caja').innerHTML = ''; }
$('modal').addEventListener('click', function (e) {
  if (e.target === $('modal') || e.target.closest('[data-cerrar]')) cerrarModal();
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarModal(); });

// Ficha de la boda (HIS-05)
function abrirFicha(id) {
  const e = S.eventos.filter(function (x) { return x.id === id; })[0];
  if (!e) return;
  abrirModal('<h2 class="modal-titulo">' + esc(e.nombre || 'Sin nombre') + '</h2>' +
    '<div class="texto-suave">' + esc(fechaLarga(e.fecha)) + (e.hora ? ' · ' + esc(e.hora) : '') + '<br>' + esc(ubicacion(e)) + '</div>' +
    '<div class="datos"><div class="dato"><b>' + num(e.adultos) + '</b><span>Adultos</span></div>' +
    '<div class="dato"><b>' + num(e.ninos) + '</b><span>Niños</span></div>' +
    '<div class="dato"><b>' + num(e.tronas) + '</b><span>Tronas</span></div></div>' +
    '<div class="modal-pie"><button class="btn btn-secundario" data-cerrar>Cerrar</button>' +
    '<button class="btn btn-secundario" id="f-ver">Ver (solo lectura)</button>' +
    (puedePlanificar() ? '<button class="btn btn-principal" id="f-editar">Editar</button>' : '') + '</div>');
  $('f-ver').addEventListener('click', function () { cerrarModal(); location.hash = '#/evento/' + id + '/datos'; });
  if ($('f-editar')) $('f-editar').addEventListener('click', function () { cerrarModal(); location.hash = '#/evento/' + id + '/datos/editar'; });
}

// Nueva boda (REG-01, REG-02)
function modalNueva(fecha) {
  abrirModal('<h2 class="modal-titulo">Nueva boda</h2>' +
    '<label class="campo">Nombre de la boda *<input id="n-nombre" placeholder="Ej.: LAURA Y PABLO"></label>' +
    '<label class="campo">Lugar *<select id="n-lugar"><option value="">Elige…</option><option value="JLV">Jardines La Vid</option><option value="FINCA">Finca</option></select></label>' +
    '<label class="campo oculto" id="n-finca-c">Nombre de la finca *<input id="n-finca"></label>' +
    '<label class="campo">Fecha *<input id="n-fecha" type="date" value="' + esc(fecha) + '"></label>' +
    '<label class="campo">Hora<input id="n-hora" type="time"></label>' +
    '<p class="mensaje" id="n-msg"></p>' +
    '<div class="modal-pie"><button class="btn btn-secundario" data-cerrar>Cancelar</button><button class="btn btn-principal" id="n-crear">Crear boda</button></div>');
  $('n-lugar').addEventListener('change', function () { $('n-finca-c').classList.toggle('oculto', this.value !== 'FINCA'); });
  $('n-crear').addEventListener('click', function () {
    const nombre = mayus($('n-nombre').value);
    const lugar = $('n-lugar').value;
    const finca = mayus($('n-finca').value);
    const f = $('n-fecha').value;
    const msg = $('n-msg');
    if (!nombre) { msg.textContent = 'El nombre es obligatorio.'; return; }
    if (!lugar) { msg.textContent = 'Elige el lugar.'; return; }
    if (lugar === 'FINCA' && !finca) { msg.textContent = 'Escribe el nombre de la finca.'; return; }
    if (!f) { msg.textContent = 'La fecha es obligatoria.'; return; }
    this.disabled = true;
    const datos = {
      nombre: nombre, lugar: lugar, finca: lugar === 'FINCA' ? finca : '', fecha: f, hora: $('n-hora').value,
      adultos: 0, ninos: 0, tronas: 0, profesionales: 0, coordinador: '', estado: 'PLANIFICACION', notas: '',
      papelera: false, creado: serverTimestamp(), creadoPor: S.user.uid, modificado: serverTimestamp(), modificadoPor: S.user.uid
    };
    // El identificador se genera en el dispositivo: sin conexión la boda se abre igualmente y se sube después.
    const ref = doc(collection(db, 'eventos'));
    seguir(setDoc(ref, datos)).catch(function () {});
    cerrarModal();
    aviso('Boda creada.');
    location.hash = '#/evento/' + ref.id + '/datos/editar';
  });
}

// Borrado (HIS-04): solo administrador, a la papelera
function confirmarBorrado(id) {
  const e = S.eventos.filter(function (x) { return x.id === id; })[0];
  if (!e) return;
  abrirModal('<h2 class="modal-titulo">Eliminar boda</h2>' +
    '<p>Vas a eliminar <b>' + esc(e.nombre) + '</b> (' + esc(fechaCorta(e.fecha)) + '). Se borrará la boda, sus planos y sus consumos.</p>' +
    '<p class="texto-suave">Irá a la papelera y el administrador podrá recuperarla durante 30 días.</p>' +
    '<div class="modal-pie"><button class="btn btn-secundario" data-cerrar>Cancelar</button><button class="btn btn-peligro" id="b-si">Eliminar</button></div>');
  $('b-si').addEventListener('click', function () {
    cerrarModal();
    seguir(updateDoc(doc(db, 'eventos', id), { papelera: true, papeleraEn: serverTimestamp(), modificadoPor: S.user.uid })).catch(function () {});
    aviso('Boda enviada a la papelera.');
  });
}

// ───────── Expediente ─────────
const CAMPOS = [
  { k: 'nombre', l: 'Nombre de la boda', t: 'text', may: true },
  { k: 'fecha', l: 'Fecha', t: 'date' },
  { k: 'hora', l: 'Hora', t: 'time' },
  { k: 'lugar', l: 'Lugar', t: 'select', op: [['JLV', 'Jardines La Vid'], ['FINCA', 'Finca']] },
  { k: 'finca', l: 'Nombre de la finca', t: 'text', may: true },
  { k: 'coordinador', l: 'Coordinador', t: 'text', may: true },
  { k: 'adultos', l: 'Adultos', t: 'number' },
  { k: 'ninos', l: 'Niños', t: 'number' },
  { k: 'tronas', l: 'Tronas', t: 'number' },
  { k: 'profesionales', l: 'Profesionales (fotógrafo, músicos…)', t: 'number' },
  { k: 'estado', l: 'Estado', t: 'select', op: [['PLANIFICACION', 'En planificación'], ['CONFIRMADA', 'Confirmada'], ['CELEBRADA', 'Celebrada'], ['CERRADA', 'Cerrada']] }
];

function vistaEvento(id, pestana, editar) {
  if (!id) { location.hash = '#/historico'; return; }
  S.pestana = pestana;
  S.soloLectura = !(editar && puedePlanificar());
  if (S.eventoId !== id) {
    if (S.unsubEvento) S.unsubEvento();
    S.eventoId = id; S.evento = null;
    S.unsubEvento = onSnapshot(doc(db, 'eventos', id), function (s) {
      if (!s.exists() || s.data().papelera) { // DAT-05
        aviso('Esta boda se ha eliminado desde otro dispositivo.', true);
        location.hash = '#/historico';
        return;
      }
      const primera = !S.evento;
      S.evento = s.data();
      if (primera) pintarEvento(); else refrescarCampos();
    }, function (e) { aviso(traducirError(e), true); location.hash = '#/historico'; });
  }
  pintarEvento();
}

function pintarEvento() {
  const e = S.evento;
  if (!e) { $('contenido').innerHTML = '<div class="vacio">Cargando la boda…</div>'; return; }
  const base = '#/evento/' + S.eventoId + '/';
  const suf = S.soloLectura ? '' : '/editar';
  let h = '<div class="exp-cab"><div><a href="#/historico" class="enlace">‹ Histórico</a>' +
    '<h1 class="titulo">' + esc(e.nombre || 'Sin nombre') + '</h1>' +
    '<div class="subtitulo">' + esc(fechaLarga(e.fecha)) + (e.hora ? ' · ' + esc(e.hora) : '') + ' · ' + esc(ubicacion(e)) + '</div></div>' +
    '<div class="fila">' + (S.soloLectura
      ? '<span class="etiqueta">Solo lectura</span>' + (puedePlanificar() ? '<a class="btn btn-principal" href="' + base + S.pestana + '/editar">Pasar a edición</a>' : '')
      : '<span class="etiqueta">Editando · se guarda solo</span><a class="btn btn-secundario" href="' + base + S.pestana + '">Salir de edición</a>') +
    '</div></div>';
  h += '<div class="pestanas">';
  PESTANAS.forEach(function (p) {
    h += '<a class="pestana' + (p[0] === S.pestana ? ' activa' : '') + '" href="' + base + p[0] + suf + '">' + p[1] + '</a>';
  });
  h += '</div>';
  if (S.pestana === 'datos') {
    h += '<div class="bloque"><h2>Datos generales</h2><div class="rejilla">';
    CAMPOS.forEach(function (c) { h += htmlCampo(c, e); });
    h += '</div></div><div class="bloque"><h2>Notas</h2><label class="campo">Notas internas<textarea rows="4" data-campo="notas"' +
      (S.soloLectura ? ' disabled' : '') + '>' + esc(e.notas) + '</textarea></label></div>';
  } else {
    const nom = PESTANAS.filter(function (p) { return p[0] === S.pestana; })[0];
    h += '<div class="bloque construccion"><h2>' + esc(nom ? nom[1] : '') + '</h2><p>Este apartado se está trasladando de la app anterior con todas sus funciones. Llegará en las próximas versiones.</p></div>';
  }
  $('contenido').innerHTML = h;
  conectarCampos();
}

function htmlCampo(c, e) {
  const v = e[c.k] === undefined || e[c.k] === null ? '' : e[c.k];
  const dis = S.soloLectura ? ' disabled' : '';
  const oculto = c.k === 'finca' && e.lugar !== 'FINCA' ? ' oculto' : '';
  let input;
  if (c.t === 'select') {
    input = '<select data-campo="' + c.k + '"' + dis + '>';
    c.op.forEach(function (o) { input += '<option value="' + o[0] + '"' + (String(v) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; });
    input += '</select>';
  } else {
    input = '<input type="' + c.t + '" data-campo="' + c.k + '" value="' + esc(v) + '"' + (c.t === 'number' ? ' min="0" inputmode="numeric"' : '') + dis + '>';
  }
  return '<label class="campo' + oculto + '" data-caja="' + c.k + '">' + esc(c.l) + input + '</label>';
}

function valorCampo(el) {
  const k = el.getAttribute('data-campo');
  const c = CAMPOS.filter(function (x) { return x.k === k; })[0];
  if (c && c.t === 'number') return Math.max(0, num(el.value));
  if (c && c.may) return mayus(el.value);
  return el.value;
}

const temporizadores = {};
function guardarCampo(el) {
  if (S.soloLectura) return;
  const k = el.getAttribute('data-campo');
  const v = valorCampo(el);
  if (k === 'nombre' && !v) { aviso('El nombre no puede quedar vacío.', true); el.value = S.evento.nombre; return; }
  if (k === 'fecha' && !v) { aviso('La fecha es obligatoria.', true); el.value = S.evento.fecha; return; }
  if (String(S.evento[k]) === String(v)) return;
  const cambio = {};
  cambio[k] = v;
  cambio.modificado = serverTimestamp();
  cambio.modificadoPor = S.user.uid;
  if (k === 'lugar' && v === 'JLV') cambio.finca = '';
  seguir(updateDoc(doc(db, 'eventos', S.eventoId), cambio)).catch(function () {});
}

function conectarCampos() {
  document.querySelectorAll('[data-campo]').forEach(function (el) {
    el.addEventListener('change', function () { clearTimeout(temporizadores[el.getAttribute('data-campo')]); guardarCampo(el); });
    if (el.tagName === 'TEXTAREA' || el.type === 'text') {
      el.addEventListener('input', function () {
        const k = el.getAttribute('data-campo');
        clearTimeout(temporizadores[k]);
        temporizadores[k] = setTimeout(function () { guardarCampo(el); }, 800);
      });
    }
    if (el.getAttribute('data-campo') === 'lugar') {
      el.addEventListener('change', function () {
        const caja = document.querySelector('[data-caja="finca"]');
        if (caja) caja.classList.toggle('oculto', el.value !== 'FINCA');
      });
    }
  });
}

// Actualiza en tiempo real los campos que no se están editando (REG-05)
function refrescarCampos() {
  const e = S.evento;
  const tit = document.querySelector('.exp-cab .titulo');
  if (tit) tit.textContent = e.nombre || 'Sin nombre';
  const sub = document.querySelector('.exp-cab .subtitulo');
  if (sub) sub.textContent = fechaLarga(e.fecha) + (e.hora ? ' · ' + e.hora : '') + ' · ' + ubicacion(e);
  document.querySelectorAll('[data-campo]').forEach(function (el) {
    if (el === document.activeElement) return;
    const k = el.getAttribute('data-campo');
    const v = e[k] === undefined || e[k] === null ? '' : String(e[k]);
    if (el.value !== v) el.value = v;
  });
  const caja = document.querySelector('[data-caja="finca"]');
  if (caja) caja.classList.toggle('oculto', e.lugar !== 'FINCA');
}

// ───────── Usuarios (solo administrador) ─────────
function vistaUsuarios() {
  $('contenido').innerHTML = '<div class="cabecera"><div><h1 class="titulo">Usuarios</h1>' +
    '<div class="subtitulo">Quien entra con Google por primera vez aparece como «Pendiente» hasta que le asignes un rol.</div></div>' +
    '<button class="btn btn-principal" id="u-nuevo">+ Crear acceso con correo</button></div>' +
    '<div class="tabla-caja" id="u-tabla"><div class="vacio">Cargando…</div></div>';
  $('u-nuevo').addEventListener('click', modalNuevoUsuario);
  if (!S.unsubUsuarios) {
    S.unsubUsuarios = onSnapshot(collection(db, 'users'), function (qs) {
      const l = [];
      qs.forEach(function (d) { const x = d.data(); x.uid = d.id; l.push(x); });
      l.sort(function (a, b) {
        if (a.rol === 'pendiente' && b.rol !== 'pendiente') return -1;
        if (b.rol === 'pendiente' && a.rol !== 'pendiente') return 1;
        return String(a.nombre).localeCompare(String(b.nombre));
      });
      S.usuarios = l;
      pintarUsuarios();
    }, function (e) { aviso(traducirError(e), true); });
  } else pintarUsuarios();
}

function pintarUsuarios() {
  const t = $('u-tabla');
  if (!t) return;
  let h = '<table class="tabla"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th></tr></thead><tbody>';
  S.usuarios.forEach(function (u) {
    const yo = u.uid === S.user.uid;
    let sel = '<select data-rol="' + u.uid + '"' + (yo ? ' disabled title="No puedes cambiar tu propio rol"' : '') + '>';
    Object.keys(ROLES).forEach(function (r) { sel += '<option value="' + r + '"' + (u.rol === r ? ' selected' : '') + '>' + ROLES[r] + '</option>'; });
    sel += '</select>';
    h += '<tr><td><b>' + esc(u.nombre) + '</b>' + (yo ? ' <span class="etiqueta">Tú</span>' : '') + '</td><td>' + esc(u.email) + '</td><td>' + sel + '</td></tr>';
  });
  t.innerHTML = h + '</tbody></table>';
  t.querySelectorAll('[data-rol]').forEach(function (s) {
    s.addEventListener('change', function () {
      seguir(updateDoc(doc(db, 'users', s.getAttribute('data-rol')), { rol: s.value }))
        .then(function () { aviso('Rol actualizado.'); }).catch(function () {});
    });
  });
}

let appSecundaria = null;
function claveAleatoria() {
  const a = new Uint32Array(4);
  crypto.getRandomValues(a);
  return 'Am' + Array.prototype.map.call(a, function (n) { return n.toString(36); }).join('') + '!9';
}
function modalNuevoUsuario() {
  let opciones = '';
  Object.keys(ROLES).forEach(function (r) { if (r !== 'pendiente') opciones += '<option value="' + r + '"' + (r === 'camarero' ? ' selected' : '') + '>' + ROLES[r] + '</option>'; });
  abrirModal('<h2 class="modal-titulo">Crear acceso</h2>' +
    '<p class="texto-suave">La persona recibirá un correo para crear su propia contraseña.</p>' +
    '<label class="campo">Nombre *<input id="nu-nombre"></label>' +
    '<label class="campo">Correo *<input id="nu-email" type="email"></label>' +
    '<label class="campo">Rol<select id="nu-rol">' + opciones + '</select></label>' +
    '<p class="mensaje" id="nu-msg"></p>' +
    '<div class="modal-pie"><button class="btn btn-secundario" data-cerrar>Cancelar</button><button class="btn btn-principal" id="nu-crear">Crear y enviar correo</button></div>');
  $('nu-crear').addEventListener('click', async function () {
    const nombre = mayus($('nu-nombre').value);
    const email = $('nu-email').value.trim().toLowerCase();
    const rol = $('nu-rol').value;
    const msg = $('nu-msg');
    if (!nombre || !email) { msg.textContent = 'Nombre y correo son obligatorios.'; return; }
    this.disabled = true;
    try {
      // Segunda instancia: crear la cuenta no cierra la sesión del administrador.
      if (!appSecundaria) appSecundaria = initializeApp(window.FIREBASE_CONFIG, 'secundaria');
      const auth2 = getAuth(appSecundaria);
      const cred = await createUserWithEmailAndPassword(auth2, email, claveAleatoria());
      await setDoc(doc(db, 'users', cred.user.uid), { nombre: nombre, email: email, rol: rol, creado: serverTimestamp() });
      await signOut(auth2);
      await sendPasswordResetEmail(auth, email);
      cerrarModal();
      aviso('Acceso creado. Se ha enviado el correo a ' + email + '.');
    } catch (e) {
      msg.textContent = traducirError(e);
      this.disabled = false;
    }
  });
}

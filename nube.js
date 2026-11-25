// Alfonso Mira · Planning — capa de nube (Firebase)
// Sustituye a Apps Script/Google Sheets sin tocar las funciones de la app.
// Sin encadenamiento opcional, sin fusión nula y sin expresiones regulares literales.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, onSnapshot, writeBatch,
  serverTimestamp, deleteField, FieldPath, query, where, getDocsFromCache, Timestamp
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

const app = initializeApp(window.FIREBASE_CONFIG);
const auth = getAuth(app);
auth.languageCode = 'es';
let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  db = initializeFirestore(app, {});
}

const ROLES = {
  admin: 'Administrador', gestor: 'Gestor', jefesala: 'Jefe de sala', coordinador: 'Coordinador',
  cocina: 'Cocina', camarero: 'Camarero', pendiente: 'Pendiente'
};
const ROLES_PLAN = ['admin', 'gestor'];          // gestión: crean bodas, costes, puntos de mejora y personal
const ROLES_EDITAN = ['admin', 'gestor', 'jefesala', 'coordinador']; // rellenan los documentos de las bodas
const LIMITE_DOC = 950000;

const S = { user: null, perfil: null, arrancado: false, enNube: 0, online: navigator.onLine, sesion: 'web' };
const guardado = {}; // id → { clave: textoJSON } tal como está en la nube
const remotosAplazados = {};

function $(id) { return document.getElementById(id); }
function esc(v) {
  return String(v === undefined || v === null ? '' : v)
    .split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;')
    .split('"').join('&quot;').split("'").join('&#39;');
}
function mayus(v) { return String(v || '').trim().toUpperCase(); }
function rol() { return S.perfil ? S.perfil.rol : ''; }
function puedePlanificar() { return ROLES_PLAN.indexOf(rol()) >= 0; }
function puedeEditar() { return ROLES_EDITAN.indexOf(rol()) >= 0; }
// Coordinadores, camareros y cocina solo ven las bodas en las que aparecen en el LISTADO DE PERSONAL
const ROLES_SOLO_SUYAS = ['coordinador', 'camarero', 'cocina'];
function palabras(t) {
  return String(t || '').normalize('NFD').split('').filter(function (c) { const k = c.charCodeAt(0); return k < 0x300 || k > 0x36f; }).join('')
    .toUpperCase().split(' ').map(function (x) { return x.split('.').join('').trim(); }).filter(function (x) { return x; });
}
function esSuya(ev) {
  if (ROLES_SOLO_SUYAS.indexOf(rol()) < 0) return true;
  const yo = palabras(S.perfil && S.perfil.nombre);
  if (!yo.length) return false;
  return (ev && ev.camareros || []).some(function (c) {
    const p = palabras(c && c.nombre);
    if (!p.length) return false;
    if (p.join(' ') === yo.join(' ')) return true;
    return p.length >= 2 && p.every(function (x) { return yo.indexOf(x) >= 0; });
  });
}
function esAdmin() { return rol() === 'admin'; }
function nuevaRev() { return Date.now().toString(36) + Math.floor(Math.random() * 1679616).toString(36); }
function espera(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

let avisoT = null;
function aviso(txt, error) {
  let a = $('nb-aviso');
  if (!a) { a = document.createElement('div'); a.id = 'nb-aviso'; document.body.appendChild(a); }
  a.textContent = txt;
  a.className = 'nb-aviso' + (error ? ' nb-error' : '');
  clearTimeout(avisoT);
  avisoT = setTimeout(function () { a.className = 'nb-aviso nb-oculto'; }, error ? 7000 : 3500);
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
    'permission-denied': 'Tu rol no tiene permiso para guardar este cambio.'
  };
  return m[c] || (err && err.message ? err.message : String(err));
}

// ───────── Estado de la nube ─────────
function pintarNube() {
  const el = $('nb-nube');
  if (!el) return;
  let t, cls;
  if (!S.online) { cls = 'off'; t = S.enNube ? 'Sin conexión · ' + S.enNube + ' cambio(s) guardado(s) en el dispositivo' : 'Sin conexión'; }
  else if (S.enNube) { cls = 'pend'; t = 'Subiendo a la nube…'; }
  else { cls = 'ok'; t = 'Nube al día'; }
  el.className = 'nb-nube ' + cls;
  el.querySelector('span').textContent = t;
}
window.addEventListener('online', function () { S.online = true; pintarNube(); });
window.addEventListener('offline', function () { S.online = false; pintarNube(); });

// Espera la confirmación de la nube un momento; sin conexión la escritura queda en el dispositivo y se sube sola.
async function escribir(promesa, alFallar) {
  S.enNube++; pintarNube();
  let fallo = null;
  const p = promesa.then(function () { S.enNube--; pintarNube(); return 'ok'; }, function (err) {
    S.enNube--; pintarNube(); fallo = err;
    if (alFallar) alFallar(err);
    aviso('No se ha guardado: ' + traducirError(err), true);
    throw err;
  });
  p.catch(function () {});
  const r = await Promise.race([p.catch(function (e) { return e; }), espera(1500).then(function () { return 'cola'; })]);
  if (fallo) throw fallo;
  return r;
}

// ───────── Formato de las bodas en Firestore ─────────
// eventos/{id}: { boda, fecha, papelera, rev, session, datos: { apartado: textoJSON } }
// Cada apartado (protocolo, plano, camareros…) se guarda por separado: dos personas
// trabajando en apartados distintos nunca se pisan.
function montar(d) {
  if (d.datos && typeof d.datos === 'object') {
    const o = {};
    Object.keys(d.datos).forEach(function (k) {
      try { o[k] = JSON.parse(d.datos[k]); } catch (e) { o[k] = d.datos[k]; }
    });
    return o;
  }
  // Bodas creadas con la v0.1
  const finca = d.lugar === 'FINCA';
  return {
    boda: d.nombre || '', fecha: d.fecha || '', hora: d.hora || '',
    lugar_tipo: finca ? 'BODA FINCA' : 'BODA JARDINES LA VID',
    ubicacion: finca ? (d.finca || '') : 'JARDINES LA VID',
    nombre_finca: finca ? (d.finca || '') : '', items: []
  };
}
function recordar(id, d) {
  const m = {};
  if (d && d.datos && typeof d.datos === 'object') Object.keys(d.datos).forEach(function (k) { m[k] = d.datos[k]; });
  guardado[id] = d && d.datos ? m : null;
}

// ───────── Funciones que antes estaban en Apps Script ─────────
window.__backend = {
  loadData: async function () {
    // Lecturas optimizadas: la primera vez del día se leen todas las bodas; el resto de aperturas,
    // las bodas guardadas en el dispositivo más solo las que han cambiado desde la última vez.
    const col = collection(db, 'eventos');
    const clave = 'am_sync_' + (S.user ? S.user.uid : '');
    const hoy = new Date().toISOString().slice(0, 10);
    const inicio = Date.now();
    let previo = null;
    try { previo = JSON.parse(localStorage.getItem(clave) || 'null'); } catch (e) { previo = null; }
    let docs = null;
    if (previo && previo.dia === hoy && previo.t) {
      try {
        const enCache = await getDocsFromCache(col);
        if (enCache.size > 0 && enCache.size >= (previo.n || 0)) {
          const cambios = await getDocs(query(col, where('modificado', '>', Timestamp.fromMillis(previo.t - 10 * 60 * 1000))));
          const m = {};
          enCache.forEach(function (x) { m[x.id] = x; });
          cambios.forEach(function (x) { m[x.id] = x; });
          docs = Object.keys(m).map(function (k) { return m[k]; });
        }
      } catch (e) { docs = null; }
    }
    if (!docs) { const qs = await getDocs(col); docs = []; qs.forEach(function (x) { docs.push(x); }); }
    const events = {}, revs = {};
    docs.forEach(function (s) {
      const d = s.data();
      if (d.papelera) return;
      const ev = montar(d);
      if (!esSuya(ev)) return;
      events[s.id] = ev;
      revs[s.id] = d.rev || '';
      recordar(s.id, d);
    });
    try { localStorage.setItem(clave, JSON.stringify({ t: inicio, dia: hoy, n: docs.length })); } catch (e) {}
    return JSON.stringify({ events: events, revs: revs, corruptos: [] });
  },
  loadEvent: async function (id) {
    const s = await getDoc(doc(db, 'eventos', id));
    if (!s.exists() || s.data().papelera) return { ok: true, json: null, rev: 'DELETED' };
    const d = s.data();
    recordar(id, d);
    return { ok: true, json: JSON.stringify(montar(d)), rev: d.rev || '' };
  },
  getEventRev: async function (id) {
    const s = await getDoc(doc(db, 'eventos', id));
    return { ok: true, rev: s.exists() ? (s.data().rev || '') : '' };
  },
  saveEvent: async function (id, json, opciones) {
    if (!puedeEditar()) return { ok: false, error: 'Tu rol solo permite consultar.' };
    const obj = JSON.parse(json);
    let op = {};
    try { op = opciones ? JSON.parse(opciones) : {}; } catch (e) { op = {}; }
    if (op.session) S.sesion = op.session;
    const ref = doc(db, 'eventos', id);
    const rev = nuevaRev();
    const nuevo = {};
    let total = 0;
    Object.keys(obj).forEach(function (k) { nuevo[k] = JSON.stringify(obj[k]); total += nuevo[k].length; });
    if (total > LIMITE_DOC) return { ok: false, error: 'La boda ocupa demasiado (' + Math.round(total / 1024) + ' KB). Reduce las imágenes del plano o de la minuta.' };
    const previo = guardado[id];
    const meta = { boda: obj.boda || '', fecha: obj.fecha || '', rev: rev, session: S.sesion, modificado: serverTimestamp(), modificadoPor: S.user.uid };
    let promesa;
    if (!previo) {
      const datos = {};
      Object.keys(nuevo).forEach(function (k) { datos[k] = nuevo[k]; });
      const base = Object.assign({ papelera: false, datos: datos }, meta);
      promesa = setDoc(ref, base, { merge: true });
    } else {
      const args = [];
      Object.keys(nuevo).forEach(function (k) { if (previo[k] !== nuevo[k]) args.push(new FieldPath('datos', k), nuevo[k]); });
      Object.keys(previo).forEach(function (k) { if (!(k in nuevo)) args.push(new FieldPath('datos', k), deleteField()); });
      if (!args.length) return { ok: true, rev: rev };
      Object.keys(meta).forEach(function (k) { args.push(k, meta[k]); });
      promesa = updateDoc.apply(null, [ref].concat(args));
    }
    guardado[id] = nuevo;
    await escribir(promesa, function () { guardado[id] = previo; });
    return { ok: true, rev: rev };
  },
  deleteEventDB: async function (id) {
    if (!puedePlanificar()) return { ok: false, error: 'Tu rol no puede eliminar bodas.' };
    await escribir(updateDoc(doc(db, 'eventos', id), { papelera: true, papeleraEn: serverTimestamp(), modificado: serverTimestamp(), modificadoPor: S.user.uid, session: S.sesion }));
    delete guardado[id];
    return { ok: true };
  },
  // COSTES y PUNTOS DE MEJORA: ahora los abre el rol (administrador o gestor), sin contraseña
  verificarClaveCostes: async function () { return puedePlanificar(); },
  loadCostes: async function () {
    const s = await getDoc(doc(db, 'config', 'costes'));
    return s.exists() ? (s.data().json || '') : '';
  },
  saveCostes: async function (clave, json) {
    if (!puedePlanificar()) return { ok: false, error: 'Sin permiso' };
    JSON.parse(json);
    await escribir(setDoc(doc(db, 'config', 'costes'), { json: json, modificado: serverTimestamp(), modificadoPor: S.user.uid }));
    return { ok: true };
  },
  enviarPuntoMejora: async function (json) {
    const d = JSON.parse(json || '{}');
    const propuesta = String(d.propuesta || '').trim().substring(0, 2000);
    if (propuesta.length < 5) return { ok: false, error: 'Propuesta vacía' };
    const corto = function (v) { return String(v || '').substring(0, 120); };
    await escribir(addDoc(collection(db, 'puntos_mejora'), {
      fecha: new Date().toISOString(), boda: corto(d.boda), fecha_boda: corto(d.fecha_boda), evento_id: corto(d.evento_id),
      area: corto(d.area), momento: corto(d.momento), tipo: corto(d.tipo), prioridad: corto(d.prioridad),
      propuesta: propuesta, estado: 'NUEVA', nota: ''
    }));
    return { ok: true };
  },
  loadPuntosMejora: async function () {
    if (!puedePlanificar()) return { ok: false, error: 'Sin permiso' };
    const qs = await getDocs(collection(db, 'puntos_mejora'));
    const l = [];
    qs.forEach(function (s) { const x = s.data(); x.id = s.id; l.push(x); });
    l.sort(function (a, b) { return String(a.fecha).localeCompare(String(b.fecha)); });
    return { ok: true, datos: JSON.stringify(l) };
  },
  actualizarPuntoMejora: async function (clave, id, cambiosJson) {
    const c = JSON.parse(cambiosJson || '{}');
    const u = {};
    if (c.estado !== undefined) u.estado = String(c.estado).substring(0, 40);
    if (c.nota !== undefined) u.nota = String(c.nota).substring(0, 2000);
    await escribir(updateDoc(doc(db, 'puntos_mejora', id), u));
    return { ok: true };
  },
  borrarPuntoMejora: async function (clave, id) {
    await escribir(deleteDoc(doc(db, 'puntos_mejora', id)));
    return { ok: true };
  }
};


// ───────── API sencilla para las mejoras (mejoras.js) ─────────
window.__am = {
  rol: function () { return rol(); },
  uid: function () { return S.user ? S.user.uid : ''; },
  nombre: function () { return S.perfil ? S.perfil.nombre : ''; },
  puedePlanificar: puedePlanificar, puedeEditar: puedeEditar, esAdmin: esAdmin, aviso: aviso,
  leer: async function (col, id) { const s = await getDoc(doc(db, col, id)); return s.exists() ? s.data() : null; },
  guardar: async function (col, id, datos, sustituir) {
    datos = Object.assign({}, datos, { actualizado: serverTimestamp() });
    if (col === 'eventos') datos.modificado = serverTimestamp();
    await escribir(setDoc(doc(db, col, id), datos, sustituir ? {} : { merge: true }));
    return true;
  },
  listar: async function (col, campo, valor) {
    const ref = campo ? query(collection(db, col), where(campo, '==', valor)) : collection(db, col);
    const qs = await getDocs(ref);
    const l = [];
    qs.forEach(function (s) { const x = s.data(); x.id = s.id; l.push(x); });
    return l;
  },
  borrar: async function (col, id) { await escribir(deleteDoc(doc(db, col, id))); return true; },
  nuevoId: function () { return doc(collection(db, 'fincas')).id + doc(collection(db, 'fincas')).id.substring(0, 6); }
};

// ───────── Cambios de otros dispositivos en tiempo real ─────────
function editandoAhora() {
  const a = document.activeElement;
  if (!a) return false;
  const t = a.tagName;
  return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || a.isContentEditable;
}
function aplicarRemoto(id) {
  try {
    if (typeof currentEventId !== 'undefined' && currentEventId === id) {
      if (editandoAhora()) { remotosAplazados[id] = true; return; }
      recargarEventoDesdeServidor(id, false);
      return;
    }
    recargarEventoDesdeServidor(id, false);
    setTimeout(function () {
      try { renderCalendar(); } catch (e) {}
      try { if (!$('view-historico').classList.contains('hidden')) renderHistorico(); } catch (e) {}
    }, 400);
  } catch (e) { console.warn('Cambio remoto', e); }
}
document.addEventListener('focusout', function () {
  setTimeout(function () {
    if (editandoAhora()) return;
    Object.keys(remotosAplazados).forEach(function (id) { delete remotosAplazados[id]; aplicarRemoto(id); });
  }, 300);
});
function escucharCambios() {
  let primera = true;
  // Solo escucha las bodas que cambian desde ahora (no vuelve a leerlas todas)
  onSnapshot(query(collection(db, 'eventos'), where('modificado', '>', Timestamp.fromMillis(Date.now() - 10 * 60 * 1000))), function (qs) {
    if (primera) { primera = false; return; }
    qs.docChanges().forEach(function (c) {
      if (c.doc.metadata.hasPendingWrites) return;
      const d = c.doc.data();
      if (d.session && d.session === S.sesion) return;
      if (!esSuya(montar(d))) return;
      aplicarRemoto(c.doc.id);
    });
  }, function (e) { console.warn('Tiempo real', e); });
}

// ───────── Acceso ─────────
const proveedor = new GoogleAuthProvider();
proveedor.setCustomParameters({ prompt: 'select_account' });
getRedirectResult(auth).catch(function (e) { $('nb-login-msg').textContent = traducirError(e); });

function pantalla(id) {
  ['nb-carga', 'nb-login', 'nb-pendiente'].forEach(function (x) { $(x).classList.toggle('nb-oculto', x !== id); });
  $('nb-capa').classList.toggle('nb-oculto', !id);
}
$('nb-google').addEventListener('click', function () {
  $('nb-login-msg').textContent = '';
  signInWithPopup(auth, proveedor).catch(function (e) {
    if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) signInWithRedirect(auth, proveedor);
    else $('nb-login-msg').textContent = traducirError(e);
  });
});
function entrarCorreo() {
  const email = $('nb-email').value.trim(), pass = $('nb-pass').value;
  if (!email || !pass) { $('nb-login-msg').textContent = 'Escribe el correo y la contraseña.'; return; }
  signInWithEmailAndPassword(auth, email, pass).catch(function (e) { $('nb-login-msg').textContent = traducirError(e); });
}
$('nb-entrar').addEventListener('click', entrarCorreo);
$('nb-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') entrarCorreo(); });
$('nb-olvido').addEventListener('click', function () {
  const email = $('nb-email').value.trim();
  if (!email) { $('nb-login-msg').textContent = 'Escribe tu correo arriba y vuelve a pulsar.'; return; }
  sendPasswordResetEmail(auth, email)
    .then(function () { $('nb-login-msg').textContent = 'Te hemos enviado un correo para crear una contraseña nueva.'; })
    .catch(function (e) { $('nb-login-msg').textContent = traducirError(e); });
});
document.addEventListener('click', function (e) {
  if (e.target.closest('[data-nb="salir"]')) signOut(auth).then(function () { location.reload(); });
  if (e.target.closest('[data-nb="usuarios"]')) abrirUsuarios();
});

onAuthStateChanged(auth, function (user) {
  S.user = user;
  if (!user) { pantalla('nb-login'); return; }
  // La sesión dura 180 días desde la última vez que se escribió la contraseña (o se entró con Google)
  const ultima = Date.parse((user.metadata && user.metadata.lastSignInTime) || '');
  if (ultima && Date.now() - ultima > 180 * 864e5) {
    signOut(auth).then(function () { pantalla('nb-login'); aviso('Por seguridad, vuelve a entrar con tu correo y contraseña (la sesión dura 180 días).'); });
    return;
  }
  pantalla('nb-carga');
  prepararPerfil(user).catch(function (e) { aviso('No se ha podido cargar tu perfil: ' + traducirError(e), true); pantalla('nb-login'); });
});

async function prepararPerfil(user) {
  const refU = doc(db, 'users', user.uid);
  const snap = await getDoc(refU);
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
  onSnapshot(refU, function (s) {
    if (!s.exists()) { signOut(auth).then(function () { location.reload(); }); return; }
    const anterior = S.perfil ? S.perfil.rol : null;
    S.perfil = s.data();
    if (S.perfil.rol === 'pendiente') { $('nb-pend-email').textContent = user.email || ''; pantalla('nb-pendiente'); return; }
    if (S.arrancado && anterior !== S.perfil.rol) { location.reload(); return; }
    if (!S.arrancado) arrancar();
  });
}

// ───────── Arranque de la app y permisos por rol ─────────
function aplicarRol() {
  const r = rol();
  document.body.classList.add('rol-' + r);
  if (!puedeEditar()) document.body.classList.add('rol-lectura');
  if (!puedePlanificar()) document.body.classList.add('rol-sinplan');
  $('nb-u-nombre').textContent = S.perfil.nombre || S.user.email;
  $('nb-u-rol').textContent = ROLES[r] || r;
  const ini = String(S.perfil.nombre || '?').trim().split(' ');
  $('nb-u-avatar').textContent = ((ini[0] || '?').charAt(0) + (ini.length > 1 ? ini[ini.length - 1].charAt(0) : '')).toUpperCase();

  // Solo consulta: las bodas se abren siempre en modo visión
  if (!puedeEditar()) {
    const abrir = window.abrirEvento;
    window.abrirEvento = function (id) { return abrir(id, true); };
    window.visionPasarEdicion = function () { aviso('Tu rol solo permite consultar.'); };
  }
  if (!puedePlanificar()) {
    window.openModalNuevoRegistro = function () { aviso('Solo administración y gestión pueden crear bodas.'); };
  } else {
    try { costesClave = 'rol'; } catch (e) {}
    // Sin pantalla de contraseña: las propuestas se cargan al entrar en PUNTOS DE MEJORA
    const cambiar = window.switchTab;
    let pmCargado = false;
    window.switchTab = function (tabId) {
      const r = cambiar.apply(this, arguments);
      if (tabId === 'puntos' && !pmCargado) { pmCargado = true; try { pmCargar(); } catch (e) {} }
      return r;
    };
  }
  if (!esAdmin()) {
    window.openDeleteConfirmModal = function () { aviso('Solo el administrador puede eliminar bodas.'); };
  }
}

function arrancar() {
  S.arrancado = true;
  S.sesion = (typeof CLIENT_SESSION !== 'undefined') ? CLIENT_SESSION : ('s' + Date.now().toString(36));
  aplicarRol();
  pantalla(null);
  pintarNube();
  window.__arrancarLegado();
  try { if (window.__mejorasArranque) window.__mejorasArranque(); } catch (e) { console.warn('Mejoras', e); }
  setTimeout(escucharCambios, 1500);
  if (esAdmin()) setTimeout(function () { sincronizarDirectorio().catch(function (e) { console.warn('Directorio', e); }); }, 3000);
}

// ───────── Los usuarios de la app aparecen solos en el directorio de PERSONAL ─────────
const ROLES_DIRECTORIO = ['jefesala', 'coordinador', 'cocina', 'camarero'];
async function sincronizarDirectorio() {
  if (!esAdmin()) return 0;
  const us = await getDocs(collection(db, 'users'));
  const ps = await getDocs(collection(db, 'personal'));
  const dir = [];
  ps.forEach(function (d) { const x = d.data(); x.id = d.id; dir.push(x); });
  const clave = function (t) { return palabras(t).join(' '); };
  let n = 0;
  const tareas = [];
  us.forEach(function (d) {
    const u = d.data();
    if (ROLES_DIRECTORIO.indexOf(u.rol) < 0 || !u.nombre) return;
    const k = clave(u.nombre);
    const ya = dir.filter(function (p) {
      if (p.uid === d.id) return true;
      if (clave(p.nombre) === k) return true;
      return (p.alias || []).some(function (a) { return clave(a) === k; });
    })[0];
    if (ya) {
      if (!ya.uid || ya.email !== (u.email || '')) tareas.push(setDoc(doc(db, 'personal', ya.id), { uid: d.id, email: u.email || '' }, { merge: true }));
      return;
    }
    n++;
    tareas.push(setDoc(doc(db, 'personal', 'u_' + d.id), {
      nombre: mayus(u.nombre), telefono: '', equipo: u.rol === 'cocina' ? 'COCINA' : '', alias: [], uid: d.id, email: u.email || ''
    }));
  });
  await Promise.all(tareas);
  return n;
}
window.__sincronizarDirectorio = sincronizarDirectorio;

// ───────── Usuarios (administrador) ─────────
let unsubUsuarios = null;
function abrirUsuarios() {
  if (!esAdmin()) return;
  const m = $('nb-modal');
  m.classList.remove('nb-oculto');
  $('nb-modal-caja').innerHTML = '<div class="nb-cab"><h2>Usuarios</h2><button class="nb-x" data-nb-cerrar>✕</button></div>' +
    '<p class="nb-suave">Quien entra con Google por primera vez queda «Pendiente» hasta que le asignes un rol.</p>' +
    '<div class="nb-fila"><button class="nb-btn nb-prin" id="nb-nuevo">+ Crear acceso con correo</button>' +
    '<button class="nb-btn" id="nb-importar">Importar de la app anterior (.xlsx)</button>' +
    '<input type="file" id="nb-fichero" accept=".xlsx" class="nb-oculto"></div>' +
    '<div id="nb-imp-msg" class="nb-suave"></div>' +
    '<div id="nb-usuarios" class="nb-tabla">Cargando…</div>' +
    '<table class="nb-leyenda"><tr><td><b>Administrador</b></td><td>Todo, incluidos usuarios, costes y eliminar bodas.</td></tr>' +
    '<tr><td><b>Gestor</b></td><td>Gestión: crea y edita bodas, costes, puntos de mejora, personal y planning.</td></tr>' +
    '<tr><td><b>Jefe de sala</b></td><td>Edita todas las bodas (checklists, evaluaciones…), con listado de personal y precios de consumos. No ve COSTES.</td></tr>' +
    '<tr><td><b>Coordinador</b></td><td>Camarero con rango de coordinación: rellena su ficha y los documentos de la boda. Sin costes ni gestión.</td></tr>' +
    '<tr><td><b>Cocina / Camarero</b></td><td>Solo consulta (modo visión).</td></tr></table>';
  $('nb-nuevo').addEventListener('click', formNuevoUsuario);
  $('nb-importar').addEventListener('click', function () { $('nb-fichero').click(); });
  $('nb-fichero').addEventListener('change', function () { if (this.files[0]) importar(this.files[0]); });
  if (unsubUsuarios) unsubUsuarios();
  unsubUsuarios = onSnapshot(collection(db, 'users'), function (qs) {
    const l = [];
    qs.forEach(function (d) { const x = d.data(); x.uid = d.id; l.push(x); });
    l.sort(function (a, b) {
      if ((a.rol === 'pendiente') !== (b.rol === 'pendiente')) return a.rol === 'pendiente' ? -1 : 1;
      return String(a.nombre).localeCompare(String(b.nombre));
    });
    pintarUsuarios(l);
  }, function (e) { aviso(traducirError(e), true); });
}
function cerrarModal() {
  $('nb-modal').classList.add('nb-oculto');
  if (unsubUsuarios) { unsubUsuarios(); unsubUsuarios = null; }
}
document.addEventListener('click', function (e) {
  if (e.target.closest('[data-nb-cerrar]') || e.target === $('nb-modal')) cerrarModal();
});
function pintarUsuarios(l) {
  const t = $('nb-usuarios');
  if (!t) return;
  let h = '<table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th></tr></thead><tbody>';
  l.forEach(function (u) {
    const yo = u.uid === S.user.uid;
    let sel = '<select data-rol="' + u.uid + '"' + (yo ? ' disabled' : '') + '>';
    Object.keys(ROLES).forEach(function (r) { sel += '<option value="' + r + '"' + (u.rol === r ? ' selected' : '') + '>' + ROLES[r] + '</option>'; });
    sel += '</select>';
    h += '<tr' + (u.rol === 'pendiente' ? ' class="nb-pend"' : '') + '><td><b>' + esc(u.nombre) + '</b>' + (yo ? ' (tú)' : '') + '</td><td>' + esc(u.email) + '</td><td>' + sel + '</td></tr>';
  });
  t.innerHTML = h + '</tbody></table>';
  t.querySelectorAll('[data-rol]').forEach(function (s) {
    s.addEventListener('change', function () {
      escribir(updateDoc(doc(db, 'users', s.getAttribute('data-rol')), { rol: s.value }))
        .then(function () { aviso('Rol actualizado.'); }).catch(function () {});
    });
  });
}
let appSecundaria = null;
function formNuevoUsuario() {
  let op = '';
  Object.keys(ROLES).forEach(function (r) { if (r !== 'pendiente') op += '<option value="' + r + '"' + (r === 'camarero' ? ' selected' : '') + '>' + ROLES[r] + '</option>'; });
  $('nb-modal-caja').innerHTML = '<div class="nb-cab"><h2>Crear acceso</h2><button class="nb-x" data-nb-cerrar>✕</button></div>' +
    '<p class="nb-suave">La persona recibirá un correo para crear su propia contraseña.</p>' +
    '<label class="nb-campo">Nombre *<input id="nu-nombre"></label>' +
    '<label class="nb-campo">Correo *<input id="nu-email" type="email"></label>' +
    '<label class="nb-campo">Rol<select id="nu-rol">' + op + '</select></label>' +
    '<p class="nb-msg" id="nu-msg"></p>' +
    '<div class="nb-fila nb-fin"><button class="nb-btn" id="nu-volver">Volver</button><button class="nb-btn nb-prin" id="nu-crear">Crear y enviar correo</button></div>';
  $('nu-volver').addEventListener('click', abrirUsuarios);
  $('nu-crear').addEventListener('click', async function () {
    const nombre = mayus($('nu-nombre').value), email = $('nu-email').value.trim().toLowerCase(), r = $('nu-rol').value;
    if (!nombre || !email) { $('nu-msg').textContent = 'Nombre y correo son obligatorios.'; return; }
    this.disabled = true;
    try {
      if (!appSecundaria) appSecundaria = initializeApp(window.FIREBASE_CONFIG, 'secundaria');
      const auth2 = getAuth(appSecundaria);
      const a = new Uint32Array(4); crypto.getRandomValues(a);
      const clave = 'Am' + Array.prototype.map.call(a, function (n) { return n.toString(36); }).join('') + '!9';
      const cred = await createUserWithEmailAndPassword(auth2, email, clave);
      await setDoc(doc(db, 'users', cred.user.uid), { nombre: nombre, email: email, rol: r, creado: serverTimestamp() });
      await signOut(auth2);
      await sendPasswordResetEmail(auth, email);
      try { await sincronizarDirectorio(); } catch (e2) {}
      aviso('Acceso creado y añadido al directorio de PERSONAL. Correo enviado a ' + email + '.');
      abrirUsuarios();
    } catch (e) { $('nu-msg').textContent = traducirError(e); this.disabled = false; }
  });
}

// ───────── Importar la hoja DB_Eventos de la app anterior ─────────
function cargarSheetJS() {
  return new Promise(function (ok, ko) {
    if (window.XLSX) { ok(window.XLSX); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    s.onload = function () { ok(window.XLSX); };
    s.onerror = function () { ko(new Error('No se ha podido cargar el lector de Excel.')); };
    document.head.appendChild(s);
  });
}
async function importar(fichero) {
  const msg = $('nb-imp-msg');
  msg.textContent = 'Leyendo el archivo…';
  try {
    const X = await cargarSheetJS();
    const wb = X.read(await fichero.arrayBuffer(), { type: 'array' });
    const hoja = wb.Sheets[wb.SheetNames[0]];
    const filas = X.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: '' });
    const bodas = [];
    const errores = [];
    for (let i = 1; i < filas.length; i++) {
      const f = filas[i];
      const id = String(f[0] || '').trim();
      if (!id) continue;
      let txt = String(f[3] || '');
      for (let c = 4; c < f.length; c++) {
        const t = String(f[c] || '');
        if (!t) continue;
        txt += t.charAt(0) === '~' ? t.substring(1) : t;
      }
      try { bodas.push({ id: id, obj: JSON.parse(txt) }); } catch (e) { errores.push('Fila ' + (i + 1) + ' (' + (f[1] || id) + ')'); }
    }
    if (!bodas.length) { msg.textContent = 'No se ha encontrado ninguna boda en el archivo.'; return; }
    const existentes = [];
    for (let i = 0; i < bodas.length; i++) {
      const s = await getDoc(doc(db, 'eventos', bodas[i].id));
      if (s.exists() && !s.data().papelera) existentes.push(bodas[i].id);
    }
    let texto = 'Se van a importar ' + bodas.length + ' boda(s).';
    if (existentes.length) texto += '\n\n' + existentes.length + ' ya existen en la app nueva: se SUSTITUIRÁN por la versión del archivo.';
    if (errores.length) texto += '\n\nNo se pueden leer: ' + errores.join(', ');
    if (!confirm(texto + '\n\n¿Continuar?')) { msg.textContent = 'Importación cancelada.'; return; }
    let hechas = 0;
    const grandes = [];
    for (let i = 0; i < bodas.length; i++) {
      const b = bodas[i];
      const datos = {};
      let total = 0;
      Object.keys(b.obj).forEach(function (k) { datos[k] = JSON.stringify(b.obj[k]); total += datos[k].length; });
      if (total > LIMITE_DOC) { grandes.push(b.obj.boda || b.id); continue; }
      msg.textContent = 'Importando ' + (i + 1) + ' de ' + bodas.length + '…';
      await escribir(setDoc(doc(db, 'eventos', b.id), {
        boda: b.obj.boda || '', fecha: b.obj.fecha || '', papelera: false, rev: nuevaRev(), session: 'importacion',
        datos: datos, importado: serverTimestamp(), modificado: serverTimestamp(), modificadoPor: S.user.uid
      }));
      guardado[b.id] = datos;
      hechas++;
    }
    msg.textContent = 'Importadas ' + hechas + ' boda(s).' + (grandes.length ? ' Demasiado grandes (no importadas): ' + grandes.join(', ') : '');
    aviso('Importación terminada: ' + hechas + ' boda(s).');
    try { cargarDatosIniciales(1); } catch (e) {}
  } catch (e) {
    msg.textContent = 'Error: ' + traducirError(e);
  }
}

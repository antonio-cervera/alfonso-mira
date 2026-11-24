// Campos de la FICHA DE LA FINCA (los usan la app y la página pública finca.html)
// Formato: [clave, etiqueta, tipo] · tipo: text, tel, email, date, time, number, sino, texto
window.AM_FICHA_FINCA = [
  { titulo: 'Datos de la finca', campos: [
    ['contacto', 'Persona de contacto', 'text'], ['telefono', 'Teléfono', 'tel'], ['email', 'Correo', 'email'],
    ['direccion', 'Dirección', 'text'], ['acceso', 'Cómo llegar / acceso de vehículos', 'texto']
  ] },
  { titulo: 'Horarios', campos: [
    ['montaje_fecha', 'Día de acceso para montaje', 'date'], ['montaje_hora', 'Hora de acceso para montaje', 'time'],
    ['inicio_evento', 'Hora de inicio del evento', 'time'], ['fin_musica', 'Hora límite de música', 'time'],
    ['fin_evento', 'Hora de fin del evento', 'time'], ['salida_personal', 'Hora límite de salida del personal', 'time']
  ] },
  { titulo: 'Electricidad y agua', campos: [
    ['potencia_kw', 'Potencia eléctrica disponible (kW)', 'number'], ['tomas', 'Tomas de corriente y ubicación', 'texto'],
    ['cuadro', 'Ubicación del cuadro eléctrico', 'text'], ['generador', '¿Hace falta generador?', 'sino'],
    ['agua', '¿Hay toma de agua?', 'sino'], ['agua_ubicacion', 'Ubicación de la toma de agua', 'text']
  ] },
  { titulo: 'Instalaciones', campos: [
    ['cocina', 'Cocina u office disponible', 'texto'], ['aseos', 'Aseos para invitados y personal', 'text'],
    ['aparcamiento', 'Aparcamiento y descarga de camiones', 'texto'], ['zona_personal', 'Zona para el personal', 'text']
  ] },
  { titulo: 'Material', campos: [
    ['material_disponible', 'Material de la finca que se puede usar (mesas, sillas, carpas…)', 'texto'],
    ['material_dejar', 'Qué se puede dejar en la finca tras el evento', 'texto'],
    ['recogida_fecha', 'Día de recogida del material', 'date'], ['recogida_hora', 'Hora de recogida del material', 'time']
  ] },
  { titulo: 'Normas de la finca', campos: [
    ['normas_ruido', 'Ruido y música', 'texto'], ['normas_fuego', 'Fuego, velas y pirotecnia', 'texto'],
    ['normas_lanzamientos', 'Confeti, arroz, pétalos…', 'text'], ['normas_otras', 'Otras normas', 'texto']
  ] },
  { titulo: 'Observaciones', campos: [['observaciones', 'Observaciones', 'texto']] }
];

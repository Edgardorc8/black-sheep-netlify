// Black Sheep — Tablero de ventas. Todo lo que se cambia está aquí.
window.TABLERO = {
  // ID de tu Google Sheet (lo que va entre /d/ y /edit en el link).
  // Vacío = modo demo con ventas inventadas para ver cómo se mueve.
  SHEET_ID: "",
  // Nombre de la pestaña donde caen las ventas (la del Google Form suele ser "Respuestas de formulario 1").
  PESTANA: "Ventas",

  // Meta de prima anual (AP) del mes, en dólares.
  META_MES: 150000,

  // Cada cuántos segundos revisa si hay ventas nuevas.
  REFRESCO_SEG: 30,

  // Cómo escribe la hoja las fechas: "mdy" (10/28/2026) o "dmy" (28/10/2026).
  FORMATO_FECHA: "mdy",

  TITULO: "Arena de ventas",
};

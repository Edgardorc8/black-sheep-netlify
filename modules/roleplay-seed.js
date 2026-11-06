/*
 * Escenarios de EJEMPLO para el Roleplay (se reemplazan con el guion de Black Sheep).
 *   brief   → lo que ve el agente antes de llamar
 *   persona → instrucciones secretas para la IA (quién es el cliente y sus objeciones)
 *   opening → lo primero que dice el cliente al contestar
 * BSRoleplayDemoLines / BSRoleplayDemoGrade solo se usan en el modo de prueba (sin IA).
 */
window.BSRoleplaySeed = [
  {
    title: "Rosa pidió información", level: "easy",
    brief: "Rosa, 38 años, mamá de dos niños. Llenó un formulario pidiendo información de seguro de vida. Objetivo: agendar la presentación.",
    persona: "Te llamas Rosa Martínez, tienes 38 años, trabajas en una clínica dental y tienes dos hijos (8 y 11). Llenaste un formulario en internet porque una amiga murió joven y te dio miedo. Eres amable y abierta. Tu única duda es si te alcanza: ganas poco. Si el agente te explica con calma y te propone una cita para revisar opciones, aceptas.",
    opening: "¿Bueno? Sí, ¿quién habla?",
    rubric: "",
  },
  {
    title: "Miguel ya tiene seguro del trabajo", level: "medium",
    brief: "Miguel, 52 años, mecánico. Pidió información pero dice que ya está cubierto por su trabajo. Objetivo: agendar la presentación del IUL.",
    persona: "Te llamas Miguel Torres, 52 años, mecánico con 20 años en la misma empresa, casado, una hija en la universidad. Objeciones en este orden: 1) 'ya tengo seguro en el trabajo' (es 1 vez tu salario, unos 45 mil), 2) 'eso ha de ser carísimo', 3) 'déjeme lo platico con mi esposa'. Solo aceptas la cita si el agente te hace ver que el seguro del trabajo se pierde al jubilarte o al salirte, y te propone que tu esposa esté en la cita.",
    opening: "Sí, diga.",
    rubric: "",
  },
  {
    title: "Laura, dueña de negocio desconfiada", level: "hard",
    brief: "Laura, 45 años, dueña de un salón de belleza. Muy ocupada y desconfiada de los vendedores. Objetivo: lograr que acepte una presentación de 20 minutos.",
    persona: "Te llamas Laura Gómez, 45 años, divorciada, dueña de un salón de belleza con 4 empleadas, un hijo de 16. Estás atendiendo clientas y te molestan las llamadas de ventas. Objeciones fuertes: 'no tengo tiempo', 'mándamelo por correo', 'los seguros son una estafa, a mi tía nunca le pagaron', 'está muy caro', 'déjame pensarlo'. Repites la objeción si no te la resuelven. Te interesa proteger a tu hijo y no tienes ahorro para el retiro: si el agente descubre eso con buenas preguntas y te muestra valor sin presionar, aceptas una cita corta. Si el agente suena a guion o insiste mucho, cuelgas.",
    opening: "¿Sí? Estoy ocupada, ¿quién habla?",
    rubric: "",
  },
];

window.BSRoleplayDemoLines = {
  easy: [
    "Ah sí, sí, yo llené eso. Es que una amiga falleció y me quedé pensando en mis niños.",
    "Mire, lo que me preocupa es que no gano mucho. ¿Más o menos cuánto saldría algo así?",
    "Ah, ok, eso sí me suena posible. ¿Y cómo le hacemos?",
    "Sí, el jueves en la tarde puedo. Gracias, muy amable. Hasta luego.",
  ],
  medium: [
    "Sí, yo pedí información, pero la verdad ya tengo seguro en el trabajo.",
    "Pues sí, pero eso ha de ser carísimo, ¿no?",
    "Mmm... déjeme lo platico con mi esposa y luego le llamo.",
    "Bueno, está bien, si ella puede estar, el sábado en la mañana. Hasta luego.",
  ],
  hard: [
    "Mire, no tengo tiempo ahorita, ¿me lo puede mandar por correo?",
    "La verdad los seguros son una estafa. A mi tía nunca le pagaron nada.",
    "Ajá... ¿y cuánto me va a costar eso? Porque seguro está carísimo.",
    "Déjeme pensarlo. No me gusta decidir estas cosas por teléfono.",
    "Bueno, está bien, veinte minutos el lunes, pero nada más veinte. Adiós.",
  ],
};

window.BSRoleplayDemoGrade = {
  puntaje: 74,
  resultado: "Cita agendada",
  resumen: "Calificación de EJEMPLO (modo de prueba, sin IA). Con la IA conectada, aquí verás la evaluación real de tu llamada, citando lo que dijiste.",
  fortalezas: ["Te presentaste con claridad y buen tono.", "Pediste la cita de forma directa al final."],
  mejorar: ["Haz más preguntas antes de hablar del producto.", "Cuando el cliente dijo 'déjame pensarlo', aclara cuál es la duda real antes de responder."],
  criterios: [
    { nombre: "Apertura y conexión", puntos: 8, comentario: "Buen saludo y tono amable." },
    { nombre: "Preguntas de descubrimiento", puntos: 6, comentario: "Faltó preguntar por familia y presupuesto." },
    { nombre: "Manejo de objeciones", puntos: 7, comentario: "Respondiste el precio, pero sin confirmar." },
    { nombre: "Claridad del producto", puntos: 8, comentario: "Explicación sencilla." },
    { nombre: "Cierre", puntos: 8, comentario: "Propusiste dos horarios." },
    { nombre: "Escucha activa", puntos: 7, comentario: "Interrumpiste una vez." },
  ],
  frase_para_practicar: "Entiendo que lo quiera pensar. Para ayudarle mejor: ¿lo que le detiene es el precio o tiene otra duda?",
};

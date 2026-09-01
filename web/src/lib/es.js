/**
 * ESPAGNOL — I18N-02 (comité 29 §4, priorité 1 : Pérou, Chili, Mexique,
 * Argentine — le premier bassin minier mondial hors anglophonie).
 *
 * ── STATUT : BROUILLON (draft) ─────────────────────────────────────
 *
 * Cette traduction a été produite par IA et N'A PAS encore été relue par
 * un locuteur natif du métier. La politique du comité : elle peut
 * s'afficher, elle le dit (le commutateur montre « Español (draft) »),
 * et la marque ne se lève qu'après relecture native — même si cela
 * retarde une vente. Le vocabulaire suit les équivalents normatifs
 * espagnols (ISO 21502 est publiée en espagnol) : valor ganado, línea
 * base, hito, caso de negocio, tolerancia, parte interesada.
 *
 * Même architecture que le français : clé = le libellé anglais lui-même,
 * une entrée manquante retombe sur l'anglais, jamais sur une clé cassée.
 * La porte F5 vérifie CHAQUE langue du registre : un libellé t() sans
 * entrée ES fait échouer la construction comme pour le FR.
 */

export const ES = {
  // ── coquille : navigation et titres
  "My week": "Mi semana",
  "Portfolio": "Cartera",
  "Programmes": "Programas",
  "My site": "Mi sitio",
  "Project overview": "Vista del proyecto",
  "Schedule": "Cronograma",
  "Board": "Tablero",
  "Risks & issues": "Riesgos e incidencias",
  "Budget & cost": "Presupuesto y costes",
  "Change requests": "Solicitudes de cambio",
  "Resources": "Recursos",
  "Meetings": "Reuniones",
  "Documents": "Documentos",
  "Reports": "Informes",
  "Locations": "Sitios",
  "Administration": "Administración",

  // ── PM-08 · PM-04 — clôture et acceptation
  "Acceptance criteria": "Criterios de aceptación",
  "Benefits owner after closure": "Responsable de los beneficios tras el cierre",
  "Benefits realise AFTER closure. Left with the project, they belong to nobody.":
    "Los beneficios se realizan DESPUÉS del cierre. Dejados en el proyecto, no pertenecen a nadie.",
  "Checked by": "Verificado por",
  "Close it": "Cerrar",
  "Close this project": "Cerrar este proyecto",
  "Operations owner who takes it over": "Responsable de operaciones que lo asume",
  "Required to mark done when criteria exist — the named person who checked them. The name stays.":
    "Obligatorio para marcar como hecho cuando existen criterios — la persona nombrada que los verificó. El nombre queda.",
  "The closing word": "La palabra final",
  "The person who answers when what was delivered breaks. Without a name, the dissolved project team gets the call.":
    "La persona que responde cuando lo entregado falla. Sin un nombre, la llamada llega al equipo de proyecto ya disuelto.",
  "What is left behind, and what was deliberately not done. Read by whoever inherits this.":
    "Lo que se deja, y lo que deliberadamente no se hizo. Lo lee quien herede esto.",
  "What must be TRUE for this to count as achieved — testable, written before the work. Empty means no formal acceptance.":
    "Lo que debe ser CIERTO para darlo por logrado — verificable, escrito antes del trabajo. Vacío = sin aceptación formal.",

  // ── PM-06 — risque résiduel et provision nommée
  "Required for a contingency draw when the project has open risks — the committee reads what the reserve was spent against.":
    "Obligatorio para un uso de contingencia cuando el proyecto tiene riesgos abiertos — el comité lee contra qué se gastó la reserva.",
  "Risk this draw answers": "Riesgo que financia este uso",
  "Target impact (1–5)": "Impacto objetivo (1–5)",
  "Target probability (1–5)": "Probabilidad objetivo (1–5)",
  "Where the response is meant to take the probability. Leave empty for Accept or Monitor.":
    "Adónde debe llevar la respuesta la probabilidad. Vacío para Aceptar o Vigilar.",
  "Without a target, whether the mitigation worked is a matter of memory.":
    "Sin objetivo, saber si la mitigación funcionó es cuestión de memoria.",
  "— not a contingency draw, or no open risk —": "— no es un uso de contingencia, o no hay riesgo abierto —",

  // ── PM-03 — cas d'affaire
  ", revised ": ", revisado el ",
  "A figure with its basis can be checked; a figure without one can only be argued with.":
    "Una cifra con su base se puede comprobar; una cifra sin base solo se puede discutir.",
  "Annual, once delivered. The benefits register holds the measured truth.":
    "Anual, una vez entregado. El registro de beneficios guarda la verdad medida.",
  "Basis: ": "Base: ",
  "Business case": "Caso de negocio",
  "Expected benefit ($M/yr)": "Beneficio esperado (M$/año)",
  "Expected benefit / yr": "Beneficio esperado / año",
  "Expected cost": "Coste esperado",
  "Expected cost ($M)": "Coste esperado (M$)",
  "If the case no longer holds, do not reconfirm it — revise it, or take the project to the steering committee.":
    "Si el caso ya no se sostiene, no lo reconfirme — revíselo, o lleve el proyecto al comité de dirección.",
  "It still holds": "Sigue vigente",
  "Last reconfirmed": "Última reconfirmación",
  "Nothing here says why this project deserves its budget. Gate 1 asks for the business case as evidence — and without it, nobody can ever answer whether it still holds.":
    "Nada aquí dice por qué este proyecto merece su presupuesto. La puerta 1 exige el caso de negocio como evidencia — y sin él, nadie podrá responder jamás si sigue vigente.",
  "Only the programme office writes it — the deliverer executes the justification, it does not author it.":
    "Solo la oficina de programa lo escribe — quien entrega ejecuta la justificación, no la redacta.",
  "Revise": "Revisar",
  "Revise the business case": "Revisar el caso de negocio",
  "Revised after its last reconfirmation — what was reconfirmed is not what is written below.":
    "Revisado después de su última reconfirmación — lo reconfirmado no es lo que está escrito abajo.",
  "Save the case": "Guardar el caso",
  "Still worth doing?": "¿Sigue valiendo la pena?",
  "The justification in the payer's words — what the group gets, not how the team will build it.":
    "La justificación en palabras de quien paga — lo que el grupo obtiene, no cómo lo construirá el equipo.",
  "This records that the justification holds, at the current gate, under your name.":
    "Esto consigna que la justificación se sostiene, en la puerta actual, bajo su nombre.",
  "What the numbers rest on": "En qué se apoyan las cifras",
  "What was promised when the money was asked for. The ledger holds what actually happened.":
    "Lo que se prometió cuando se pidió el dinero. El libro mayor guarda lo que realmente ocurrió.",
  "Why this project": "Por qué este proyecto",
  "Write it": "Escribirlo",
  "Write the business case": "Escribir el caso de negocio",
  "changed since it was last reconfirmed": "modificado desde su última reconfirmación",
  "gate ": "puerta ",
  "none written": "ninguno escrito",
  "reconfirmed at gate ": "reconfirmado en la puerta ",
  "written ": "escrito el ",
  "written, never reconfirmed at a gate": "escrito, nunca reconfirmado en una puerta",

  // ── MC-01 — pays et entité légale
  "Country": "País",
  "Legal entity": "Entidad legal",
  "Two-letter ISO code — SN, CI, PE. The per-country legal condition on time entry (G-14) reads this.":
    "Código ISO de dos letras — SN, CI, PE. La condición legal por país sobre el registro de tiempo (G-14) lee este campo.",
  "The company that carries this site. A data-subject request is answered by an entity, not by a city.":
    "La sociedad que sostiene este sitio. Una solicitud de datos personales la responde una entidad, no una ciudad.",
  "Two letters, or empty": "Dos letras, o vacío",

  // ── PM-01 — tolérances et exceptions
  " past the margin — waiting on an answer": " fuera del margen — a la espera de respuesta",
  " waiting on an answer": " a la espera de respuesta",
  "Answer": "Responder",
  "Answer this exception": "Responder a esta excepción",
  "Benefit (points below target)": "Beneficio (puntos bajo el objetivo)",
  "Change the margin": "Cambiar el margen",
  "Compares the estimate at completion with the budget.": "Compara la estimación a la terminación con el presupuesto.",
  "Cost (% over budget)": "Coste (% sobre presupuesto)",
  "Dimension": "Dimensión",
  "Exceptions": "Excepciones",
  "Measured / allowed": "Medido / permitido",
  "Measured against the baseline finish, never against the current plan — otherwise moving the date would clear the breach.":
    "Medido contra el fin de línea base, nunca contra el plan vigente — si no, mover la fecha borraría el exceso.",
  "No margin, so nothing to exceed.": "Sin margen, nada que exceder.",
  "Nothing has gone past the margin. The hourly sweep checks on its own.":
    "Nada ha superado el margen. El barrido horario lo comprueba por sí solo.",
  "Read back by a committee months later. Say what was decided, not that a decision happened.":
    "Lo releerá un comité meses después. Diga qué se decidió, no que hubo una decisión.",
  "Record the answer": "Consignar la respuesta",
  "Schedule (days past the baseline)": "Plazo (días más allá de la línea base)",
  "Scope, quality and risk — in words": "Alcance, calidad y riesgo — en palabras",
  "Set a margin": "Fijar un margen",
  "Set the margin": "Fijar el margen",
  "Set the margin for this project": "Fijar el margen de este proyecto",
  "Stated, not measured: ": "Declarado, no medido: ",
  "The four answers the level that delegated the margin may give.":
    "Las cuatro respuestas que puede dar el nivel que delegó el margen.",
  "The margin this project works inside": "El margen dentro del que trabaja este proyecto",
  "These three cannot be measured here. Stating them is honest; pretending to compute them would not be.":
    "Estos tres no se pueden medir aquí. Declararlos es honesto; fingir calcularlos no lo sería.",
  "Tolerance & exceptions": "Tolerancia y excepciones",
  "Watches the weakest benefit on the project, not the average — one missed benefit must not hide behind one exceeded.":
    "Vigila el beneficio más débil del proyecto, no el promedio — un beneficio fallido no debe esconderse tras uno superado.",
  "What was decided": "Qué se decidió",

  "What was found": "Qué se constató",
  "Why": "Por qué",
  "Without a margin, authority is delegated without a bound: this project can drift and nothing will say so on its own. Only the programme office can set one.":
    "Sin margen, la autoridad se delega sin límite: este proyecto puede desviarse y nada lo dirá por sí solo. Solo la oficina de programa puede fijar uno.",
  "allowed": "permitido",
  "inside the margin set for it": "dentro del margen que se le fijó",
  "no limit set": "sin límite fijado",
  "no margin set": "sin margen fijado",
  "nobody has set one": "nadie ha fijado uno",
  "none open": "ninguna abierta",
  "of": "de",
  "past the margin": "fuera del margen",
  "set on ": "fijado el ",
  "Tolerance raised": "Margen elevado",
  "Plan revised": "Plan revisado",
  "Accepted": "Exceso aceptado",
  "Stopped": "Proyecto detenido",
  "Answered": "Respondida",
  "days": "días",
  "points below target": "puntos bajo el objetivo",

  // INT-02 · los sistemas conectados
  "A key is never stored — only its fingerprint. Every act it performs is recorded under the name you give it here, not as an anonymous system. Revoking one key never affects another.":
    "Una clave nunca se guarda — solo su huella. Cada acto que realiza queda registrado con el nombre que usted le dé aquí, no como un sistema anónimo. Revocar una clave nunca afecta a las demás.",
  "Change what this key may do": "Cambiar lo que esta clave puede hacer",
  "Connect a system": "Conectar un sistema",
  "Connected systems": "Sistemas conectados",
  "Copy it now": "Cópiela ahora",
  "I have copied it": "La he copiado",
  "Integrations": "Integraciones",
  "Issue a key": "Emitir una clave",
  "Issue a key when a system needs to read the portfolio. Until then, nothing outside can reach it.":
    "Emita una clave cuando un sistema necesite leer la cartera. Hasta entonces, nada externo puede alcanzarla.",
  "It stops working immediately. No other integration is affected.":
    "Deja de funcionar de inmediato. Ninguna otra integración se ve afectada.",
  "Key": "Clave",
  "Last used": "Último uso",
  "May": "Puede",
  "Name": "Nombre",
  "No system is connected": "Ningún sistema está conectado",
  "One key per system, and each key says what it may do": "Una clave por sistema, y cada clave dice lo que puede hacer",
  "Read months later by whoever wonders whether this key can be revoked.":
    "Lo leerá meses después quien se pregunte si esta clave puede revocarse.",
  "Reading the connected systems…": "Leyendo los sistemas conectados…",
  "Revoke": "Revocar",
  "Revoke it": "Revocar",
  "Revoke this key?": "¿Revocar esta clave?",
  "Revoked": "Revocada",
  "Rotate": "Rotar",
  "Rotate it": "Rotar la clave",
  "Rotate this key?": "¿Rotar esta clave?",
  "SAP — financial actuals": "SAP — costes reales",
  "The current key stops working the moment the new one is issued.":
    "La clave actual deja de funcionar en el momento en que se emite la nueva.",
  "The key for": "La clave de",
  "The new key for": "La nueva clave de",
  "The record stays, so the audit trail can still name what it wrote.":
    "El registro queda, para que la pista de auditoría aún pueda nombrar lo que escribió.",
  "This is what the audit trail will show when it writes. Name the system, not the person.":
    "Esto es lo que mostrará la pista de auditoría cuando escriba. Nombre el sistema, no a la persona.",
  "This key is shown once and is not stored anywhere. If it is lost, rotate it — that is a normal thing to do, not a failure.":
    "Esta clave se muestra una sola vez y no se guarda en ninguna parte. Si se pierde, rótela — es un gesto normal, no un fallo.",
  "What it is for": "Para qué sirve",
  "Whatever is using it will fail until it is given the new key.":
    "Lo que la use fallará hasta que reciba la nueva clave.",
  "nothing — closed by default": "nada — cerrado por defecto",

  // PM-02 · el registro de lecciones
  "Adopt": "Adoptar",
  "Adopt it": "Adoptar",
  "Adopt this lesson?": "¿Adoptar esta lección?",
  "Adopted": "Adoptada",
  "All": "Todas",
  "All categories": "Todas las categorías",
  "Archived": "Archivada",
  "Avoid": "A evitar",
  "Category": "Categoría",
  "Correct a lesson": "Corregir una lección",
  "Gate 4 asks for these as evidence. This is where they live.":
    "La puerta 4 las exige como evidencia. Aquí es donde viven.",
  "In one sentence": "En una frase",
  "It becomes readable at every site, including sites that cannot see the project it came from.":
    "Se vuelve legible en todos los sitios, incluidos los que no pueden ver el proyecto del que proviene.",
  "Leave empty if it came up outside a gate, or at closure.":
    "Déjelo vacío si surgió fuera de una puerta, o al cierre.",
  "Lesson": "Lección",
  "Lessons": "Lecciones",
  "Lessons learned": "Lecciones aprendidas",
  "No lesson matches those filters.": "Ninguna lección coincide con esos filtros.",
  "Not at a gate": "Fuera de puerta",
  "Nothing recorded yet. The first one usually comes out of a gate review.":
    "Nada consignado todavía. La primera suele salir de una revisión de puerta.",
  "Proposed": "Propuesta",
  "Raised at gate": "Levantada en la puerta",
  "Record a lesson": "Consignar una lección",
  "Record it": "Consignar",
  "Repeat": "A repetir",
  "Required before the group can adopt it. Without this, it is an anecdote.":
    "Obligatorio antes de que el grupo pueda adoptarla. Sin esto, es una anécdota.",
  "Search the register": "Buscar en el registro",
  "Something to avoid": "Algo a evitar",
  "Something to repeat": "Algo a repetir",
  "That is the point of adopting it — and it is why only the programme office can.":
    "Ese es el sentido de adoptarla — y por eso solo puede hacerlo la oficina de programa.",
  "The cause, not the symptom — this is the part that transfers to another site.":
    "La causa, no el síntoma — esta es la parte que se transfiere a otro sitio.",
  "The facts, dated where you can. Not who is to blame.":
    "Los hechos, fechados donde pueda. No quién tiene la culpa.",
  "The local supplier delivers in eight weeks, not four":
    "El proveedor local entrega en ocho semanas, no en cuatro",
  "The project that lived it. The lesson keeps its programme and site even after that project is gone.":
    "El proyecto que la vivió. La lección conserva su programa y su sitio incluso cuando ese proyecto ya no exista.",
  "Waiting on the programme office": "A la espera de la oficina de programa",
  "What happened": "Qué ocurrió",
  "What kind": "De qué tipo",
  "What someone scanning the register needs to recognise it by.":
    "Aquello por lo que alguien que recorra el registro la reconocerá.",
  "What to do differently": "Qué hacer distinto",
  "What worked is worth recording as much as what failed — a register of failures alone is never re-read.":
    "Lo que funcionó merece consignarse tanto como lo que falló — un registro solo de fracasos nunca se relee.",
  "Where it will be looked for later — the area the next project will be worrying about.":
    "Donde se buscará más tarde — el área que preocupará al próximo proyecto.",
  "Why it happened": "Por qué ocurrió",
  "Worth repeating": "A repetir",
  "gate": "puerta",
  "no recommendation — cannot be adopted": "sin recomendación — no puede adoptarse",
  "nothing waiting": "nada en espera",
  "of the adopted ones": "entre las adoptadas",
  "proposed, not yet published": "propuestas, aún no publicadas",
  "readable at every site": "legibles en todos los sitios",
  "Scope": "Alcance",
  "Quality": "Calidad",
  "Stakeholders": "Partes interesadas",
  "Procurement": "Compras",
  "Governance": "Gobernanza",
  "Technical": "Técnica",
  "Transition": "Transición",

  // M-01 · continuidad
  "Continuity": "Continuidad",
  "take the book with you, or close every door": "llevarse el libro, o cerrar todas las puertas",
  "The archive holds the portfolio and the audit trail in one open file, which is loaded elsewhere with npm run restore. It carries no password, so it can be handed to a third party as it is. It is not a backup — a backup is taken at the database.":
    "El archivo contiene la cartera y la pista de auditoría en un solo fichero abierto, que se carga en otro lugar con npm run restore. No lleva ninguna contraseña, así que puede entregarse tal cual a un tercero. No es una copia de seguridad — esa se hace a nivel de base de datos.",
  "Export the archive": "Exportar el archivo",
  "Archive": "Archivar",
  "Archive exported": "Archivo exportado",
  "The book and the trail, in one file.": "El libro y la pista, en un solo fichero.",
  "End every session?": "¿Terminar todas las sesiones?",
  "Everyone signs in again, including you, immediately.":
    "Todo el mundo vuelve a iniciar sesión, usted incluido, de inmediato.",
  "This is the answer to a workstation left open or a doubt about a password — not a button to try.":
    "Es la respuesta a un puesto dejado abierto o a una duda sobre una contraseña — no un botón para probar.",
  "End every session": "Terminar todas las sesiones",
  "Sessions": "Sesiones",
  "Sessions ended": "Sesiones terminadas",
  "session(s) — sign in again.": "sesión(es) — vuelva a conectarse.",

  // grupos de navegación y títulos
  "Deliver": "Entregar",
  "Control": "Controlar",
  "Govern": "Gobernar",
  "Record": "Consignar",
  "System": "Sistema",
  "Executive portfolio view": "Vista ejecutiva de la cartera",
  "Programme governance": "Gobernanza de programas",
  "Integrated master schedule": "Cronograma maestro integrado",
  "Work board": "Tablero de trabajo",
  "Budget & earned value": "Presupuesto y valor ganado",
  "Resource capacity": "Capacidad de recursos",
  "Meetings & decisions": "Reuniones y decisiones",
  "Document library": "Biblioteca de documentos",
  "Status reporting": "Informes de estado",
  "Delivery locations": "Sitios de entrega",
  "Governance & administration": "Gobernanza y administración",

  // coquille, connexion, primeros pasos
  "Portfolio management office": "Oficina de gestión de cartera",
  "Sections": "Secciones",
  "Sign out": "Cerrar sesión",
  "Search everything (Ctrl-K)": "Buscar en todo (Ctrl-K)",
  "Help — how Meridian works": "Ayuda — cómo funciona Meridian",
  "Help": "Ayuda",
  "Sign in": "Iniciar sesión",
  "Signing in…": "Iniciando sesión…",
  "Email": "Correo electrónico",
  "Password": "Contraseña",
  "Group IT portfolio management office": "Oficina de gestión de la cartera TI del grupo",
  "Every action you take is recorded against your name and scoped to the sites and programmes you hold.":
    "Cada acción que realice queda registrada a su nombre y limitada a los sitios y programas que le corresponden.",
  "Accounts on this instance": "Cuentas de esta instancia",
  "Who can sign in": "Quién puede iniciar sesión",
  "Could not reach the server": "No se pudo alcanzar el servidor",
  /* I18N-02 — la porte d'entrée gardait de l'anglais nu (voir i18n.js). */
  "Email address": "Correo electrónico",
  "Your password": "Su contraseña",
  "Loading the directory…": "Cargando el directorio…",
  "unrestricted": "sin restricción",
  "Four levels of access, agreed at the constitutive committee: administrator, group, site and viewer. Group and site accounts are scoped by the grants named beside them — a grant list is never implicitly “all”.":
    "Cuatro niveles de acceso, acordados en el comité constitutivo: administrador, grupo, sitio y lector. Las cuentas de grupo y de sitio se limitan a los permisos nombrados junto a ellas — una lista de permisos nunca es implícitamente «todo».",
  "Four levels of access are enforced: administrator, group, site and viewer. Group and site accounts are scoped by grants — a grant list is never implicitly “all”. Accounts and grants are managed by an administrator.":
    "Se aplican cuatro niveles de acceso: administrador, grupo, sitio y lector. Las cuentas de grupo y de sitio se limitan mediante permisos — una lista de permisos nunca es implícitamente «todo». Las cuentas y los permisos los gestiona un administrador.",
  "Selecting a name fills the address in. Passwords are set at seed time and listed in the README; change them from Administration before this instance carries anything real.":
    "Elegir un nombre rellena la dirección. Las contraseñas se fijan al sembrar la instancia y figuran en el README; cámbielas desde Administración antes de que esta instancia lleve algo real.",
  "Selecting a name fills the address in. Forgotten your password? Any administrator can reset it — you will choose a new one at your next sign-in.":
    "Elegir un nombre rellena la dirección. ¿Olvidó su contraseña? Cualquier administrador puede restablecerla — elegirá una nueva en su próximo inicio de sesión.",
  "The directory could not be loaded. Sign in with your address and password.":
    "El directorio no se ha podido cargar. Inicie sesión con su dirección y su contraseña.",
  "Your SDP sign-in reached this module, but no PMO account carries your email yet. Ask a Meridian administrator to provision you, or sign in with a module account below.":
    "Su acceso SDP ha llegado a este módulo, pero ninguna cuenta PMO lleva aún su dirección. Pida a un administrador de Meridian que le aprovisione, o inicie sesión con una cuenta del módulo aquí abajo.",
  "Everything, including users, grants and global settings":
    "Todo, incluidas las cuentas, los permisos y los ajustes globales",
  "Portfolio-wide read; write inside the granted programmes":
    "Lectura de toda la cartera; escritura dentro de los programas concedidos",
  "Own sites plus group projects read-only; write own site projects":
    "Sus sitios, más los proyectos de grupo en solo lectura; escritura en los proyectos de su sitio",
  "Read-only": "Solo lectura",
  "Access model": "Modelo de acceso",
  "administrator only": "solo para administradores",
  "Choose your own password": "Elija su propia contraseña",
  "First sign-in": "Primer inicio de sesión",
  "The password you were given": "La contraseña que le dieron",
  "Your new password (8+ characters)": "Su nueva contraseña (8+ caracteres)",
  "Set password": "Establecer contraseña",
  "Password changed": "Contraseña cambiada",
  "It is yours now": "Ahora es suya",
  "Start here": "Empiece aquí",
  "Welcome to Meridian": "Bienvenido a Meridian",
  "Don't show this again": "No volver a mostrar esto",
  "You hold the whole system: accounts, grants, sites and programmes live under Administration. If this book is empty, the Portfolio view shows you the setup path.":
    "Usted sostiene todo el sistema: cuentas, permisos, sitios y programas viven en Administración. Si este libro está vacío, la vista Cartera le muestra el camino de puesta en marcha.",
  "You govern programmes: start at Programmes for your slate's health and decisions owed, and chair your series under Meetings. Money and baselines are yours alone.":
    "Usted gobierna programas: empiece en Programas para la salud de su cartera y las decisiones pendientes, y presida sus series en Reuniones. El dinero y las líneas base son solo suyos.",
  "Your site is the centre: My site shows what you run, what the group lands on you, and your people's load. Update progress from a project's Stage plan — and raise a concern on any group project at your site.":
    "Su sitio es el centro: Mi sitio muestra lo que usted dirige, lo que el grupo despliega en su sitio, y la carga de su gente. Actualice el avance desde el plan de etapas de un proyecto — y levante una inquietud sobre cualquier proyecto de grupo en su sitio.",
  "You read everything in your scope. Portfolio for the headline, Reports for the narrative — nothing here will let you change a record.":
    "Usted lee todo lo de su ámbito. Cartera para el titular, Informes para el relato — nada aquí le permitirá cambiar un registro.",
  "Ctrl-K searches everything; the ? button in the header explains how health, gates and scope work.":
    "Ctrl-K busca en todo; el botón ? de la cabecera explica cómo funcionan la salud, las puertas y el ámbito.",
  "Cancel": "Cancelar",
  "Save": "Guardar",
  "Saving…": "Guardando…",
  "Refreshing the book": "Actualizando el libro",

  // V-01 · beneficios
  "Value": "Valor",
  "Benefit": "Beneficio",
  "Benefits promised": "Beneficios prometidos",
  "State a benefit": "Declarar un beneficio",
  "Edit benefit": "Editar beneficio",
  "Remove benefit": "Quitar beneficio",
  "Benefit added": "Beneficio añadido",
  "Benefit updated": "Beneficio actualizado",
  "Benefit removed": "Beneficio quitado",
  "not yet measured": "aún sin medir",
  "measured ": "medido ",
  " of target": " del objetivo",
  "nothing promised yet": "nada prometido todavía",
  "This project has no stated benefit. ": "Este proyecto no tiene ningún beneficio declarado. ",
  "Type": "Tipo",
  "Measure": "Medida",
  "Unit": "Unidad",
  "Baseline": "Línea base",
  "Target": "Objetivo",
  "Measured actual": "Real medido",
  "Benefit owner": "Responsable del beneficio",
  "Realised by": "A realizar antes de",
  "Measured on": "Medido el",
  "How it will be measured": "Cómo se medirá",
  "Where it stands today": "Dónde está hoy",
  "Post-implementation review": "Revisión posimplantación",
  "Record the post-implementation review": "Consignar la revisión posimplantación",
  "Revise verdict": "Revisar el veredicto",
  "Verdict": "Veredicto",
  "Reason": "Motivo",
  "Met": "Cumplido",
  "Partly met": "Parcialmente cumplido",
  "Missed": "No cumplido",
  "Review recorded": "Revisión consignada",
  "Measured": "Medido",
  "Attainment": "Logro",
  "Value position": "Posición de valor",
  "Promising nothing": "Sin promesa",
  "projects with no stated benefit": "proyectos sin beneficio declarado",
  "Value promised": "Valor prometido",

  // V-02 · periodos
  "Close the period": "Cerrar el periodo",
  "Close the reporting period": "Cerrar el periodo de informe",
  "Record of record": "Registro de referencia",
  "Reported period": "Periodo informado",
  "Live — as the book stands now": "En vivo — tal como está el libro ahora",
  "Reported figures — frozen at close, not recalculated": "Cifras informadas — congeladas al cierre, no recalculadas",
  "Period closed": "Periodo cerrado",
  "Restates": "Reformula",
  "Nothing — an ordinary close": "Nada — un cierre ordinario",
  "Note for the record": "Nota para el registro",
  "Closed ": "Cerrado ",
  " by ": " por ",
  " · as at ": " · a fecha ",
  " project(s)": " proyecto(s)",
  " · restates ": " · reformula ",
  " · restatement": " · reformulación",

  // V-03/V-06/V-07 · planta y despliegue
  "Plant & rollout": "Planta y despliegue",
  "Classify": "Clasificar",
  "What does this reach into?": "¿Hasta dónde alcanza esto?",
  "Plant impact": "Impacto en planta",
  "Business systems only": "Solo sistemas de gestión",
  "Touches plant systems": "Toca sistemas de planta",
  "Safety-related": "Relacionado con la seguridad",
  "Touches the plant": "Toca la planta",
  "Release": "Liberar",
  "Revise release": "Revisar la liberación",
  "Release intrusive work": "Liberar trabajo intrusivo",
  "Management-of-change reference": "Referencia de gestión del cambio (MOC)",
  "Management of change released": "Gestión del cambio liberada",
  "Freezes ahead: ": "Congelaciones próximas: ",
  "Sites in this rollout": "Sitios de este despliegue",
  "not a multi-site rollout": "no es un despliegue multisitio",
  " live of ": " en producción de ",
  "Add a site to this rollout": "Añadir un sitio a este despliegue",
  "Edit rollout wave": "Editar la ola de despliegue",
  "Rollout wave updated": "Ola de despliegue actualizada",
  "Site added to the rollout": "Sitio añadido al despliegue",
  "Wave removed": "Ola quitada",
  "Wave": "Ola",
  "Planned": "Planificado",
  "Went live": "Entró en producción",
  "Shutdowns & change freezes": "Paradas y congelaciones de cambios",
  "Declare": "Declarar",
  "Declare a window": "Declarar una ventana",
  "Site calendar": "Calendario del sitio",
  "Change freeze — intrusive work refused": "Congelación de cambios — trabajo intrusivo rechazado",
  "Shutdown — intrusive work welcome": "Parada — trabajo intrusivo bienvenido",
  "intrusive work welcome": "trabajo intrusivo bienvenido",
  "intrusive work refused": "trabajo intrusivo rechazado",
  "What the site calls it": "Cómo lo llama el sitio",
  "Window declared": "Ventana declarada",
  "Window withdrawn": "Ventana retirada",
  "Withdraw": "Retirar",
  "Readiness": "Preparación",
  "Unknown": "Desconocida",
  "Not ready": "No preparado",
  "Preparing": "Preparándose",
  "Ready": "Preparado",
  " ahead": " por delante",
  "none declared": "ninguna declarada",

  // hoja de ruta y demanda
  "Roadmap": "Hoja de ruta",
  "Pipeline": "Cartera de entrada",
  "In flight": "En curso",
  "Landing this quarter": "Aterrizan este trimestre",
  "Plant cutovers ahead": "Basculamientos de planta próximos",
  "Cross-project links": "Vínculos entre proyectos",
  "What waits on what": "Qué espera a qué",
  " cross-project links": " vínculos entre proyectos",
  "waits for": "espera a",
  "Because": "Porque",
  "Requests": "Solicitudes",
  "Raise a request": "Levantar una solicitud",
  "Request raised": "Solicitud levantada",
  "Decide": "Decidir",
  "Decision recorded": "Decisión consignada",
  "Make it a project": "Convertirla en proyecto",
  "The queue": "La cola",
  "Set the envelope": "Fijar la dotación",
  "The capital envelope": "La dotación de capital",
  "Envelope set": "Dotación fijada",
  "Score": "Puntuación",
  "unscored": "sin puntuar",
  "Cost": "Coste",
  "Running total": "Total acumulado",
  "Line": "Línea",
  "above": "encima",

  "below": "debajo",
  "Awaiting a decision": "A la espera de decisión",
  "Approved, not started": "Aprobado, sin empezar",
  "Declined": "Rechazada",
  "Demanded": "Solicitado",
  "Below the line": "Bajo la línea",
  "Strategic fit 1–5": "Encaje estratégico 1–5",
  "Value 1–5": "Valor 1–5",
  "Risk 1–5 (5 = worst)": "Riesgo 1–5 (5 = peor)",
  "Effort 1–5 (5 = hardest)": "Esfuerzo 1–5 (5 = más duro)",
  "Priority set": "Prioridad fijada",
  "Commitments": "Compromisos",
  "Raise a commitment": "Levantar un compromiso",
  "Commitment raised": "Compromiso levantado",
  "Commitment updated": "Compromiso actualizado",
  "Purchase order": "Orden de compra",
  "Supplier": "Proveedor",
  "Amount (M)": "Importe (M)",
  "Currency": "Divisa",
  "Expected": "Esperado",
  "What it buys": "Qué compra",
  "nothing committed": "nada comprometido",
  "Budget": "Presupuesto",
  "Spent": "Gastado",
  "Committed": "Comprometido",
  "Free": "Libre",
  "Currencies": "Divisas",
  "capex": "capex",
  "opex": "opex",
  "Effective capacity": "Capacidad efectiva",
  "Contractors": "Contratistas",

  // estados
  "Approved": "Aprobado",
  "Draft": "Borrador",
  "In review": "En revisión",
  "Superseded": "Sustituido",
  "Cleared": "Levantada",
  "Overdue": "Vencido",
  "At risk": "En riesgo",
  "Pending": "Pendiente",
  "Rejected": "Rechazada",
  "Open": "Abierta",
  "Closed": "Cerrada",
  "In progress": "En curso",
  "Live": "Activa",
  "Held": "Retenida",
  "Cancelled": "Cancelada",
  "Forecast": "Previsto",
  "Realised": "Realizado",
  "Partially realised": "Parcialmente realizado",
  "Withdrawn": "Retirado",
  "Part received": "Recibido en parte",
  "Received": "Recibido",
  "New": "Nueva",
  "Triaged": "Clasificada",
  "Converted": "Convertida",
  "Open items": "Elementos abiertos",
  "Critical": "Crítico",
  "High": "Alto",
  "At steering level": "A nivel de comité de dirección",
  "At PMO level": "A nivel de PMO",
  "Contingency across the book": "Contingencia en todo el libro",
  "Approve": "Aprobar",
  "Submit": "Enviar",
  "New revision": "Nueva revisión",
  "Off — phases can advance with evidence outstanding.":
    "Desactivado — las fases pueden avanzar con evidencias pendientes.",
  " · if time allows": " · si el tiempo lo permite",
  "Phase advance is blocked. ": "El avance de fase está bloqueado. ",
  "Open the evidence list": "Abrir la lista de evidencias",
  "Evidence link": "Enlace de la evidencia",
  "Artefact": "Artefacto",
  "open": "abierto(s)",
  "Net effect of approved changes": "Efecto neto de los cambios aprobados",
  "Effect on ": "Efecto sobre ",
  "Budget now": "Presupuesto actual",
  "If approved": "Si se aprueba",
  "Finish now": "Fin actual",
  "Contingency left": "Contingencia restante",

  // R-02 · rotación y suplencia
  "You are covering for an absent colleague.": "Usted cubre a un colega ausente.",
  "Their authority, their slate — every act is recorded with both names.":
    "Su autoridad, su cartera — cada acto queda registrado con ambos nombres.",
  "Stop covering": "Dejar de cubrir",
  "You are named as deputy": "Usted figura como suplente",
  "Cover for them": "Cubrirle",
  "Covering started": "Suplencia iniciada",
  " until ": " hasta el ",
  "Absences & cover": "Ausencias y suplencias",
  "Declare an absence": "Declarar una ausencia",
  "Rotation & cover": "Rotación y suplencia",
  "Who is away": "Quién está ausente",
  "Who covers": "Quién cubre",
  "Nobody — decisions wait": "Nadie — las decisiones esperan",
  "The deputy acts with the absent person's authority — never more — and the record names both.":
    "El suplente actúa con la autoridad del ausente — nunca más — y el registro nombra a ambos.",
  "Absence declared": "Ausencia declarada",
  "Absence withdrawn": "Ausencia retirada",
  "An absence cannot end before it starts": "Una ausencia no puede terminar antes de empezar",
  "covered by ": "cubierto por ",
  "nobody covers": "nadie cubre",
  "Decisions will wait until they return": "Las decisiones esperarán a su regreso",
  "No absence is declared. A decision owed to somebody on rotation waits in silence — declare the roster and name who covers.":
    "No hay ninguna ausencia declarada. Una decisión debida a alguien en rotación espera en silencio — declare el turno y nombre quién cubre.",
  "rotation": "rotación",
  "leave": "permiso",
  "training": "formación",
  "unavailable": "no disponible",

  // preferencias de notificación
  "Notification preferences": "Preferencias de notificación",
  "Language of my emails": "Idioma de mis correos",
  "Follow the interface": "Seguir la interfaz",
  "Cadence": "Cadencia",
  "As things happen": "Según ocurra",
  "Daily": "Diaria",
  "Weekly": "Semanal",
  "Nothing by email": "Nada por correo",
  "Preferences saved": "Preferencias guardadas",
  "All statuses": "Todos los estados",
  " of ": " de ",
  "On — a project cannot advance a phase until every evidence item for its next gate is approved.":
    "Activado — un proyecto no puede avanzar de fase hasta que cada evidencia de su próxima puerta esté aprobada.",

  // controles comunes
  "Close": "Cerrar",
  "Edit": "Editar",
  "Add": "Añadir",
  "CSV": "CSV",
  "Print": "Imprimir",
  "Copy": "Copiar",
  "Download Markdown": "Descargar Markdown",
  "New project": "Nuevo proyecto",
  "Copy status": "Copiar el estado",
  "Open schedule": "Abrir el cronograma",
  "Open board": "Abrir el tablero",
  "Set status": "Fijar el estado",
  "Re-baseline": "Nueva línea base",
  "Advance phase": "Avanzar de fase",
  "Raise change": "Levantar un cambio",
  "Raise item": "Levantar un elemento",
  "Raise concern": "Levantar una inquietud",
  "Book cost": "Contabilizar coste",
  "Assign person": "Asignar persona",
  "Add document": "Añadir documento",
  "New item": "Nuevo elemento",
  "Export report": "Exportar el informe",
  "Export book": "Exportar el libro",
  "Milestone": "Hito",
  "Stage": "Etapa",
  "Open in portfolio": "Abrir en la cartera",
  "Meeting pack": "Dossier de reunión",
  "Minutes": "Acta",
  "Record a decision": "Consignar una decisión",
  "Record decision": "Consignar la decisión",
  "Close the meeting": "Cerrar la reunión",
  "Attendance": "Asistencia",
  "Refresh from SDP": "Actualizar desde SDP",
  "Link item": "Vincular elemento",

  // cartera
  "Portfolio value": "Valor de la cartera",
  "On track": "En rumbo",
  "Schedule index": "Índice de cronograma",
  "Cost index": "Índice de coste",
  "Forecast variance": "Desviación prevista",
  "Open risks": "Riesgos abiertos",
  "Project register": "Registro de proyectos",
  "Decisions owed": "Decisiones debidas",
  "Next on the calendar": "Próximo en el calendario",
  "Programme mix": "Composición por programa",
  "My open actions": "Mis acciones abiertas",
  "This week": "Esta semana",

  "last 7 days": "últimos 7 días",
  "Project": "Proyecto",
  "Site": "Sitio",
  "people": "personas",
  "Phase": "Fase",
  "Health": "Salud",
  "Progress": "Avance",
  "Finish": "Fin",
  "reported": "informado",
  "No projects match this scope": "Ningún proyecto coincide con este ámbito",
  "Widen the programme, site or health filter in the header.":
    "Amplíe el filtro de programa, sitio o salud en la cabecera.",
  "First run": "Primera puesta en marcha",
  "Set up the portfolio": "Preparar la cartera",
  "Being set up": "En preparación",
  "This portfolio has no projects yet": "Esta cartera aún no tiene proyectos",
  "Add your first site": "Añada su primer sitio",
  "Add a programme": "Añada un programa",
  "Add people": "Añada personas",
  "Create accounts & grants": "Cree cuentas y permisos",
  "Create the first project": "Cree el primer proyecto",
  "Actions you owe": "Acciones que usted debe",
  "Your risks & issues": "Sus riesgos e incidencias",
  "Due in the next fortnight": "Vencen en la próxima quincena",
  "Your projects": "Sus proyectos",
  "This week in your book": "Esta semana en su libro",
  "Nothing on your plate from the meetings register.": "Nada suyo en el registro de reuniones.",
  "No open register items carry your name.": "Ningún elemento abierto del registro lleva su nombre.",
  "Nothing of yours lands in the next two weeks.": "Nada suyo aterriza en las próximas dos semanas.",
  "You manage no open projects.": "Usted no dirige ningún proyecto abierto.",
  "Quiet week — nothing in your scope moved.": "Semana tranquila — nada de su ámbito se movió.",
  "your slate and what lands on it": "su cartera y lo que aterriza en ella",
  "Your projects on site": "Sus proyectos en el sitio",
  "site-governed — yours to run": "gobernados por el sitio — suyos para dirigir",
  "Group programmes here": "Programas de grupo aquí",
  "read-only; concerns are your channel": "solo lectura; las inquietudes son su canal",
  "Your people on group work": "Su gente en trabajo de grupo",
  "Open register": "Registro abierto",
  "Yours to run": "Suyos para dirigir",
  "Landing on your site": "Aterrizando en su sitio",
  "Open risks & issues": "Riesgos e incidencias abiertos",
  "No site-governed projects here yet.": "Aún no hay proyectos gobernados por el sitio.",
  "No group programmes are delivering here right now.": "Ningún programa de grupo entrega aquí ahora mismo.",
  "Register is clear for this site.": "El registro está limpio para este sitio.",
  "group-run": "dirigido por el grupo",
  "Decisions owed on this slate": "Decisiones debidas en esta cartera",
  "Risk posture": "Postura de riesgo",
  "Referred from delivery calls": "Remitidas desde las reuniones de entrega",
  "Decisions requested": "Decisiones solicitadas",
  "Actions carried forward": "Acciones arrastradas",
  "Decisions taken at site and programme level": "Decisiones tomadas a nivel de sitio y de programa",
  "Refer upward": "Remitir hacia arriba",
  "No — this room decides": "No — esta sala decide",
  "Refer to the group steering committee": "Remitir al comité de dirección del grupo",
  "Refer to the programme board": "Remitir al comité de programa",
  "Answers a referral": "Responde a una remisión",
  "None": "Ninguna",
  "This account is read-only.": "Esta cuenta es de solo lectura.",
  "This is a group-governed project. Your site holds read access to it; changes are made at group level.":
    "Este es un proyecto gobernado por el grupo. Su sitio tiene acceso de lectura; los cambios se hacen a nivel de grupo.",
  "That change was not saved.": "Ese cambio no se guardó.",
  " Your entries are kept — fix and try again, or Cancel.":
    " Sus entradas se conservan — corrija y vuelva a intentarlo, o Cancele.",
  "One moment": "Un momento",
  "Another change is still saving — try again in a second":
    "Otro cambio aún se está guardando — inténtelo en un segundo",
  "Could not complete: ": "No se pudo completar: ",
  "That did not go through": "Eso no pasó",
  "Unexpected error": "Error inesperado",

  // fragmentos con datos
  " awaiting a decision": " a la espera de decisión",
  " benefits met": " beneficios cumplidos",
  " demanded against ": " solicitados contra ",
  " measured": " medidos",
  " measured, none ruled on yet": " medidos, ninguno juzgado todavía",
  " of actual effort recorded over the last four weeks, beside the planned FTE below.":
    " de esfuerzo real registrado en las últimas cuatro semanas, junto al FTE planificado abajo.",
  " on ": " el ",
  " on reduced availability": " con disponibilidad reducida",
  " on the critical path": " en la ruta crítica",
  " open order(s)": " orden(es) abierta(s)",
  " open purchase order(s)": " orden(es) de compra abierta(s)",
  " over the envelope": " sobre la dotación",
  " people": " personas",
  " project row(s)": " fila(s) de proyecto",
  " project(s) carry no score, so the queue cannot rank them. They sort last rather than worst.":
    " proyecto(s) sin puntuación: la cola no puede clasificarlos. Se ordenan al final, no como los peores.",
  " project(s) promise nothing": " proyecto(s) no prometen nada",
  " recorded event(s)": " evento(s) registrado(s)",
  " released ": " liberado el ",
  " stages": " etapas",
  " withdrawn": " retirados",
  " · opex ": " · opex ",
  "% of what was promised": "% de lo prometido",
  "A benefit that was promised and then withdrawn is usually better marked Withdrawn than deleted — the register keeps the promise visible.":
    "Un beneficio prometido y luego retirado suele marcarse Retirado antes que borrarse — el registro mantiene visible la promesa.",
  "A cutover, a switch-over, anything a change freeze is about":
    "Un basculamiento, una conmutación, todo aquello de lo que trata una congelación de cambios",
  "A project cannot finish before it starts": "Un proyecto no puede terminar antes de empezar",
  "A window cannot end before it starts": "Una ventana no puede terminar antes de empezar",
  "Actual, not planned": "Real, no planificado",
  "Amount": "Importe",
  "Any day of that week": "Cualquier día de esa semana",
  "Anything above 'business systems only' brings the site's change freezes into force":
    "Todo lo que supere « solo sistemas de gestión » activa las congelaciones de cambios del sitio",
  "As at": "A fecha",
  "As at the date it was raised — the ledger does not revalue its own history":
    "A la fecha en que se levantó — el libro mayor no revalúa su propia historia",
  "August 2026, Q3 FY26, Week 35 — whatever the pack is titled":
    "Agosto 2026, T3 AF26, Semana 35 — como se titule el dossier",
  "Benefits": "Beneficios",
  "Committed money": "Dinero comprometido",
  "Correcting a period already closed? Name it. The original stays on the record.":
    "¿Corrige un periodo ya cerrado? Nómbrelo. El original queda en el registro.",
  "Dataset": "Conjunto de datos",
  "Dataset export": "Exportación del conjunto de datos",
  "Dataset exported": "Conjunto de datos exportado",
  "Days spent": "Días empleados",
  "Decide: ": "Decidir: ",
  "Decision": "Decisión",
  "Detail": "Detalle",
  "Edit ": "Editar ",
  "Edit wave": "Editar la ola",
  "Effort recorded": "Esfuerzo registrado",
  "Envelope (M)": "Dotación (M)",
  "Estimate": "Estimación",
  "Every project you can see is written down as it stands today, at the portfolio's status date. Closed periods cannot be edited or deleted — a correction is a new period that names this one.":
    "Cada proyecto que puede ver queda escrito tal como está hoy, a la fecha de estado de la cartera. Los periodos cerrados no se editan ni se borran — una corrección es un periodo nuevo que nombra a este.",
  "Everything on the record for this project, as at a date":
    "Todo lo registrado de este proyecto, a una fecha",
  "Everything on the record up to this date — leave today's date for current state":
    "Todo lo registrado hasta esta fecha — deje la fecha de hoy para el estado actual",
  "Evidence pack": "Dossier de evidencias",
  "Evidence pack built": "Dossier de evidencias generado",
  "For": "Para",
  "From": "Desde",
  "Gate": "Puerta",
  "Governed at": "Gobernado a nivel",
  "Group": "Grupo",
  "Hand-placed rank": "Rango asignado a mano",
  "In production, availability, cost or compliance terms":
    "En términos de producción, disponibilidad, coste o cumplimiento",
  "Kind": "Tipo",
  "Leave blank to let the score decide. A rank overrules it — for when the room does.":
    "Déjelo en blanco para que decida la puntuación. Un rango la anula — para cuando la sala lo haga.",
  "Leave blank until it has been measured": "Déjelo en blanco hasta que se haya medido",
  "Less detail": "Menos detalle",
  "Management of change ": "Gestión del cambio ",
  "Measured against what the benefits promised": "Medido contra lo que prometían los beneficios",
  "More detail": "Más detalle",
  "No actual effort has been recorded yet — the numbers below are the plan, and only the plan.":
    "Aún no se ha registrado esfuerzo real — las cifras de abajo son el plan, y solo el plan.",
  "No artefact — an approval will be refused": "Sin artefacto — la aprobación será rechazada",
  "No management-of-change release — intrusive work inside a site freeze will be refused":
    "Sin liberación de gestión del cambio — el trabajo intrusivo dentro de una congelación del sitio será rechazado",
  "No period has been closed yet. Everything on this page is computed from the book as it stands right now, which means it will read differently tomorrow. Closing a period writes down what was reported, so it can be produced again.":
    "Aún no se ha cerrado ningún periodo. Todo en esta página se calcula del libro tal como está ahora, es decir, mañana se leerá distinto. Cerrar un periodo escribe lo que se informó, para poder reproducirlo.",
  "No project in your scope waits on another. Links are made on a project's schedule.":
    "Ningún proyecto de su ámbito espera a otro. Los vínculos se crean en el cronograma de un proyecto.",
  "No shutdown or freeze is on the calendar. Until one is, nothing stops a cutover being planned into production hours.":
    "No hay parada ni congelación en el calendario. Hasta que la haya, nada impide planificar un basculamiento en horas de producción.",
  "Note": "Nota",
  "Nothing has been asked for yet.": "Aún no se ha solicitado nada.",
  "Nothing has been asked for yet. A request records what somebody wants and why, before anyone plans it — and a decline keeps its reason where the person who asked can read it.":
    "Aún no se ha solicitado nada. Una solicitud registra qué quiere alguien y por qué, antes de que nadie lo planifique — y un rechazo conserva su motivo donde quien pidió puede leerlo.",
  "Nothing in flight in your scope.": "Nada en curso en su ámbito.",
  "Nothing in flight to rank.": "Nada en curso que clasificar.",
  "Nothing is committed. A purchase order raised is money gone from the envelope months before it becomes a cost line — recording it here is what stops the budget looking healthier than it is.":
    "Nada comprometido. Una orden de compra emitida es dinero salido de la dotación meses antes de volverse una línea de coste — registrarla aquí es lo que impide que el presupuesto parezca más sano de lo que está.",
  "Nothing was in scope for you in that period.": "Nada estaba en su ámbito en ese periodo.",
  "One flat row per project, for the group's own reporting":
    "Una fila plana por proyecto, para los informes propios del grupo",
  "Person": "Persona",
  "Plant availability, cost per ounce, hours lost…":
    "Disponibilidad de planta, coste por onza, horas perdidas…",
  "Plant impact classified": "Impacto en planta clasificado",
  "Prioritisation": "Priorización",
  "Programme": "Programa",
  "Project created from the request": "Proyecto creado desde la solicitud",
  "Project manager": "Jefe de proyecto",
  "Project name": "Nombre del proyecto",
  "Put this meeting in your calendar": "Ponga esta reunión en su calendario",
  "Rate to reporting currency": "Tipo de cambio a la divisa de informe",
  "Re-create this row exactly as its image holds it":
    "Recrear esta fila exactamente como la guarda su imagen",
  "Received means it has become a cost line — it stops counting as committed":
    "Recibido significa que ya es una línea de coste — deja de contar como comprometido",
  "Record effort": "Registrar esfuerzo",
  "Reference": "Referencia",

  "Remove": "Quitar",
  "Remove this benefit?": "¿Quitar este beneficio?",
  "Remove wave": "Quitar la ola",
  "Replaces ": "Sustituye a ",
  "Request": "Solicitud",
  "Required for anything short of Met — the committee has to be able to read it back":
    "Obligatorio para todo lo que no sea Cumplido — el comité debe poder releerlo",
  "Required to decline — the person who asked will read this":
    "Obligatorio para rechazar — la persona que pidió leerá esto",
  "Restore": "Restaurar",
  "Restored from the trail": "Restaurado desde la pista",
  "Risk": "Riesgo",
  "Risks": "Riesgos",
  "Rough cost (M)": "Coste aproximado (M)",
  "Score ": "Puntuación ",
  "Series ICS": "ICS de la serie",
  "Sign in with your work account": "Inicie sesión con su cuenta de trabajo",
  "Sponsor": "Patrocinador",
  "Stage plan": "Plan de etapas",
  "Start": "Inicio",
  "Status": "Estado",
  "Stored against the Monday of the week you pick":
    "Se guarda contra el lunes de la semana que elija",
  "Subscribe to the whole series": "Suscribirse a toda la serie",
  "That period could not be loaded — refresh to try again.":
    "Ese periodo no se pudo cargar — actualice para reintentar.",
  "The MOC this was raised under in the site's own process":
    "El MOC bajo el que se levantó en el proceso propio del sitio",
  "The business person who wants this, not the person building it":
    "La persona de negocio que quiere esto, no quien lo construye",
  "The person accountable for the number, not for the project":
    "La persona responsable de la cifra, no del proyecto",
  "The reporting periods could not be loaded — refresh to try again.":
    "Los periodos de informe no se pudieron cargar — actualice para reintentar.",
  "The request list could not be loaded — refresh to try again.":
    "La lista de solicitudes no se pudo cargar — actualice para reintentar.",
  "The trail is append-only, so a pack built today for a date in the past says exactly what it said then.":
    "La pista es de solo adición: un dossier generado hoy para una fecha pasada dice exactamente lo que decía entonces.",
  "This account is not linked to a person, so nothing is owed to you by name.":
    "Esta cuenta no está vinculada a una persona, así que nada se le debe por su nombre.",
  "This project": "Este proyecto",
  "This project lands at one site. Add a site to track it as a wave-by-wave rollout.":
    "Este proyecto aterriza en un solo sitio. Añada un sitio para seguirlo como despliegue ola a ola.",
  "This records that management of change has released the project's intrusive work. Cutovers may then be dated inside a site freeze, and the release is on the record with your name against it.":
    "Esto consigna que la gestión del cambio ha liberado el trabajo intrusivo del proyecto. Los basculamientos podrán fecharse dentro de una congelación del sitio, y la liberación queda en el registro con su nombre.",
  "This week's movement could not be loaded — refresh to try again.":
    "El movimiento de esta semana no se pudo cargar — actualice para reintentar.",
  "To": "Hasta",
  "Until one is recorded with a baseline, a target and an owner, the portfolio can say this project was run well but not that it was worth doing.":
    "Hasta que se consigne uno con línea base, objetivo y responsable, la cartera puede decir que este proyecto se dirigió bien, pero no que valió la pena.",
  "What is being asked for": "Qué se pide",
  "What the board will call this period": "Cómo llamará el consejo a este periodo",
  "What the business gets": "Qué obtiene el negocio",
  "What the business gets — in its words, not the project's":
    "Qué obtiene el negocio — en sus palabras, no en las del proyecto",
  "What the group has to spend. Zero means none agreed, and nothing falls below the line.":
    "Lo que el grupo puede gastar. Cero significa que no se acordó nada, y nada cae bajo la línea.",
  "Where the piece actually lives. Approval is refused without it, and changing it after approval sends the document back to review.":
    "Dónde vive realmente la pieza. Sin ella la aprobación se rechaza, y cambiarla tras aprobar devuelve el documento a revisión.",
  "Why this close reads as it does — read back months later by people who were not there":
    "Por qué este cierre se lee así — lo releerán meses después personas que no estuvieron",
  "Your actions could not be loaded — refresh to try again.":
    "Sus acciones no se pudieron cargar — actualice para reintentar.",
  "across the horizon": "en el horizonte",
  "across the portfolio": "en toda la cartera",
  "against an envelope of ": "contra una dotación de ",
  "approved envelope": "dotación aprobada",
  "business systems only": "solo sistemas de gestión",
  "capex ": "capex ",
  "could not be loaded": "no se pudo cargar",
  "d late upstream": "d de retraso aguas arriba",
  "dependencies between projects": "dependencias entre proyectos",
  "due ": "vence el ",
  "everything fits": "todo cabe",
  "intrusive work on the horizon": "trabajo intrusivo en el horizonte",
  "live ": "en producción ",
  "no capital envelope agreed": "sin dotación de capital acordada",
  "no envelope agreed": "sin dotación acordada",
  "no people yet": "aún sin personas",
  "none ruled on yet": "ninguno juzgado todavía",
  "nothing booked yet": "nada contabilizado todavía",
  "nothing measured yet": "nada medido todavía",
  "of ": "de ",
  "of target, on measured benefits": "del objetivo, sobre beneficios medidos",
  "or with a Meridian account below": "o con una cuenta Meridian abajo",
  "planned ": "planificado ",
  "raised and not yet decided": "levantadas y aún sin decidir",
  "ready to become projects": "listas para volverse proyectos",
  "ruled on at group level": "juzgados a nivel de grupo",
  "site ": "sitio ",
  "spent and committed exceed the budget": "gastado y comprometido superan el presupuesto",
  "sponsor ": "patrocinador ",
  "uncommitted and unspent": "sin comprometer y sin gastar",
  "what the portfolio promised, and what has been measured":
    "lo que la cartera prometió, y lo que se ha medido",
  "with the reason on the record": "con el motivo en el registro",
  "unsafe link": "enlace no seguro",

  // ayuda
  "How Meridian works": "Cómo funciona Meridian",
  "Keyboard & direct manipulation": "Teclado y manipulación directa",
  "Health (RAG)": "Salud (RAG)",
  "Green/Amber/Red is derived from schedule and cost indices — hover any dot to read WHY. A manual override always carries a written reason.":
    "Verde/Ámbar/Rojo se deriva de los índices de cronograma y coste — pase el cursor sobre cualquier punto para leer POR QUÉ. Una anulación manual siempre lleva un motivo escrito.",
  "Gates": "Puertas",
  "A project advances phase only when the next gate's evidence documents are approved. Overriding a gate is a recorded governance exception.":
    "Un proyecto avanza de fase solo cuando los documentos de evidencia de su próxima puerta están aprobados. Anular una puerta es una excepción de gobernanza registrada.",
  "Your scope": "Su ámbito",
  "You see and edit what your grants name. A group programme delivered at your site is readable, never editable — raise a CONCERN on it instead.":
    "Usted ve y edita lo que nombran sus permisos. Un programa de grupo entregado en su sitio es legible, nunca editable — levante una INQUIETUD en su lugar.",
  "Decisions & referrals": "Decisiones y remisiones",
  "A site meeting refers what is above its authority; the group agenda picks it up automatically and its decision retires the referral.":
    "Una reunión de sitio remite lo que supera su autoridad; el orden del día del grupo lo recoge automáticamente y su decisión retira la remisión.",
  "Prioritisation score": "Puntuación de priorización",
  "Fit, value and risk pull a project up the queue; effort pulls it down. The score only ranks — it never decides. A hand-placed rank overrules it, for when the room does.":
    "El encaje, el valor y el riesgo suben un proyecto en la cola; el esfuerzo lo baja. La puntuación solo ordena — nunca decide. Un rango asignado a mano la anula, para cuando lo haga la sala.",
  "Search everything — projects, people, risks, changes, documents":
    "Buscar en todo — proyectos, personas, riesgos, cambios, documentos",
  "This list": "Esta lista",
  "Close a dialog": "Cerrar un diálogo",
  "Drag a Gantt bar": "Arrastrar una barra del Gantt",
  "Move a stage; drag its edge to change the length":
    "Mover una etapa; arrastre su borde para cambiar la duración",
  "On a Gantt bar, nudge a day; with shift, a week":
    "Sobre una barra del Gantt, desplazar un día; con mayúsculas, una semana",
  "On a board card, move it between columns": "Sobre una tarjeta del tablero, moverla entre columnas",
  "Double-click": "Doble clic",
  "Edit a Gantt stage or a board card": "Editar una etapa del Gantt o una tarjeta del tablero",
  "Need access or a grant changed? Any account marked ADMIN on the sign-in screen's directory can help.":
    "¿Necesita acceso o cambiar un permiso? Cualquier cuenta marcada ADMIN en el directorio de la pantalla de inicio puede ayudar.",
  "Start here — what this account is for": "Empiece aquí — para qué sirve esta cuenta",
  "Reopen the orientation for your role, at any time":
    "Reabrir la orientación de su rol, en cualquier momento",
  "You can reopen this page at any time from Help.":
    "Puede reabrir esta página en cualquier momento desde Ayuda.",
  "Orientation": "Orientación",
  "Health, gates, scope, referrals": "Salud, puertas, ámbito, remisiones",

  // ayudas de campo de administración
  "Administration → Sites": "Administración → Sitios",
  "Administration → Programmes": "Administración → Programas",
  "Administration → Directory": "Administración → Directorio",
  "Administration → Accounts — a group/site account needs a grant to see anything":
    "Administración → Cuentas — una cuenta de grupo/sitio necesita un permiso para ver algo",
  "The New project button appears here once a site and a programme exist":
    "El botón Nuevo proyecto aparece aquí en cuanto existan un sitio y un programa",
  "Links the account to a person so their actions and allocations line up.":
    "Vincula la cuenta a una persona para que sus acciones y asignaciones cuadren.",
  "The account holder should change this at first sign-in.":
    "El titular de la cuenta debería cambiarla en su primer inicio de sesión.",
  "A group or site account with no grants can see nothing. One is required.":
    "Una cuenta de grupo o de sitio sin permisos no puede ver nada. Se requiere uno.",
  "Deactivating ends every live session for this account immediately.":
    "Desactivar termina de inmediato todas las sesiones vivas de esta cuenta.",
  "Free text — this is the directory description, not an access level.":
    "Texto libre — es la descripción del directorio, no un nivel de acceso.",
  "Clearing this marks a leaver. The system checks first for live projects, open actions and open RAID items.":
    "Vaciarlo marca una salida. El sistema comprueba antes proyectos vivos, acciones abiertas y elementos RAID abiertos.",
  "Three letters, e.g. the airport code.": "Tres letras, p. ej. el código de aeropuerto.",
  "A group project is run by the group and is read-only to a site. A site project belongs to its site.":
    "Un proyecto de grupo lo dirige el grupo y es de solo lectura para un sitio. Un proyecto de sitio pertenece a su sitio.",
  "Sets each stage's baseline window to where it sits today. Schedule variance resets to zero.":
    "Fija la ventana de línea base de cada etapa donde está hoy. La desviación de cronograma vuelve a cero.",
  "This is the record steering reads when it asks why the variance disappeared.":
    "Este es el registro que lee el comité cuando pregunta por qué desapareció la desviación.",
  "Taken proportionally from the existing stages, so the shares still sum to 100%.":
    "Tomado proporcionalmente de las etapas existentes, para que las partes sigan sumando el 100%.",
  "Both the original and the reversal stay visible; this is what explains the pair.":
    "El original y la contrapartida quedan visibles; esto es lo que explica el par.",
  "Contingency draws are reported separately from the approved envelope.":
    "Los usos de contingencia se informan aparte de la dotación aprobada.",
  "e.g. −1 High": "p. ej. −1 Alto",
  "A referral headlines the broader room's next agenda until its decision answers it.":
    "Una remisión encabeza el próximo orden del día de la sala superior hasta que su decisión la responda.",
  "Naming the referral retires it from future agendas.":
    "Nombrar la remisión la retira de los próximos órdenes del día.",
  "Scope decides both what the agenda covers and who may run it.":
    "El ámbito decide qué cubre el orden del día y quién puede dirigirlo.",
  "The agenda is divided across its sections in proportion to weight; anything that will not fit is marked “if time allows”.":
    "El orden del día se reparte entre sus secciones en proporción al peso; lo que no quepa se marca « si el tiempo lo permite ».",

  // estados vacíos
  "No programmes granted to this account": "Ningún programa concedido a esta cuenta",
  "No site granted to this account": "Ningún sitio concedido a esta cuenta",
  "No projects in the book": "Ningún proyecto en el libro",
  "Nothing in this scope": "Nada en este ámbito",
  "No projects led here": "Ningún proyecto dirigido aquí",
  "No allocations": "Sin asignaciones",
  "No meeting series in your scope": "Ninguna serie de reuniones en su ámbito",
  "Nothing scheduled yet.": "Nada programado todavía.",
  "Register is clear.": "El registro está limpio.",
  "No accounts match that filter.": "Ninguna cuenta coincide con ese filtro.",
  "The directory is empty.": "El directorio está vacío.",

  // centro de notificación (reglajes)
  "what leaves, how long it is kept, and when it climbs":
    "qué sale, cuánto se conserva, y cuándo escala",
  "Keep notifications for (days)": "Conservar las notificaciones (días)",
  "0 = no retention decided, and the purge declines to run rather than choose for you":
    "0 = ninguna retención decidida, y la purga se abstiene en lugar de elegir por usted",
  "Escalate after (days)": "Escalar después de (días)",
  "an unread message climbs one step instead of being sent again; 0 turns it off":
    "un mensaje no leído sube un escalón en lugar de reenviarse; 0 lo desactiva",
  "Weekly cap per account": "Tope semanal por cuenta",
  "above this, the settings failed — not the reader":
    "por encima de esto, fallaron los ajustes — no el lector",
  "Trusted webhook hosts": "Hosts de webhook de confianza",
  "Closed by default: with none named, nothing is posted outward.":
    "Cerrado por defecto: sin ninguno nombrado, nada se envía fuera.",

  // ayudas pedagógicas de campo
  "Read months later by somebody who was not on the call — say what was decided, not that a call happened.":
    "Lo leerá meses después alguien que no estuvo en la llamada — diga qué se decidió, no que hubo una llamada.",
  "What somebody picking this up would need to know before starting.":
    "Lo que necesitaría saber quien lo retome, antes de empezar.",
  "The one or two lines a reader needs to judge this without asking you.":
    "Las una o dos líneas que un lector necesita para juzgarlo sin preguntarle.",
  "Enough for the person who decides to decide without calling you back.":
    "Lo bastante para que quien decide, decida sin devolverle la llamada.",
  "The person who asked will read this. A refusal without a reason reads as a refusal of them.":
    "La persona que pidió leerá esto. Un rechazo sin motivo se lee como un rechazo a ella.",
  "For whoever reads this queue next week, not for you today.":
    "Para quien lea esta cola la semana que viene, no para usted hoy.",
  "What a reader would need to understand the number beside it.":
    "Lo que un lector necesitaría para entender la cifra de al lado.",
  "Name the source and the unit, so the person who measures it later measures the same thing.":
    "Nombre la fuente y la unidad, para que quien lo mida después mida lo mismo.",
  "The committee reads this back when it asks why the figure moved.":
    "El comité relee esto cuando pregunta por qué se movió la cifra.",
  "One sentence somebody can act on. « Discussed » is not a decision.":
    "Una frase sobre la que alguien pueda actuar. « Se discutió » no es una decisión.",
  "Why, in the room's own words — this is what makes the decision defensible six months from now.":
    "Por qué, en palabras de la sala — esto es lo que hace defendible la decisión dentro de seis meses.",
  "What the owner needs in order to start, without coming back to ask.":
    "Lo que el responsable necesita para empezar, sin volver a preguntar.",
  "The share of the work actually done — every schedule index is computed from this one number.":
    "La parte del trabajo realmente hecha — cada índice de cronograma se calcula de esta única cifra.",
  "What the second project is waiting for, in the words the two teams would use.":
    "Qué espera el segundo proyecto, en las palabras que usarían los dos equipos.",

  "Share of a full week. Above the ceiling, this person shows as over-allocated to their own site lead.":
    "Parte de una semana completa. Por encima del techo, esta persona aparece sobreasignada ante su propio jefe de sitio.",
  "Share of a full week over the whole period, not the effort of one busy day.":
    "Parte de una semana completa sobre todo el periodo, no el esfuerzo de un día cargado.",
  "The stage this work belongs to — it is how the board and the schedule stay the same story.":
    "La etapa a la que pertenece este trabajo — así el tablero y el cronograma cuentan la misma historia.",
  "The name the portfolio will carry. The request stays linked, so the thread from ask to project survives.":
    "El nombre que llevará la cartera. La solicitud queda vinculada, y el hilo de la petición al proyecto sobrevive.",
  "The occurrence rebuilds its agenda from the book when it opens, so a date moved is not an agenda lost.":
    "La sesión reconstruye su orden del día desde el libro al abrirse: una fecha movida no es un orden del día perdido.",
  "The holder is asked to change it at their next sign-in: an admin-set password is one two people know.":
    "Al titular se le pide cambiarla en su próximo inicio de sesión: una contraseña puesta por un administrador la conocen dos personas.",

  // manual y primeros pasos
  "Using Meridian": "Usar Meridian",
  "First steps and answers": "Primeros pasos y respuestas",
  "Using Meridian — first steps and answers": "Usar Meridian — primeros pasos y respuestas",
  "First steps": "Primeros pasos",
  "How do I…": "¿Cómo…",
  "Manual": "Manual",
  "done": "hecho",
  "answers": "respuestas",
  "Show me": "Muéstrame",
  "These tick themselves as the work gets done — nothing here is a box you check by hand.":
    "Estas se marcan solas a medida que el trabajo se hace — nada aquí es una casilla que se marque a mano.",
  "Answers to what people actually ask, in the order they ask them. Each one says where the thing is done.":
    "Respuestas a lo que la gente realmente pregunta, en el orden en que lo pregunta. Cada una dice dónde se hace.",
  "Until you do, the trail cannot say an action was really yours.":
    "Hasta que lo haga, la pista no puede decir que una acción fue realmente suya.",
  "Find your own week": "Encontrar su propia semana",
  "My week gathers what is owed by you, and only by you.":
    "Mi semana reúne lo que usted debe, y solo usted.",
  "Update a stage on one of your projects": "Actualizar una etapa de uno de sus proyectos",
  "Open the project, then Stage plan. The percentage you set is what the indices are computed from.":
    "Abra el proyecto, luego el plan de etapas. El porcentaje que fije es del que se calculan los índices.",
  "Raise a risk or an issue": "Levantar un riesgo o una incidencia",
  "Anything that could cost time or money belongs on the register — before it does.":
    "Todo lo que pueda costar tiempo o dinero pertenece al registro — antes de que lo haga.",
  "Know how to speak about a group project": "Saber cómo hablar de un proyecto de grupo",
  "A group project landing on your site is read-only. Raise a CONCERN on it; your programme office sees it on their agenda.":
    "Un proyecto de grupo que aterriza en su sitio es de solo lectura. Levante una INQUIETUD; su oficina de programa la ve en su orden del día.",
  "Find a decision your site meeting took": "Encontrar una decisión tomada por su reunión de sitio",
  "Meetings keep their minutes. A decision taken is a decision anybody can read back.":
    "Las reuniones conservan sus actas. Una decisión tomada es una decisión que cualquiera puede releer.",
  "Record a week of real effort": "Registrar una semana de esfuerzo real",
  "Four fields, once a week. It sits beside the plan — the gap is the point.":
    "Cuatro campos, una vez por semana. Está junto al plan — la brecha es lo que importa.",
  "Read your programme's slate": "Leer la cartera de su programa",
  "Programmes shows the health of everything you govern, and what is owed to you.":
    "Programas muestra la salud de todo lo que usted gobierna, y lo que se le debe.",
  "Decide a change request somebody else raised": "Decidir una solicitud de cambio levantada por otro",
  "You never decide your own — a second pair of eyes is the control, not a formality.":
    "Usted nunca decide la suya — un segundo par de ojos es el control, no una formalidad.",
  "Approve a gate evidence document": "Aprobar un documento de evidencia de puerta",
  "It must point at a real artefact on a trusted host, and you cannot approve one you own.":
    "Debe apuntar a un artefacto real en un host de confianza, y usted no puede aprobar uno propio.",
  "Close a reporting period": "Cerrar un periodo de informe",
  "Closing freezes what was reported, so the number you quote can be produced again.":
    "Cerrar congela lo informado, para que la cifra que cite pueda reproducirse.",
  "Score the demand queue": "Puntuar la cola de solicitudes",
  "Fit and value pull up; risk and effort pull down. The score ranks — it never decides.":
    "El encaje y el valor suben; el riesgo y el esfuerzo bajan. La puntuación ordena — nunca decide.",
  "Add the sites and programmes": "Añadir los sitios y programas",
  "Everything else hangs off them: a project needs both to exist.":
    "Todo lo demás cuelga de ellos: un proyecto necesita ambos para existir.",
  "Add the people": "Añadir a las personas",
  "An account is linked to a person, so their actions and allocations line up.":
    "Una cuenta se vincula a una persona, para que sus acciones y asignaciones cuadren.",
  "Create the named accounts and their grants": "Crear las cuentas nominativas y sus permisos",
  "A group or site account with no grant sees nothing. And named accounts are what makes segregation of duties real.":
    "Una cuenta de grupo o de sitio sin permiso no ve nada. Y las cuentas nominativas son lo que hace real la segregación de funciones.",
  "Name the trusted document hosts": "Nombrar los hosts de documentos de confianza",
  "Until you do, no gate evidence can be approved — the control is closed, deliberately.":
    "Hasta que lo haga, ninguna evidencia de puerta puede aprobarse — el control está cerrado, deliberadamente.",
  "Decide how long notifications are kept": "Decidir cuánto se conservan las notificaciones",
  "Without a duration nothing is purged: how long a record of who was told what is kept is your decision, not the tool's.":
    "Sin duración nada se purga: cuánto se conserva el registro de a quién se dijo qué es decisión suya, no de la herramienta.",
  "Read the portfolio headline": "Leer el titular de la cartera",
  "One line per project: health, gate, money, and why the colour is what it is.":
    "Una línea por proyecto: salud, puerta, dinero, y por qué el color es el que es.",
  "Read a published period": "Leer un periodo publicado",
  "A closed period is frozen: it reads today exactly as it read then.":
    "Un periodo cerrado está congelado: hoy se lee exactamente como se leyó entonces.",
  "Understand where a number comes from": "Entender de dónde sale una cifra",
  "Hover any health dot: it says why. Nothing in Meridian asks to be taken on trust.":
    "Pase el cursor sobre cualquier punto de salud: dice por qué. Nada en Meridian pide fe.",
  "Getting started": "Empezar",
  "Keeping a project honest": "Mantener un proyecto honesto",
  "Gates and evidence": "Puertas y evidencias",
  "Meetings and decisions": "Reuniones y decisiones",
  "Your week, your absences": "Su semana, sus ausencias",
  "How do I sign in for the first time?": "¿Cómo inicio sesión por primera vez?",
  "Use the address and the temporary password you were given. Meridian will ask you to choose your own before it lets you record anything: until you do, the trail cannot say an action was really yours.":
    "Use la dirección y la contraseña temporal que le dieron. Meridian le pedirá elegir la suya antes de dejarle registrar nada: hasta entonces, la pista no puede decir que una acción fue realmente suya.",
  "Where do I find what is owed by me?": "¿Dónde encuentro lo que debo?",
  "My week. It gathers the actions, the risks and the decisions that carry your name — and nothing that carries somebody else's.":
    "Mi semana. Reúne las acciones, los riesgos y las decisiones que llevan su nombre — y nada que lleve el de otro.",
  "Why can I see a project but not change it?": "¿Por qué puedo ver un proyecto pero no cambiarlo?",
  "Your grants name what you may write. A group programme delivered at your site is readable, never editable — that is deliberate. Raise a concern on it instead, and your programme office sees it on their agenda.":
    "Sus permisos nombran lo que puede escribir. Un programa de grupo entregado en su sitio es legible, nunca editable — es deliberado. Levante una inquietud, y su oficina de programa la verá en su orden del día.",
  "How do I update progress?": "¿Cómo actualizo el avance?",
  "Open the project, then Stage plan, and set the percentage complete on the stage. Every index — schedule, cost, forecast — is computed from that number, so it is the one thing worth keeping true.":
    "Abra el proyecto, luego el plan de etapas, y fije el porcentaje completado de la etapa. Cada índice — cronograma, coste, previsión — se calcula de esa cifra: es lo único que vale la pena mantener verdadero.",
  "What does the colour mean?": "¿Qué significa el color?",
  "Green, amber and red are derived from the schedule and cost indices. Hover the dot and it tells you why. If you disagree, override it — but an override always carries a written reason, because the committee reads it back.":
    "Verde, ámbar y rojo se derivan de los índices de cronograma y coste. Pase el cursor y le dice por qué. Si no está de acuerdo, anúlelo — pero una anulación siempre lleva un motivo escrito, porque el comité lo relee.",
  "How do I raise a risk or an issue?": "¿Cómo levanto un riesgo o una incidencia?",
  "Risks & issues, then the button. Probability times impact decides who hears about it: high enough and it appears on the steering agenda by itself.":
    "Riesgos e incidencias, luego el botón. Probabilidad por impacto decide quién se entera: bastante alto, y aparece solo en el orden del día del comité.",
  "Something changed the cost or the dates. What do I do?":
    "Algo cambió el coste o las fechas. ¿Qué hago?",
  "Raise a change request. Above the threshold it goes to your programme office; below it, a colleague decides. You never decide your own — that is the control, not a formality.":
    "Levante una solicitud de cambio. Por encima del umbral va a su oficina de programa; por debajo, decide un colega. Usted nunca decide la suya — ese es el control, no una formalidad.",
  "Why will the gate not let my project advance?": "¿Por qué la puerta no deja avanzar mi proyecto?",
  "A gate needs its evidence documents approved. A document is approved evidence only when it points at a real artefact on a trusted host — a document with no link is a label, and Meridian refuses to count it.":
    "Una puerta necesita sus documentos de evidencia aprobados. Un documento es evidencia aprobada solo cuando apunta a un artefacto real en un host de confianza — un documento sin enlace es una etiqueta, y Meridian se niega a contarlo.",
  "Why can I not approve my own document?": "¿Por qué no puedo aprobar mi propio documento?",
  "Whoever owns a piece of evidence never approves it. Hand it to a colleague or to your programme office: an approval means somebody else looked.":
    "Quien posee una evidencia nunca la aprueba. Entréguela a un colega o a su oficina de programa: una aprobación significa que otro miró.",
  "The link in an approved document is dead. What happens?":
    "El enlace de un documento aprobado está muerto. ¿Qué pasa?",
  "Meridian checks periodically and shows it in the library — but it never withdraws the approval on its own. Somebody who knows where the piece lives confirms it. A dropped link is not a governance decision.":
    "Meridian lo comprueba periódicamente y lo muestra en la biblioteca — pero nunca retira la aprobación por sí solo. Alguien que sabe dónde vive la pieza lo confirma. Un enlace caído no es una decisión de gobernanza.",
  "How do I run a meeting?": "¿Cómo dirijo una reunión?",
  "Open the occurrence: the agenda is already built from the book. Open it, record decisions and actions as you go, then close it. Closing freezes the pack, so what was discussed can be produced again.":
    "Abra la sesión: el orden del día ya está construido desde el libro. Ábrala, consigne decisiones y acciones sobre la marcha, y ciérrela. Cerrar congela el dossier: lo discutido puede reproducirse.",
  "Something is above my authority. How do I escalate?":
    "Algo supera mi autoridad. ¿Cómo lo escalo?",
  "Refer it from the meeting. The broader room picks it up on their next agenda automatically, and their decision retires the referral — you do not chase it.":
    "Remítalo desde la reunión. La sala superior lo recoge automáticamente en su próximo orden del día, y su decisión retira la remisión — usted no la persigue.",
  "Where do I find a decision taken months ago?": "¿Dónde encuentro una decisión de hace meses?",
  "Meetings & decisions keeps every minute. The trail is append-only, so a decision reads today exactly as it read then.":
    "Reuniones y decisiones conserva cada acta. La pista es de solo adición: una decisión se lee hoy exactamente como entonces.",
  "How do I record real effort?": "¿Cómo registro el esfuerzo real?",
  "Resources, then Record effort. Four fields, once a week. It sits beside the plan rather than inside it — the gap between the two is the point.":
    "Recursos, luego Registrar esfuerzo. Cuatro campos, una vez por semana. Está junto al plan, no dentro — la brecha entre ambos es lo que importa.",
  "I am going on rotation. Who covers me?": "Me voy de rotación. ¿Quién me cubre?",
  "Declare the absence on My site and name a deputy. They take your authority for that period — never more than yours — and the trail names you both. When you come back, your digest widens to cover the days you missed.":
    "Declare la ausencia en Mi sitio y nombre un suplente. Tomará su autoridad durante ese periodo — nunca más que la suya — y la pista los nombra a ambos. A su regreso, su resumen se amplía para cubrir los días perdidos.",
  "How do I stop being told things at night?": "¿Cómo dejo de recibir avisos de noche?",
  "Notification preferences, next to your name. Choose the cadence and the quiet hours; urgent messages still come through, because a silence you cannot pierce is a silence people switch off.":
    "Preferencias de notificación, junto a su nombre. Elija la cadencia y las horas de silencio; lo urgente sigue pasando, porque un silencio imposible de romper es un silencio que la gente apaga.",
  "Stuck? Ask ": "¿Atascado? Pregunte a ",
  ", the Meridian referent for ": ", referente Meridian de ",
  " — before the group, because they are on your site and know your work.":
    " — antes que al grupo, porque está en su sitio y conoce su trabajo.",
  "No referent is named for your site yet. An administrator can name one in Administration → Sites — and until they do, questions go to the group, which is slower.":
    "Aún no hay referente nombrado para su sitio. Un administrador puede nombrarlo en Administración → Sitios — y hasta entonces, las preguntas van al grupo, que es más lento.",
  "Training ground": "Terreno de práctica",
  "Nothing here touches the real book. Break things on purpose — that is what it is for.":
    "Nada aquí toca el libro real. Rompa cosas a propósito — para eso está.",

  // conducción de sesión
  "Closed. The pack is frozen: it reads today exactly as it read in the room, and it can be produced again.":
    "Cerrada. El dossier está congelado: se lee hoy exactamente como en la sala, y puede reproducirse.",
  "In session. Record each decision as it is taken and each action with an owner and a date. Refer anything above this room's authority — the broader agenda picks it up by itself. Close the meeting when you are done: closing is what freezes the record.":
    "En sesión. Consigne cada decisión al tomarse y cada acción con responsable y fecha. Remita lo que supere la autoridad de esta sala — el orden del día superior lo recoge solo. Cierre la reunión al terminar: cerrar es lo que congela el registro.",
  "Scheduled. The agenda below is built from the book as it stands now, and rebuilds when you open the meeting. Open it when the room is ready.":
    "Programada. El orden del día de abajo se construye del libro tal como está, y se reconstruye al abrir la reunión. Ábrala cuando la sala esté lista.",

  // adopción
  "Adoption": "Adopción",
  "How the tool is used": "Cómo se usa la herramienta",
  "Measuring…": "Midiendo…",
  "Reading how the tool is actually used, site by site.":
    "Leyendo cómo se usa realmente la herramienta, sitio por sitio.",
  "Sites measured": "Sitios medidos",
  "over the last ": "en los últimos ",
  " days": " días",
  "Sites gone quiet": "Sitios en silencio",
  "every site has updated something": "todos los sitios han actualizado algo",
  "Refusals per active user": "Rechazos por usuario activo",
  "how often people meet a wall": "cuántas veces la gente choca con un muro",
  "Adoption by site": "Adopción por sitio",
  "Six numbers, as at ": "Seis cifras, a fecha ",
  ". A site silent for ": ". Un sitio en silencio durante ",
  " days is named — nothing else in Meridian would say it.":
    " días es nombrado — nada más en Meridian lo diría.",
  "Accounts seen": "Cuentas vistas",
  "Last progress": "Último avance",
  "never": "nunca",
  "d ago": "d atrás",
  "Meetings held": "Reuniones celebradas",
  "Actions closed": "Acciones cerradas",
  "Weeks entered": "Semanas registradas",
  "No sites in the book yet.": "Aún no hay sitios en el libro.",
  "These are counts by site, never by person. Refusals are counted for the whole portfolio because a refusal happens on a resource OUTSIDE somebody's scope — charging it to that resource's site would say the opposite of what it means.":
    "Son recuentos por sitio, nunca por persona. Los rechazos se cuentan para toda la cartera porque un rechazo ocurre sobre un recurso FUERA del ámbito de alguien — cargarlo al sitio de ese recurso diría lo contrario de lo que significa.",

  // sonda de evidencias y modo sin conexión
  "The last check did not reach this link. The approval is untouched.":
    "La última comprobación no alcanzó este enlace. La aprobación queda intacta.",
  "The check was refused access — the piece may well be there.":
    "A la comprobación se le negó el acceso — la pieza bien puede estar ahí.",
  "Answered at the last check: ": "Respondió en la última comprobación: ",
  "Offline — showing what was last loaded": "Sin conexión — mostrando lo último cargado",
  "as at ": "a fecha ",
  "nothing can be recorded until the link is back":
    "nada puede registrarse hasta que vuelva la conexión",
  "Try again": "Reintentar",

  // centro de notificación
  "Notifications": "Notificaciones",
  "Notification centre": "Centro de notificaciones",
  "What is waiting for you": "Qué le espera",
  "Unread": "Sin leer",
  "addressed to you": "dirigidas a usted",
  "Needs attention": "Requiere atención",
  "attention or urgent": "atención o urgente",
  "In the box": "En el buzón",
  "kept for the retention period": "conservadas durante el periodo de retención",
  "Mark all read": "Marcar todo como leído",
  "Show what I have already read": "Mostrar lo ya leído",
  "Nothing unread — this is what a quiet week looks like.":
    "Nada sin leer — así se ve una semana tranquila.",
  "Nothing here": "Nada aquí",
  "Messages arrive when something is due, blocked, or owed to you. Your subscriptions decide what also reaches you by email.":
    "Los mensajes llegan cuando algo vence, se bloquea o se le debe. Sus suscripciones deciden qué le llega además por correo.",
  "not sent yet": "aún sin enviar",
  "on behalf of ": "en nombre de ",
  "new": "nuevas",
  "info": "info",
  "attention": "atención",
  "urgent": "urgente",

  // priorización
  "Fit": "Encaje",
  "Effort": "Esfuerzo",
  "Risk and effort pull the score down": "El riesgo y el esfuerzo BAJAN la puntuación",
  "Four notes are needed — fit, value, risk and effort. An unscored project sorts last, not worst.":
    "Se necesitan cuatro notas — encaje, valor, riesgo y esfuerzo. Un proyecto sin puntuar se ordena al final, no como el peor.",
};

/* ── fragments composés autour de nombres vivants (R-15) ────────────── */
/* Miroir de FRAG (i18n.js) — même liste, même ordre. L'ordre est une
   partie du contrat : le motif précis passe avant le mot générique
   (« N evidence items outstanding for » avant « outstanding »), sinon le
   générique mange la phrase. Le tour au navigateur (I18N-02) a trouvé
   « above the escalation threshold » traduit en FR et pas en ES : ce
   miroir était partiel. Il est désormais tenu complet par la porte F5. */
export const ES_FRAG = [
  [/\bbehind the plan\b/g, "con retraso sobre el plan"],
  [/\bahead of plan\b/g, "adelantado sobre el plan"],
  [/\bspending faster than earning\b/g, "gasta más rápido de lo que gana valor"],
  [/\bover the spend rate\b/g, "por encima del ritmo de gasto"],
  [/\bunder the spend rate\b/g, "por debajo del ritmo de gasto"],
  [/\binside the envelope\b/g, "dentro de la dotación"],
  [/\bagainst budget\b/g, "contra el presupuesto"],
  [/\bagainst\b/g, "contra"],
  [/\bapproved envelope\b/g, "dotación aprobada"],
  [/\bapproved\b/g, "aprobado"],
  [/(\d+) funded projects?\b/g, "$1 proyecto(s) financiado(s)"],
  [/\bfunded\b/g, "financiado(s)"],
  [/\bstrategy\b/g, "estrategia"],
  [/\bopen items?\b/g, "elemento(s) abierto(s)"],
  [/\bhighest exposure\b/g, "exposición máxima"],
  [/\bno data\b/g, "sin datos"],
  [/(\d+) evidence items? outstanding for\b/g, "$1 evidencia(s) pendiente(s) para"],
  [/\boutstanding\b/g, "pendiente(s)"],
  [/\bawaiting a decision\b/g, "a la espera de decisión"],
  [/\bawaiting\b/g, "a la espera de"],
  [/\bof target\b/g, "del objetivo"],
  [/\bnot yet measured\b/g, "aún sin medir"],
  [/\bacross the portfolio\b/g, "en el conjunto de la cartera"],
  [/\bacross the horizon\b/g, "en el horizonte"],
  [/\bacross the\b/g, "en"],
  [/\bwas due\b/g, "se esperaba el"],
  [/\bdue\b/g, "esperado"],
  [/\boverdue\b/gi, "atrasado"],
  [/\(in (\d+) days?\)/g, "(en $1 días)"],
  [/\((\d+) days? ago\)/g, "(hace $1 días)"],
  [/(\d+)d late\b/g, "$1 d de retraso"],
  [/\bforecast finish\b/g, "fin previsto"],
  [/\bevidence\b/g, "evidencias"],
  [/\bprojects? below the red (SPI|CPI) line\b/g, "proyecto(s) bajo la línea roja $1"],
  [/\bat steering level\b/g, "a nivel del comité de dirección"],
  [/\babove the escalation threshold\b/g, "por encima del umbral de escalado"],
  [/\bpeople\b/g, "personas"],
  [/\bprojects\b/g, "proyectos"],
  [/(\d+) of (\d+) evidence items? approved\b/g, "$1 de $2 evidencia(s) aprobada(s)"],
  [/(\d+) of (\d+) evidence items?\b/g, "$1 de $2 evidencia(s)"],
  [/\bacross the whole book\b/g, "en toda la cartera"],
  [/\bacross the book\b/g, "en toda la cartera"],
  [/\bchange requests? awaiting a decision\b/g, "solicitud(es) de cambio a la espera de decisión"],
  [/\brisks and issues in scope\b/g, "riesgos e incidencias del ámbito"],
  [/\bin scope\b/g, "en el ámbito"],
  [/\bshown\b/g, "mostrado(s)"],
  [/\bopen\b/g, "abierto(s)"],
];

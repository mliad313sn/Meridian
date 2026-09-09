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
  "Some business cases state no expected cost, so their spend is in no comparison either":
    "Algunos casos de negocio no declaran coste previsto, así que su gasto tampoco entra en ninguna comparación",
  "benefit-review": "revisión de beneficio",
  "No period is closed at today's status date, so there is nothing to store this page against. Close the reporting period first — these figures are read from the book as it stands today, and a period closed on another day would carry them under a date on which they were not true.":
    "Ningún periodo está cerrado a la fecha de estado de hoy, así que no hay sobre qué depositar esta página. Cierre primero el periodo de informe — estas cifras se leen del libro tal como está hoy, y un periodo cerrado otro día las llevaría bajo una fecha en la que no eran ciertas.",
  /* ── REQ-30 · la página de valor (RT365 V-11). Frases que llegan a la
     pantalla por una VARIABLE, invisibles para la puerta F5 (ver FR). */
  "What it was worth": "Lo que valió",
  "Spend against the case, benefits by status, reviews overdue, exposure, gates due and exceptions open — read from the book, nothing typed.": "El gasto frente al caso, los beneficios por estado, las revisiones vencidas, la exposición, las puertas próximas y las excepciones abiertas — leídos del libro, nada tecleado.",
  "Spend against case": "Gasto frente al caso",
  "Benefits by status": "Beneficios por estado",
  "Benefit reviews overdue": "Revisiones de beneficio vencidas",
  "Top risk exposure": "Exposición más alta",
  "Gates due": "Puertas próximas",
  "Exceptions open": "Excepciones abiertas",
  "No project is in scope for this reader": "Ningún proyecto en el alcance de este lector",
  "No project in scope carries a business case — there is nothing to set the spend against": "Ningún proyecto del alcance tiene caso de negocio — no hay nada con que comparar el gasto",
  "The business cases in scope state no expected cost, so spend cannot be compared with one": "Los casos de negocio del alcance no declaran coste previsto: el gasto no se puede comparar",
  "No project in scope has stated a benefit — there is nothing to report by status": "Ningún proyecto del alcance ha declarado un beneficio — no hay nada que repartir por estado",
  "No benefit carries the date it was to be realised — nothing can be overdue, which is not the same as nothing being late": "Ningún beneficio lleva la fecha en que debía realizarse — nada puede estar vencido, que no es lo mismo que nada esté vencido",
  "No risk is open in this scope — there is no exposure to rank": "Ningún riesgo abierto en este alcance — no hay exposición que ordenar",
  "No gate in scope carries a committed date — a placeholder is a position on a timeline, not a commitment": "Ninguna puerta del alcance lleva fecha comprometida — una fecha provisional es una posición, no un compromiso",
  "No project in scope carries a tolerance, so no exception can be raised — an empty exception register here is not a clean one": "Ningún proyecto del alcance lleva tolerancia, así que no puede levantarse ninguna excepción — un registro vacío aquí no es un registro limpio",
  "No cost line has been booked against those cases — the spend is nil, not unmeasured": "No se ha registrado ningún apunte contra esos casos — el gasto es nulo, no sin medir",
  "None of the dated benefit reviews is past due": "Ninguna de las revisiones con fecha está vencida",
  "No committed gate falls inside the horizon": "Ninguna puerta comprometida cae dentro del horizonte",
  "No exception is open against the tolerances that are set": "Ninguna excepción abierta contra las tolerancias fijadas",
  "Some benefits carry no measurement yet": "Algunos beneficios aún no llevan medición",
  "Some projects in scope carry no business case and are not in this comparison": "Algunos proyectos del alcance no tienen caso de negocio y no entran en esta comparación",
  "Issues are open too, and are counted apart from risks": "También hay problemas abiertos, contados aparte de los riesgos",
  "Gates dated with a placeholder are excluded — a placeholder is not a commitment": "Las puertas con fecha provisional quedan excluidas — una fecha provisional no es un compromiso",
  " · Value report · as at ": " · Informe de valor · a ",
  "Print this page": "Imprimir esta página",
  "Store this page": "Depositar esta página",
  "Store this value page": "Depositar esta página de valor",
  "Which page": "Qué página",
  "Stored figures — written down when the page was stored, not recalculated. ": "Cifras depositadas — escritas al depositar la página, no recalculadas. ",
  "Stored ": "Depositada el ",
  " · scope: ": " · alcance: ",
  "That stored page could not be loaded — refresh to try again.": "Esa página depositada no se pudo cargar — actualice para reintentar.",
  "As at ": "A ",
  " · every project you can see: ": " · todos los proyectos que usted ve: ",
  " project(s), of which ": " proyecto(s), de los cuales ",
  " closed": " cerrados",
  " · this page ignores the scope filter above, because the page that is stored is this one.": " · esta página ignora el filtro de alcance de arriba, porque la página que se deposita es esta.",
  "measured": "medida",
  "The project-by-project table is computed from the book as it stands and is not part of what was stored, so it is not shown beside stored figures. Switch to the live page to read it.": "La tabla proyecto por proyecto se calcula sobre el libro tal como está y no forma parte de lo depositado, así que no se muestra junto a cifras depositadas. Vuelva a la página viva para leerla.",
  "Project by project": "Proyecto por proyecto",
  "Top exposure": "Exposición más alta",
  "Next gate": "Próxima puerta",
  "No project in scope": "Ningún proyecto en el alcance",
  "Nothing is in your scope to report on.": "No hay nada en su alcance sobre lo que informar.",
  "Generated from the book — no figure on this page was typed. ": "Generada desde el libro — ninguna cifra de esta página se tecleó. ",
  "Stored against ": "Depositada sobre ",
  " and readable unchanged for as long as the record lasts.": " y legible sin cambios mientras dure el registro.",
  "Nothing here is on the record until this page is stored against a closed reporting period.": "Nada de esto queda registrado hasta que la página se deposite sobre un periodo cerrado.",
  "Case cost": "Coste del caso",
  "Booked": "Registrado en el libro",
  "Left against the case": "Queda frente al caso",
  "Case benefit / yr": "Beneficio del caso / año",
  "Spent outside any case": "Gastado fuera de todo caso",
  "Variance": "Desviación",
  "Case standing": "Vigencia del caso",
  "Partly": "Parcialmente",
  "Ruled on": "Resueltos",
  "project(s)": "proyecto(s)",
  "Dated reviews": "Revisiones con fecha",
  "Undated promises": "Promesas sin fecha",
  "Longest overdue": "Mayor retraso",
  "Was due": "Vencía",
  "Open issues": "Problemas abiertos",
  "portfolio-wide": "de toda la cartera",
  "Exposure": "Exposición",
  "Band": "Banda",
  "Escalates to": "Escala a",
  "Inside the horizon": "Dentro del horizonte",
  "Already past": "Ya vencidas",
  "Dated with a placeholder": "Con fecha provisional",
  "Due": "Vence",
  "In": "En",
  "d late": "d de retraso",
  "State": "Estado",
  "Outstanding": "Pendiente",
  " evidence": " evidencia(s)",
  " criteria": " criterio(s)",
  "Projects with a tolerance": "Proyectos con tolerancia",
  "Oldest open": "La más antigua abierta",
  "Schedule / cost / benefit": "Plazo / coste / beneficio",
  "Open for": "Abierta desde hace",
  "Reporting period": "Periodo de informe",
  "No period is closed at today's status date": "Ningún periodo cerrado a la fecha de estado de hoy",
  "No period is closed at today's status date.": "Ningún periodo cerrado a la fecha de estado de hoy.",
  "Close the period first (the button above), then store the page against it.": "Cierre primero el periodo (el botón de arriba) y deposite después la página sobre él.",
  "Why this page reads as it does — read back months later by people who were not there": "Por qué esta página se lee así — releída meses después por quienes no estaban",
  "The six figures are written down exactly as they read now — including the ones that are not measured, which are stored as absences with their reason and never as zeros. A stored page cannot be edited or deleted: a correction is a new period that restates this one, with its own page.": "Las seis cifras se escriben exactamente como se leen ahora — incluidas las que no están medidas, que se depositan como ausencias con su razón y nunca como ceros. Una página depositada no se puede editar ni borrar: una corrección es un periodo nuevo que rectifica este, con su propia página.",
  "Nothing to store": "Nada que depositar",
  "Value page stored": "Página de valor depositada",
  "Low": "Bajo",
  "Medium": "Medio",
  "Steering": "Comité de dirección",
  "PMO": "Oficina de proyectos",
  "schedule": "plazo",
  "cost": "coste",
  "benefit": "beneficio",
  // ── REQ-27 · un proyecto pasa a la escala de su programa
  "Move onto the programme's ladder": "Pasar a la escala del programa",
  "See what this would do": "Ver qué haría esto",
  "Adopted — kept with its date, its acceptance and its evidence": "Adoptado: conservado con su fecha, su aceptación y sus pruebas",
  "Created — this rung is not on the project yet": "Creado: este peldaño aún no está en el proyecto",
  "Retired — it leaves the ladder and keeps everything it carries": "Retirado: sale de la escala y conserva todo lo que lleva",
  "Nothing is deleted. A retired gate becomes an ordinary milestone and keeps its date, its acceptance and its filed evidence.": "No se elimina nada. Un hito retirado vuelve a ser un hito ordinario y conserva su fecha, su aceptación y sus pruebas presentadas.",
  "I have read what leaves the ladder": "He leído lo que sale de la escala",
  "Move this project onto the ladder": "Pasar este proyecto a la escala",
  "This project is already on its programme's ladder — there is nothing to move.": "Este proyecto ya está en la escala de su programa: no hay nada que mover.",
  "Scaffolded on this many gates": "Hitos al crear",
  "Declared by the programme": "Declarados por el programa",
  "These milestones already exist and simply take their place on the ladder.": "Estos hitos ya existen y simplemente ocupan su lugar en la escala.",
  "Scaffolded exactly as it would have been at birth: its draft evidence and the criteria the ladder declares.": "Creado exactamente como lo habría sido al nacer: su prueba en borrador y los criterios que declara la escala.",
  "marked done": "marcado como hecho",
  "accepted by a named person": "aceptado por una persona nombrada",
  "acceptance criteria posed": "criterios de aceptación planteados",
  "filed evidence citation(s)": "prueba(s) presentada(s)",
  "criterion(s) found met by a named reviewer": "criterio(s) cumplido(s) por un revisor nombrado",
  "adopted": "adoptados",
  "created": "creados",
  "retired": "retirados",
  "No period in this window carries a value \u2014 there is nothing to trend": "Ning\u00fan per\u00edodo de esta ventana lleva un valor \u2014 no hay nada que poner en tendencia",
  // ── REQ-28 · las cinco señales de gobernanza, y por qué alguna no se mide
  "Governance signals": "Señales de gobernanza",
  "Not measured": "No medido",
  "Decision latency": "Latencia de decisión",
  "Action ageing": "Antigüedad de las acciones",
  "Gate cycle time": "Tiempo entre puertas",
  "RAID review compliance": "Cumplimiento de revisiones del registro",
  "Exception age": "Antigüedad de las excepciones",
  "No decision carries both the day it was taken and the day it was recorded": "Ninguna decisión lleva a la vez el día en que se tomó y el día en que el registro lo supo",
  "No action is open — there is no ageing to measure": "No hay ninguna acción abierta — no hay antigüedad que medir",
  "No gate has been closed — there is no cycle time": "No se ha cerrado ninguna puerta — no hay tiempo de ciclo",
  "Gates were closed without a recorded acceptance date": "Se cerraron puertas sin fecha de aceptación registrada",
  "These projects were scaffolded under a gate ladder we cannot name": "Estos proyectos se crearon bajo una escalera de puertas que no sabemos nombrar",
  "These cycle times come from ladders of different lengths and are not comparable": "Estos tiempos provienen de escaleras de distinta longitud y no son comparables",
  "No RAID item is open": "No hay ninguna línea de registro abierta",
  "No open RAID item carries a review date": "Ninguna línea abierta lleva fecha de revisión",
  "No exception is open — there is no age to measure": "No hay ninguna excepción abierta — no hay antigüedad que medir",
  "One period only — a trend needs at least two": "Un solo período — una tendencia necesita al menos dos",
  "The register records the next review date, not that a review happened — there is no history": "El registro anota la próxima fecha de revisión, no que una revisión ocurriera — no hay historial",
  "Some actions were closed without a date, so the register cannot be replayed": "Algunas acciones se cerraron sin fecha: el registro no puede reproducirse",
  "Some exceptions were answered without a date, so the register cannot be replayed": "Algunas excepciones se respondieron sin fecha: el registro no puede reproducirse",
  "Some decisions are proposed and not ratified, and no ratification date is recorded": "Hay decisiones propuestas y no ratificadas, y no se registra fecha de ratificación",
  "Reading the clocks the book already keeps…": "Leyendo los relojes que el libro ya lleva…",
  "since the previous period: ": "desde el período anterior: ",
  "Five clocks the book already keeps, as at ": "Cinco relojes que el libro ya lleva, al ",
  ", over ": ", sobre ",
  " months. Nothing here asks anyone to type anything.": " meses. Nada aquí pide a nadie escribir nada.",
  "No programme has measured any of the five yet — the reasons are on the tiles above.": "Ningún programa ha medido aún ninguna de las cinco — las razones están en las fichas de arriba.",
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
  "Is it still worth doing?": "¿Sigue mereciendo la pena?",
  "At which gate": "En qué hito",
  "The verdict": "El veredicto",
  "Continue \u2014 it still holds": "Continuar — sigue vigente",
  "Continue, with conditions": "Continuar, con condiciones",
  "Stop \u2014 it is no longer worth doing": "Parar — ya no merece la pena",
  "Stop is not decoration: the next gate is refused until somebody says otherwise.": "«Parar» no es decorativo: el siguiente hito se rechaza hasta que alguien diga lo contrario.",
  "Who reconfirmed it": "Quién lo reconfirmó",
  "The case is reconfirmed by whoever pays for it, named \u2014 not by whoever typed.": "El caso lo reconfirma quien paga, con nombre — no quien lo teclea.",
  "What changed since the last one": "Qué ha cambiado desde la anterior",
  "Read at the next gate beside the two figures: this is what makes the act useful rather than ritual.": "Se lee en el siguiente hito junto a las dos cifras: es lo que hace el acto útil en vez de ritual.",
  "Record the reconfirmation": "Registrar la reconfirmación",
  "A gate cannot be passed until the case has been reconfirmed at that gate: passing a gate is the decision to carry on spending.": "Un hito no se supera hasta que el caso se haya reconfirmado en ese hito: superar un hito es la decisión de seguir gastando.",
  " \u2014 already reconfirmed": " — ya reconfirmado",
  "Reconfirmed at": "Reconfirmado en",
  "Not reconfirmed at any gate yet \u2014 the next gate will ask for it.": "Aún no reconfirmado en ningún hito — el siguiente hito lo pedirá.",
  "Gate ": "Hito ",
  " at gate ": " en el hito ",
  "cost ": "coste ",
  "benefit ": "beneficio ",
  "Benefits due to be measured": "Beneficios pendientes de medir",
  "This project is on a ladder its programme no longer declares.": "Este proyecto sigue una escala que su programa ya no declara.",
  "It was set up with ": "Se creó con ",
  " gates; the programme now declares ": " hitos; el programa declara ahora ",
  ". Its dated gates and their filed evidence were deliberately left alone \u2014 but read \u201cwhat is next\u201d with that in mind.": ". Sus hitos con fecha y las pruebas archivadas se han dejado intactos deliberadamente, pero lea «qué viene después» sabiéndolo.",
  "accepted by ": "aceptado por ",
  "Promised, and measured": "Prometido y medido",
  "what the case said it was for, against what the benefits have actually shown": "para qué decía el caso que servía, frente a lo que los beneficios han mostrado realmente",
  "No case written": "Sin caso escrito",
  "Reviews overdue": "Revisiones vencidas",
  "The totals above sum money only. ": "Los totales anteriores solo suman dinero. ",
  " benefit(s) are counted in their own units and deliberately left out of any total: ": " beneficio(s) se cuentan en su propia unidad y quedan deliberadamente fuera de todo total: ",
  ". Converting them to a currency would invent a number.": ". Convertirlos a una moneda inventaría un número.",
  "The case": "El caso",
  "What was measured": "Lo que se midió",
  "benefits, but no case": "beneficios, pero sin caso",
  "nothing promised": "nada prometido",
  "never reconfirmed": "nunca reconfirmado",
  " \u00b7 revised since": " · revisado desde entonces",
  "no benefit named yet": "aún sin beneficio nombrado",
  "not measured": "no medido",
  "now ": "ahora ",
  "review ": "revisión ",
  " days overdue": " días de retraso",
  "undated": "sin fecha",
  "closed": "cerrado",
  "No project in scope.": "Ningún proyecto en el alcance.",
  "Check now": "Comprobar ahora",
  "The sweep runs hourly on its own; this asks for it now.": "El barrido se ejecuta solo cada hora; esto lo pide ahora.",
  " not measured": " sin medir",
  " project(s), none of them measured yet": " proyecto(s), ninguno medido todavía",
  "nothing measured to index": "nada medido que indexar",
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

  // ── I-12 · la posture du jour 1 (retour de terrain RT365)
  "demonstration account(s) still open with the password printed in the README":
    "cuenta(s) de demostración aún abierta(s) con la contraseña impresa en el README",
  "Anyone who reads the repository can sign in as them. Change each password, or deactivate the account, before this instance carries anything real. In production the server refuses to start while this is true.":
    "Cualquiera que lea el repositorio puede iniciar sesión con ellas. Cambie cada contraseña, o desactive la cuenta, antes de que esta instancia contenga algo real. En producción el servidor se niega a arrancar mientras esto sea cierto.",
  "Closed by default, waiting on a decision":
    "Cerrado por defecto, a la espera de una decisión",
  "no trusted document host named — evidence cannot be approved":
    "ningún host documental de confianza designado — no se puede aprobar ninguna evidencia",
  "no mail transport — notifications queue and do not send":
    "sin transporte de correo — las notificaciones se acumulan y no se envían",
  "no notification host named — nothing leaves the instance":
    "ningún host de notificación designado — nada sale de la instancia",
  "Break-glass: ":
    "Rotura de cristal: ",
  "an administrator is exempt from segregation of duties and may sign every step of a change request, including one it raised; each such signature is marked break-glass in the audit trail. Run the portfolio from named group and site accounts.":
    "un administrador está exento de la segregación de funciones y puede firmar cada paso de una solicitud de cambio, incluida una que él mismo planteó; cada firma de ese tipo se marca como rotura de cristal en la pista de auditoría. Gestione la cartera desde cuentas de grupo y de sitio nominativas.",
  "you raised this request. As an administrator you may still sign it — the exemption exists for emergencies, and the audit trail will mark the signature as break-glass. Prefer having a colleague with group authority decide it.":
    "usted planteó esta solicitud. Como administrador aún puede firmarla — la exención existe para emergencias, y la pista de auditoría marcará la firma como rotura de cristal. Es preferible que la decida un colega con autoridad de grupo.",

  // ── I-7 / I-8 · el registro de decisiones y el RAID vinculado (retorno de terreno RT365)
  "The agenda of the next meeting in scope asks for this item once the date has come.":
    "La agenda de la próxima reunión en su ámbito reclama este elemento una vez llegada la fecha.",
  "Against gate":
    "Contra la puerta",
  "Not linked to a gate":
    "Sin vínculo con una puerta",
  "The gate whose passage this item puts at risk. The gate line shows how many open items stand against it.":
    "La puerta de gobernanza cuyo paso este elemento pone en riesgo. La línea de la puerta indica cuántos elementos abiertos pesan contra ella.",
  "Change request":
    "Solicitud de cambio",
  "Not linked to a change":
    "Sin vínculo con un cambio",
  "Against gate ":
    "Contra la puerta ",
  "open register item(s) against it":
    "elemento(s) de registro abierto(s) en su contra",
  "outside a meeting":
    "fuera de reunión",
  "alternatives: ":
    "alternativas: ",
  "dissent: ":
    "disenso: ",
  "supersedes ":
    "reemplaza ",
  "Decision register":
    "Registro de decisiones",
  "One sentence, in the past tense, that someone will read in a year without the context.":
    "Una frase, en pasado, que alguien leerá dentro de un año sin el contexto.",
  "Portfolio-wide (group level)":
    "Toda la cartera (nivel grupo)",
  "Decided by":
    "Decidido por",
  "Decided on":
    "Decidido el",
  "The reasoning, so the committee can read it back without the person who wrote it.":
    "El razonamiento, para que el comité pueda releerlo sin la persona que lo escribió.",
  "Alternatives considered":
    "Alternativas consideradas",
  "What was refused, and why. A register that keeps only the winner cannot explain the choice.":
    "Lo que se descartó, y por qué. Un registro que solo guarda la opción elegida no explica la elección.",
  "Dissent":
    "Disenso",
  "Who disagreed, and on what. Recorded dissent protects the dissenter and the decision alike.":
    "Quién estuvo en desacuerdo, y en qué. Un disenso registrado protege tanto a quien lo expresa como a la decisión.",
  "Register item":
    "Elemento del registro",
  "Milestone or gate":
    "Hito",
  "Supersedes decision":
    "Reemplaza la decisión",
  "The identifier of the decision this one replaces, e.g. DEC-012. That one stays on the record.":
    "El identificador de la decisión que esta reemplaza, p. ej. DEC-012. Aquella permanece en el registro.",

  // ── I-3 / I-4 · la escalera de puertas y los criterios (retorno de terreno RT365)
  "Default ladder":
    "Escalera por defecto",
  "Every programme":
    "Todos los programas",
  "programme(s) with their own ladder":
    "programa(s) con su propia escalera",
  "evidence required at each gate":
    "evidencia exigida en cada puerta",
  "A programme declares its own ladder from Reference data → programme. Projects take their programme's ladder when they are created; changing a ladder later leaves existing projects as they are.":
    "Un programa declara su propia escalera desde Datos de referencia → programa. Los proyectos toman la escalera de su programa al crearse; cambiarla después deja los proyectos existentes tal como están.",
  "Criteria for ":
    "Criterios de ",
  "found met":
    "verificado(s)",
  "Criterion":
    "Criterio",
  "No criterion posed for this gate. Evidence alone clears it; a criterion says what the evidence must prove.":
    "Ningún criterio planteado para esta puerta. La evidencia sola la supera; un criterio dice qué debe demostrar la evidencia.",
  "found met by ":
    "verificado por ",
  "not yet found met":
    "aún no verificado",
  "Found met":
    "Verificado",
  "Reopen":
    "Reabrir",
  "Edit criterion":
    "Editar el criterio",
  "Remove criterion":
    "Quitar el criterio",
  "Pose a criterion":
    "Plantear un criterio",
  "What must be true":
    "Lo que debe ser cierto",
  "One testable sentence, written before the evidence. A reviewer will say whether it holds.":
    "Una frase verificable, escrita antes de la evidencia. Un revisor dirá si se cumple.",
  "Pose":
    "Plantear",
  "Evidence document":
    "Documento de evidencia",
  "Where to look, or why it was reformulated — read by the reviewer, months later.":
    "Dónde mirar, o por qué se reformuló — leído por el revisor, meses después.",
  "Save criterion":
    "Guardar el criterio",
  "The evidence cited is ":
    "La evidencia citada es ",
  ", owned by ":
    ", propiedad de ",
  "Reviewed by":
    "Revisado por",
  "The named person who checked it — not the owner of the evidence it cites. The name stays.":
    "La persona nominada que lo comprobó — no el propietario de la evidencia citada. El nombre permanece.",
  "criteria":
    "criterios",
  "Gate ladder":
    "Escalera de puertas",
  "One gate per line: name | owner | evidence, comma separated | position in the project window as a percentage. Leave empty for the default ladder. Projects take the ladder at creation; a later change does not rewrite them.":
    "Una puerta por línea: nombre | propietario | evidencia, separada por comas | posición en la ventana del proyecto en porcentaje. Vacío = escalera por defecto. Los proyectos toman la escalera al crearse; un cambio posterior no los reescribe.",

  // ── PM-05 / PM-11 · partes interesadas y plan de comunicación (I-10)
  " named":
    " nombrada(s)",
  " sceptical or opposed":
    " escéptica(s) u opuesta(s)",
  "none named":
    "ninguna nombrada",
  "Communication plan":
    "Plan de comunicación",
  " audience(s)":
    " audiencia(s)",
  " overdue":
    " atrasada(s)",
  "no plan":
    "sin plan",
  "interest × influence, attitude, and who owns the relationship":
    "interés × influencia, actitud, y quién lleva la relación",
  "Stakeholder":
    "Parte interesada",
  "Who":
    "Quién",
  "Interest / influence":
    "Interés / influencia",
  "Attitude":
    "Actitud",
  "Champion":
    "Promotor",
  "Supporter":
    "Partidario",
  "Neutral":
    "Neutral",
  "Sceptic":
    "Escéptico",
  "Opponent":
    "Opositor",
  "Engagement":
    "Participación",
  "Inform":
    "Informar",
  "Consult":
    "Consultar",
  "Involve":
    "Involucrar",
  "Partner":
    "Asociar",
  "Owner":
    "Responsable",
  "No stakeholder named yet.":
    "Ninguna parte interesada nombrada todavía.",
  "No stakeholder named. The most frequent cause of failure on a multi-site project leaves no trace here until somebody writes a name.":
    "Ninguna parte interesada nombrada. La causa de fracaso más frecuente en un proyecto multisitio no deja rastro aquí hasta que alguien escribe un nombre.",
  "Edit stakeholder":
    "Editar la parte interesada",
  "Name a stakeholder":
    "Nombrar una parte interesada",
  "A person or an organisation — a regulator, a supplier, a works council count.":
    "Una persona o una organización — un regulador, un proveedor, un comité de empresa cuentan.",
  "In the directory":
    "En el directorio",
  "Not in the directory":
    "Fuera del directorio",
  "Organisation":
    "Organización",
  "Role":
    "Rol",
  "Interest (1–5)":
    "Interés (1–5)",
  "How much the outcome matters to them.":
    "Cuánto les importa el resultado.",
  "Influence (1–5)":
    "Influencia (1–5)",
  "How much they can change the outcome.":
    "Cuánto pueden cambiar el resultado.",
  "Inform: they hear. Consult: they are asked. Involve: they shape it. Partner: they decide with you.":
    "Informar: escuchan. Consultar: se les pregunta. Involucrar: lo moldean. Asociar: deciden con usted.",
  "Relationship owner":
    "Lleva la relación",
  "What they want, what they fear, what was agreed with them — read by whoever takes over.":
    "Qué quieren, qué temen, qué se acordó con ellos — leído por quien tome el relevo.",
  "Add stakeholder":
    "Añadir la parte interesada",
  "who hears what, how often, from whom":
    "quién oye qué, con qué frecuencia, de quién",
  "Audience":
    "Audiencia",
  "Channel":
    "Canal",
  "Frequency":
    "Frecuencia",
  "Next":
    "Próxima",
  "No audience planned yet.":
    "Ninguna audiencia planificada todavía.",
  "No communication planned. The meetings and the digest carry most of it in practice; the plan says who else must hear, and when.":
    "Ninguna comunicación planificada. Las reuniones y el resumen llevan la mayor parte en la práctica; el plan dice quién más debe oír, y cuándo.",
  "Edit communication":
    "Editar la comunicación",
  "Plan a communication":
    "Planificar una comunicación",
  "Who must hear: a committee, a site, a supplier, the users of a branch.":
    "Quién debe oír: un comité, un sitio, un proveedor, los usuarios de una sucursal.",
  "What they need to know":
    "Lo que necesitan saber",
  "The message, in one line — status, a decision owed, a date that moves.":
    "El mensaje, en una línea — un estado, una decisión pendiente, una fecha que se mueve.",
  "weekly call, e-mail, town hall…":
    "reunión semanal, correo, asamblea…",
  "weekly, at each gate, once…":
    "semanal, en cada puerta, una vez…",
  "What was said last time, or what must not be said yet — read by whoever sends the next one.":
    "Lo que se dijo la última vez, o lo que aún no debe decirse — leído por quien envíe la siguiente.",
  "Plan it":
    "Planificar",

  // ── REQ-07 segunda ronda · órgano, evidencia, procedencia, estado
  "A body, not a person (name it below)":
    "Un órgano, no una persona (nómbrelo abajo)",
  "Deciding body":
    "Órgano decisor",
  "When a committee decided rather than one person: its name, as the minutes call it. Either a person or a body is required.":
    "Cuando decidió un comité y no una persona: su nombre, tal como lo llama el acta. Se requiere una persona o un órgano.",
  "Ratified":
    "Ratificada",
  "Proposed — awaiting ratification":
    "Propuesta — pendiente de ratificación",
  "Record of the decision":
    "Registro de la decisión",
  "The minutes, the gate report, the page where the decision is written down — a link a reader can open.":
    "El acta, el informe de puerta, la página donde la decisión está escrita — un enlace que un lector puede abrir.",
  "Provenance":
    "Procedencia",
  "Where the authority for it comes from, in your organisation's own tags.":
    "De dónde viene su autoridad, con las etiquetas propias de su organización.",
  "proposed":
    "propuesta",

  // ── REQ-14 · la fecha del hito dice en qué se basa (RT365 D-057)
  "The date is":
    "La fecha es",
  "a commitment":
    "un compromiso",
  "a placeholder — no calendar date yet":
    "una posición — aún sin fecha de calendario",
  "A placeholder is drawn where it sits but is never reported missed or overdue; make it a commitment once the condition below has been measured.":
    "Una posición se dibuja donde está pero nunca se informa como incumplida ni atrasada; conviértala en compromiso una vez medida la condición de abajo.",
  "Dated after":
    "Fechada tras",
  "the capacity model at gate C…":
    "el modelo de capacidad en la puerta C…",
  "The predecessor or the measurement that will produce the real date — read by whoever re-baselines.":
    "El predecesor o la medición que producirá la fecha real — leído por quien restablezca la línea base.",
  "placeholder":
    "posición",
  "after: ":
    "tras: ",

  "Unscheduled": "Sin fecha",

  // ── REQ-13 / REQ-18 / REQ-19 (RT365, tercera ronda)
  "What has to happen, or be measured, before this date can be promised.":
    "Lo que debe ocurrir, o medirse, antes de que esta fecha pueda prometerse.",
  "No condition recorded":
    "Ninguna condición registrada",
  "The finish date is a placeholder — not a commitment.":
    "La fecha de fin es un marcador de posición — no es un compromiso.",
  "Not named":
    "Sin nombrar",
  "The person who answers for the business case, not for the delivery.":
    "La persona que responde por el caso de negocio, no por la entrega.",
  "What has to be true for this project to be finished. Written before it is, or it is an opinion afterwards.":
    "Lo que debe ser cierto para que este proyecto esté terminado. Escrito antes de estarlo, o después solo es una opinión.",
  "safety, supply, regulatory…":
    "seguridad, suministro, regulatorio…",
  "Your own classification, kept beside the RAID type the engine reads.":
    "Su propia clasificación, guardada junto al tipo RAID que lee el motor.",
  "Closed on":
    "Cerrada el",
  "The day this item actually closed — stamped when it was closed here, corrected when it was closed elsewhere.":
    "El día en que esta línea se cerró realmente — sellado al cerrarla aquí, corregido cuando se cerró en otro sitio.",
  "Closed by":
    "Cerrada por",
  "The person on whose word it closed.":
    "La persona por cuya palabra se cerró.",
  "Closed — the date was not recorded":
    "Cerrada — la fecha no se registró",

  /* ── REQ-24 (V-5) · el ranking de la cartera: valor, confianza,
     exposición y capacidad, la ponderación y la línea. Las frases de
     PRIORITY_TEXT llegan por VARIABLE y son invisibles para la puerta
     F5: se ponen aquí a mano, como se hizo con SIGNAL_TEXT. */
  "Value and risk against capacity":
    "Valor y riesgo frente a capacidad",
  "Not placed":
    "Sin colocar",
  "Claimed value":
    "Valor declarado",
  "Confidence":
    "Confianza",
  "RAID exposure":
    "Exposición RAID",
  "Capacity consumed":
    "Capacidad consumida",
  "From the business case — expected benefit a year":
    "Del caso de negocio — beneficio esperado al año",
  "From the request — the benefit its sponsor claims":
    "De la solicitud — el beneficio que declara su patrocinador",
  "From the business case — how far the payer trusts that figure":
    "Del caso de negocio — cuánto confía en esa cifra quien paga",
  "From the request — how far the sponsor trusts that figure":
    "De la solicitud — cuánto confía el patrocinador en esa cifra",
  "The worst open RAID item, probability × impact":
    "La peor línea RAID abierta, probabilidad × impacto",
  "From the request — the worst thing its sponsor expects":
    "De la solicitud — lo peor que espera su patrocinador",
  "From the allocations, averaged over the horizon":
    "De las asignaciones, promediadas sobre el horizonte",
  "From the request — the people its sponsor expects to need":
    "De la solicitud — las personas que su patrocinador cree necesitar",
  "No business case — this project has never said what it is worth":
    "Sin caso de negocio — este proyecto nunca ha dicho cuánto vale",
  "The business case states no expected benefit":
    "El caso de negocio no enuncia ningún beneficio esperado",
  "The request states no expected benefit — a benefit in words is not a number":
    "La solicitud no enuncia beneficio esperado — un beneficio en palabras no es una cifra",
  "Nobody has recorded how far this figure is trusted":
    "Nadie ha registrado cuánto se confía en esta cifra",
  "No RAID item has ever been logged here — the exposure is not known, and it is not zero":
    "Nunca se ha registrado aquí ninguna línea RAID — la exposición no se conoce, y no es cero",
  "The request records no probability and impact for the worst thing it expects":
    "La solicitud no registra probabilidad ni impacto para lo peor que espera",
  "Nobody is allocated to this project — what it consumes is not known, and it is not zero":
    "Nadie está asignado a este proyecto — lo que consume no se conoce, y no es cero",
  "The request does not estimate the people it will take":
    "La solicitud no estima las personas que costará",
  "Ranked on all four inputs":
    "Clasificado sobre las cuatro entradas",
  "Missing an input — not placed in the order, and not placed last either":
    "Falta una entrada — no colocado en el orden, y tampoco colocado el último",
  "Weighting":
    "Ponderación",
  "These are the weights this software shipped with — nobody in this group has reviewed them":
    "Son los pesos con los que se entregó este software — nadie de este grupo los ha revisado",
  "Set by":
    "Fijada por",
  "Every weight is zero — nothing is being weighed, so nothing is ranked":
    "Todos los pesos son cero — no se pesa nada, así que nada se clasifica",
  "Where capacity runs out":
    "Donde se agota la capacidad",
  "Capacity runs out here":
    "La capacidad se agota aquí",
  "The capital envelope runs out here":
    "El sobre de inversión se agota aquí",
  "No person in this book carries availability — there is no capacity to rank against, so no line is drawn":
    "Nadie en este libro lleva disponibilidad — no hay capacidad contra la que clasificar, así que no se traza ninguna línea",
  "Work that is not in this ranking already consumes the whole pool — nothing here is above the line":
    "El trabajo que no está en este ranking ya consume todo el conjunto — nada aquí está por encima de la línea",
  "No capital envelope has been agreed — no money line is drawn":
    "No se ha acordado ningún sobre de inversión — no se traza ninguna línea de dinero",
  "Some ranked rows carry no cost, so a money line would understate the demand — none is drawn":
    "Algunas filas clasificadas no llevan coste: una línea de dinero subestimaría la demanda — no se traza ninguna",
  "Everything ranked fits inside the capacity":
    "Todo lo clasificado cabe dentro de la capacidad",
  "The capital queue":
    "La cola de inversión",
  "The older V-04 queue: four hand notes from 1 to 5, live projects only, against the money alone. It is kept because the notes and the hand-placed rank are still recorded here; the ranking above is the one that reads value, confidence, exposure and capacity.":
    "La antigua cola V-04: cuatro notas a mano de 1 a 5, solo proyectos vivos, frente al dinero solo. Se conserva porque las notas y el rango puesto a mano se registran aquí; el ranking de arriba es el que lee valor, confianza, exposición y capacidad.",
  "Reading the book, the register and the allocations…":
    "Leyendo el libro, el registro y las asignaciones…",
  " open of ":
    " abiertas de ",
  " allocations":
    " asignaciones",
  " pts × ":
    " pts × ",
  " available":
    " disponibles",
  "Row":
    "Fila",
  "live project":
    "proyecto vivo",
  "request":
    "solicitud",
  "of 100":
    "sobre 100",
  "Running capacity":
    "Capacidad acumulada",
  "Inputs":
    "Entradas",
  "What is missing":
    "Lo que falta",
  "No programme":
    "Sin programa",
  " ranked, ":
    " clasificadas, ",
  " not placed":
    " sin colocar",
  "Nothing in this programme carries all four inputs yet.":
    "Nada en este programa lleva todavía las cuatro entradas.",
  "Not placed. These are not ranked last and they are not ranked first — they are not in the order at all, because a rank built on an input nobody has recorded is a confident-looking guess.":
    "Sin colocar. No están clasificadas las últimas ni las primeras — no están en el orden en absoluto, porque un rango construido sobre una entrada que nadie ha registrado es una suposición con aire de certeza.",
  " ranked and ":
    " clasificadas y ",
  " not placed, as at ":
    " sin colocar, a fecha de ",
  "Set the weighting":
    "Fijar la ponderación",
  "Value and confidence pull a row up; exposure and the people it takes push it down. Each input is put on a 0–100 scale against the largest in the set being ranked, then weighted — so points move when the set changes, and the order of any two rows against each other does not.":
    "El valor y la confianza tiran de una fila hacia arriba; la exposición y las personas que cuesta la empujan hacia abajo. Cada entrada se lleva a una escala de 0 a 100 frente a la mayor del conjunto clasificado, y luego se pondera — los puntos se mueven cuando cambia el conjunto, y el orden de dos filas entre sí, no.",
  "Capacity pool":
    "Conjunto de capacidad",
  " people at their availability, up to the ":
    " personas a su disponibilidad, hasta el techo del ",
  "% ceiling":
    " %",
  "Held outside this ranking":
    "Retenida fuera de este ranking",
  "Allocated to work that is closed or could not be placed — those people are busy whether or not their project has been scored.":
    "Asignada a trabajo cerrado o imposible de colocar — esas personas están ocupadas se haya puntuado su proyecto o no.",
  "Available to this ranking":
    "Disponible para este ranking",
  "Over the next ":
    "Sobre los próximos ",
  " days, from ":
    " días, del ",
  " to ":
    " al ",
  "Capital envelope":
    "Sobre de inversión",
  "The second line: the running cost crosses it, or the people run out first.":
    "La segunda línea: el coste acumulado la cruza, o bien la gente se acaba antes.",
  "before the first row":
    "antes de la primera fila",
  "Nothing is competing for capacity: no live project and no open request.":
    "Nada compite por la capacidad: ningún proyecto vivo y ninguna solicitud abierta.",
  "That request is still loading — try again in a moment.":
    "Esa solicitud aún se está cargando — inténtelo de nuevo en un momento.",
  "Inputs: ":
    "Entradas: ",
  "Expected benefit a year (M)":
    "Beneficio esperado al año (M)",
  "The number, not the words. Leave it empty rather than guessing — an empty claim keeps the request out of the order; a guessed one moves it up it.":
    "La cifra, no las palabras. Déjelo vacío antes que adivinar — una declaración vacía mantiene la solicitud fuera del orden; una adivinada la hace subir en él.",
  "Confidence in that figure 1–5":
    "Confianza en esa cifra 1–5",
  "How far the sponsor would stand behind it. Nobody can compute this, so nothing here computes it.":
    "Hasta qué punto el patrocinador lo respaldaría. Nadie puede calcularlo, así que aquí nada lo calcula.",
  "People it will take (FTE)":
    "Personas que costará (ETC)",
  "Averaged over the ranking horizon, in the same unit as the allocations a project carries.":
    "Promediadas sobre el horizonte del ranking, en la misma unidad que las asignaciones de un proyecto.",
  "Worst case — probability 1–5":
    "Peor caso — probabilidad 1–5",
  "Worst case — impact 1–5":
    "Peor caso — impacto 1–5",
  "The same 1–5 scale the RAID register uses, so a request and a live project are exposed on one scale.":
    "La misma escala 1–5 del registro RAID, para que una solicitud y un proyecto vivo se expongan en una sola escala.",
  "Ranking inputs saved":
    "Entradas del ranking guardadas",
  "Exposure comes from this project's RAID register and the capacity from its allocations — both are edited on the project, not here, because a second place to state them is a second answer.":
    "La exposición viene del registro RAID de este proyecto y la capacidad de sus asignaciones — ambas se editan en el proyecto, no aquí: un segundo lugar para enunciarlas sería una segunda respuesta.",
  "Why this deserves its budget":
    "Por qué esto merece su presupuesto",
  "The payer's justification, read back at every gate.":
    "La justificación de quien paga, releída en cada puerta.",
  "Expected cost (M)":
    "Coste esperado (M)",
  "The claimed value the ranking reads. Empty keeps this project out of the order rather than placing it at the bottom of it.":
    "El valor declarado que lee el ranking. Vacío mantiene este proyecto fuera del orden en vez de colocarlo al final de él.",
  "How far the payer would stand behind it. Nobody can compute this, so nothing here computes it.":
    "Hasta qué punto quien paga lo respaldaría. Nadie puede calcularlo, así que aquí nada lo calcula.",
  "The weighting":
    "La ponderación",
  "Weights are shares of their own total, so 40/20/20/20 and 4/2/2/2 are the same weighting. Saving re-ranks every programme immediately.":
    "Los pesos son partes de su propio total: 40/20/20/20 y 4/2/2/2 son la misma ponderación. Guardar reclasifica todos los programas de inmediato.",
  "What the business case, or the request, says it is worth a year.":
    "Lo que el caso de negocio, o la solicitud, dice que vale al año.",
  "How far the person who claimed that figure would stand behind it.":
    "Hasta qué punto quien declaró esa cifra la respaldaría.",
  "The worst open item, probability × impact. Pushes a row down.":
    "La peor línea abierta, probabilidad × impacto. Empuja una fila hacia abajo.",
  "The people it takes over the horizon. Pushes a row down.":
    "Las personas que cuesta sobre el horizonte. Empuja una fila hacia abajo.",
  "Why these weights":
    "Por qué estos pesos",
  "Read months later by somebody who disagrees with a rank. A weighting whose reason is not written is a verdict.":
    "Leído meses después por alguien que discrepa de un rango. Una ponderación cuya razón no está escrita es un veredicto.",
  "Weighting set":
    "Ponderación fijada",
};

/* ── fragments composés autour de nombres vivants (R-15) ────────────── */
/* Miroir de FRAG (i18n.js) — même liste, même ordre. L'ordre est une
   partie du contrat : le motif précis passe avant le mot générique
   (« N evidence items outstanding for » avant « outstanding »), sinon le
   générique mange la phrase. Le tour au navigateur (I18N-02) a trouvé
   « above the escalation threshold » traduit en FR et pas en ES : ce
   miroir était partiel. Il est désormais tenu complet par la porte F5. */
export const ES_FRAG = [
  /* REQ-30 — la población de una cifra de la página de valor (ver FR). */
  [/(\d+) case\(s\) with an expected cost, of (\d+) project\(s\)/g, "$1 caso(s) con coste previsto, de $2 proyecto(s)"],
  [/(\d+) live of (\d+) benefit\(s\) stated/g, "$1 vigente(s) de $2 beneficio(s) declarado(s)"],
  [/of (\d+) dated review\(s\)/g, "de $1 revisión(es) con fecha"],
  [/highest of (\d+) open risk\(s\)/g, "la más alta de $1 riesgo(s) abierto(s)"],
  [/within (\d+) days, of (\d+) committed gate\(s\)/g, "dentro de $1 días, de $2 puerta(s) comprometida(s)"],
  [/against (\d+) project\(s\) carrying a tolerance/g, "sobre $1 proyecto(s) con tolerancia"],
  [/(\d+) criterions? not yet found met\b/g, "$1 criterio(s) aún no verificado(s)"],
  [/\bno evidence item filed\b/g, "ninguna evidencia presentada"],
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

/** Cada cuánto se refrescan en segundo plano las páginas vivas (ms). */
export const POLL_MS = 5000;

/** Un canal sin nada en revisión se refresca seis veces más despacio (30 s). */
export const IDLE_POLL_MS = POLL_MS * 6;

/** La lista de proyectos se refresca doce veces más despacio (60 s). */
export const PROJECTS_POLL_MS = POLL_MS * 12;

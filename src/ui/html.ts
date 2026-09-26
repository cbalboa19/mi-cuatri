// Utilidades para generar HTML con plantillas.

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para meterlo en HTML (contenido o atributos entre comillas). */
export const esc = (s: unknown): string => String(s).replace(/[&<>"']/g, (c) => ESC[c] ?? c);

export const $ = <T extends Element = HTMLElement>(sel: string): T | null => document.querySelector<T>(sel);

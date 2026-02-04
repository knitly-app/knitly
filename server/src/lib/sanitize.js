const HTML_ENTITIES = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  '"': "&quot;",
  "'": "&#x27;",
};

const ENTITY_REGEX = /[<>&"']/g;

export function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str.replace(ENTITY_REGEX, (char) => HTML_ENTITIES[char]);
}

export function sanitizeText(text) {
  if (typeof text !== "string") return "";
  return escapeHtml(text.trim());
}

export function sanitizeSearchQuery(query) {
  if (typeof query !== "string") return "";
  return escapeHtml(query.trim());
}

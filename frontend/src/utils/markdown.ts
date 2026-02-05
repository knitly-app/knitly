/**
 * Simple markdown renderer for bold and italic only.
 * Content is already HTML-escaped on input, so this is safe.
 */
export function renderMarkdown(text: string): string {
  if (!text) return ''

  return text
    // Bold: **text** → <strong>text</strong>
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic: *text* → <em>text</em> (but not if part of **)
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    // Mentions: @username → link
    .replace(/@(\w+)/g, '<a href="/profile/@$1" class="mention text-accent-500 hover:underline">@$1</a>')
}

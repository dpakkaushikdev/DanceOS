/** THE TRASH MARK — one glyph and one red for every removal in the app. A leaf
 *  module, so the delete button and the confirm dialog it opens can both import
 *  it without importing each other. */

export const DELETE_RED = "#F87171";

export function TrashGlyph({ size = 16, color = DELETE_RED }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9 7V4.8c0-.4.4-.8.8-.8h4.4c.4 0 .8.4.8.8V7" />
      <path d="M6.5 7l.9 12.2c.1.9.8 1.8 1.8 1.8h5.6c1 0 1.7-.9 1.8-1.8L17.5 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

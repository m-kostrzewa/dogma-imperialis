/**
 * Shared mutable search-mode state.
 * Read by searchClient (index.jsx) and toggled by DebouncedSearchBox UI.
 * Default: both modes enabled ("Both").
 */
export const searchMode = { text: true, semantic: true };

export const SEARCH_MODE_EVENT = 'searchModeChanged';

export function notifyModeChanged() {
  window.dispatchEvent(new Event(SEARCH_MODE_EVENT));
}

// Page highlight functionality
import { TextHighlighter } from './highlighter.js';
import { SearchStorage } from './searchStorage.js';

export class PageHighlight {
  constructor() {
    this.highlighter = new TextHighlighter();
    this.init();
  }

  init() {
    // Check URL parameter first
    const urlParams = new URLSearchParams(window.location.search);
    const highlightQuery = urlParams.get('highlight');

    if (highlightQuery) {
      this.highlight(highlightQuery);
      return;
    }

    // Check localStorage for recent search
    const clickedResult = SearchStorage.getClickedResult();
    if (clickedResult &&
        SearchStorage.isResultRecent(clickedResult) &&
        clickedResult.url === window.location.pathname) {

      this.highlight(clickedResult.query);
      SearchStorage.clearClickedResult(); // Avoid repeated highlighting
    }
  }

  highlight(query) {
    const highlighted = this.highlighter.highlightText(query);
    if (highlighted) {
      this.highlighter.showNotification(query);
    }
  }
}
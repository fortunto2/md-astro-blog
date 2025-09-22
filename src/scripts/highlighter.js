// Text highlighting utilities
export class TextHighlighter {
  constructor() {
    this.setupStyles();
  }

  setupStyles() {
    if (document.querySelector('#highlight-styles')) return;

    const style = document.createElement('style');
    style.id = 'highlight-styles';
    style.textContent = `
      .search-highlight {
        background-color: #ffeb3b;
        padding: 2px 4px;
        border-radius: 3px;
        box-shadow: 0 0 0 1px #fbc02d;
        font-weight: bold;
      }
      .search-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 1000;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        animation: slideIn 0.3s ease-out;
      }
      .search-notification button {
        background: none;
        border: none;
        color: white;
        margin-left: 10px;
        cursor: pointer;
        font-size: 16px;
      }
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  highlightText(query, selector = '.prose') {
    if (!query || query.length < 2) return false;

    const content = document.querySelector(selector);
    if (!content) return false;

    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    if (words.length === 0) return false;

    let hasHighlights = false;
    this.highlightInNode(content, words, () => hasHighlights = true);

    if (hasHighlights) {
      this.scrollToFirstHighlight(content);
    }

    return hasHighlights;
  }

  highlightInNode(node, words, onHighlight) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      let highlightedText = text;

      words.forEach(word => {
        const regex = new RegExp(`(${word})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<span class="search-highlight">$1</span>');
      });

      if (highlightedText !== text) {
        const wrapper = document.createElement('span');
        wrapper.innerHTML = highlightedText;
        node.parentNode.replaceChild(wrapper, node);
        onHighlight();
      }
    } else if (node.nodeType === Node.ELEMENT_NODE &&
               !['SCRIPT', 'STYLE'].includes(node.tagName)) {
      Array.from(node.childNodes).forEach(child =>
        this.highlightInNode(child, words, onHighlight)
      );
    }
  }

  scrollToFirstHighlight(container) {
    setTimeout(() => {
      const firstHighlight = container.querySelector('.search-highlight');
      if (firstHighlight) {
        firstHighlight.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }, 100);
  }

  showNotification(query) {
    // Remove existing notification
    const existing = document.querySelector('.search-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'search-notification';
    notification.innerHTML = `
      🔍 Highlighted: "${query}"
      <button onclick="this.parentElement.remove()" title="Close">×</button>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }
}
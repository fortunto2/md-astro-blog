// Search page functionality
import { SearchStorage } from './searchStorage.js';

export class SearchPage {
  constructor() {
    this.form = document.getElementById('searchForm');
    this.input = document.getElementById('searchInput');
    this.button = document.getElementById('searchButton');
    this.results = document.getElementById('searchResults');

    this.init();
  }

  init() {
    if (!this.form) return;

    this.form.addEventListener('submit', (e) => this.handleSearch(e));

    // Search on page load if query exists
    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get('q');
    const initialMode = urlParams.get('mode') || 'search';

    // Set initial mode
    const modeRadio = document.querySelector(`input[name="mode"][value="${initialMode}"]`);
    if (modeRadio) {
      modeRadio.checked = true;
    }

    if (initialQuery) {
      this.performSearch(initialQuery, initialMode);
    }
  }

  async handleSearch(e) {
    e.preventDefault();
    const query = this.input.value.trim();
    if (!query) return;

    // Get selected search mode
    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'search';

    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('q', query);
    url.searchParams.set('mode', mode);
    window.history.pushState({}, '', url);

    await this.performSearch(query, mode);
  }

  async performSearch(query, mode = 'search') {
    if (query.length < 2) {
      this.showError('Query must be at least 2 characters');
      return;
    }

    this.setLoading(true);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&mode=${mode}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      this.displayResults(data);
    } catch (error) {
      console.error('Search error:', error);
      this.showError(`Ошибка поиска: ${error.message}`);
    } finally {
      this.setLoading(false);
    }
  }

  setLoading(loading) {
    this.button.disabled = loading;
    this.button.textContent = loading ? 'Поиск...' : 'Поиск';

    if (loading) {
      this.results.innerHTML = '<div class="loading">Поиск в процессе...</div>';
    }
  }

  showError(message) {
    this.results.innerHTML = `<div class="error">${message}</div>`;
  }

  displayResults(data) {
    if (!data.results || data.results.length === 0) {
      this.showError(`По запросу "${data.query}" ничего не найдено. Попробуйте другие ключевые слова.`);
      return;
    }

    // Save to localStorage
    SearchStorage.saveSearchContext(data.query, data.results);

    const aiAnswerHtml = data.answer ? `
      <div class="ai-answer" style="background: #f0f8ff; border: 1px solid #b3d9ff; padding: 1rem; margin: 1rem 0; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #0066cc;">🤖 AI Ответ</h3>
        <p>${data.answer}</p>
      </div>
    ` : '';

    const resultsHtml = data.results.map(result => `
      <div class="search-result">
        <h3><a href="${result.url}?highlight=${encodeURIComponent(data.query)}" data-search-link="${result.url}">${result.title}</a></h3>
        <p>${result.description}</p>
        <div class="search-meta">
          <span class="search-score">Релевантность: ${(result.score * 100).toFixed(1)}%</span>
          ${result.date ? ` • ${result.date}` : ''}
          ${result.tags && result.tags.length > 0 ? ` • Теги: ${result.tags.join(', ')}` : ''}
          ${result.source ? ` • ${result.source}` : ''}
        </div>
      </div>
    `).join('');

    this.results.innerHTML = `
      ${aiAnswerHtml}
      <p><strong>Найдено результатов:</strong> ${data.total}</p>
      ${resultsHtml}
    `;

    // Add click handlers
    this.results.querySelectorAll('[data-search-link]').forEach(link => {
      link.addEventListener('click', () => {
        const clickedResult = data.results.find(r => r.url === link.dataset.searchLink);
        if (clickedResult) {
          SearchStorage.saveClickedResult(clickedResult, data.query);
        }
      });
    });
  }
}
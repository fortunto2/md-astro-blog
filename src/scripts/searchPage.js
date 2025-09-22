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
      this.showError(`Search error: ${error.message}`);
    } finally {
      this.setLoading(false);
    }
  }

  setLoading(loading) {
    this.button.disabled = loading;
    this.button.textContent = loading ? 'Searching...' : 'Search';

    if (loading) {
      this.results.innerHTML = '<div class="text-center py-8 text-gray-600">Searching...</div>';
    }
  }

  showError(message) {
    this.results.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">${message}</div>`;
  }

  displayResults(data) {
    if (!data.results || data.results.length === 0) {
      this.showError(`No results found for "${data.query}". Try different keywords.`);
      return;
    }

    // Save to localStorage
    SearchStorage.saveSearchContext(data.query, data.results);

    const aiAnswerHtml = data.answer ? `
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 class="text-lg font-semibold text-blue-900 mb-2 flex items-center gap-2">
          🤖 AI Answer
        </h3>
        <p class="text-blue-800">${data.answer}</p>
      </div>
    ` : '';

      const resultsHtml = data.results.map(result => `
        <div class="search-result border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
          <h3 class="text-lg font-semibold mb-2">
            <a href="${result.url}?highlight=${encodeURIComponent(data.query)}"
               data-search-link="${result.url}"
               class="text-blue-600 hover:text-blue-800 hover:underline">
              ${result.title}
            </a>
          </h3>
          <p class="text-gray-700 mb-3">${result.description}</p>
          <div class="flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <span class="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">
              Relevance: ${(result.score * 100).toFixed(1)}%
            </span>
            ${result.date ? `<span>• ${result.date}</span>` : ''}
            ${result.tags && result.tags.length > 0 ? `<span>• Tags: ${result.tags.join(', ')}</span>` : ''}
            ${result.source ? `<span>• ${result.source}</span>` : ''}
          </div>
        </div>
      `).join('');

    this.results.innerHTML = `
      ${aiAnswerHtml}
      <div class="mb-4 text-sm text-gray-600">
        <strong>Results found:</strong> ${data.total}
      </div>
      <div class="space-y-4">
        ${resultsHtml}
      </div>
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
// Search context storage utilities
export class SearchStorage {
  static saveSearchContext(query, results) {
    const context = {
      query,
      timestamp: Date.now(),
      results: results.map(r => ({
        url: r.url,
        title: r.title,
        description: r.description
      }))
    };
    localStorage.setItem('searchContext', JSON.stringify(context));
  }

  static saveClickedResult(result, query) {
    localStorage.setItem('clickedSearchResult', JSON.stringify({
      ...result,
      query,
      timestamp: Date.now()
    }));
  }

  static getClickedResult() {
    try {
      const result = localStorage.getItem('clickedSearchResult');
      return result ? JSON.parse(result) : null;
    } catch {
      return null;
    }
  }

  static clearClickedResult() {
    localStorage.removeItem('clickedSearchResult');
  }

  static isResultRecent(result, maxAgeMinutes = 5) {
    return result && Date.now() - result.timestamp < maxAgeMinutes * 60 * 1000;
  }
}
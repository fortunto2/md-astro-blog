// Простой тест для проверки фильтрации поиска по доменам
// Запуск: node test-search-filter.js

const BASE_URL = 'http://localhost:4322/api/search';

async function testSearch(query, domain = null) {
  const url = new URL(BASE_URL);
  url.searchParams.set('q', query);
  if (domain) {
    url.searchParams.set('domain', domain);
  }
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`\n🔍 Поиск: "${query}"${domain ? ` | Домен: ${domain}` : ' | Все домены'}`);
    console.log(`📊 Найдено: ${data.total} результатов`);
    console.log(`🏷️  Домен в ответе: ${data.domain}`);
    
    if (data.results && data.results.length > 0) {
      console.log('📄 Результаты:');
      data.results.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.title} (${result.url})`);
      });
    }
    
    if (data.answer) {
      console.log(`💬 AI ответ: ${data.answer.substring(0, 100)}...`);
    }
    
  } catch (error) {
    console.error(`❌ Ошибка: ${error.message}`);
  }
}

async function runTests() {
  console.log('🧪 Тестирование фильтрации поиска по доменам\n');
  
  // Тест 1: Поиск по всем доменам
  await testSearch('тест');
  
  // Тест 2: Поиск только в domain-a.example
  await testSearch('тест', 'domain-a.example');
  
  // Тест 3: Поиск только в domain-b.example  
  await testSearch('тест', 'domain-b.example');
  
  // Тест 4: Поиск только в shared
  await testSearch('тест', 'shared');
  
  // Тест 5: Поиск по конкретному контенту
  await testSearch('заметка', 'domain-a.example');
  
  console.log('\n✅ Тесты завершены');
}

runTests();

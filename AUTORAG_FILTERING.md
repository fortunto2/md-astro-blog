# AutoRAG Фильтрация по доменам

## Обзор

В проекте реализована фильтрация результатов поиска AutoRAG по доменам через параметр `domain`. Это позволяет искать контент только в определенных папках-доменах.

## Структура доменов

```
dev-content/
├── domain-a.example/     # Домен A
├── domain-b.example/     # Домен B  
└── shared/              # Общие файлы
```

## API Использование

### Базовый поиск
```bash
# Поиск по всем доменам
GET /api/search?q=запрос
```

### Фильтрация по домену
```bash
# Поиск только в domain-a.example
GET /api/search?q=запрос&domain=domain-a.example

# Поиск только в domain-b.example
GET /api/search?q=запрос&domain=domain-b.example

# Поиск только в shared
GET /api/search?q=запрос&domain=shared
```

## Реализация

### Типы фильтров AutoRAG

```typescript
// Простой фильтр сравнения
type ComparisonFilter = {
  key: string;                    // Ключ поля для фильтрации
  type: "eq" | "ne" | "gt" | "gte" | "lt" | "lte";  // Тип сравнения
  value: string | number | boolean;  // Значение для сравнения
};

// Составной фильтр (AND/OR логика)
type CompoundFilter = {
  type: "and" | "or";            // Логическая операция
  filters: ComparisonFilter[];   // Массив фильтров
};
```

### Функция создания фильтра

```typescript
function createDomainFilter(domain?: string) {
  if (!domain) return undefined;
  
  // Для фильтрации по домену используем составной фильтр
  // который проверяет, что filename начинается с домена
  return {
    type: 'and' as const,
    filters: [
      {
        key: 'filename',
        type: 'gte' as const,
        value: `${domain}/`
      },
      {
        key: 'filename', 
        type: 'lt' as const,
        value: `${domain}/~` // Следующий символ после домена
      }
    ]
  };
}
```

### Применение фильтра

```typescript
// aiSearch с фильтром
const answer = await env.AI.autorag("blog-deep").aiSearch({
  query: query.trim(),
  max_num_results: 10,
  rewrite_query: true,
  filters: domainFilter  // Применяем фильтр
});

// search с фильтром
const searchResult = await env.AI.autorag("blog-deep").search({
  query: query.trim(),
  max_num_results: 10,
  rewrite_query: false,
  filters: domainFilter  // Применяем фильтр
});
```

## Различия между методами AutoRAG

### `aiSearch()` - Интеллектуальный поиск
- **AI-генерация ответов**: Возвращает AI-сгенерированный ответ
- **Переписывание запроса**: `rewrite_query: true` - AI переформулирует запрос
- **Более умный поиск**: Использует семантическое понимание

### `search()` - Базовый поиск
- **Простой векторный поиск**: Базовый поиск по эмбеддингам
- **Без переписывания**: `rewrite_query: false` - использует запрос как есть
- **Только результаты**: Не генерирует AI-ответ

## Расширенные возможности фильтрации

### Фильтрация по дате
```typescript
{
  key: 'date',
  type: 'gte',
  value: '2025-01-01'
}
```

### Фильтрация по статусу
```typescript
{
  key: 'status',
  type: 'eq',
  value: 'public'
}
```

### Фильтрация по тегам
```typescript
{
  key: 'tags',
  type: 'eq',
  value: 'culture'
}
```

### Составные фильтры
```typescript
{
  type: 'and',
  filters: [
    { key: 'domain', type: 'eq', value: 'domain-a.example' },
    { key: 'status', type: 'eq', value: 'public' },
    { key: 'date', type: 'gte', value: '2025-01-01' }
  ]
}
```

## Тестирование

Запустите тест для проверки фильтрации:

```bash
node test-search-filter.js
```

### Примеры тестов
- Поиск по всем доменам
- Поиск только в domain-a.example
- Поиск только в domain-b.example
- Поиск только в shared

## Ответ API

```json
{
  "query": "поисковый запрос",
  "domain": "domain-a.example",
  "total": 5,
  "results": [
    {
      "title": "Заголовок заметки",
      "description": "Описание...",
      "url": "/n/slug",
      "score": 0.95,
      "source": "autorag"
    }
  ],
  "answer": "AI-сгенерированный ответ..."
}
```

## Заключение

Фильтрация по доменам позволяет:
- ✅ Искать контент только в нужном домене
- ✅ Изолировать результаты по папкам
- ✅ Использовать мощные возможности AutoRAG
- ✅ Легко расширять фильтрацию по другим полям

AutoRAG предоставляет гибкую систему фильтрации через параметр `filters`, которая может быть использована для создания сложных запросов с множественными условиями.

# Astro Zettelkasten Blog

Мультидоменный SSR-блог для заметок с поддержкой wikilinks, AutoRAG поиска, R2 хранилища и динамической генерации контента.

## 🚀 Ключевые особенности

- **SSR рендеринг** markdown файлов on-the-fly
- **Dual endpoints**: HTML (`/n/[slug]`) и raw markdown (`/n/[slug].md`)
- **Wikilinks**: `[[заметка]]` → `/n/заметка`
- **Мультидоменная архитектура** с доменно-специфичным контентом
- **AutoRAG поиск** с векторным индексом и AI-режимом
- **Динамическая генерация** sitemap.xml и llms.txt
- **Публичный/приватный контент** с SEO оптимизацией
- **Cloudflare R2** хранилище контента
- **Edge кеширование** через Cloudflare Pages
- **Подсветка текста** с сохранением в localStorage

## 📁 Структура

```text
blog2/
├── src/
│   ├── lib/md.ts           # Обработка markdown
│   ├── pages/
│   │   ├── index.astro     # Главная (domain index + header/footer)
│   │   ├── search.astro    # Поисковая страница с AI/regular режимами
│   │   ├── sitemap.xml.ts  # Динамическая генерация sitemap
│   │   ├── llms.txt.ts     # Динамическая генерация llms.txt
│   │   ├── n/
│   │   │   ├── [...slug].astro    # HTML заметки
│   │   │   └── [...slug].md.ts    # Raw markdown API
│   │   └── api/
│   │       ├── search.ts   # AutoRAG поиск с доменной фильтрацией
│   │       └── r2/[...path].ts    # Fallback API для R2
├── .env                    # Конфигурация
└── CLAUDE.md              # Подробная документация
```

## 🧞 Команды

| Команда | Описание |
|---------|----------|
| `pnpm dev` | Dev сервер `localhost:4322` |
| `pnpm build` | Сборка в `./dist/` |
| `pnpm deploy` | Сборка + деплой на Cloudflare |
| `pnpm test` | Запуск тестов (43 теста) |
| `pnpm lint` | Линтинг с автофиксом |
| `pnpm r2:put` | Быстрая загрузка файла в R2 |
| `pnpm r2:delete` | Удаление объекта из R2 |

## 🔧 Настройка

2. При необходимости добавить CDN fallback в `.env` (по умолчанию используется R2 биндинг `BLOG_CONTENT`)
3. Загрузить контент: `pnpm r2:put sgr-blog-content/domain/file.md --file ./notes/file.md --remote`

## 🌍 Продакшен

- **Live**: https://<pages-project>.pages.dev
- **R2**: https://content.example.com

Подробная документация в [CLAUDE.md](./CLAUDE.md)

## 🧩 Cloudflare bindings

Ensure the Pages project has the following bindings configured:

- **R2 bucket**: `BLOG_CONTENT` → `sgr-blog-content`
- **Vectorize index**: `VECTOR_INDEX` → `autorag-blog-deep`
- **AI binding**: `AI` → `@cf/microsoft/DialoGPT-medium`

Without these bindings the worker will return 500 errors when trying to read content or perform searches.


# Мультидоменная система контента

## 🎯 Что изменилось
- Каждый домен управляет своим заголовком и футером через `header.md` и `footer.md` в папке домена.
- Индекс домена ищется по цепочке: `/<domain>/index.md` → `/indexes/<basename>.md` → значение `PUBLIC_INDEX_URL`.
- Заметки и вложенные папки резолвятся из каталога домена с поддержкой `shared/` и корневого fallback.
- Приватные области можно организовать в произвольных подпапках (например, `private/`) и закрыть доступ через Cloudflare Zero Trust.
- Добавлено предотвращение дублирования заголовков (hasH1 detection)
- Контент читается через биндинг `BLOG_CONTENT`; `PUBLIC_MD_BASES` можно оставить пустым, если не нужен CDN fallback.
- 30 автоматических тестов покрывают все основные функции.

## 📁 Структура R2
```
sgr-blog-content/
├── domain-a.example/
│   ├── header.md              # Заголовок домена
│   ├── footer.md              # Футер (почта: info@<maindomain>)
│   ├── index.md               # Главный MOC домена
│   └── section/               # Произвольные подпапки
│       ├── index.md
│       ├── topic-a.md
│       └── topic-b.md
├── domain-b.example/          # Другие домены оформляются аналогично
├── domain-c.example/
├── indexes/                   # Глобальные MOC, если нужно переиспользовать одну и ту же заметку
└── (shared/ — опционально)
```

## 🔎 Поиск заметок
Когда воркер рендерит страницу или выдаёт исходный Markdown, он последовательно пробует:
1. `<domain>/<slug>.md` - домен-специфичный файл
2. `shared/<slug>.md` - общий файл
3. `<slug>.md` - legacy файл в корне
4. Фолбек через собственный `/api/r2/<slug>.md`

> Приоритетная система поиска обеспечивает максимальную гибкость и обратную совместимость.

## 🧩 Частичные шаблоны
- `header.md` и `footer.md` рендерятся на главной и на каждой заметке.
- Если `footer.md` отсутствует, движок подставит email `info@<основной-домен>`.
- Можно создавать дополнительные частичные файлы и подключать их вручную в заметках.

## 🚀 Скрипты и команды
`package.json` уже содержит основные сценарии:
```bash
pnpm dev        # локальная разработка
pnpm build      # сборка
pnpm deploy     # build + wrangler pages deploy dist
pnpm r2:put     # wrangler r2 object put
pnpm r2:delete  # wrangler r2 object delete
```

### Примеры работы с R2
```bash
# Загрузка заметки
pnpm r2:put sgr-blog-content/domain-a.example/section/topic-a.md \
  --file ./content/domain-a/section/topic-a.md --remote

# Добавление заголовка/футера
pnpm r2:put sgr-blog-content/domain-a.example/header.md --file ./header.md --remote
pnpm r2:put sgr-blog-content/domain-a.example/footer.md --file ./footer.md --remote

# Удаление объекта
pnpm r2:delete sgr-blog-content/domain-a.example/draft-note.md --remote
```

## 🛠 Настройка нового домена
1. Добавить CNAME в Cloudflare Pages.
2. Создать папку в бакете: `sgr-blog-content/<domain>/`.
3. Загрузить `header.md`, `footer.md`, `index.md` и остальные заметки.
4. При необходимости разместить общий MOC в `indexes/` и сослаться на него через `PUBLIC_INDEX_URL`.
5. Проверить `https://<domain>/` и несколько заметок (`/n/<slug>` и `/n/<slug>.md`).

## 🔒 Приватный контент
- Создайте подпапку (например, `domain-a.example/private/`) и в ней собственный `index.md`.
- Ограничьте доступ через Cloudflare Zero Trust или иные средства.
- Внутренние ссылки вида `/n/private/report` продолжат работать для авторизованных пользователей.

## 🧩 Пример структуры домена
- Главный MOC: `domain-a.example/index.md`
- Тематический раздел: `domain-a.example/section/index.md`
- Подзаписки: `domain-a.example/section/topic-a.md`, `domain-a.example/section/topic-b.md`
- Заголовок и футер: `domain-a.example/header.md`, `domain-a.example/footer.md`

Используйте этот пример как шаблон для остальных доменов.

## ✨ Новые возможности

### Предотвращение дублирования заголовков
- Система автоматически определяет наличие H1 в начале markdown контента
- Если контент начинается с `# Заголовок`, то заголовок из frontmatter не рендерится
- Это предотвращает дублирование заголовков на странице
- Свойство `hasH1` в интерфейсе `Note` контролирует это поведение

### Тестирование и качество кода
- **43 автоматических теста** покрывают все основные функции
- Тесты для определения H1, обработки wikilinks, domain routing, поиска
- Покрытие: markdown обработка, wikilinks, доменная фильтрация, search API
- Запуск: `pnpm test` или `pnpm test:run`
- Линтинг: `pnpm lint` с автофиксом через `pnpm lint:fix`
- Husky + lint-staged для автоматической проверки при коммитах

## 🔍 Система поиска

### AutoRAG интеграция
- **Векторный поиск** через Cloudflare Vectorize
- **AI-режим** с семантическим поиском и генерацией ответов
- **Regular режим** для точного текстового поиска
- **Доменная фильтрация** автоматически по текущему домену
- **Highlight система** с сохранением выделений в localStorage

### API endpoints
- `GET /api/search?q=query&mode=ai|regular&domain=example.com`
- Возвращает результаты с title, content, url и метаданными
- Автоматическая фильтрация служебных файлов (header, footer, index)

### Поисковая страница
- `/search` - интерфейс с переключением режимов
- Сохранение настроек в URL параметрах
- Real-time подсветка найденного текста
- Responsive дизайн для мобильных устройств

## 📄 Динамическая генерация

### Sitemap.xml
- Автоматическая генерация из R2 контента
- Исключение служебных файлов (header.md, footer.md, index.md)
- Правильные lastmod даты из метаданных R2
- Соответствие стандартам Google SEO

### llms.txt
- Структурированный список всех публичных заметок
- Ссылки на raw markdown версии (.md)
- Динамический baseUrl для мультидоменности
- Фильтрация приватного и служебного контента

## 🎨 Пользовательский интерфейс

### Навигация
- Генерация дефолтного header для доменов без header.md
- Унифицированное название "Blog - Zettelkasten" для всех доменов
- Основные ссылки: главная, поиск, llms.txt
- Responsive меню для мобильных устройств

### Подсветка текста
- JavaScript модуль для highlight функциональности
- Сохранение состояния в localStorage
- Автоматическая очистка при смене страницы
- Поддержка множественных выделений

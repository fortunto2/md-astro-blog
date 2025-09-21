# CLAUDE.md - Astro Zettelkasten Blog

Этот файл содержит инструкции для Claude Code при работе с Astro Zettelkasten блогом.

## Архитектура проекта

### Основная концепция
Это Astro SSR (Server-Side Rendering) приложение для Zettelkasten блога с:
- **On-the-fly рендеринг** markdown файлов из R2 хранилища
- **Dual endpoints**: HTML (`/n/[slug]`) и raw markdown (`/n/[slug].md`)
- **Wikilinks поддержка**: `[[заметка]]` → `/n/заметка`
- **Публичный/приватный контент** с SEO оптимизацией
- **Edge кеширование** через Cloudflare

### Технический стек
- **Astro 5.13.9** с SSR режимом
- **@astrojs/cloudflare** адаптер для Cloudflare Pages
- **markdown-it** + **highlight.js** для обработки markdown
- **Cloudflare R2** для хранения контента
- **Custom domain** `content.example.com` для доступа к R2

## Структура файлов

```
blog2/
├── src/
│   ├── lib/
│   │   └── md.ts                    # Основная логика markdown обработки
│   ├── pages/
│   │   ├── index.astro              # Главная страница (domain index + header/footer)
│   │   ├── n/
│   │   │   ├── [...slug].astro      # HTML рендеринг заметок
│   │   │   └── [...slug].md.ts      # API для raw markdown
│   │   └── api/
│   │       └── r2/[...path].ts      # Fallback API для R2 доступа
├── astro.config.mjs                 # Astro конфигурация
├── wrangler.toml                    # Cloudflare Workers конфигурация
└── CLAUDE.md                        # Этот файл
```

## Ключевые файлы

### `/src/lib/md.ts`
Центральный модуль для работы с markdown:

```typescript
// Основные функции
export async function fetchNote(slug: string): Promise<Note | null>
export function parseFrontmatter(markdown: string): { frontmatter: NoteFrontmatter; content: string }
export function processWikilinks(content: string): string
export async function fetchPage(slug: string): Promise<string | null>
export function isPrivate(frontmatter: NoteFrontmatter): boolean
export function generateMetaTags(frontmatter: NoteFrontmatter, slug: string)
```

**Важные особенности:**
- Поддерживает fallback через internal API (`/api/r2/`)
- Обрабатывает wikilinks: `[[заметка]]` → `[заметка](/n/заметка)`
- Приватной считается заметка, только если в frontmatter указано `status: "private"`


**Критически важно:**
- `PUBLIC_MD_BASES` опционален — оставьте пустым, если читаете контент напрямую через `BLOG_CONTENT`
- При необходимости можно указать CDN (например, `https://content.example.com`), который будет использоваться как fallback к R2
- Можно указать несколько источников через точку с запятой

## Команды разработки

### Основные команды
```bash
# Установка зависимостей
pnpm install

# Запуск dev сервера с R2 эмуляцией (рекомендуется)
pnpm dev

# Сборка для продакшена
pnpm build

# Деплой на Cloudflare Pages
pnpm deploy

# Тесты
pnpm test
pnpm test:run

# Линтинг
pnpm lint
pnpm lint:fix
```

### Локальная разработка

```bash
# Запуск dev сервера
pnpm dev
```

**Автоматический режим:**
- В **dev** режиме: читает контент из папки `dev-content/`
- В **production**: использует R2 или публичный URL как fallback

**Структура локального контента:**
```
dev-content/
├── domain-a.example/
│   ├── index.md
│   ├── test-note.md
│   └── private-note.md
├── domain-b.example/
│   └── другие-заметки.md
└── shared/
    └── global-note.md
```

**Примеры тестовых URL:**
- `http://localhost:4322/` - главная (domain-a.example/index.md) с header/footer
- `http://localhost:4322/?domain=domain-b.example` - минималистичная главная без header
- `http://localhost:4322/n/test-note` - тестовая заметка с header/footer
- `http://localhost:4322/n/minimal-note?domain=domain-b.example` - заметка без header/footer
- `http://localhost:4322/n/private-note` - приватная заметка
- `http://localhost:4322/n/shared/global-note` - общая заметка

### Работа с R2 контентом
> Приложение использует R2-биндинг `BLOG_CONTENT` (bucket `sgr-blog-content`) и индекс Vectorize `VECTOR_INDEX` (`autorag-blog-deep`), объявленные в `wrangler.toml`. Никаких дополнительных ключей или URL в `.env` не требуется.
```bash
# Загрузка файлов в R2 (ВАЖНО: использовать --remote)
pnpm r2:put sgr-blog-content/domain/filename.md --file /path/to/file.md --remote

# Массовая загрузка
for file in /path/to/notes/*.md; do
    filename=$(basename "$file")
    pnpm r2:put sgr-blog-content/domain/"$filename" --file "$file" --remote
done

# Проверка доступности (для CDN fallback)
curl -I "https://content.example.com/filename.md"
```

### Тестирование эндпоинтов
```bash
# HTML рендеринг
curl "http://localhost:4322/n/note-slug"

# Raw markdown
curl "http://localhost:4322/n/note-slug.md"

# Главная страница
curl "http://localhost:4322/"
```

## Работа с контентом

### Header и Footer (опционально)
- **header.md** — опциональный заголовок для домена
- **footer.md** — опциональный подвал для домена
- **index.md** — обязательная главная страница

**Приоритет поиска:**
1. Домен-специфичный файл: `{domain}/header.md`
2. Общий файл: `shared/header.md`
3. Если не найден — не отображается (header) или fallback email (footer)

**Тестирование локально:**
- С header/footer: `?domain=domain-a.example`
- Без header/footer: `?domain=domain-b.example`

### Frontmatter формат
```yaml
---
title: 'Заголовок заметки'
date: '2025-09-17'
description: 'Краткое описание'
tags: ['тег1', 'тег2']
category: 'категория'
status: 'public'  # или 'private'
domain: 'example.com'  # опционально
cover: 'https://example.com/image.jpg'  # опционально
aliases: ['алиас1', 'алиас2']  # опционально
---
```

### Wikilinks
```markdown
[[20250101-sample-note]]

# Преобразуется в:
[20250101-sample-note](/n/20250101-sample-note)
```

### Статус приватности
- **Публичные**: по умолчанию, либо `status: 'public'`
- **Приватные**: только если указано `status: 'private'`
- Приватные заметки получают `noindex,nofollow` и баннер-предупреждение

## Деплой и продакшен

### Текущие URL
- **Продакшен**: https://2448f163.sgr-blog.pages.dev
- **Dev сервер**: http://localhost:4322 (если 4321 занят)
- **R2 CDN (опционально)**: https://content.example.com

### Процесс деплоя
2. Проверить что все файлы загружены в R2 с `--remote`
3. Запустить `pnpm build`
4. Проверить что сборка прошла без ошибок
5. Деплой: `pnpm deploy`

### Cloudflare конфигурация
```toml
# wrangler.toml
name = "sgr-blog"
compatibility_date = "2024-01-01"

[[r2_buckets]]
binding = "BLOG_CONTENT"
bucket_name = "sgr-blog-content"
```

## Устранение проблем

### R2 доступ
**Проблема**: 404 ошибки при доступе к загруженным файлам
**Решение**:
- Использовать `--remote` флаг при загрузке
- Проверить что файлы доступны через `content.example.com`

### Cloudflare адаптер
**Проблема**: "Cannot find module '@astrojs/cloudflare'"
**Решение**: `pnpm add @astrojs/cloudflare`

### Dev сервер
**Проблема**: Порт 4321 занят
**Решение**: Astro автоматически выберет следующий порт (4322, 4323, etc.)

### Кеширование
- **Dev**: Кеширование отключено
- **Продакшен**:
  - HTML: `s-maxage=86400, stale-while-revalidate=604800`
  - Markdown: `max-age=0, s-maxage=86400`

## Расширение функциональности


### Мультидоменная система контента
**НОВОЕ**: Поддержка разделения контента по доменам в одном R2 бакете:

```
sgr-blog-content/
├── domain-a.example/   # Контент для первого домена
├── domain-b.example/   # Контент для второго домена
├── shared/             # Общие заметки (опционально)
└── *.md                # Legacy файлы в корне
```

**Приоритет поиска заметок:**
1. Домен-специфичная папка: `/{domain}/{slug}.md`
2. Общая папка: `/shared/{slug}.md`
3. Корневая папка: `/{slug}.md` (legacy)

**Загрузка контента:**
```bash
# Домен-специфичный контент
pnpm r2:put sgr-blog-content/domain-a.example/note.md --file note.md --remote

# Общий контент (если требуется)
pnpm r2:put sgr-blog-content/shared/global-note.md --file note.md --remote
```

Подробности в [DOMAINS.md](./DOMAINS.md)

### Кастомизация рендеринга
Редактировать `src/lib/md.ts`:
- `processWikilinks()` - логика wikilinks
- `parseFrontmatter()` - парсинг метаданных
- `generateMetaTags()` - SEO метатеги
- `getCurrentDomain()` - определение текущего домена
- `fetchNote()` - домен-специфичный поиск заметок

### Новые страницы
Создать в `src/pages/`:
- `.astro` файлы для HTML страниц
- `.ts` файлы для API эндпоинтов

## Мониторинг и аналитика

### Логи доступа
Cloudflare автоматически логирует:
- HTTP статусы
- Cache hit/miss
- Geographic data
- User agents

### Производительность
- Edge кеширование через Cloudflare
- SSR только для новых/измененных файлов
- Оптимизированные CSS/JS bundle

## Безопасность

### Приватный контент
- Не индексируется поисковиками (`noindex,nofollow`)
- Доступен по прямой ссылке
- Нет дополнительной аутентификации

### CORS и заголовки
```javascript
headers: {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, max-age=300, s-maxage=3600',
  'Access-Control-Allow-Origin': '*',
}
```

## Полезные ссылки

- **Astro Docs**: https://docs.astro.build
- **Cloudflare Pages**: https://pages.cloudflare.com
- **R2 Storage**: https://developers.cloudflare.com/r2/
- **Wrangler CLI**: https://developers.cloudflare.com/workers/wrangler/

---

## Дополнительные возможности

### Предотвращение дублирования заголовков
- Система автоматически определяет наличие H1 в начале markdown контента
- Если контент начинается с `# Заголовок`, то заголовок из frontmatter не рендерится
- Это предотвращает дублирование заголовков на странице
- Свойство `hasH1` в интерфейсе `Note` контролирует это поведение

### Тестирование
- **30 тестов** покрывают все основные функции
- Тесты для определения H1, обработки wikilinks, domain routing
- Запуск: `pnpm test` или `pnpm test:run`
- Линтинг: `pnpm lint` с автофиксом через `pnpm lint:fix`

---

**Последнее обновление**: 2025-09-22
**Версия Astro**: 5.13.9
**Статус**: Продакшен готов ✅

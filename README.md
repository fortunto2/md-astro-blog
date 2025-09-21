# Astro Zettelkasten Blog

SSR-блог для заметок с поддержкой wikilinks и R2 хранилища.

## 🚀 Особенности

- **SSR рендеринг** markdown файлов on-the-fly
- **Dual endpoints**: HTML (`/n/[slug]`) и raw markdown (`/n/[slug].md`)
- **Wikilinks**: `[[заметка]]` → `/n/заметка`
- **Публичный/приватный контент** с SEO
- **Cloudflare R2** хранилище контента
- **Edge кеширование** через Cloudflare Pages

## 📁 Структура

```text
blog2/
├── src/
│   ├── lib/md.ts           # Обработка markdown
│   ├── pages/
│   │   ├── index.astro     # Главная (доменный MOC + header/footer)
│   │   └── n/
│   │       ├── [...slug].astro    # HTML заметки
│   │       └── [...slug].md.ts    # Raw markdown API
├── .env                    # Конфигурация
└── CLAUDE.md              # Подробная документация
```

## 🧞 Команды

| Команда | Описание |
|---------|----------|
| `pnpm dev` | Dev сервер `localhost:4322` |
| `pnpm build` | Сборка в `./dist/` |
| `pnpm deploy` | Сборка + деплой на Cloudflare |
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

- R2 bucket: `BLOG_CONTENT` → `sgr-blog-content`
- Vectorize index: `VECTOR_INDEX` → `autorag-blog-deep`

Without these bindings the worker will return 500 errors when trying to read content.


# Мультидоменная система контента

## 🎯 Что изменилось
- Каждый домен управляет своим заголовком и футером через `header.md` и `footer.md` в папке домена.
- Индекс домена ищется по цепочке: `/<domain>/index.md` → `/indexes/<basename>.md` → значение `PUBLIC_INDEX_URL`.
- Заметки и вложенные папки резолвятся напрямую из каталога домена; `shared/` и корневой fallback более не используются (можно оставлять пустыми).
- Приватные области можно организовать в произвольных подпапках (например, `private/`) и закрыть доступ через Cloudflare Zero Trust.
- `/all` удалён — весь публичный контент управляется через доменные индексы.
- Контент читается через биндинг `BLOG_CONTENT`; `PUBLIC_MD_BASES` можно оставить пустым, если не нужен CDN fallback.

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
1. `https://content.example.com/<domain>/<slug>.md`
2. Если путь начинается с `indexes/` — `https://content.example.com/indexes/<slug>.md`
3. Если путь содержит другой домен в виде `<other-domain>/<slug>` — запрос в этот домен
4. Фолбек через собственный `/api/r2/<slug>.md`

> Классический fallback `/<slug>.md` и `shared/` отключены — структура контролируется доменными папками.

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

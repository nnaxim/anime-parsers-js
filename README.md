# anime-parsers-js

JavaScript порт Python библиотеки [AnimeParsers](https://github.com/YaNesyTortiK/AnimeParsers) от [@YaNesyTortiK](https://github.com/YaNesyTortiK).

Огромное спасибо автору оригинальной библиотеки за проделанную работу

---

## Установка

```bash
npm install anime-parsers
```

## Импорт
```js
const { KodikParser } = require("anime-parsers");
или
import { KodikParser } from "anime-parsers";
```

---

## Что реализовано

- [x] `KodikParser` - парсер плеера Kodik (требуется API токен)

## TODO

- [ ] `AniboomParser` - парсер AniBoom
- [ ] `JutsuParser` - парсер JutSu
- [ ] `ShikimoriParser` - парсер Shikimori

---

## KodikParser

### Важно

На данный момент метод `getToken()` не подходит для использования с методами:

- `baseSearch`
- `baseSearchById`
- `getList`
- `search`

Получение токена через этот способ нестабильно
Рекомендуется использовать собственный токен, полученный напрямую от Kodik

Подробнее:
https://github.com/YaNesyTortiK/AnimeParsers/issues/25

---

### Альтернатива

Можно использовать готовую базу аниме (~8000 тайтлов):
https://github.com/nnaxim/anime-table

В таблице есть поле `shikimori_id`, с помощью которого можно:

- получать ссылки на плеер через Kodik
- получать список озвучек
- парсить серии

Это позволяет работать без поиска через API и обходить ограничения с токеном

Пример использования
```js
const token = await KodikParser.getToken()

const parser = new KodikParser(token)

await parser.getM3u8PlaylistLink('shikimori_id из таблицы выше', "shikimori", 1, "735", 480)
// https://cloud.kodik-storage.com/.....
```

### Инициализация

```js
import { KodikParser } from "anime-parsers";

const token = await KodikParser.getToken()
const parser = new KodikParser(token)
```

### Получить токен

```js
const token = await KodikParser.getToken()
```

### Поиск по названию

```js
const results = await parser.search('Наруто')
// Возвращает массив объектов с полями:
// title, title_orig, other_title, type, year,
// screenshots, shikimori_id, kinopoisk_id, imdb_id,
// worldart_link, additional_data, material_data, link
```

### Поиск по ID

```js
// id_type: 'shikimori' | 'kinopoisk' | 'imdb'
const results = await parser.searchById('z20', 'shikimori')
```

### Информация об аниме (переводы и количество серий)

```js
const info = await parser.getInfo('z20', 'shikimori')
// { series_count: 220, translations: [{ id, type, name }] }

const count = await parser.seriesCount('z20', 'shikimori')
// 220

const translations = await parser.translations('z20', 'shikimori')
// [{ id: '735', type: 'Озвучка', name: '2x2 (220 эп.)' }, ...]
```

### Ссылка на видеофайл

```js
const [url, maxQuality] = await parser.getLink('z20', 'shikimori', 1, '609')
// url: '//cloud.kodik-storage.com/.../'
// maxQuality: 720
// Итоговая ссылка: 'https:' + url + '720.mp4'
```

> Если аниме - фильм или одна серия, передайте `seriaNum = 0`.
> Если перевод неизвестен - передайте `translationId = '0'`.

### M3U8 плейлист

```js
// Ссылка на плейлист
const link = await parser.getM3u8PlaylistLink('z20', 'shikimori', 1, '609', 480)
// 'https://cloud.kodik-storage.com/.../480.mp4:hls:manifest.m3u8'

// Содержимое плейлиста (с полными ссылками на сегменты)
const playlist = await parser.getM3u8Playlist('z20', 'shikimori', 1, '609', 480)
```

### Список аниме

```js
const [list, nextPageId] = await parser.getList(
    50,          // limitPerPage
    1,           // pagesToParse
    true,        // includeMaterialData
    'ongoing',   // animeStatus: 'ongoing' | 'released' | null
    true,        // onlyAnime
    null         // startFrom (nextPageId из предыдущего запроса)
)
```

### Прямой запрос к API

```js
const data = await parser.apiRequest('search', { title: 'Наруто', limit: 5 })
// Возвращает сырой ответ сервера
```

---

## Оригинальная библиотека

- Репозиторий: [github.com/YaNesyTortiK/AnimeParsers](https://github.com/YaNesyTortiK/AnimeParsers)
- Автор: [@YaNesyTortiK](https://github.com/YaNesyTortiK)

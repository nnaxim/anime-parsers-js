# anime-parsers-js

JavaScript порт Python библиотеки [AnimeParsers](https://github.com/YaNesyTortiK/AnimeParsers) от [@YaNesyTortiK](https://github.com/YaNesyTortiK).

---

## Установка

```bash
npm install anime-parsers-js
```

## Импорт

```js
// CommonJS
const { KodikParser, Shikimori } = require("anime-parsers-js");

// ESM
import { KodikParser, Shikimori } from "anime-parsers-js";
```

## Для разработки

```bash
git clone https://github.com/nnaxim/anime-parsers-js.git
cd anime-parsers-js
npm install
```

---

## Что реализовано

- [x] `KodikParser` - парсер плеера Kodik
- [x] `Shikimori` - парсер Shikimori

## TODO

- [ ] `AniboomParser` - парсер AniBoom

---

## KodikParser

### Инициализация

```js
import { KodikParser } from "anime-parsers-js";

const token = await KodikParser.getToken()
const parser = new KodikParser(token)
```

#### Получить токен
```js
const token = await KodikParser.getToken()
```

#### Поиск по названию
```js
const results = await parser.search('Наруто')
// Возвращает массив объектов:
// [{ title, title_orig, other_title, type, year,
// screenshots, shikimori_id, kinopoisk_id, imdb_id,
// worldart_link, additional_data, material_data, link }]
```

#### Поиск по ID
```js
// idType: 'shikimori' | 'kinopoisk' | 'imdb'
const results = await parser.searchById('z20', 'shikimori')
```

#### Информация (переводы и количество серий)
```js
const info = await parser.getInfo('z20', 'shikimori')
// { series_count: 220, translations: [{ id, type, name }] }

const count = await parser.seriesCount('z20', 'shikimori')
// 220

const translations = await parser.translations('z20', 'shikimori')
// [{ id: '735', type: 'Озвучка', name: '2x2 (220 эп.)' }, ...]
```

#### Ссылка на видеофайл
```js
const [url, maxQuality] = await parser.getLink('z20', 'shikimori', 1, '609')
// url: '//cloud.kodik-storage.com/.../'
// maxQuality: 720
// Итоговая ссылка: 'https:' + url + '720.mp4'
```

> Если аниме - фильм или одна серия: `seriaNum = 0`
> Если перевод неизвестен: `translationId = '0'`

#### M3U8 плейлист
```js
// Ссылка на плейлист
const link = await parser.getM3u8PlaylistLink('z20', 'shikimori', 1, '609', 480)
// 'https://cloud.kodik-storage.com/.../480.mp4:hls:manifest.m3u8'

// Содержимое плейлиста (с полными ссылками на сегменты)
const playlist = await parser.getM3u8Playlist('z20', 'shikimori', 1, '609', 480)
```

#### Список аниме
```js
const [list, nextPageId] = await parser.getList(
    50, // limitPerPage
    1, // pagesToParse
    true, // includeMaterialData
    'ongoing', // animeStatus: 'ongoing' | 'released' | null
    true, // onlyAnime
    null // startFrom (nextPageId из предыдущего запроса)
)
```

#### Прямой запрос к API
```js
const data = await parser.apiRequest('search', { title: 'Наруто', limit: 5 })
// Возвращает сырой ответ сервера
```

---

## Shikimori

### Инициализация

```js
import { Shikimori } from "anime-parsers-js";

// Обычная
const shiki = new Shikimori()

// С зеркалом
const shiki = new Shikimori({ mirror: 'shikimori.me' })
```

#### Быстрый поиск
```js
const results = await shiki.search('Наруто')
// [{ title, original_title, shikimori_id, poster,
//    type, status, studio, year, genres, link }]
```

#### Информация об аниме
```js
const info = await shiki.animeInfo('https://shikimori.one/animes/z20-naruto')
// { title, original_title, picture, type, episodes,
// status, genres, themes, rating, score,
// description, studio, dates, next_episode, ... }
```

#### Дополнительная информация
```js
const extra = await shiki.additionalAnimeInfo('https://shikimori.one/animes/z20-naruto')
// { related, staff, main_characters, screenshots, videos, similar }
```

#### Список аниме по фильтрам
```js
const list = await shiki.getAnimeList({
    status: ['ongoing'], // 'ongoing' | 'anons' | 'released' | 'latest'
    animeType: ['tv'], // 'tv' | 'movie' | 'ova' | 'ona' | 'special' | ...
    rating: 'pg_13', // 'g' | 'pg' | 'pg_13' | 'r' | 'r_plus'
    genres: ['27-Shounen'], // см. Shikimori.genresList
    startPage: 1,
    pageLimit: 3,
    sortBy: 'rating' // 'rating' | 'popularity' | 'name' | 'aired_on' | ...
})
```

#### Календарь онгоингов
```js
const calendar = await shiki.getOngoingCalendar()
// { 'Понедельник, 7 апреля': [{ id, link, name_ru, name_en, picture, episode, time, release_type }] }
```

#### Ссылка по ID
```js
const link = await shiki.linkById('20')
// 'https://shikimori.one/animes/z20-naruto'
```

#### ID из ссылки
```js
const id = shiki.idByLink('https://shikimori.one/animes/z20-naruto')
// '20'
```

#### Поиск через GraphQL
```js
const results = await shiki.deepSearch('Наруто', { limit: 5, status: 'released' })

const info = await shiki.deepAnimeInfo('20')
```

---

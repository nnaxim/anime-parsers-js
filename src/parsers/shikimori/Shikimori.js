import axios from "axios"
import { load } from 'cheerio'
import { ServiceError, ServiceIsOverloaded, TooManyRequests } from "../../errors/index.js"

export class Shikimori {
    static genresList = ['1-Action', '2-Adventure', '3-Racing', '4-Comedy', '5-Avant-Garde', '6-Mythology', '7-Mystery', '8-Drama', '9-Ecchi', '10-Fantasy', '11-Strategy-Game', '13-Historical', '14-Horror', '15-Kids', '17-Martial-Arts', '18-Mecha', '19-Music', '20-Parody', '21-Samurai', '22-Romance', '23-School', '24-Sci-Fi', '25-Shoujo', '27-Shounen', '29-Space', '30-Sports', '31-Super-Power', '32-Vampire', '35-Harem', '36-Slice-of-Life', '37-Supernatural', '38-Military', '39-Detective', '40-Psychological', '42-Seinen', '43-Josei', '102-Team-Sports', '103-Video-Game', '104-Adult-Cast', '105-Gore', '106-Reincarnation', '107-Love-Polygon', '108-Visual-Arts', '111-Time-Travel', '112-Gag-Humor', '114-Award-Winning', '117-Suspense', '118-Combat-Sports', '119-CGDCT', '124-Mahou-Shoujo', '125-Reverse-Harem', '130-Isekai', '131-Delinquents', '134-Childcare', '135-Magical-Sex-Shift', '136-Showbiz', '137-Otaku-Culture', '138-Organized-Crime', '139-Workplace', '140-Iyashikei', '141-Survival', '142-Performing-Arts', '143-Anthropomorphic', '144-Crossdressing', '145-Idols-(Female)', '146-High-Stakes-Game', '147-Medical', '148-Pets', '149-Educational',  '150-Idols-(Male)', '151-Romantic-Subtext', '543-Gourmet']

    constructor({ mirror = null } = {}) {
        this._dmn = mirror ?? "shikimori.one"
    }

    _checkStatus(status, url = '') {
        if (status === 429) throw new TooManyRequests('Сервер вернул код 429 для обозначения что запросы выполняются слишком часто.')
        if (status === 520) throw new ServiceIsOverloaded('Сервер вернул статус ответа 520, что означает что он перегружен и не может ответить сразу.')
        if (status !== 200) throw new ServiceError(`Сервер не вернул ожидаемый код 200. Код: "${status}"`)
    }

    async search(title) {
        const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        }

        const response = await axios.get(`https://${this._dmn}/animes/autocomplete/v2`, {
        params: { search: title },
        headers,
        validateStatus: () => true
        })

        this._checkStatus(response.status)

        const html = response.data?.content ?? ''
        const $ = load(html)
        const res = []

        $('div.b-db_entry-variant-list_item').each((_, el) => {
        const elem = $(el)
        if (elem.attr('data-type') !== 'anime') return

        const cData = {}
        cData.link = elem.attr('data-url')
        cData.shikimori_id = elem.attr('data-id')

        const imageEl = elem.find('div.image picture img')
        cData.poster = imageEl.length
            ? imageEl.attr('srcset')?.replace(' 2x', '') ?? null
            : null

        const info = elem.find('div.info')
        const nameLink = info.find('div.name a')
        cData.original_title = nameLink.attr('title') ?? null
        cData.title = nameLink.text().split('/')[0] ?? null

        const lineKey = info.find('div.line div.key').text()
        if (lineKey === 'Тип:') {
            const lineValue = info.find('div.line div.value')
            cData.type = lineValue.find('div.b-tag').first().text() ?? null

            const statusTags = lineValue.find('div.b-anime_status_tag')
            cData.status = statusTags.last().attr('data-text') ?? null
            cData.studio = statusTags.length > 1 ? statusTags.first().attr('data-text') ?? null : null

            const bTags = lineValue.find('div.b-tag')
            cData.year = bTags.length > 1
            ? bTags.last().text().replace(' год', '')
            : null
        } else {
            cData.type = null
            cData.status = null
            cData.studio = null
            cData.year = null
        }

        cData.genres = []
        info.find('span.genre-ru').each((_, g) => cData.genres.push($(g).text()))

        res.push(cData)
        })

        return res
    }

    async animeInfo(shikimoriLink) {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
        }

        const response = await axios.get(shikimoriLink, {
            headers,
            validateStatus: () => true
        })

        this._checkStatus(response.status)

        const $ = load(response.data)

        if ($('p.age-restricted-warning').length) {
            throw new AgeRestricted(`Аниме по ссылке "${shikimoriLink}" невозможно обработать из-за блокировки по возрастному рейтингу.`)
        }

        const res = {}

        const titleParts = $('header.head h1').text().split(' / ')
        res.title = titleParts[0] ?? null
        res.original_title = titleParts[1] ?? null

        const picture = $('picture img').first()
        res.picture = picture.length
            ? picture.attr('srcset')?.replace(' 2x', '') ?? null
            : null

        $('div.c-info-left div.block div.line').each((_, el) => {
            const line = $(el)
            const key = line.find('div.key').text()
            const value = line.find('div.value')

            if (key === 'Тип:') res.type = value.text().trim()
            else if (key === 'Эпизоды:') res.episodes = value.text().trim()
            else if (key === 'Следующий эпизод:') res.next_episode = value.find('span').attr('data-datetime') ?? null
            else if (key === 'Длительность эпизода:') res.episode_duration = value.text().trim()
            else if (key === 'Статус:') {
            res.status = value.find('span').first().attr('data-text') ?? null
            const spans = value.find('span')
            res.dates = spans.length > 1
                ? spans.last().text()
                : value.text().trim()
            }
            else if (key === 'Жанры:') {
            res.genres = []
            value.find('span.genre-ru').each((_, g) => res.genres.push($(g).text()))
            }
            else if (key === 'Темы:' || key === 'Тема:') {
            res.themes = []
            value.find('span.genre-ru').each((_, g) => res.themes.push($(g).text()))
            }
            else if (key === 'Рейтинг:') res.rating = value.text().trim()
            else if (key === 'Лицензировано:') res.licensed = value.text().trim()
            else if (key === 'Лицензировано в РФ под названием:') res.licensed_in_ru = value.text().trim()
            else if (key === 'Премьера в РФ:') res.premiere_in_ru = value.text().trim()
        })

        for (const k of ['type', 'episodes', 'next_episode', 'episode_duration', 'status', 'genres', 'themes', 'rating', 'dates', 'licensed', 'licensed_in_ru', 'premiere_in_ru']) {
            if (!(k in res)) res[k] = null
        }

        const desc = $('div.text').first()
        res.description = desc.length ? desc.text() : null

        const score = $('div.score-value').first()
        res.score = score.length ? score.text() : null

        const studioEl = $('a[title]').filter((_, el) => /^Аниме студии/.test($(el).attr('title'))).first()
        res.studio = studioEl.length
            ? studioEl.attr('title').replace('Аниме студии ', '')
            : null

        return res
    }


}

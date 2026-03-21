import axios from "axios"
import { load } from 'cheerio'
import { AgeRestricted, NoResults, PostArgumentsError, ServiceError, ServiceIsOverloaded, TooManyRequests, UnexpectedBehavior } from "../../errors/index.js"

export class Shikimori {
    static genresList = ['1-Action', '2-Adventure', '3-Racing', '4-Comedy', '5-Avant-Garde', '6-Mythology', '7-Mystery', '8-Drama', '9-Ecchi', '10-Fantasy', '11-Strategy-Game', '13-Historical', '14-Horror', '15-Kids', '17-Martial-Arts', '18-Mecha', '19-Music', '20-Parody', '21-Samurai', '22-Romance', '23-School', '24-Sci-Fi', '25-Shoujo', '27-Shounen', '29-Space', '30-Sports', '31-Super-Power', '32-Vampire', '35-Harem', '36-Slice-of-Life', '37-Supernatural', '38-Military', '39-Detective', '40-Psychological', '42-Seinen', '43-Josei', '102-Team-Sports', '103-Video-Game', '104-Adult-Cast', '105-Gore', '106-Reincarnation', '107-Love-Polygon', '108-Visual-Arts', '111-Time-Travel', '112-Gag-Humor', '114-Award-Winning', '117-Suspense', '118-Combat-Sports', '119-CGDCT', '124-Mahou-Shoujo', '125-Reverse-Harem', '130-Isekai', '131-Delinquents', '134-Childcare', '135-Magical-Sex-Shift', '136-Showbiz', '137-Otaku-Culture', '138-Organized-Crime', '139-Workplace', '140-Iyashikei', '141-Survival', '142-Performing-Arts', '143-Anthropomorphic', '144-Crossdressing', '145-Idols-(Female)', '146-High-Stakes-Game', '147-Medical', '148-Pets', '149-Educational', '150-Idols-(Male)', '151-Romantic-Subtext', '543-Gourmet']

    constructor({ mirror = null } = {}) {
        this._dmn = mirror ?? "shikimori.one"
    }

    _checkStatus(status) {
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
                res.dates = spans.length > 1 ? spans.last().text() : value.text().trim()
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

    async additionalAnimeInfo(shikimoriLink) {
        const link = shikimoriLink.endsWith('/')
            ? shikimoriLink + 'resources'
            : shikimoriLink + '/resources'

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
        }

        const response = await axios.get(link, {
            headers,
            validateStatus: () => true
        })

        this._checkStatus(response.status)

        const $ = load(response.data)

        if ($('p.age-restricted-warning').length) {
            throw new AgeRestricted(`Аниме по ссылке "${shikimoriLink}" невозможно обработать из-за блокировки по возрастному рейтингу.`)
        }

        const res = {
            related: [], staff: [], main_characters: [], screenshots: [], videos: [], similar: []
        }

        $('div.cc-related-authors div.c-column').each((_, col) => {
            const colEl = $(col)
            const colType = colEl.find('div.subheadline').text()

            if (colType === 'Связанное') {
                colEl.find('div.b-db_entry-variant-list_item').each((_, el) => {
                    const entry = $(el)
                    const cData = {}

                    cData.url = entry.attr('data-url') ?? null

                    const img = entry.find('picture img')
                    cData.picture = img.length ? img.attr('srcset')?.replace(' 2x', '') ?? null : null

                    const nameRu = entry.find('div.name span.name-ru')
                    const nameEn = entry.find('div.name span.name-en')
                    cData.name = nameRu.length
                        ? nameRu.text()
                        : nameEn.length
                            ? nameEn.text()
                            : null

                    cData.relation = null
                    cData.type = null
                    cData.date = null

                    entry.find('div.line div').each((_, div) => {
                        const d = $(div)
                        const cls = (d.attr('class') ?? '').split(' ')
                        if (cls.includes('b-anime_status_tag')) {
                            cData.relation = d.text()
                        } else if (cls.includes('linkeable')) {
                            const href = d.attr('data-href') ?? ''
                            if (href.includes('/kind/')) cData.type = d.text()
                            else if (href.includes('/season/')) cData.date = d.text()
                        }
                    })

                    if (cData.type === 'Клип' && !cData.name) {
                        cData.name = entry.find('div.name a').first().text() || null
                    }

                    res.related.push(cData)
                })
            } else if (colType === 'Авторы') {
                colEl.find('div.b-db_entry-variant-list_item').each((_, el) => {
                    const entry = $(el)
                    const cData = {}
                    cData.link = entry.attr('data-url') ?? null
                    cData.name = entry.attr('data-text') ?? null
                    cData.roles = []
                    entry.find('div.line div.b-tag').each((_, role) => cData.roles.push($(role).text()))
                    res.staff.push(cData)
                })
            }
        })

        try {
            $('div.c-characters article').each((_, el) => {
                const char = $(el)
                const cData = {}
                const imgMeta = char.find('meta[itemprop="image"]')
                cData.picture = imgMeta.length ? imgMeta.attr('content') ?? null : null
                cData.name = char.find('span.name-ru').text() || null
                res.main_characters.push(cData)
            })
        } catch {}

        try {
            const twoVideos = $('div.two-videos')
            if (twoVideos.length) {
                twoVideos.find('a.c-screenshot').each((_, el) => {
                    res.screenshots.push($(el).attr('href'))
                })
                twoVideos.find('div.c-video').each((_, el) => {
                    const vid = $(el)
                    res.videos.push({
                        link: vid.find('a').attr('href') ?? null,
                        name: vid.find('span.name').text() || null
                    })
                })
            }
        } catch {}

        try {
            $('div.block article').each((_, el) => {
                const sim = $(el)
                const cData = {}
                const imgMeta = sim.find('meta[itemprop="image"]')
                cData.picture = imgMeta.length ? imgMeta.attr('content') ?? null : null
                cData.name = sim.find('span.name-ru').text() || null
                cData.link = sim.find('div').first().attr('data-href') ?? null
                res.similar.push(cData)
            })
        } catch {}

        return res
    }

    _getAnimeInfoFromArticle($, article) {
        const el = $(article)
        const cData = {}

        cData.shikimori_id = el.attr('id') ?? null
        cData.url = el.find('a').first().attr('href') ?? null

        try {
            const img = el.find('picture img')
            cData.poster = img.length ? img.attr('srcset')?.slice(0, -3) ?? null : null
        } catch {
            cData.poster = null
        }

        try {
            const nameEn = el.find('span.name-en')
            const nameRu = el.find('span.name-ru')
            if (nameEn.length && nameRu.length) {
                cData.original_title = nameEn.text()
                cData.title = nameRu.text()
            } else {
                const title = el.find('span.title').text()
                cData.original_title = title || null
                cData.title = title || null
            }
        } catch {
            cData.original_title = null
            cData.title = null
        }

        cData.type = null
        cData.year = null

        try {
            el.find('span.misc span').each((_, m) => {
                const text = $(m).text()
                if (/^\d+$/.test(text)) cData.year = text
                else cData.type = text
            })
        } catch {}

        return cData
    }

    async getAnimeList({
        status = [],
        animeType = [],
        rating = null,
        genres = [],
        startPage = 1,
        pageLimit = 3,
        sortBy = 'rating'
    } = {}) {
        if (pageLimit <= 0) return []

        const validStatuses = ['ongoing', 'anons', 'released', 'latest']
        const validTypes = ['tv', 'movie', 'ova', 'ona', 'special', 'tv_special', 'music', 'pv', 'cm']
        const validSorts = ['rating', 'popularity', 'name', 'aired_on', 'ranked_random', 'id_desc']
        const validRatings = ['g', 'pg', 'pg_13', 'r', 'r_plus']

        status = status.filter(s => validStatuses.includes(s))
        animeType = animeType.filter(t => validTypes.includes(t))
        genres = genres.filter(g => Shikimori.genresList.includes(g))
        if (!validSorts.includes(sortBy)) sortBy = 'rating'
        if (rating && !validRatings.includes(rating)) rating = null

        let searchUrl = `https://${this._dmn}/animes`
        if (animeType.length) searchUrl += `/kind/${animeType.join(',')}`
        if (status.length) searchUrl += `/status/${status.join(',')}`
        if (genres.length) searchUrl += `/genre/${genres.join(',')}`

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
            'Accept': 'application/json, text/plain, */*',
            'Referer': `https://${this._dmn}/animes/status/ongoing`,
            'X-Requested-With': 'XMLHttpRequest',
        }

        const res = []
        let i = startPage
        let totalPages = startPage + 1

        while (i < startPage + pageLimit && i <= totalPages) {
            const url = `${searchUrl}/page/${i}.json?order=${sortBy}${rating ? `&rating=${rating}` : ''}`
            const response = await axios.get(url, { headers, validateStatus: () => true })

            this._checkStatus(response.status)

            const data = response.data
            totalPages = data.pages_count
            const $ = load(data.content)
            const articles = $('article')

            if (articles.length === 0 && i > 1) return res
            if (articles.length === 0 && i === 1) throw new NoResults('Данные по онгоингам не найдены')

            articles.each((_, art) => res.push(this._getAnimeInfoFromArticle($, art)))
            i++
        }

        return res
    }

    async getOngoingCalendar() {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
        }

        const response = await axios.get(`https://${this._dmn}/ongoings`, {
            headers,
            validateStatus: () => true
        })

        this._checkStatus(response.status)

        const $ = load(response.data)
        const res = {}

        $('div.block').each((_, block) => {
            const blockEl = $(block)
            const day = blockEl.find('div.headline').text()
            res[day] = []

            blockEl.find('article').each((_, entry) => {
                const entryEl = $(entry)
                const cover = entryEl.find('a.cover')
                if (!cover.length) return

                const item = {}
                item.id = entryEl.attr('id') ?? null
                item.link = cover.attr('href') ?? null

                const title = cover.find('span.title')
                item.name_en = title.find('span.name-en').text() || null
                item.name_ru = title.find('span.name-ru').text() || null

                const pic = cover.find('picture')
                if (pic.length) {
                    const img = pic.find('img')
                    if (img.length) {
                        item.picture = img.attr('srcset')?.slice(0, -3) ?? null
                    } else {
                        const src = pic.find('source')
                        item.picture = src.length ? src.attr('srcset')?.slice(0, -3) ?? null : null
                    }
                } else {
                    item.picture = null
                }

                const misc = cover.find('span.misc')
                if (misc.length) {
                    const miscSpans = misc.find('span')
                    const firstText = miscSpans.first().text()
                    item.episode = firstText.includes(' эпизод')
                        ? parseInt(firstText)
                        : null
                    item.time = miscSpans.eq(1).text() || null
                    item.release_type = !firstText.includes(' эпизод') ? firstText : null
                } else {
                    item.episode = null
                    item.time = null
                    item.release_type = null
                }

                res[day].push(item)
            })
        })

        return res
    }

    async linkById(shikimoriId) {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
        }

        const response = await axios.get(`https://${this._dmn}/animes/${shikimoriId}`, {
            headers,
            validateStatus: () => true,
            maxRedirects: 0
        })

        if (response.status === 404) {
            const $ = load(response.data)
            const actualCode = $('p.error-404').text()
            if (actualCode === '404') throw new NoResults(`Страница аниме с shikimori_id "${shikimoriId}" не найдена.`)
            if (actualCode === '429') throw new TooManyRequests('Сервер вернул код 429 для обозначения что запросы выполняются слишком часто.')
            if (actualCode === '302') return $('a').first().attr('href')
            throw new UnexpectedBehavior(`Непредвиденная ошибка при попытке нахождения страницы по id (${shikimoriId}). Обнаружен: "${actualCode}"`)
        }

        if (response.status === 429) throw new TooManyRequests('Сервер вернул код 429 для обозначения что запросы выполняются слишком часто.')
        if (response.status === 520) throw new ServiceIsOverloaded('Сервер вернул статус ответа 520, что означает что он перегружен и не может ответить сразу.')
        if (response.status === 200 || response.status === 302) return response.request?.res?.responseUrl ?? response.headers?.location ?? null

        throw new UnexpectedBehavior(`Непредвиденная ошибка при попытке нахождения страницы по id (${shikimoriId}). Обнаружен: "${response.status}"`)
    }

    idByLink(shikimoriLink) {
        const afterSlash = shikimoriLink.slice(shikimoriLink.lastIndexOf('/') + 1)
        const beforeDash = afterSlash.slice(0, afterSlash.indexOf('-'))
        return beforeDash.replace(/\D/g, '')
    }

    async deepSearch(title, searchParameters = {}, returnParameters = ['id', 'name', 'russian', 'genres { id name russian kind}', 'status', 'url']) {
        let query = '{\n'
        let searchQuery = `animes(search: "${title}"`

        for (const [parameter, value] of Object.entries(searchParameters)) {
            let val
            if (typeof value === 'string') val = `"${value}"`
            else if (typeof value === 'boolean') val = value ? 'true' : 'false'
            else val = value
            searchQuery += `, ${parameter}: ${val}`
        }
        searchQuery += ')'
        query += searchQuery

        let returnQuery = '{\n'
        for (const param of returnParameters) {
            returnQuery += param + '\n'
        }
        returnQuery += '}'
        query += returnQuery + '\n}'

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
            'Accept': '*/*',
            'Referer': `https://${this._dmn}/api/doc/graphql`,
            'content-type': 'application/json',
            'Origin': `https://${this._dmn}`,
        }

        const response = await axios.post(`https://${this._dmn}/api/graphql`, {
            operationName: null,
            variables: {},
            query
        }, { headers, validateStatus: () => true })

        this._checkStatus(response.status)

        const data = response.data
        if (data.errors) throw new PostArgumentsError(`Ошибка запроса. Ошибка: ${data.errors[0].message}`)
        return data.data?.animes ?? []
    }

    async deepAnimeInfo(shikimoriId, returnParameters = ['id', 'name', 'russian', 'genres { id name russian kind}', 'status', 'url']) {
        let query = '{\n'
        query += `animes(ids: "${shikimoriId}")`

        let returnQuery = '{\n'
        for (const param of returnParameters) {
            returnQuery += param + '\n'
        }
        returnQuery += '}'
        query += returnQuery + '\n}'

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
            'Accept': '*/*',
            'Referer': `https://${this._dmn}/api/doc/graphql`,
            'content-type': 'application/json',
            'Origin': `https://${this._dmn}`,
        }

        const response = await axios.post(`https://${this._dmn}/api/graphql`, {
            operationName: null,
            variables: {},
            query
        }, { headers, validateStatus: () => true })

        this._checkStatus(response.status)

        const data = response.data
        if (data.errors) throw new PostArgumentsError(`Ошибка запроса. Ошибка: ${data.errors[0].message}`)

        const animes = data.data?.animes ?? []
        if (animes.length === 0) throw new NoResults(`Нет данных по shikimori_id "${shikimoriId}"`)
        return animes[0]
    }
}

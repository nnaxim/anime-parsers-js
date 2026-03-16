import axios from "axios"
import { load } from 'cheerio'
import { NoResults, PostArgumentsError, ServiceError, TokenError, UnexpectedBehavior } from "../../errors/index.js"

export class KodikParser {

    constructor(token = null) {
        this.TOKEN = token
        this._cryptStep = null
    }

    async apiRequest(endpoint, filters = {}, parameters = {}) {
        const allowedEndpoints = ['search', 'list', 'translations']

        if(!allowedEndpoints.includes(endpoint)) {
            throw new PostArgumentsError(`Uknown endpoint: ${endpoint}`)
        }

        if(!this.TOKEN) {
            throw new TokenError('kodik token is not provided')
        }

        const payload = new URLSearchParams({
            token: this.TOKEN,
            ...filters,
            ...parameters
        })

        const url = `https://kodikapi.com/${endpoint}`

        let response

        try {
            response = await axios.post(
                url,
                payload.toString(),
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        "Accept": "*/*",
                        "Accept-Encoding": "gzip, deflate",
                        "Connection": "keep-alive"
                    }
                }
            )
        } catch (error) {
            throw new ServiceError(
                `Kodik API request failed: ${error.message}`
            )
        }

        if (!response || !response.data) {
            throw new ServiceError("Empty response from Kodik API")
        }

        const data = response.data

        if (data.error === "Отсутствует или неверный токен") {
            throw new TokenError("Invalid Kodik token")
        }

        if (data.error) {
            throw new ServiceError(
                `Kodik API error: ${data.error}`
            )
        }

        if (data.total === 0) {
            throw new NoResults("No results from Kodik API")
        }

        return data
    }

    static async getToken() {

        const url = "https://kodik-add.com/add-players.min.js?v=2"

        let response

        try {
            response = await axios.get(url)
        } catch (error) {
            throw new ServiceError("Failed to request Kodik token")
        }

        if (!response || !response.data) {
            throw new ServiceError("Empty response from Kodik")
        }

        const data = response.data

        const start = data.indexOf("token=")

        if (start === -1) {
            throw new UnexpectedBehavior("Token not found in Kodik script")
        }

        const tokenStart = start + 7
        const tokenEnd = data.indexOf('"', tokenStart)

        if (tokenEnd === -1) {
            throw new UnexpectedBehavior("Token parsing failed")
        }

        const token = data.substring(tokenStart, tokenEnd)

        if (!token || token.length < 5) {
            throw new UnexpectedBehavior("Invalid token received")
        }

        return token
    }

    async baseSearch(
        title,
        limit = 50,
        includeMaterialData = true,
        animeStatus = null,
        strict = false
    ) {
        if (!title) {
            throw new PostArgumentsError("Title is required")
        }

        const searchTitle = strict ? `${title} ` : title

        const payload = {
            title: searchTitle,
            limit: limit,
            with_material_data: includeMaterialData ? "true" : "false",
            strict: strict ? "true" : "false"
        }

        if (animeStatus === "released" || animeStatus === "ongoing") {
            payload.anime_status = animeStatus
        }

        let data

        try {
            data = await this.apiRequest("search", payload)
        } catch (error) {

        if (error instanceof NoResults) {
            throw new NoResults(`Nothing found for "${title}"`)
        }
            throw error
        }

        return data
    }

    async baseSearchById(
        id,
        idType,
        limit = 50,
        includeMaterialData = true
    ) {
        if (typeof id === 'number') {
            id = String(id)
        } else if (typeof id !== 'string') {
            throw new PostArgumentsError(`Expected string for id, got "${typeof id}"`)
        }

        if (!['shikimori', 'kinopoisk', 'imdb'].includes(idType)) {
            throw new PostArgumentsError(`Only shikimori, kinopoisk, imdb are supported. Got: ${idType}`)
        }

        const payload = {
            [`${idType}_id`]: id,
            limit: limit,
            with_material_data: includeMaterialData ? "true" : "false"
        }

        let data

        try {
            data = await this.apiRequest("search", payload)
        } catch (error) {
            if (error instanceof NoResults) {
                throw new NoResults(`Nothing found for ${idType} id "${id}"`)
            }
            throw error
        }

        return data
    }

    _prettifyData(results, onlyAnime = false) {
        const data = []
        const addedTitles = []

        for (const res of results) {
            if (onlyAnime && !['anime-serial', 'anime'].includes(res.type)) {
                continue
            }

            if (addedTitles.includes(res.title)) {
                continue
            }

            const additionalData = {}
            const skipKeys = [
                'title', 'type', 'year', 'screenshots', 'translation',
                'shikimori_id', 'kinopoisk_id', 'imdb_id', 'worldart_link',
                'id', 'link', 'title_orig', 'other_title', 'created_at',
                'updated_at', 'quality', 'material_data'
            ]

            for (const [key, val] of Object.entries(res)) {
                if (!skipKeys.includes(key)) {
                    additionalData[key] = val
                }
            }

            data.push({
                title: res.title,
                title_orig: res.title_orig,
                other_title: res.other_title ?? null,
                type: res.type,
                year: res.year,
                screenshots: res.screenshots,
                shikimori_id: res.shikimori_id ?? null,
                kinopoisk_id: res.kinopoisk_id ?? null,
                imdb_id: res.imdb_id ?? null,
                worldart_link: res.worldart_link ?? null,
                additional_data: additionalData,
                material_data: res.material_data ?? null,
                link: res.link
            })

            addedTitles.push(res.title)
        }

        return data
    }

    async search(
        title,
        limit = null,
        includeMaterialData = true,
        animeStatus = null,
        strict = false,
        onlyAnime = false
    ) {
        const searchData = limit
            ? await this.baseSearch(title, limit, includeMaterialData, animeStatus, strict)
            : await this.baseSearch(title, 50, includeMaterialData, animeStatus, strict)

        return this._prettifyData(searchData.results, onlyAnime)
    }

    async searchById(
        id,
        idType,
        limit = null
    ) {
        if (typeof id === 'number') id = String(id)
        else if (typeof id !== 'string') {
            throw new PostArgumentsError(`Expected string for id, got "${typeof id}"`)
        }

        const searchData = limit
            ? await this.baseSearchById(id, idType, limit)
            : await this.baseSearchById(id, idType)

        return this._prettifyData(searchData.results)
    }

    async getList(
        limitPerPage = 50,
        pagesToParse = 1,
        includeMaterialData = true,
        animeStatus = null,
        onlyAnime = false,
        startFrom = null
    ) {
        const results = []
        let nextPage = startFrom

        const payload = {
            limit: limitPerPage,
            with_material_data: includeMaterialData ? "true" : "false"
        }

        if (animeStatus === "released" || animeStatus === "ongoing") {
            payload.anime_status = animeStatus
        }

        for (let i = 0; i < pagesToParse; i++) {
            if (nextPage !== null) {
                payload.next = nextPage
            }

            let data
            try {
                data = await this.apiRequest("list", payload)
            } catch (error) {
                if (error instanceof NoResults) {
                    data = { results: [] }
                } else {
                    throw error
                }
            }

            if (data.next_page) {
                const url = data.next_page
                nextPage = url.substring(url.lastIndexOf('=') + 1)
            } else {
                nextPage = null
            }

            results.push(...data.results)
        }

        return [this._prettifyData(results, onlyAnime), nextPage]
    }

    _isSerial(iframeUrl) {
        return iframeUrl[iframeUrl.indexOf('.info/') + 6] === 's'
    }

    _isVideo(iframeUrl) {
        return iframeUrl[iframeUrl.indexOf('.info/') + 6] === 'v'
    }

    _generateTranslationsDict(translationsDiv) {
        if (!translationsDiv || translationsDiv.length === 0) {
            return [{ id: "0", type: "Неизвестно", name: "Неизвестно" }]
        }

        return translationsDiv.map(el => {
            const type = el.attribs['data-translation-type']
            return {
                id: el.attribs['value'],
                type: type === 'voice' ? 'Озвучка' : type === 'subtitles' ? 'Субтитры' : type,
                name: el.children[0]?.data?.trim() ?? ''
            }
        })
    }

    async getInfo(id, idType) {
        if (typeof id === 'number') id = String(id)
        else if (typeof id !== 'string') {
            throw new PostArgumentsError(`Expected string for id, got "${typeof id}"`)
        }

        const link = await this._linkToInfo(id, idType)

        let response
        try {
            response = await axios.get(link, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "*/*"
                }
            })
        } catch (error) {
            throw new ServiceError(`Request failed: ${error.message}`)
        }

        const $ = load(response.data)

        if ($('.promo-error').length) {
            const msg = $('.message').text() || null
            const errCode = $('.error-code').text() || null
            if (msg === 'Видео запрещено к просмотру в данной стране') {
                throw new ServiceError(`Content blocked. Message: "${msg}". Code: "${errCode}"`)
            }
            throw new UnexpectedBehavior(`Player error. Message: "${msg}". Code: "${errCode}"`)
        }

        if (this._isSerial(link)) {
            const seriesCount = $('.serial-series-box select option').length

            const translationsDiv = $('.serial-translations-box select option').toArray()
            return {
                series_count: seriesCount,
                translations: this._generateTranslationsDict(translationsDiv)
            }

        } else if (this._isVideo(link)) {
            const translationsDiv = $('.movie-translations-box select option').toArray()
            return {
                series_count: 0,
                translations: this._generateTranslationsDict(translationsDiv)
            }

        } else {
            throw new UnexpectedBehavior('Link was not recognized as serial or video')
        }
    }

    async _linkToInfo(id, idType, https = true) {
        if (!this.TOKEN) {
            throw new TokenError('Kodik token is not provided')
        }

        let serv
        if (idType === 'shikimori') {
            serv = `https://kodikapi.com/get-player?title=Player&hasPlayer=false&url=https%3A%2F%2Fkodikdb.com%2Ffind-player%3FshikimoriID%3D${id}&token=${this.TOKEN}&shikimoriID=${id}`
        } else if (idType === 'kinopoisk') {
            serv = `https://kodikapi.com/get-player?title=Player&hasPlayer=false&url=https%3A%2F%2Fkodikdb.com%2Ffind-player%3FkinopoiskID%3D${id}&token=${this.TOKEN}&kinopoiskID=${id}`
        } else if (idType === 'imdb') {
            serv = `https://kodikapi.com/get-player?title=Player&hasPlayer=false&url=https%3A%2F%2Fkodikdb.com%2Ffind-player%3FkinopoiskID%3D${id}&token=${this.TOKEN}&imdbID=${id}`
        } else {
            throw new PostArgumentsError(`Unknown idType: ${idType}`)
        }

        let response
        try {
            response = await axios.get(serv, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "*/*"
                }
            })
        } catch (error) {
            throw new ServiceError(`Request failed: ${error.message}`)
        }

        const data = response.data

        if (data.error === 'Отсутствует или неверный токен') {
            throw new TokenError('Invalid Kodik token')
        }
        if (data.error) {
            throw new ServiceError(`Kodik API error: ${data.error}`)
        }
        if (!data.found) {
            throw new NoResults(`No data for ${idType} id "${id}"`)
        }

        return (https ? 'https:' : 'http:') + data.link
    }

    async translations(id, idType) {
        if (typeof id === 'number') id = String(id)
        else if (typeof id !== 'string') {
            throw new PostArgumentsError(`Expected string for id, got "${typeof id}"`)
        }

        const info = await this.getInfo(id, idType)
        return info.translations
    }

    async seriesCount(id, idType) {
        if (typeof id === 'number') id = String(id)
        else if (typeof id !== 'string') {
            throw new PostArgumentsError(`Expected string for id, got "${typeof id}"`)
        }

        const info = await this.getInfo(id, idType)
        return info.series_count
    }

    _convertChar(char, num) {
        const alph = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        const upper = char.toUpperCase()
        if (alph.includes(upper)) {
            const ch = alph[(alph.indexOf(upper) + num) % alph.length]
            return char === char.toLowerCase() ? ch.toLowerCase() : ch
        }
        return char
    }

    _convert(string) {
        if (this._cryptStep !== null && this._cryptStep !== undefined) {
            const crypted = string.split('').map(c => this._convertChar(c, this._cryptStep)).join('')
            const padding = (4 - (crypted.length % 4)) % 4
            try {
                const result = Buffer.from(crypted + '='.repeat(padding), 'base64').toString('utf-8')
                if (result.includes('mp4:hls:manifest')) return result
            } catch {}
        }

        for (let rot = 0; rot < 26; rot++) {
            const crypted = string.split('').map(c => this._convertChar(c, rot)).join('')
            const padding = (4 - (crypted.length % 4)) % 4
            try {
                const result = Buffer.from(crypted + '='.repeat(padding), 'base64').toString('utf-8')
                if (result.includes('mp4:hls:manifest')) {
                    this._cryptStep = rot
                    return result
                }
            } catch {}
        }

        throw new UnexpectedBehavior('Decryption failed')
    }

    async _getPostLink(scriptUrl) {
        let response
        try {
            response = await axios.get('https://kodik.info' + scriptUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "*/*"
                }
            })
        } catch (error) {
            throw new ServiceError(`Request failed: ${error.message}`)
        }

        const data = response.data

        const start = data.indexOf('$.ajax') + 30
        const end = data.indexOf('cache:!1') - 3
        const encoded = data.substring(start, end)

        return Buffer.from(encoded, 'base64').toString('utf-8')
    }

    async _getLinkWithData(videoType, videoHash, videoId, urlParams, scriptUrl) {
        const params = new URLSearchParams({
            hash: videoHash,
            id: videoId,
            type: videoType,
            d: urlParams.d,
            d_sign: urlParams.d_sign,
            pd: urlParams.pd,
            pd_sign: urlParams.pd_sign,
            ref: '',
            ref_sign: urlParams.ref_sign,
            bad_user: 'true',
            cdn_is_working: 'true'
        })

        const postLink = await this._getPostLink(scriptUrl)

        let response
        try {
            response = await axios.post(
                'https://kodik.info' + postLink,
                params.toString(),
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        "Accept": "*/*"
                    }
                }
            )
        } catch (error) {
            throw new ServiceError(`Request failed: ${error.message}`)
        }

        const data = response.data

        if (data.error === 'Отсутствует или неверный токен') {
            throw new TokenError('Invalid Kodik token')
        }
        if (data.error) {
            throw new ServiceError(`Kodik error: ${data.error}`)
        }

        const dataUrl = data.links['360'][0].src
        const url = dataUrl.includes('mp4:hls:manifest') ? dataUrl : this._convert(dataUrl)
        const maxQuality = Math.max(...Object.keys(data.links).map(Number))

        return [url, maxQuality]
    }

    async getLink(id, idType, seriaNum, translationId) {
        if (typeof id === 'number') id = String(id)
        else if (typeof id !== 'string') throw new PostArgumentsError(`Expected string for id, got "${typeof id}"`)

        if (typeof seriaNum === 'string' && !isNaN(seriaNum)) seriaNum = parseInt(seriaNum)
        else if (typeof seriaNum !== 'number') throw new PostArgumentsError(`Expected number for seriaNum, got "${typeof seriaNum}"`)

        if (typeof translationId === 'number') translationId = String(translationId)
        else if (typeof translationId !== 'string') throw new PostArgumentsError(`Expected string for translationId, got "${typeof translationId}"`)

        const link = await this._linkToInfo(id, idType)

        let response
        try {
            response = await axios.get(link, {
                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Accept": "*/*" }
            })
        } catch (error) {
            throw new ServiceError(`Request failed: ${error.message}`)
        }

        let html = response.data
        let $ = load(html)

        const urlParamsStart = html.indexOf('urlParams') + 13
        const urlParamsEnd = html.indexOf(';', urlParamsStart) - 1
        const urlParams = JSON.parse(html.substring(urlParamsStart, urlParamsEnd))

        if (translationId !== '0' && seriaNum !== 0) {
            let mediaHash = null
            let mediaId = null

            $('.serial-translations-box select option').each((_, el) => {
                if ($(el).attr('data-id') === translationId) {
                    mediaHash = $(el).attr('data-media-hash')
                    mediaId = $(el).attr('data-media-id')
                }
            })

            const url = `https://kodik.info/serial/${mediaId}/${mediaHash}/720p?min_age=16&first_url=false&season=1&episode=${seriaNum}`
            const r = await axios.get(url, {
                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Accept": "*/*" }
            })
            html = r.data
            $ = load(html)

        } else if (translationId !== '0' && seriaNum === 0) {
            let mediaHash = null
            let mediaId = null

            $('.movie-translations-box select option').each((_, el) => {
                if ($(el).attr('data-id') === translationId) {
                    mediaHash = $(el).attr('data-media-hash')
                    mediaId = $(el).attr('data-media-id')
                }
            })

            const url = `https://kodik.info/video/${mediaId}/${mediaHash}/720p?min_age=16&first_url=false&season=1&episode=0`
            const r = await axios.get(url, {
                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Accept": "*/*" }
            })
            html = r.data
            $ = load(html)
        }

        const scripts = $('script').toArray()
        const scriptUrl = $(scripts[1]).attr('src')

        const hashContainer = $(scripts[4]).html()
        const videoType = hashContainer.match(/\.type = '(.+?)'/)?.[1]
        const videoHash = hashContainer.match(/\.hash = '(.+?)'/)?.[1]
        const videoId = hashContainer.match(/\.id = '(.+?)'/)?.[1]

        const [linkData, maxQuality] = await this._getLinkWithData(videoType, videoHash, videoId, urlParams, scriptUrl)

        let downloadUrl = linkData.replace('https:', '')
        downloadUrl = downloadUrl.substring(0, downloadUrl.lastIndexOf('/') + 1)

        return [downloadUrl, maxQuality]
    }

    async getM3u8PlaylistLink(id, idType, seriaNum, translationId, quality = 480) {
        if (typeof id === 'number') id = String(id)
        else if (typeof id !== 'string') throw new PostArgumentsError(`Expected string for id, got "${typeof id}"`)

        if (typeof translationId === 'number') translationId = String(translationId)
        else if (typeof translationId !== 'string') throw new PostArgumentsError(`Expected string for translationId, got "${typeof translationId}"`)

        if (typeof seriaNum === 'string' && !isNaN(seriaNum)) seriaNum = parseInt(seriaNum)
        else if (typeof seriaNum !== 'number') throw new PostArgumentsError(`Expected number for seriaNum, got "${typeof seriaNum}"`)

        const linkData = await this.getLink(id, idType, seriaNum, translationId)

        const selectedQuality = String(
            [360, 480, 720].includes(quality) ? Math.min(quality, linkData[1]) : linkData[1]
        )

        return 'https:' + linkData[0] + selectedQuality + '.mp4:hls:manifest.m3u8'
    }

    async getM3u8Playlist(id, idType, seriaNum, translationId, quality = 480) {
        if (typeof id === 'number') id = String(id)
        else if (typeof id !== 'string') throw new PostArgumentsError(`Expected string for id, got "${typeof id}"`)

        if (typeof translationId === 'number') translationId = String(translationId)
        else if (typeof translationId !== 'string') throw new PostArgumentsError(`Expected string for translationId, got "${typeof translationId}"`)

        if (typeof seriaNum === 'string' && !isNaN(seriaNum)) seriaNum = parseInt(seriaNum)
        else if (typeof seriaNum !== 'number') throw new PostArgumentsError(`Expected number for seriaNum, got "${typeof seriaNum}"`)

        const linkData = await this.getLink(id, idType, seriaNum, translationId)
        const selectedQuality = String(
            [360, 480, 720].includes(quality) ? Math.min(quality, linkData[1]) : linkData[1]
        )

        const link = 'https:' + linkData[0] + selectedQuality + '.mp4:hls:manifest.m3u8'

        let response
        try {
            response = await axios.get(link, {
                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Accept": "*/*" }
            })
        } catch (error) {
            if (error.response?.status === 404) {
                throw new NoResults('Playlist not found. Try changing quality.')
            }
            throw new ServiceError(`Request failed: ${error.message}`)
        }

        return response.data.replace(
            `./${selectedQuality}.mp4`,
            'https:' + linkData[0] + selectedQuality + '.mp4'
        )
    }

}

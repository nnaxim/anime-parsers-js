import axios from "axios"
import { NoResults, PostArgumentsError, ServiceError, TokenError, UnexpectedBehavior } from "../../errors/index.js"

export class KodikParser {

    constructor(token = null) {
        this.TOKEN = token
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

        console.log(payload.toString())

        const url = `https://kodikapi.com/${endpoint}`

        let response

        try {
            response = await axios.post(
                url,
                payload.toString(),
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "User-Agent": "python-requests/2.28.2",
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

}

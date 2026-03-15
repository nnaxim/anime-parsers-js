import axios from "axios"
import { ServiceError, UnexpectedBehavior } from "../../errors/index.js"

export class KodikParser {

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

}

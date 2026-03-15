import { KodikParser } from "./src/index.js";

const token = "447d179e875efe44217f20d1ee2146be"  // хардкод пока

const parser = new KodikParser(token)

try {
    const data = await parser.baseSearch("Naruto")
    console.log(JSON.stringify(data, null, 2))
} catch (error) {
    console.error("ERROR:", error)
}

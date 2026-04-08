import axios from "axios"

async function testAnilibria() {
  try {
    console.log("TART TEST")

    const listRes = await axios.get(
      "https://anilibria.top/api/v1/anime/releases/latest"
    )

    if (!listRes.data?.length) {
      throw new Error("releases list empty")
    }

    console.log("LIST OK:", listRes.data.length)

    const releaseId = listRes.data[0].id
    console.log("RELEASE ID:", releaseId)

    const releaseRes = await axios.get(
      `https://anilibria.top/api/v1/anime/releases/${releaseId}`
    )

    const episodes = releaseRes.data?.episodes

    if (!episodes?.length) {
      throw new Error("no episodes")
    }

    console.log("RELEASE OK:", episodes.length)

    const episodeId = episodes[0].id
    console.log("EPISODE ID:", episodeId)

    const streamRes = await axios.get(
      `https://anilibria.top/api/v1/anime/releases/episodes/${episodeId}`
    )

    const stream = streamRes.data

    if (!stream?.hls_720) {
      throw new Error("no stream")
    }

    console.log("STREAM OK")
    console.log("HLS 720:", stream.hls_720)

    console.log("ALL TESTS PASSED")
  } catch (err) {
    console.error("TEST FAILED:", err.message)
  }
}

testAnilibria()

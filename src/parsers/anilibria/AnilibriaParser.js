import axios from "axios";

const BASE_URL = "https://anilibria.top/api/v1";
const CDN_URL = "https://anilibria.top";

export class AnilibriaParser {
    constructor() {}

    _prettifyRelease(release) {
        return {
            id: release.id,
            alias: release.alias,
            type: release.type?.value ?? null,
            year: release.year,
            season: release.season?.value ?? null,
            name: {
                main: release.name?.main ?? null,
                english: release.name?.english ?? null,
                alternative: release.name?.alternative ?? null,
            },
            description: release.description ?? null,
            poster: release.poster?.optimized?.src
                ? CDN_URL + release.poster.optimized.src
                : null,
            age_rating: release.age_rating?.label ?? null,
            is_ongoing: release.is_ongoing,
            is_blocked_by_geo: release.is_blocked_by_geo,
            episodes_total: release.episodes_total ?? null,
            average_duration: release.average_duration_of_episode ?? null,
            publish_day: release.publish_day?.description ?? null,
            genres: release.genres?.map(g => g.name) ?? [],
            episodes: release.episodes?.map(e => this._prettifyEpisode(e)) ?? null,
            latest_episode: release.latest_episode
                ? this._prettifyEpisode(release.latest_episode)
                : null,
        }
    }

    _prettifyEpisode(episode) {
        return {
            id: episode.id,
            ordinal: episode.ordinal,
            name: episode.name ?? null,
            name_english: episode.name_english ?? null,
            duration: episode.duration ?? null,
            release_id: episode.release_id,
            preview: episode.preview?.optimized?.src
                ? CDN_URL + episode.preview.optimized.src
                : null,
            opening: episode.opening ?? null,
            ending: episode.ending ?? null,
            hls: {
                hls_480: episode.hls_480 ?? null,
                hls_720: episode.hls_720 ?? null,
                hls_1080: episode.hls_1080 ?? null,
            },
            updated_at: episode.updated_at ?? null,
        }
    }

    async getLatestReleases() {
        const res = await axios.get(`${BASE_URL}/anime/releases/latest`);
        return res.data.map(r => this._prettifyRelease(r));
    }

    async getRelease(releaseId) {
        const res = await axios.get(`${BASE_URL}/anime/releases/${releaseId}`);
        return this._prettifyRelease(res.data);
    }

    async getEpisode(episodeId) {
        const res = await axios.get(`${BASE_URL}/anime/releases/episodes/${episodeId}`);
        return this._prettifyEpisode(res.data);
    }
}

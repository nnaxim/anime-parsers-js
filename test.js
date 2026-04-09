import { AnilibriaParser } from "./src/index.js";

async function test() {
    const parser = new AnilibriaParser();

    console.log("=== getLatestReleases ===");
    const latest = await parser.getLatestReleases();
    console.log("count:", latest.length);
    console.log("first release name:", latest[0].name.main);

    const releaseId = latest[0].id;

    console.log("\n=== getRelease ===");
    const release = await parser.getRelease(releaseId);
    console.log("name:", release.name.main);
    console.log("episodes count:", release.episodes?.length ?? "нет эпизодов");
    console.log("first episode ordinal:", release.episodes?.[0]?.ordinal);
    console.log("first episode hls_720:", release.episodes?.[0]?.hls?.hls_720);

    const episodeId = release.episodes?.[0]?.id;

    console.log("\n=== getEpisode ===");
    const episode = await parser.getEpisode(episodeId);
    console.log("ordinal:", episode.ordinal);
    console.log("hls_720:", episode.hls?.hls_720);
    console.log("hls_1080:", episode.hls?.hls_1080);

    console.log("\nALL OK");
}

test().catch(console.error);

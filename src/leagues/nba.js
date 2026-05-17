/**
 * A league adapter fetches a schedule and normalizes it to Game objects.
 * Each league (NBA, WNBA, etc.) implements this interface.
 *
 * @typedef {object} LeagueAdapter
 * @property {string} name - Human-readable name (e.g. "NBA", "WNBA")
 * @property {string} seasonKey - Config key for the season year
 * @property {(year: number, cacheDir: string) => Promise<Game[]>} fetchSchedule
 */

import { Game } from "../game.js";

/**
 * Fetch with browser-like headers (NBA/CDN blocks non-browser UAs)
 * @param {string} url
 * @param {object} [extraHeaders]
 * @returns {Promise<any>}
 */
async function fetchJSON(url, extraHeaders = {}) {
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "application/json",
            ...extraHeaders,
        },
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    return res.json();
}

/**
 * @type {LeagueAdapter}
 */
export const nba = {
    name: "NBA",
    seasonKey: "nbaYear",

    async fetchSchedule(year, cacheDir) {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const cachePath = path.join(cacheDir, `nba-${year}-schedule.json`);

        let data;
        try {
            await fs.access(cachePath);
            console.log(`[NBA] found cached file: ${cachePath}`);
            data = JSON.parse(await fs.readFile(cachePath, "utf-8"));
        } catch {
            const SCHEDULE_URL = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_2.json";
            console.log(`[NBA] fetching schedule from ${SCHEDULE_URL}`);
            data = await fetchJSON(SCHEDULE_URL, { Referer: "https://www.nba.com/" });
            await fs.writeFile(cachePath, JSON.stringify(data));
        }

        const gameDates = data.leagueSchedule.gameDates;
        const allGames = gameDates.flatMap(gd => gd.games);

        return allGames.map(g => {
            let dt = new Date(g.gameDateTimeUTC);
            let yyyy = dt.getFullYear().toString();
            let mm = (dt.getMonth() + 1).toString().padStart(2, "0");
            let dd = dt.getDate().toString().padStart(2, "0");

            return new Game({
                id: g.gameId,
                date: `${yyyy}-${mm}-${dd}`,
                utcTime: g.gameDateTimeUTC,
                homeTeam: g.homeTeam.teamName,
                homeTricode: g.homeTeam.teamTricode,
                awayTeam: g.awayTeam.teamName,
                awayTricode: g.awayTeam.teamTricode,
                arena: g.arenaName,
                gameLabel: g.gameLabel,
            });
        });
    },
};

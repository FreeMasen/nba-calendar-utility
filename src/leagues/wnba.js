/**
 * WNBA league adapter.
 * The WNBA uses a different API endpoint and data shape than the NBA,
 * but we normalize to the same Game interface.
 *
 * @type {LeagueAdapter}
 */

import { Game } from "../game.js";

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

export const wnba = {
    name: "WNBA",
    seasonKey: "wnbaYear",

    async fetchSchedule(year, cacheDir) {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const cachePath = path.join(cacheDir, `wnba-${year}-schedule.json`);

        let data;
        try {
            await fs.access(cachePath);
            console.log(`[WNBA] found cached file: ${cachePath}`);
            data = JSON.parse(await fs.readFile(cachePath, "utf-8"));
        } catch {
            const SCHEDULE_URL = `https://content-api-prod.nba.com/public/1/leagues/wnba/schedule?addEvents=true&seasonYear=${year}&countryCode=US`;
            console.log(`[WNBA] fetching schedule from ${SCHEDULE_URL}`);
            data = await fetchJSON(SCHEDULE_URL, { Referer: "https://www.wnba.com/" });
            await fs.writeFile(cachePath, JSON.stringify(data));
        }

        const schedule = data.results.schedule;

        return schedule.map(g => {
            let dt = new Date(g.utcTime);
            let yyyy = dt.getFullYear().toString();
            let mm = (dt.getMonth() + 1).toString().padStart(2, "0");
            let dd = dt.getDate().toString().padStart(2, "0");

            return new Game({
                id: g.gid,
                date: `${yyyy}-${mm}-${dd}`,
                utcTime: g.utcTime,
                homeTeam: g.home.name,
                homeTricode: g.home.abbr,
                awayTeam: g.visitor.name,
                awayTricode: g.visitor.abbr,
                arena: g.arenaName,
                gameLabel: g.gameLabel,
            });
        });
    },
};

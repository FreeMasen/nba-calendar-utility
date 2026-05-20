#!/usr/bin/env node

import { dirname, join as pathJoin } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorize, clearEvents, saveEvents } from "./src/calendar.js";
import { readConfig } from "./src/config.js";
import { nba, wnba } from "./src/leagues/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const LEAGUES = { nba, wnba };

/**
 * Process a single team: fetch its schedule and insert calendar events.
 *
 * @param {import('./src/leagues/index.js').LeagueAdapter} adapter
 * @param {import('./src/config.js').TeamEntry} teamEntry
 * @param {any} auth
 * @param {string} cacheDir
 */
async function processTeam(adapter, teamEntry, auth, cacheDir) {
    const { teamCode, calendarId, year } = teamEntry;

    console.log(`\n[${adapter.name}] getting ${year} schedule for ${teamCode}`);
    let allGames = await adapter.fetchSchedule(year, cacheDir);

    // Filter to just this team's games
    let teamGames = allGames.filter(
        g => g.homeTricode === teamCode || g.awayTricode === teamCode
    );
    console.log(`[${adapter.name}] found ${teamGames.length} games for ${teamCode}`);

    // Optional: uncomment to clear existing events first
    // await clearEvents(calendarId, year, auth);

    console.log(`[${adapter.name}] saving events for ${teamCode} to calendar ${calendarId}`);
    let msg = await saveEvents(teamGames, calendarId, teamCode, auth);
    console.log(`[${adapter.name}] ${teamCode} complete: ${msg}`);
}

async function main() {
    console.log("authorizing");
    let auth = await authorize();

    console.log("reading config");
    let config = await readConfig();

    for (let leagueConfig of config.leagues) {
        let adapter = LEAGUES[leagueConfig.league];
        if (!adapter) {
            throw new Error(
                `Unknown league "${leagueConfig.league}". Supported: ${Object.keys(LEAGUES).join(", ")}`
            );
        }

        for (let teamEntry of leagueConfig.teams) {
            await processTeam(adapter, teamEntry, auth, __dirname);
        }
    }

    console.log("\nAll teams processed.");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

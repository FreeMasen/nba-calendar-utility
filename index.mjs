#!/usr/bin/env node

import { dirname, join as pathJoin } from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorize, clearEvents, saveEvents } from "./src/calendar.js";
import { readConfig } from "./src/config.js";
import { nba, wnba } from "./src/leagues/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const LEAGUES = { nba, wnba };

async function main() {
    console.log("authorizing");
    let auth = await authorize();

    console.log("reading config");
    let { calendarId, league: leagueName, teamCode, year } = await readConfig();

    let adapter = LEAGUES[leagueName];
    if (!adapter) {
        throw new Error(`Unknown league "${leagueName}". Supported: ${Object.keys(LEAGUES).join(", ")}`);
    }

    console.log(`[${adapter.name}] getting ${year} schedule for ${teamCode}`);
    let allGames = await adapter.fetchSchedule(year, __dirname);

    // Filter to just this team's games
    let teamGames = allGames.filter(
        g => g.homeTricode === teamCode || g.awayTricode === teamCode
    );
    console.log(`[${adapter.name}] found ${teamGames.length} games for ${teamCode}`);

    // Optional: uncomment to clear existing events first
    // await clearEvents(calendarId, year, auth);

    console.log("saving events");
    let msg = await saveEvents(teamGames, calendarId, teamCode, auth);
    console.log("complete", msg);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

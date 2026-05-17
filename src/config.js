import { dirname, join as pathJoin } from 'node:path';
import * as fs from "node:fs/promises";
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Fallback season year: current year if month > April, otherwise last year.
 * The 2022/2023 NBA season started in October 2022 and ended April 2023,
 * but is treated as the "2022 season" by the API.
 */
function fallbackYear() {
    let today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth();
    if (month >= 0 && month <= 4) {
        return year - 1;
    }
    return year;
}

/**
 * Read and validate config.json.
 * Supports both legacy and multi-league configs:
 *
 * Legacy:
 *   { "teamCode": "NYK", "calendarId": "...", "year": 2025 }
 *
 * Multi-league:
 *   { "calendarId": "...", "league": "nba", "teamCode": "NYK", "year": 2025 }
 *   { "calendarId": "...", "league": "wnba", "teamCode": "NYL", "wnbaYear": 2026 }
 *
 * @returns {{ calendarId: string, league: string, teamCode: string, year: number }}
 */
export async function readConfig() {
    let configFile = pathJoin(__dirname, "config.json");
    let json = await fs.readFile(configFile, "utf-8");
    let cfg = JSON.parse(json);

    // calendarId is always required
    if (!cfg.calendarId || typeof cfg.calendarId != "string") {
        throw new Error("Invalid config.json: calendarId is required and must be a string");
    }

    // Determine league
    let league = (cfg.league ?? "nba").toLowerCase();

    // Determine team code
    if (!cfg.teamCode || typeof cfg.teamCode != "string" || cfg.teamCode.length != 3) {
        throw new Error("Invalid config.json: teamCode is required and must be a 3-character string");
    }
    let teamCode = cfg.teamCode.toUpperCase();

    // Determine year
    let year = cfg.year;
    if (!year || typeof year != "number") {
        year = fallbackYear();
        console.warn(`No valid year found in config.json, using default: ${year}`);
    }

    return { calendarId: cfg.calendarId, league, teamCode, year };
}

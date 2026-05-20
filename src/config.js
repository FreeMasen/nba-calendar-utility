import { dirname, join as pathJoin } from 'node:path';
import * as fs from "node:fs/promises";
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Extract a calendar ID from the config value.
 * Accepts:
 *   - "primary"
 *   - An email address like "ab12cd34@group.calendar.google.com"
 *   - A Google Calendar URL like "https://calendar.google.com/calendar/embed?src=ab12cd34%40group.calendar.google.com"
 *   - A Google Calendar settings URL like "https://calendar.google.com/calendar/r/settings/calendar/ab12cd34@group.calendar.google.com"
 */
export function extractCalendarId(value) {
    // "primary" is a special value the API accepts as-is
    if (value === "primary") {
        return value;
    }

    // If it looks like a URL, try to extract the calendar ID
    if (value.startsWith("http://") || value.startsWith("https://")) {
        try {
            let url = new URL(value);

            // Embed URLs: ?src=ENCODED_EMAIL
            let src = url.searchParams.get("src");
            if (src) {
                return decodeURIComponent(src);
            }

            // Settings URLs: /calendar/r/settings/calendar/ENCODED_EMAIL
            let match = url.pathname.match(/\/calendar\/r\/settings\/calendar\/(.+)/);
            if (match) {
                return decodeURIComponent(match[1]);
            }

            // Calendar view URLs: /calendar/r/ENCODED_EMAIL/...
            match = url.pathname.match(/calendar\/r\/([^/]+)/);
            if (match) {
                let candidate = decodeURIComponent(match[1]);
                // Only if it looks like an email address
                if (candidate.includes("@")) {
                    return candidate;
                }
            }

            throw new Error(`Could not extract calendar ID from URL: ${value}`);
        } catch (e) {
            if (e.message.startsWith("Could not extract")) throw e;
            throw new Error(`Invalid calendar URL: ${value}`);
        }
    }

    // Otherwise treat it as a raw calendar ID (email address)
    return value;
}

/**
 * Fallback season year: current year if month > April, otherwise last year.
 * The NBA season starts in October and ends in April,
 * but is treated as the "previous year" season by the API.
 */
export function fallbackYear() {
    let today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth();
    if (month >= 0 && month <= 4) {
        return year - 1;
    }
    return year;
}

/**
 * Validate and normalize a single team entry.
 *
 * @param {object} entry - A team config entry
 * @param {string} league - League name (for error messages)
 * @returns {{ teamCode: string, calendarId: string, year: number }}
 */
function validateTeamEntry(entry, league) {
    if (!entry.teamCode || typeof entry.teamCode != "string" || entry.teamCode.length != 3) {
        throw new Error(
            `Invalid config.json: teamCode is required and must be a 3-character string ` +
            `(in ${league} entry: ${JSON.stringify(entry)})`
        );
    }
    let teamCode = entry.teamCode.toUpperCase();

    if (!entry.calendarId || typeof entry.calendarId != "string") {
        throw new Error(
            `Invalid config.json: calendarId is required for team ${teamCode} in ${league}`
        );
    }
    let calendarId = extractCalendarId(entry.calendarId);

    let year = entry.year;
    if (!year || typeof year != "number") {
        year = fallbackYear();
    }

    return { teamCode, calendarId, year };
}

/**
 * Read and validate config.json.
 *
 * The config is a JSON object where each key is a league name
 * and the value is an array of team entries. Each team entry
 * specifies a team code, the calendar to write to, and optionally
 * a season year.
 *
 * Example:
 *   {
 *     "nba": [
 *       { "teamCode": "NYK", "calendarId": "primary", "year": 2025 },
 *       { "teamCode": "BOS", "calendarId": "celtics@group.calendar.google.com" }
 *     ],
 *     "wnba": [
 *       { "teamCode": "NYL", "calendarId": "liberty@group.calendar.google.com" }
 *     ]
 *   }
 *
 * If year is omitted, it defaults to the current season year
 * (see fallbackYear).
 *
 * @returns {Record<string, { teamCode: string, calendarId: string, year: number }[]>}
 *   A map of league name → array of validated team entries
 */
export async function readConfig() {
    let configFile = pathJoin(__dirname, "..", "config.json");
    let json = await fs.readFile(configFile, "utf-8");
    let cfg = JSON.parse(json);

    if (typeof cfg != "object" || cfg === null || Array.isArray(cfg)) {
        throw new Error("Invalid config.json: must be an object with league keys");
    }

    let result = {};

    for (let [league, entries] of Object.entries(cfg)) {
        let leagueLower = league.toLowerCase();

        if (!Array.isArray(entries)) {
            throw new Error(
                `Invalid config.json: value for "${league}" must be an array of team entries`
            );
        }

        if (entries.length === 0) {
            console.warn(`No team entries for ${leagueLower}, skipping`);
            continue;
        }

        result[leagueLower] = entries.map(entry => validateTeamEntry(entry, leagueLower));
    }

    if (Object.keys(result).length === 0) {
        throw new Error("Invalid config.json: no leagues configured");
    }

    return result;
}

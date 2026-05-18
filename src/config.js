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
function extractCalendarId(value) {
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
            match = url.pathname.match(/\/calendar\/r\/([^/]+)/);
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
 *
 * Config format:
 *   { "league": "nba", "teamCode": "NYK", "calendarId": "...", "year": 2025 }
 *
 * @returns {{ calendarId: string, league: string, teamCode: string, year: number }}
 */
export async function readConfig() {
    let configFile = pathJoin(__dirname, "config.json");
    let json = await fs.readFile(configFile, "utf-8");
    let cfg = JSON.parse(json);

    // calendarId is always required — can be "primary", an email address,
    // or a full Google Calendar URL (we'll extract the ID from the URL)
    if (!cfg.calendarId || typeof cfg.calendarId != "string") {
        throw new Error("Invalid config.json: calendarId is required and must be a string");
    }
    let calendarId = extractCalendarId(cfg.calendarId);

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

    return { calendarId, league, teamCode, year };
}

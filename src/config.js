import { dirname, join as pathJoin } from 'node:path';
import * as fs from "node:fs/promises";
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Helper Functions ────────────────────────────────────────

/**
 * Extract a calendar ID from a config value.
 *
 * Accepts:
 *   - `"primary"` (Google Calendar's special value for the default calendar)
 *   - An email address like `"ab12cd34@group.calendar.google.com"`
 *   - A Google Calendar embed URL like
 *     `"https://calendar.google.com/calendar/embed?src=ab12cd34%40group.calendar.google.com"`
 *   - A Google Calendar settings URL like
 *     `"https://calendar.google.com/calendar/r/settings/calendar/ab12cd34@group.calendar.google.com"`
 *
 * @param {string} value — raw value from config
 * @returns {string} extracted calendar ID
 * @throws {Error} if the value is a URL that can't be parsed
 */
export function extractCalendarId(value) {
    if (value === "primary") {
        return value;
    }

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

    // Raw calendar ID (email address)
    return value;
}

/**
 * Compute the default season year.
 *
 * The NBA/WNBA season starts in the fall and ends the following spring.
 * If the current month is January–April, we're in the season that
 * started the previous calendar year. Otherwise, the current year.
 *
 * @returns {number} the default season year
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

// ── TeamEntry ───────────────────────────────────────────────

/**
 * A single team's configuration: which team, which calendar, which season.
 *
 * @example
 *   const entry = TeamEntry.fromJson({ teamCode: "NYK", calendarId: "primary" });
 *   entry.teamCode;   // "NYK"
 *   entry.calendarId; // "primary"
 *   entry.year;       // 2025 (fallback)
 *   entry.toJson();   // { teamCode: "NYK", calendarId: "primary", year: 2025 }
 */
export class TeamEntry {
    /** @type {string} 3-letter team tricode, e.g. "NYK", "LAL" */
    teamCode;

    /** @type {string} Google Calendar ID or "primary" */
    calendarId;

    /** @type {number} Season year (e.g. 2025) */
    year;

    /**
     * @param {{
     *   teamCode: string,
     *   calendarId: string,
     *   year: number,
     * }} props
     */
    constructor({ teamCode, calendarId, year }) {
        this.teamCode = teamCode;
        this.calendarId = calendarId;
        this.year = year;
    }

    /**
     * Build a TeamEntry from a raw JSON object (e.g. from config.json).
     *
     * Validates and normalizes the input:
     *   - `teamCode` is uppercased and must be exactly 3 characters
     *   - `calendarId` is extracted if it's a Google Calendar URL
     *   - `year` falls back to the current season year if omitted
     *
     * @param {object} json — raw team entry from config
     * @param {string} json.teamCode — 3-letter team tricode
     * @param {string} json.calendarId — calendar ID, URL, or "primary"
     * @param {number} [json.year] — season year (optional)
     * @param {string} [league] — league name for error messages (optional)
     * @returns {TeamEntry}
     * @throws {Error} if teamCode is missing/invalid or calendarId is missing
     */
    static fromJson(json, league = "unknown") {
        if (!json.teamCode || typeof json.teamCode !== "string" || json.teamCode.length !== 3) {
            throw new Error(
                `Invalid config: teamCode is required and must be a 3-character string ` +
                `(in ${league} entry: ${JSON.stringify(json)})`
            );
        }
        let teamCode = json.teamCode.toUpperCase();

        if (!json.calendarId || typeof json.calendarId !== "string") {
            throw new Error(
                `Invalid config: calendarId is required for team ${teamCode} in ${league}`
            );
        }
        let calendarId = extractCalendarId(json.calendarId);

        let year = json.year;
        if (!year || typeof year !== "number") {
            year = fallbackYear();
        }

        return new TeamEntry({ teamCode, calendarId, year });
    }

    /**
     * Serialize to a plain JSON object suitable for writing to config.json.
     *
     * @returns {{ teamCode: string, calendarId: string, year: number }}
     */
    toJson() {
        return {
            teamCode: this.teamCode,
            calendarId: this.calendarId,
            year: this.year,
        };
    }
}

// ── LeagueConfig ────────────────────────────────────────────

/**
 * A league's configuration: the league name and its team entries.
 *
 * @example
 *   const lc = LeagueConfig.fromJson("nba", [
 *     { teamCode: "NYK", calendarId: "primary" },
 *   ]);
 *   lc.league;       // "nba"
 *   lc.teams.length; // 1
 *   lc.toJson();     // { nba: [{ teamCode: "NYK", calendarId: "primary", year: 2025 }] }
 */
export class LeagueConfig {
    /** @type {string} League key, e.g. "nba", "wnba" */
    league;

    /** @type {TeamEntry[]} team entries for this league */
    teams;

    /**
     * @param {{
     *   league: string,
     *   teams: TeamEntry[],
     * }} props
     */
    constructor({ league, teams }) {
        this.league = league;
        this.teams = teams;
    }

    /**
     * Build a LeagueConfig from a raw JSON array (e.g. from config.json).
     *
     * @param {string} league — league key (e.g. "nba", "wnba")
     * @param {object[]} entries — raw team entry objects
     * @returns {LeagueConfig}
     * @throws {Error} if entries is empty (after filtering)
     */
    static fromJson(league, entries) {
        if (!Array.isArray(entries)) {
            throw new Error(
                `Invalid config: value for "${league}" must be an array of team entries`
            );
        }

        let teams = entries
            .map(entry => TeamEntry.fromJson(entry, league))
            .filter(entry => entry !== null);

        if (teams.length === 0) {
            throw new Error(`Invalid config: no valid team entries for "${league}"`);
        }

        return new LeagueConfig({ league, teams });
    }

    /**
     * Serialize to a plain JSON object with the league as the key.
     *
     * @returns {Record<string, { teamCode: string, calendarId: string, year: number }[]>}
     */
    toJson() {
        return {
            [this.league]: this.teams.map(t => t.toJson()),
        };
    }
}

// ── Config ──────────────────────────────────────────────────

/**
 * Top-level configuration: a collection of league configs.
 *
 * The config file maps league names to arrays of team entries.
 * Each team entry specifies a team code, the calendar to write to,
 * and optionally a season year.
 *
 * @example
 *   // From a config.json file:
 *   const config = await Config.fromFile("config.json");
 *
 *   // From a raw object:
 *   const config = Config.fromJson({
 *     nba: [
 *       { teamCode: "NYK", calendarId: "primary", year: 2025 },
 *       { teamCode: "BOS", calendarId: "celtics@..." },
 *     ],
 *     wnba: [
 *       { teamCode: "NYL", calendarId: "liberty@..." },
 *     ],
 *   });
 *
 *   // Iterate:
 *   for (const league of config.leagues) {
 *     for (const team of league.teams) {
 *       console.log(team.teamCode, team.calendarId, team.year);
 *     }
 *   }
 *
 *   // Serialize:
 *   config.toJson();
 */
export class Config {
    /** @type {LeagueConfig[]} league configurations */
    leagues;

    /**
     * @param {{ leagues: LeagueConfig[] }} props
     */
    constructor({ leagues }) {
        this.leagues = leagues;
    }

    /**
     * Build a Config from a raw JSON object.
     *
     * @param {Record<string, object[]>} json — league keys → arrays of team entry objects
     * @returns {Config}
     * @throws {Error} if json is not an object or has no valid leagues
     */
    static fromJson(json) {
        if (typeof json !== "object" || json === null || Array.isArray(json)) {
            throw new Error("Invalid config: must be an object with league keys");
        }

        let leagues = [];

        for (let [league, entries] of Object.entries(json)) {
            let leagueLower = league.toLowerCase();

            try {
                let leagueConfig = LeagueConfig.fromJson(leagueLower, entries);
                leagues.push(leagueConfig);
            } catch (e) {
                // Empty league arrays just get skipped (with a warning)
                if (entries.length === 0) {
                    console.warn(`No team entries for ${leagueLower}, skipping`);
                    continue;
                }
                throw e;
            }
        }

        if (leagues.length === 0) {
            throw new Error("Invalid config: no leagues configured");
        }

        return new Config({ leagues });
    }

    /**
     * Read and parse a config.json file.
     *
     * @param {string} filePath — absolute or relative path to the config file
     * @returns {Promise<Config>}
     * @throws {Error} if the file can't be read or the config is invalid
     */
    static async fromFile(filePath) {
        let json = await fs.readFile(filePath, "utf-8");
        let raw = JSON.parse(json);
        return Config.fromJson(raw);
    }

    /**
     * Serialize to a plain JSON object suitable for writing to config.json.
     *
     * @returns {Record<string, { teamCode: string, calendarId: string, year: number }[]>}
     */
    toJson() {
        let result = {};
        for (let league of this.leagues) {
            Object.assign(result, league.toJson());
        }
        return result;
    }
}

// ── Convenience ─────────────────────────────────────────────

/**
 * Read and validate config.json from the project root.
 *
 * @returns {Promise<Config>}
 */
export async function readConfig() {
    let configFile = pathJoin(__dirname, "..", "config.json");
    return Config.fromFile(configFile);
}

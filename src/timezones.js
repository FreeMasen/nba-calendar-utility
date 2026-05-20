/**
 * Team tricode → IANA timezone mapping.
 *
 * Google Calendar's `timeZone` field accepts IANA tz database names
 * (e.g. "America/New_York"). When we set the event start/end with a
 * `timeZone`, Google handles DST conversion automatically — the event
 * shows at the correct wall-clock time regardless of when it's viewed.
 *
 * We map by **home team tricode** rather than arena name because:
 *   - Tricodes are stable across arena renames (sponsor changes)
 *   - Teams rarely relocate (and when they do, the tricode often changes)
 *   - It's more compact and easier to maintain
 *
 * NBA and WNBA share some tricodes (CHI, ATL, DAL, MIN, IND, WAS, PHX)
 * but those teams play in the same timezone in both leagues, so one
 * entry covers both. WNBA-unique tricodes (NYL, CON, LVA, LA) are
 * listed separately.
 *
 * For games where the home team isn't recognized, we fall back to
 * "America/New_York" (covers the most NBA/WNBA teams).
 */

/**
 * @type {Record<string, string>} tricode → IANA timezone
 */
const TEAM_TZ = {
    // ── Atlantic ──────────────────────────────────────
    TOR: "America/Toronto",

    // ── Eastern ───────────────────────────────────────
    NYK: "America/New_York",
    BKN: "America/New_York",
    PHI: "America/New_York",
    WAS: "America/New_York",
    BOS: "America/New_York",
    DET: "America/Detroit",
    CLE: "America/New_York",
    IND: "America/Indiana/Indianapolis",
    ATL: "America/New_York",
    MIA: "America/New_York",
    ORL: "America/New_York",
    CHA: "America/New_York",

    // ── Central ───────────────────────────────────────
    CHI: "America/Chicago",
    MIL: "America/Chicago",
    MIN: "America/Chicago",
    OKC: "America/Chicago",
    SAS: "America/Chicago",
    DAL: "America/Chicago",
    HOU: "America/Chicago",
    MEM: "America/Chicago",
    NOP: "America/Chicago",

    // ── Mountain ──────────────────────────────────────
    DEN: "America/Denver",
    UTA: "America/Denver",
    PHX: "America/Phoenix",   // Arizona doesn't observe DST

    // ── Pacific ───────────────────────────────────────
    LAL: "America/Los_Angeles",
    LAC: "America/Los_Angeles",
    GSW: "America/Los_Angeles",
    SAC: "America/Los_Angeles",
    POR: "America/Los_Angeles",

    // ── WNBA-specific tricodes ────────────────────────
    NYL: "America/New_York",   // Liberty
    CON: "America/New_York",   // Sun (Connecticut)
    LVA: "America/Los_Angeles", // Aces (Las Vegas → Pacific)
    LV:  "America/Los_Angeles", // Aces alternate
    LA:  "America/Los_Angeles", // Sparks
    SEA: "America/Los_Angeles", // Storm (Seattle)
};

/** Fallback timezone if the home team isn't in the map */
const DEFAULT_TZ = "America/New_York";

/**
 * Look up the IANA timezone for a home team tricode.
 * Returns DEFAULT_TZ if the tricode isn't recognized.
 *
 * @param {string} tricode  e.g. "NYK", "LAL"
 * @returns {string} IANA timezone name
 */
export function getTeamTimezone(tricode) {
    return TEAM_TZ[tricode] ?? DEFAULT_TZ;
}

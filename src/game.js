import { getTeamTimezone } from "./timezones.js";

/**
 * A normalized game that any league adapter produces.
 * This is the internal representation used by the calendar layer.
 */
export class Game {
    /** @param {{
     *   id: string,
     *   date: string,        // YYYY-MM-DD
     *   utcTime: string,     // ISO 8601 UTC
     *   homeTeam: string,    // e.g. "Knicks"
     *   homeTricode: string, // e.g. "NYK"
     *   awayTeam: string,
     *   awayTricode: string,
     *   arena: string,
     *   gameLabel?: string,
     * }} opts
     */
    constructor({ id, date, utcTime, homeTeam, homeTricode, awayTeam, awayTricode, arena, gameLabel }) {
        this.id = id;
        this.date = date;
        this.utcTime = utcTime;
        this.homeTeam = homeTeam;
        this.homeTricode = homeTricode;
        this.awayTeam = awayTeam;
        this.awayTricode = awayTricode;
        this.arena = arena ?? "";
        this.gameLabel = gameLabel ?? "";
    }

    /**
     * 
     * @param {string} preferred_team The user preferred team
     */
    summary(preferred_team) {
        if (this.homeTricode === preferred_team) {
            return `${this.homeTeam} vs ${this.awayTeam}`;
        }
        return `${this.awayTeam} @ ${this.homeTeam}`;
    }

    /**
     * @returns {string}
     */
    calendarId() {
        return Buffer.from(`${this.id}${this.summary()}${this.gameLabel}`).toString("hex").substring(0, 1024);
    }

    /**
     * Convert to a Google Calendar event with a timed start/end
     * and a timezone so DST is handled correctly.
     *
     * Google Calendar API format:
     *   start: { dateTime: "2024-01-15T19:30:00", timeZone: "America/New_York" }
     *
     * We use the home team's timezone (the game is at their arena).
     * The dateTime is in local wall-clock time at that timezone,
     * and Google uses the timeZone to display it correctly for
     * viewers in any timezone, accounting for DST transitions.
     *
     * @param {string} targetTeam The tricode of the team to put first in the summary
     * @returns {{ start: { dateTime: string, timeZone: string }, end: { dateTime: string, timeZone: string }, summary: string }}
     */
    toCalendarEvent(targetTeam) {
        const tz = getTeamTimezone(this.homeTricode);

        // Parse the UTC time and format it in the arena's local timezone.
        // toLocaleString with timeZone gives us the wall-clock time at the arena.
        const utcDate = new Date(this.utcTime);

        // Get local wall-clock time at the arena's timezone
        const localParts = new Intl.DateTimeFormat("en-CA", {
            timeZone: tz,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        }).formatToParts(utcDate);

        const part = (type) => localParts.find(p => p.type === type).value;
        const localDateTime = `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;

        // End time: assume ~2.5 hours for NBA, ~2 hours for WNBA.
        // This is an estimate; Google Calendar users can adjust.
        const durationMinutes = 150; // 2.5 hours
        const endTime = new Date(utcDate.getTime() + durationMinutes * 60 * 1000);
        const endParts = new Intl.DateTimeFormat("en-CA", {
            timeZone: tz,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        }).formatToParts(endTime);

        const ePart = (type) => endParts.find(p => p.type === type).value;
        const endDateTime = `${ePart("year")}-${ePart("month")}-${ePart("day")}T${ePart("hour")}:${ePart("minute")}:${ePart("second")}`;

        // Short time for the summary (e.g. "7:30 PM")
        const startTime = utcDate.toLocaleTimeString("en-US", {
            timeZone: tz,
            timeStyle: "short",
        });

        return {
            id: this.calendarId(),
            start: { dateTime: localDateTime, timeZone: tz },
            end: { dateTime: endDateTime, timeZone: tz },
            summary: this.summary(),
        };
    }
}

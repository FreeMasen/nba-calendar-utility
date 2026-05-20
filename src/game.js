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
     * Convert to a Google Calendar event.
     * @param {string} targetTeam The tricode of the team to put first in the summary
     * @returns {{ start: { date: string }, end: { date: string }, summary: string }}
     */
    toCalendarEvent(targetTeam) {
        let time = new Date(this.utcTime);
        let startTime = time.toLocaleTimeString([], { timeStyle: "short" });

        let summary;
        if (this.homeTricode === targetTeam) {
            summary = `${this.homeTeam} vs ${this.awayTeam} ${startTime}`;
        } else {
            summary = `${this.awayTeam} @ ${this.homeTeam} ${startTime}`;
        }

        return {
            start: { date: this.date },
            end: { date: this.date },
            summary,
        };
    }
}

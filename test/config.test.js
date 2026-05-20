import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    Config,
    LeagueConfig,
    TeamEntry,
    extractCalendarId,
    fallbackYear,
} from "../src/config.js";

// ── extractCalendarId ───────────────────────────────────────

describe("extractCalendarId", () => {
    it('returns "primary" as-is', () => {
        assert.equal(extractCalendarId("primary"), "primary");
    });

    it("returns a raw email address as-is", () => {
        assert.equal(
            extractCalendarId("ab12cd34@group.calendar.google.com"),
            "ab12cd34@group.calendar.google.com"
        );
    });

    it("extracts calendar ID from an embed URL", () => {
        assert.equal(
            extractCalendarId(
                "https://calendar.google.com/calendar/embed?src=liberty%40group.calendar.google.com"
            ),
            "liberty@group.calendar.google.com"
        );
    });

    it("extracts calendar ID from a settings URL", () => {
        assert.equal(
            extractCalendarId(
                "https://calendar.google.com/calendar/r/settings/calendar/ab12cd34@group.calendar.google.com"
            ),
            "ab12cd34@group.calendar.google.com"
        );
    });

    it("extracts calendar ID from a view URL with email", () => {
        assert.equal(
            extractCalendarId(
                "https://calendar.google.com/calendar/r/ab12cd34@group.calendar.google.com/week"
            ),
            "ab12cd34@group.calendar.google.com"
        );
    });

    it("throws for an unparseable URL", () => {
        assert.throws(
            () => extractCalendarId("https://calendar.google.com/calendar/r/just-a-slug/week"),
            /Could not extract calendar ID from URL/
        );
    });
});

// ── fallbackYear ────────────────────────────────────────────

describe("fallbackYear", () => {
    it("returns a number", () => {
        assert.equal(typeof fallbackYear(), "number");
    });
});

// ── TeamEntry ───────────────────────────────────────────────

describe("TeamEntry", () => {
    it("fromJson uppercases teamCode", () => {
        let te = TeamEntry.fromJson({ teamCode: "nyk", calendarId: "primary" });
        assert.equal(te.teamCode, "NYK");
    });

    it("fromJson extracts calendar ID from URL", () => {
        let te = TeamEntry.fromJson({
            teamCode: "BOS",
            calendarId: "https://calendar.google.com/calendar/embed?src=celtics%40group.calendar.google.com",
        });
        assert.equal(te.calendarId, "celtics@group.calendar.google.com");
    });

    it("fromJson falls back year to current season", () => {
        let te = TeamEntry.fromJson({ teamCode: "NYK", calendarId: "primary" });
        assert.equal(typeof te.year, "number");
        assert(te.year >= 2020);
    });

    it("fromJson preserves explicit year", () => {
        let te = TeamEntry.fromJson({ teamCode: "NYK", calendarId: "primary", year: 2024 });
        assert.equal(te.year, 2024);
    });

    it("fromJson throws for missing teamCode", () => {
        assert.throws(
            () => TeamEntry.fromJson({ calendarId: "primary" }),
            /teamCode is required/
        );
    });

    it("fromJson throws for wrong-length teamCode", () => {
        assert.throws(
            () => TeamEntry.fromJson({ teamCode: "NY", calendarId: "primary" }),
            /3-character/
        );
    });

    it("fromJson throws for missing calendarId", () => {
        assert.throws(
            () => TeamEntry.fromJson({ teamCode: "NYK" }),
            /calendarId is required/
        );
    });

    it("toJson serializes to plain object", () => {
        let te = TeamEntry.fromJson({ teamCode: "NYK", calendarId: "primary", year: 2025 });
        let json = te.toJson();
        assert.deepEqual(json, { teamCode: "NYK", calendarId: "primary", year: 2025 });
    });
});

// ── LeagueConfig ────────────────────────────────────────────

describe("LeagueConfig", () => {
    it("fromJson parses a league with multiple teams", () => {
        let lc = LeagueConfig.fromJson("nba", [
            { teamCode: "NYK", calendarId: "primary" },
            { teamCode: "BOS", calendarId: "celtics@group.calendar.google.com", year: 2025 },
        ]);
        assert.equal(lc.league, "nba");
        assert.equal(lc.teams.length, 2);
        assert.equal(lc.teams[0].teamCode, "NYK");
        assert.equal(lc.teams[1].teamCode, "BOS");
    });

    it("fromJson throws for non-array value", () => {
        assert.throws(
            () => LeagueConfig.fromJson("nba", "not an array"),
            /must be an array/
        );
    });

    it("fromJson throws for empty array", () => {
        assert.throws(
            () => LeagueConfig.fromJson("nba", []),
            /no valid team entries/
        );
    });

    it("toJson produces { league: entries[] }", () => {
        let lc = LeagueConfig.fromJson("wnba", [
            { teamCode: "NYL", calendarId: "primary" },
        ]);
        let json = lc.toJson();
        assert.ok(json.wnba);
        assert.equal(json.wnba.length, 1);
        assert.equal(json.wnba[0].teamCode, "NYL");
    });
});

// ── Config ──────────────────────────────────────────────────

describe("Config", () => {
    it("fromJson parses a multi-league config", () => {
        let config = Config.fromJson({
            nba: [
                { teamCode: "NYK", calendarId: "primary" },
                { teamCode: "BOS", calendarId: "celtics@group.calendar.google.com", year: 2025 },
            ],
            wnba: [
                { teamCode: "NYL", calendarId: "liberty@group.calendar.google.com" },
            ],
        });
        assert.equal(config.leagues.length, 2);
        assert.equal(config.leagues[0].league, "nba");
        assert.equal(config.leagues[0].teams.length, 2);
        assert.equal(config.leagues[1].league, "wnba");
        assert.equal(config.leagues[1].teams.length, 1);
    });

    it("fromJson throws for non-object input", () => {
        assert.throws(
            () => Config.fromJson("not an object"),
            /must be an object with league keys/
        );
    });

    it("fromJson throws for null input", () => {
        assert.throws(
            () => Config.fromJson(null),
            /must be an object with league keys/
        );
    });

    it("fromJson throws for array input", () => {
        assert.throws(
            () => Config.fromJson([]),
            /must be an object with league keys/
        );
    });

    it("fromJson throws for empty object", () => {
        assert.throws(
            () => Config.fromJson({}),
            /no leagues configured/
        );
    });

    it("round-trips through toJson", () => {
        let original = Config.fromJson({
            nba: [
                { teamCode: "NYK", calendarId: "primary", year: 2025 },
                { teamCode: "BOS", calendarId: "celtics@group.calendar.google.com" },
            ],
            wnba: [
                { teamCode: "NYL", calendarId: "liberty@group.calendar.google.com" },
            ],
        });
        let json = original.toJson();
        let restored = Config.fromJson(json);
        assert.deepEqual(original.toJson(), restored.toJson());
    });
});

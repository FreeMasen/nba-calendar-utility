import fetch from "node-fetch";
import { dirname, join as pathJoin } from 'path';
import _fs from "node:fs";
import { fileURLToPath } from 'url';
import { argv, env } from "process";
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';
const fs = _fs.promises;
Promise.sleep = (ms) => new Promise(r => setTimeout(r, ms));

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = pathJoin(__dirname, 'token.json');
const CREDENTIALS_PATH = pathJoin(__dirname, 'credentials.json');
const SCOPES = ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/calendar.events"];

// Google auth code from calendar example
async function loadSavedCredentialsIfExist() {
    try {
        const content = await fs.readFile(TOKEN_PATH);
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch {
        return;
    }
}

async function saveCredentials(client) {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
}

async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}
// end google auth code
// data.nba.net interactions
async function downloadAndSave(where, url) {
    let res = await fetch(url);
    if (!res.ok) {
        console.error("Non 200 return code");
        console.error(await res.text());
        return;
    }
    let body = await res.json();
    await fs.writeFile(where, JSON.stringify(body));
    return body;
}

async function downloadAndSaveSchedule(year, where) {
    return await downloadAndSave(where, `https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_2.json`);
}

async function getSeason(year) {
    let expectedPath = pathJoin(__dirname, `${year}-schedule.json`);
    try {
        await fs.access(expectedPath);
    } catch {
        return await downloadAndSaveSchedule(year, expectedPath);
    }
    return JSON.parse(await fs.readFile(expectedPath, "utf-8"))
}
// end data.nba.net interactions

/**
 * Returns the fallback year which is the current year if the month is
 * greater than April or last year if the month is less than april which
 * should correspond with the season year. For example the 2022/2023 season
 * started in october of 2022 and will end in april of 2023 but the data.nba.net
 * api's all treat this as the 2022 season.
 * @returns Number
 */
function fallbackYear() {
    let today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth();
    if (month >= 0 && month <= 4) {
        return year - 1
    }
    return year
}

/**
 * Filter the provided games to only include games where the targetTeamId is the
 * home or away team.
 * @param {Object[]} games List of games from data.nba.net
 * @param {Number} targetTeamId The team ID to find all home and away games for
 * @returns Object[]
 */
function filterGames(games, targetTeamId) {
    return games.flatMap(g => g.games).filter(g => g.homeTeam.teamTricode == targetTeamId || g.awayTeam.teamTricode == targetTeamId)
}

async function clearEvents(calendarId, year, auth) {
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.events.list({
        calendarId,
        timeMin: `${year}-09-01T00:00:00z`,
        singleEvents: true,
        orderBy: 'startTime',
    });
    const events = res.data.items;
    if (!events || events.length === 0) {
        console.log('No upcoming events found.');
        return;
    }
    for (let event of events) {
        await Promise.sleep(500);
        let res = await calendar.events.delete({
            calendarId,
            eventId: event.id,
        });
        console.log("deleted ", res.data);
    }
}

/**
 * Save the events to a calendar
 * @param {{start: {date: string}, end: {date: string}, summary: string}[]} games Games as google calendar events
 * @param {any} auth The google api auth object
 * @returns string
 */
async function saveEvents(games, calendarId, auth) {
    const calendar = google.calendar({ version: 'v3', auth });
    
    let success_ct = 0;
    for (let ev of games) {
        console.log("Inserting :", ev.summary, ev.start.date)
        let result = await calendar.events.insert({
            calendarId,
            resource: ev,
        });
        if (result.status != 200) {
           console.log("Failed to insert event ", ev.summary, result.status, result);
        } else {
            success_ct += 1;
        }
    }
    return `Inserted ${success_ct} of ${games.length} events`;
}

function gameToEvent(game, teams, targetTeam) {
    let gameDt = new Date(game.gameDateTimeEst);
    let year = gameDt.getFullYear().toString()
    let month = (gameDt.getMonth() + 1).toString().padStart(2, "0");
    let day = gameDt.getDate().toString().padStart(2, "0");
    let date = {
        date: `${year}-${month}-${day}`,
    }
    let hTeam = game.homeTeam.teamName;
    let vTeam = game.awayTeam.teamName;
    let time = new Date(game.gameTimeUTC);
    let startTime = time.toLocaleTimeString([], { timeStyle: "short" });
    
    let summary
    if (game.homeTeam.teamTricode == targetTeam) {
        summary = `${hTeam} vs ${vTeam} ${startTime}`;
    } else {
        summary = `${vTeam} @ ${hTeam} ${startTime}`;
    }
    let ret = {
        start: date,
        end: date,
        summary,
    }
    return ret;
}

/**
 * Read the configuration from disk
 * @returns {teamCode: string, calendarId: string, year: number}
 */
async function readConfig() {
    let configFile = pathJoin(__dirname, "config.json");
    let json = await fs.readFile(configFile, "utf-8");
    let cfg = JSON.parse(json);
    if (!cfg.teamCode || typeof cfg.teamCode != "string" || cfg.teamCode.length != 3) {
        throw "Invalid config.json, teamCode is required to be a 3 character string";
    }
    if (!cfg.calendarId
        || typeof cfg.calendarId != "string") {
        throw "Invalid config.json, calendarId is required to be a string";
    }
    if (cfg.year && typeof cfg.year != "number") {
        let fallback = fallbackYear();
        console.warn(`Invalid year (${cfg.year}) found in config.json, using default year: ${fallback}`);
        cfg.year = fallback;
    } else if (!cfg.year) {
        cfg.year = fallbackYear();
    }
    cfg.teamCode = cfg.teamCode.toUpperCase();
    return cfg;
}

(async () => {
    let auth = await authorize();
    let config = await readConfig();
    
    // await clearEvents(config.calendarId, auth)
    let allSeasons = await getSeason(config.year);
    if (!allSeasons) {
        return "Error fetching season"
    }
    let teamGames = filterGames(allSeasons.leagueSchedule.gameDates, config.teamCode)
        .map(g => gameToEvent(g, {}, config.teamCode));
    return await saveEvents(teamGames, config.calendarId, auth);
})().then(msg => console.log("complete", msg))
    .catch(e => console.log(e));

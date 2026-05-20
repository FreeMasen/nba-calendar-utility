import { dirname, join as pathJoin } from 'node:path';
import * as fs from "node:fs/promises";
import { fileURLToPath } from 'node:url';
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_PATH = pathJoin(__dirname, 'token.json');
const CREDENTIALS_PATH = pathJoin(__dirname, 'credentials.json');
const SCOPES = ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/calendar.events"];
const CALENDAR_INSERT_DELAY_MS = 500;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Google Auth ──────────────────────────────────────────────

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

export async function authorize() {
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

// ── Calendar Operations ──────────────────────────────────────

/**
 * Clear all events from the calendar within the given season window.
 * @param {string} calendarId
 * @param {number} year
 * @param {any} auth
 */
export async function clearEvents(calendarId, year, auth) {
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.events.list({
        calendarId,
        timeMin: `${year}-01-01T00:00:00z`,
        timeMax: `${year}-12-31T23:59:59z`,
        singleEvents: true,
        orderBy: 'startTime',
    });
    const events = res.data.items;
    if (!events || events.length === 0) {
        console.log('No events found for the season window.');
        return;
    }
    for (let event of events) {
        await sleep(CALENDAR_INSERT_DELAY_MS);
        let delRes = await calendar.events.delete({
            calendarId,
            eventId: event.id,
        });
        console.log("deleted", event.summary, delRes.data);
    }
}

/**
 * Insert games as all-day calendar events.
 * @param {import('./game.js').Game[]} games
 * @param {string} calendarId
 * @param {string} targetTeam
 * @param {any} auth
 * @returns {string}
 */
export async function saveEvents(games, calendarId, targetTeam, auth) {
    const calendar = google.calendar({ version: 'v3', auth });

    let successCt = 0;
    for (let game of games) {
        let ev = game.toCalendarEvent(targetTeam);
        console.log("Inserting:", ev.summary, ev.start.dateTime, `(${ev.start.timeZone})`);
        let result = await calendar.events.insert({
            calendarId,
            resource: ev,
        });
        if (result.status != 200) {
            console.log("Failed to insert event", ev.summary, result.status, result);
        } else {
            successCt += 1;
        }
        await sleep(CALENDAR_INSERT_DELAY_MS);
    }
    return `Inserted ${successCt} of ${games.length} events`;
}

# NBA/WNBA Calendar Utility

A command line utility written in Node.js that creates Google Calendar events for each scheduled game of a single NBA or WNBA team. Each event is created as an "all day" event with details in the summary. The format looks like:

```text
<Target Team Nickname> <[vs|@]> <Opponent Nickname> <Local Time>
```

The target team's nickname always comes first. For home games the teams are separated by `vs` and for away games `@`. The official start time follows the opponent's nickname, formatted according to your computer's locale.

## Supported Leagues

| League | Config value | Team code example |
|--------|-------------|-------------------|
| NBA    | `nba`       | `NYK`, `LAL`, `BOS` |
| WNBA   | `wnba`      | `NYL`, `LVA`, `IND` |

Adding a new league requires implementing the adapter interface in `src/leagues/` — see [Adding a League](#adding-a-league) below.

## Usage

> **Warning:** This utility doesn't do duplicate event checks. If you run it twice, you'll get duplicate events. See [Clearing existing events](#clearing-existing-events) to remove them first.

### Google Calendar API setup

Head to [Google's console](https://console.cloud.google.com/apis/credentials) and create a new OAuth Client ID, select "Desktop App" Application Type. Download the credentials as JSON.

### Local setup

```sh
git clone https://github.com/FreeMasen/nba-calendar-utility
cd ./nba-calendar-utility
npm install
cp ./config.json.example ./config.json
```

Copy the Google Calendar credentials into a file called `credentials.json` in the project root, something like:

```sh
mv ~/Downloads/client_secret.apps.googleusercontent.com.json ./credentials.json
```

Open `config.json` and update the fields:

- `league`: Either `"nba"` or `"wnba"`. Defaults to `"nba"`.
- `teamCode`: 3-letter code for your team. Head to nba.com or wnba.com — the scores bar at the top displays these codes.
- `calendarId`: The calendar identifier. Accepts:
  - `"primary"` for your default calendar
  - The calendar email address (e.g. `ab12cd34@group.calendar.google.com`) — find it in Google Calendar settings → Integrate calendar → Calendar ID
  - A full Google Calendar URL — just paste the URL from your browser and the config parser will extract the ID
- `year`: The season year. Defaults to the current season year (if the current month is ≤ April, last year is used).

### Auth

The first time you run this, your browser will open and ask you to log into your Google account and authorize the application. The minimum permission needed is "View and edit events on all your calendars". After authorizing, a `token.json` file is saved in the project root for future runs.

### Schedule caching

The first run for a given league+year fetches the full schedule and caches it as `<league>-<year>-schedule.json` in the project root. Subsequent runs use the cache. Delete the cache file to refresh.

### Clearing existing events

To remove all events from the calendar within a season window before inserting new ones, uncomment the `clearEvents` line in `index.mjs`:

```js
await clearEvents(calendarId, year, auth);
```

## Adding a League

Each league is a module in `src/leagues/` that exports an adapter object:

```js
import { Game } from "../game.js";

export const myLeague = {
    name: "My League",
    seasonKey: "myLeagueYear",

    async fetchSchedule(year, cacheDir) {
        // 1. Check for a cached file in cacheDir
        // 2. If no cache, fetch from the league's API
        // 3. Normalize every game to a Game instance
        // 4. Return the array of Game objects
        return games.map(g => new Game({
            id: g.id,
            date: "2026-05-15",      // YYYY-MM-DD
            utcTime: "2026-05-15T23:00:00Z", // ISO 8601 UTC
            homeTeam: "Liberty",
            homeTricode: "NYL",
            awayTeam: "Fever",
            awayTricode: "IND",
            arena: "Barclays Center",
            gameLabel: "Preseason",
        }));
    },
};
```

Then register it in `src/leagues/index.js`:

```js
export { myLeague } from "./my-league.js";
```

And add it to the `LEAGUES` map in `index.mjs`.

## Project Structure

```
index.mjs              Entry point — reads config, picks adapter, runs the pipeline
src/
  game.js              Game class — normalized game + toCalendarEvent()
  calendar.js          Google auth, clearEvents, saveEvents
  config.js            readConfig() — parses and validates config.json
  leagues/
    index.js           Re-exports all league adapters
    nba.js             NBA adapter (cdn.nba.com)
    wnba.js            WNBA adapter (content-api-prod.nba.com)
```

# NBA Calendar Utility

This is a command line utility written in nodejs that will create a google calendar event for
each scheduled game for a single NBA team. Each event is created as an "all day" event with
the details in the event summary. The format looks like the following

```text
<Target Team Nickname> <[vs|@]> <Opponent Nickname> <Local Time>
```

The team used in the configuration's nickname always comes first. For home games the teams
are separated by `vs` and for away games `@`. The official start time follows the opponent's
nickname which has been formatted according to the locale of the computer it was run on.

## Usage

> WARNING this utility doesn't do any kind of duplicate event checks or remove anything from
> the target calendar

### Google Calendar API setup

Head to [google's console](https://console.cloud.google.com/apis/credentials) and create a
new OAuth Client ID, select "Desktop App" Application Type. Download the credentials as
json.

### Local setup

Run

```sh
git clone https://github.com/FreeMasen/nba-calendar-utility
cd ./nba-calendar-utility
npm install
cp ./config.json.example ./config.json
```

Copy the Google Calendar credentials into a file called `credentials.json` in the root of this
project, something like:

```sh
mv ~/Downloads/client_secret.apps.googleusercontent.com.json ./credentials.json
```

> Note: the file name here will have some identifying jibberish

Open `config.json` and update the fields for `teamCode` and `calendarId`.

- `teamCode`: this is the 3 letter code used to identify a team, head to nba.com, their scores
  bar at the top of the screen will display these codes
- `calendarId`: this can be either `"primary"` or the long string provided by google, you can find
  this by logging into your google calendar, clicking the ⋮ next to the desired calendar from the
  side bar and select "Settings". On the following page, in the "Integrate calendar" section there
  should be a "Calendar ID"
- `year`: The year you would like to try and populate a calendar for
  - This will default to the current season year (if the current month is <= April last year)

### Auth

The first time you run this application your browser will open and ask you to log into your google
account. Once logged in, it will ask you to authorize this application, it will then warn you that
google hasn't validated this application (because you just created it in the calendar API setup).

If you select "continue" here you will be prompted with a list of checkboxes for what permissions
you would like to grant this application. The minimum for this to work would be "View and edit
events on all your calendars", this will then take you to a plain text page saying you are all
done authorizing. You should notice a `token.json` file is now in the project root.

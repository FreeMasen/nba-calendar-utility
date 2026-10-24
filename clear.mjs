import { authorize, clearEvents } from "./src/calendar.js";
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';


const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
    console.log("authorizing");
    let auth = await authorize();


    clearEvents("jqobamtfqsdivff171b0afergc@group.calendar.google.com", 2026, auth, event => {
        console.log("considering ", event.summary);
        return event.summary.includes("Pistons vs") || event.summary.includes("Pistons @");
    });

    console.log("\nAll teams processed.");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

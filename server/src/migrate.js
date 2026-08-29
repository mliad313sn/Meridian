/** CLI: apply pending migrations. `npm run migrate` */
import { connect, close, migrate, engine } from "./db.js";

await connect();
console.log(`Meridian IT-PMO — migrating (${engine()})`);
const applied = await migrate();
console.log(applied.length ? `  ${applied.length} migration(s) applied` : "");
await close();

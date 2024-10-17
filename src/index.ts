import { config } from "dotenv";
config();

import { startServer } from "./server";

(async () => {
  await startServer();
})();

import mongoose from "mongoose";
import { CONFIG } from "../src/config/environment";
import { seedDataResources } from "./dataresources.seed";
import { seedSoftwareResources } from "./softwareresources.seed";
import { seedServiceOfferings } from "./serviceofferings.seed";
import { seedGlobalDataType } from "./globaldatatypes.seed";

async function connectAndSeed(url: string) {
  try {
    await mongoose.connect(url, { retryWrites: true });
    await seedGlobalDataType();
    await seedDataResources();
    await seedSoftwareResources();
    await seedServiceOfferings();
    process.stdout.write(`Seed completed successfully for ${url}.`);
  } catch (error: any) {
    process.stdout.write(`Seed error for ${url}: ${error.message}`);
  } finally {
    await mongoose.disconnect();
  }
}

async function run() {
  let mongoUri = `mongodb://${CONFIG.mongoHost}:${CONFIG.mongoPort}/${CONFIG.mongoDatabase}`;
  if (CONFIG.mongoUserName && CONFIG.mongoPassword) {
    mongoUri = `mongodb://${CONFIG.mongoUserName}:${CONFIG.mongoPassword}@${CONFIG.mongoHost}:${CONFIG.mongoPort}/${CONFIG.mongoDatabase}`;
  }
  try {
    await connectAndSeed(mongoUri);
  } catch (error: any) {
    process.stdout.write(`Error: ${error.message}`);
  }
}

(async () => {
  await run();
})();

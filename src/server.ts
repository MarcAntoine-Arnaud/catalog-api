import express, { Application } from "express";
import cors from "cors";
import { loadMongoose } from "./config/database";
import { invalidEndpointHandler } from "./middleware/invalidEndpointHandler";
import { globalErrorHandler } from "./middleware/globalErrorHandler";
import swaggerUI from "swagger-ui-express";
import swaggerSpec from "../docs/swagger.json";
import { CONFIG } from "./config/environment";
import { setupRoutes } from "./routes";

export const startServer = async (testPort?: number) => {
  await loadMongoose();

  const app: Application = express();
  const port = testPort || CONFIG.port || 3000;

  app.use(express.json());
  app.use(cors());

  app.get("/health", (_, res) => {
    res.json({ status: "OK" });
  });
  app.use("/docs", swaggerUI.serve, swaggerUI.setup(swaggerSpec));

  setupRoutes(app);

  app.use(invalidEndpointHandler);
  app.use(globalErrorHandler);

  // Start the server
  let resolve: (arg: any) => void;
  const promise = new Promise((r) => {
    resolve = r;
  });
  const server = app.listen(port, () => {
    //eslint-disable-next-line
    console.log(`Catalog-API running on: http://localhost:${port}`);
    resolve(null); // Resolve the promise from the outside
  });

  return { server, app, promise }; // For tests
};

import serverless from "serverless-http";
import { createApp } from "../../apps/api/dist/src/app.js";

process.env.PROJECTM_SERVERLESS = "true";
const app = createApp();
const serverlessHandler = serverless(app);

export const handler = async (event: Parameters<typeof serverlessHandler>[0], context: Parameters<typeof serverlessHandler>[1]) =>
  serverlessHandler(event, context);

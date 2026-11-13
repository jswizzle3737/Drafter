import path from 'node:path';
import { createDrafterServer } from './server.js';

const port = Number.parseInt(process.env.PORT ?? '4318', 10);
const host = process.env.HOST ?? '127.0.0.1';
const dataFile =
  process.env.DRAFTER_DATA_FILE ??
  path.resolve(process.cwd(), '.drafter-server-data.json');

const instance = await createDrafterServer({ port, host, dataFile });
console.log(`Drafter Companion Server listening at ${instance.baseUrl}`);

const shutdown = async () => {
  await instance.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

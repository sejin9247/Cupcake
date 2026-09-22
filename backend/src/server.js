import { createApp } from './app.js';
import { config } from './config/index.js';
import { connectDb, disconnectDb } from './db/index.js';

await connectDb();

const server = createApp().listen(config.port, () => {
  console.log(`API 서버: http://localhost:${config.port}/api/health`);
  console.log(`CBD 탐색기: http://localhost:${config.port}/cbd-dashboard/`);
});

async function shutdown() {
  server.close();
  await disconnectDb();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

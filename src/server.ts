import 'dotenv/config';
import { buildApp } from './app';

const app = buildApp();
const port = Number(process.env.PORT || 3333);

app
  .listen({ port, host: '0.0.0.0' })
  .then(() => {
    app.log.info(`TBKA API rodando em http://localhost:${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

import { NestFactory } from '@nestjs/core';
import { type MicroserviceOptions } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { ConfigService, JsonLogger } from '@app/config';
import { createConsumerTransportStrategy } from '@app/queue';
import { WorkerModule } from './worker.module.js';
async function bootstrap() {
  const app = await NestFactory.create(WorkerModule, {
    logger: new JsonLogger(),
  });
  const config = app.get(ConfigService);
  app.connectMicroservice<MicroserviceOptions>(
    createConsumerTransportStrategy(config),
  );
  app.enableShutdownHooks();
  await app.init();
  await app.startAllMicroservices();
  await app.listen(process.env.WORKER_PORT ?? 3001);
}
await bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error('Worker failed to start', String(error));
  process.exit(1);
});

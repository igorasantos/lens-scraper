import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JsonLogger } from '@app/config';
import { ApiModule } from './api.module.js';
async function bootstrap() {
  const app = await NestFactory.create(ApiModule, { logger: new JsonLogger() });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const openApiDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('lens-scraper API')
      .setVersion('1.0')
      .build(),
  );
  SwaggerModule.setup('api-docs', app, openApiDocument);
  app.enableShutdownHooks();
  await app.listen(process.env.port ?? 3000);
}
await bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error('API failed to start', String(error));
  process.exit(1);
});

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enforce validation globally
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Enable CORS for web client integration
  app.enableCors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true
  });

  const port = process.env.API_GATEWAY_PORT || 3000;
  await app.listen(port);
  console.log(`🚪 API Gateway running on http://localhost:${port}`);
  console.log(`🧭 GraphQL UI available at http://localhost:${port}/graphql`);
}
bootstrap();

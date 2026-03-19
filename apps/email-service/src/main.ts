import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: ['http://localhost:5173'], credentials: true });

  const port = process.env.EMAIL_PORT || 3004;
  await app.listen(port);
  console.log(`📧 Email Service running on http://localhost:${port}`);
}
bootstrap();

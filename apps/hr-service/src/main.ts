import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: ['http://localhost:5173'], credentials: true });

  const port = process.env.HR_PORT || 3003;
  await app.listen(port);
  console.log(`👔 HR Service running on http://localhost:${port}`);
}
bootstrap();

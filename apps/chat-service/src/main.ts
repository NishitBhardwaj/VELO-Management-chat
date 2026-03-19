import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set up Kafka consumer for asynchronous persistence and fan-out
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: [(process.env.KAFKA_BROKERS || 'localhost:9092')],
        clientId: 'chat-service',
      },
      consumer: {
        groupId: 'chat-cassandra-persister',
      },
    },
  });

  await app.startAllMicroservices();

  const port = process.env.CHAT_SERVICE_PORT || 3006;
  await app.listen(port);
  console.log(`💬 Chat Service running on port ${port}`);
}
bootstrap();

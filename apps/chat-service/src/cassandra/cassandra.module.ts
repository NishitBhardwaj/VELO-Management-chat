import { Module, Global } from '@nestjs/common';
import { Client } from 'cassandra-driver';

export const CASSANDRA_CLIENT = 'CASSANDRA_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: CASSANDRA_CLIENT,
      useFactory: async () => {
        const client = new Client({
          contactPoints: [(process.env.CASSANDRA_HOST || '127.0.0.1:9042')],
          localDataCenter: 'dc1',
        });
        await client.connect();

        // Initialize Core Messaging Keyspace schema dynamically
        await client.execute(`
          CREATE KEYSPACE IF NOT EXISTS velo WITH replication = {'class': 'SimpleStrategy', 'replication_factor': '1'}
        `);
        await client.execute('USE velo');

        await client.execute(`
          CREATE TABLE IF NOT EXISTS messages_by_chat (
            chat_id UUID,
            message_id TIMEUUID,
            sender_id UUID,
            message_type TEXT,
            encrypted_payload TEXT,
            media_url TEXT,
            reply_to_message_id TIMEUUID,
            forwarded BOOLEAN,
            created_at TIMESTAMP,
            PRIMARY KEY (chat_id, message_id)
          ) WITH CLUSTERING ORDER BY (message_id DESC);
        `);

        await client.execute(`
          CREATE TABLE IF NOT EXISTS message_status (
            chat_id UUID,
            message_id TIMEUUID,
            user_id UUID,
            status TEXT,
            updated_at TIMESTAMP,
            PRIMARY KEY ((chat_id, message_id), user_id)
          );
        `);

        return client;
      },
    },
  ],
  exports: [CASSANDRA_CLIENT],
})
export class CassandraModule { }

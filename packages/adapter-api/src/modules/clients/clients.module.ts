import { Module } from '@nestjs/common';
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { Client, ClientSchema, ClientSchemaFactory } from '../../database/schemas/client.schema';
import { Project, ProjectSchema } from '../../database/schemas/project.schema';
import { Connection } from 'mongoose';

@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: Client.name,
        inject: [getConnectionToken()],
        useFactory: (connection: Connection) => {
          return ClientSchemaFactory(connection);
        },
      },
    ]),
    MongooseModule.forFeature([
      { name: Client.name, schema: ClientSchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}


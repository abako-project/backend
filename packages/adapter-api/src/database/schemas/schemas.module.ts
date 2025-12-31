import { Module, Global } from '@nestjs/common';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Milestone, MilestoneSchemaFactory } from './milestone.schema';

/**
 * Global module that registers shared Mongoose schemas with plugins.
 * This ensures schemas with plugins are only registered once,
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: Milestone.name,
        inject: [getConnectionToken()],
        useFactory: (connection: Connection) => {
          return MilestoneSchemaFactory(connection);
        },
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class SchemasModule {}


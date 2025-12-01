import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Connection, Document } from 'mongoose';

export type ClientDocument = Client & Document;

@Schema({ timestamps: true })
export class Client {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  company: string;

  @Prop({ required: true })
  department: string;

  @Prop({ required: true })
  website: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  location: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: number;

  @Prop({ type: Date, default: Date.now })
  updatedAt: number;

  @Prop({ type: Buffer })
  imageData?: Buffer;

  @Prop()
  imageMimeType?: string;

  id?: number;
}

export const ClientSchema = SchemaFactory.createForClass(Client);

ClientSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

export const ClientSchemaFactory = (connection: Connection) => {
  ClientSchema.plugin(require('mongoose-sequence')(connection), {
    inc_field: 'id',
    id: 'client_id_counter',
  });

  return ClientSchema;
};

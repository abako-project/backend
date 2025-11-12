import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.schema';

export type ClientDocument = Client & Document;

@Schema({ timestamps: true })
export class Client {
  @Prop({ required: true })
  name: string;

  @Prop()
  company?: string;

  @Prop()
  department?: string;

  @Prop()
  website?: string;

  @Prop()
  description?: string;

  @Prop()
  location?: string;

  @Prop({ type: Number, ref: 'User', required: true })
  userId: number;

  @Prop({ type: [String], default: [] })
  languages: string[];

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

ClientSchema.plugin(require('mongoose-sequence')(require('mongoose')), {
  inc_field: 'id',
  id: 'client_id_counter',
});


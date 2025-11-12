import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DeveloperDocument = Developer & Document;

@Schema({ timestamps: true })
export class Developer {
  @Prop({ required: true })
  name: string;

  @Prop()
  address?: string;

  @Prop()
  bio?: string;

  @Prop()
  background?: string;

  @Prop()
  githubUsername?: string;

  @Prop()
  portfolioUrl?: string;

  @Prop()
  location?: string;

  @Prop()
  availability?: string;

  @Prop({ type: Number, ref: 'User', required: true })
  userId: number;

  @Prop()
  roleId?: number;

  @Prop()
  proficiencyId?: number;

  @Prop({ default: false })
  isAvailableForHire: boolean;

  @Prop({ default: false })
  isAvailableFullTime: boolean;

  @Prop({ default: false })
  isAvailablePartTime: boolean;

  @Prop({ default: false })
  isAvailableHourly: boolean;

  @Prop()
  availableHoursPerWeek?: number;

  @Prop({ type: [String], default: [] })
  languages: string[];

  @Prop({ type: [String], default: [] })
  skills: string[];

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

export const DeveloperSchema = SchemaFactory.createForClass(Developer);

DeveloperSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

DeveloperSchema.plugin(require('mongoose-sequence')(require('mongoose')), {
  inc_field: 'id',
  id: 'developer_id_counter',
});


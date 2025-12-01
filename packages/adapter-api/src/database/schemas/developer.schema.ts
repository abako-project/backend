import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Connection, Document } from 'mongoose';

export type DeveloperDocument = Developer & Document;

@Schema({ timestamps: true })
export class Developer {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  githubUsername: string;

  @Prop()
  portfolioUrl?: string;

  @Prop()
  bio: string;

  @Prop()
  background: string;

  @Prop({ enum: ['junior', 'mid-level', 'senior'], required: true, default: 'junior' })
  role: string;

  @Prop()
  location: string;

  @Prop({ enum: ['NotAvailable', 'PartTime', 'FullTime', 'WeeklyHours'], required: true })
  availability: string;

  @Prop({ type: [String], required: true, default: [] })
  languages: string[];

  @Prop({ type: [String], required: true, default: [] })
  skills: string[];

  @Prop()
  availableHoursPerWeek?: number;

  @Prop()
  proficiencyId?: number;

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

export const DeveloperSchemaFactory = (connection: Connection) => {
  DeveloperSchema.plugin(require('mongoose-sequence')(connection), {
    inc_field: 'id',
    id: 'developer_id_counter',
  });

  return DeveloperSchema;
};

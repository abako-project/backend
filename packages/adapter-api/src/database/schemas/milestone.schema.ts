import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MilestoneDocument = Milestone & Document;

@Schema({ timestamps: true })
export class Milestone {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  budget: number;

  @Prop({ required: true })
  deliveryTimeId: number;

  @Prop({ type: Date, required: true })
  deliveryDate: number;

  @Prop()
  roleId?: number;

  @Prop()
  proficiencyId?: number;

  @Prop({ required: true, default: 0 })
  displayOrder: number;

  @Prop({ required: true })
  projectId: number;

  @Prop({ default: false })
  neededFullTimeDeveloper: boolean;

  @Prop({ default: false })
  neededPartTimeDeveloper: boolean;

  @Prop({ default: false })
  neededHourlyDeveloper: boolean;

  @Prop({ type: Number, ref: 'Developer' })
  developerId?: number;

  @Prop({ required: true, default: 'pending' })
  state: string;

  @Prop({ type: [String], default: [] })
  skills: string[];

  @Prop({ type: Date, default: Date.now })
  createdAt: number;

  @Prop({ type: Date, default: Date.now })
  updatedAt: number;

  id?: number;
}

export const MilestoneSchema = SchemaFactory.createForClass(Milestone);

MilestoneSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

MilestoneSchema.plugin(require('mongoose-sequence')(require('mongoose')), {
  inc_field: 'id',
  id: 'milestone_id_counter',
});


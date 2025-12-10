import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Connection, Document } from 'mongoose';

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
  deliveryTime: number;

  @Prop({ type: Date, required: true })
  deliveryDate: number;

  @Prop()
  role?: string;

  @Prop()
  proficiency?: string;

  @Prop({ required: true, default: 0 })
  displayOrder: number;

  @Prop({ required: true })
  contractAddress: string;

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

MilestoneSchema.index({ contractAddress: 1 });

MilestoneSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

export const MilestoneSchemaFactory = (connection: Connection) => {
  MilestoneSchema.plugin(require('mongoose-sequence')(connection), {
    inc_field: 'id',
    id: 'milestone_id_counter',
  });

  return MilestoneSchema;
};

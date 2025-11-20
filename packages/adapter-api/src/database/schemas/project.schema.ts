import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProjectDocument = Project & Document;

@Schema({ timestamps: true })
export class Project {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop()
  summary?: string;

  @Prop()
  projectTypeId?: number;

  @Prop({ required: true, default: 'draft' })
  state: string;

  @Prop()
  url?: string;

  @Prop()
  budgetId?: number;

  @Prop()
  deliveryTimeId?: number;

  @Prop({ type: Date })
  deliveryDate?: number;

  @Prop()
  proposalRejectionReason?: string;

  @Prop({ required: true })
  clientId: number;

  @Prop()
  consultantId?: number;

  @Prop({ type: Date, default: Date.now })
  createdAt: number;

  @Prop({ type: Date, default: Date.now })
  updatedAt: number;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

ProjectSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});


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
  projectType?: number;

  @Prop({ required: true, default: 'draft' })
  state: string;

  @Prop()
  url?: string;

  @Prop()
  budget?: number;

  @Prop()
  deliveryTime?: number;

  @Prop({ type: Date })
  deliveryDate?: number;

  @Prop()
  proposalRejectionReason?: string;

  @Prop({ required: true })
  clientId: string;

  @Prop()
  consultantId?: string;

  @Prop({ unique: true, sparse: true })
  contractAddress?: string;

  @Prop()
  calendarContract?: string;

  @Prop()
  coordinatorApprovalStatus?: string;

  @Prop()
  coordinatorRejectionReason?: string;

  @Prop({ 
    enum: ['pending', 'creating', 'created', 'failed'],
    default: 'created'
  })
  creationStatus?: 'pending' | 'creating' | 'created' | 'failed';

  @Prop()
  creationError?: string;

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


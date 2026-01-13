import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RatingDocument = Rating & Document;

@Schema({ timestamps: true })
export class Rating {
  @Prop({ required: true })
  projectId: string;

  @Prop({ required: true })
  clientId: string;

  @Prop({ required: true })
  developerId: string;

  @Prop({ required: true, min: 0, max: 100 })
  rating: number;

  @Prop()
  contractAddress?: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: number;

  @Prop({ type: Date, default: Date.now })
  updatedAt: number;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);

RatingSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

RatingSchema.index({ clientId: 1 });
RatingSchema.index({ developerId: 1 });
RatingSchema.index({ projectId: 1 });
RatingSchema.index({ clientId: 1, developerId: 1 });


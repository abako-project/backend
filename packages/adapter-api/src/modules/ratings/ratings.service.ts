import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Rating, RatingDocument } from '../../database/schemas/rating.schema';
import {
  RatingResponse,
  DeveloperRatingsResponse,
  ClientRatingsResponse
} from './types';

@Injectable()
export class RatingsService {
  constructor(
    @InjectModel(Rating.name) private ratingModel: Model<RatingDocument>,
  ) { }

  async createRatings(
    projectId: string,
    clientId: string,
    ratings: Array<[string, number]>,
    contractAddress?: string,
  ): Promise<Rating[]> {
    try {
      const ratingDocuments = ratings.map(([developerId, rating]) => ({
        projectId,
        clientId,
        developerId,
        rating,
        contractAddress,
      }));

      const createdRatings = await this.ratingModel.insertMany(ratingDocuments);
      console.log(`Created ${createdRatings.length} ratings for project ${projectId}`);

      return createdRatings;
    } catch (error: any) {
      console.error('Error creating ratings:', error);
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((err: any) => err.message);
        throw new BadRequestException(messages.join(', '));
      }
      throw error;
    }
  }

  async getRatingsByClient(clientId: string): Promise<ClientRatingsResponse> {
    const ratings = await this.ratingModel.find({ clientId }).exec();

    return {
      clientId,
      totalRatings: ratings.length,
      ratings: ratings.map(r => this.mapToResponse(r)),
    };
  }

  async getRatingsByDeveloper(developerId: string): Promise<DeveloperRatingsResponse> {
    const ratings = await this.ratingModel.find({ developerId }).exec();

    if (ratings.length === 0) {
      return {
        developerId,
        averageRating: 0,
        totalRatings: 0,
        ratings: [],
      };
    }

    const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = parseFloat((totalRating / ratings.length).toFixed(2));

    return {
      developerId,
      averageRating,
      totalRatings: ratings.length,
      ratings: ratings.map(r => this.mapToResponse(r)),
    };
  }

  async getRatingsByProject(projectId: string): Promise<RatingResponse[]> {
    const ratings = await this.ratingModel.find({ projectId }).exec();
    return ratings.map(r => this.mapToResponse(r));
  }

  private mapToResponse(rating: RatingDocument): RatingResponse {
    return {
      id: (rating._id as any).toString(),
      projectId: rating.projectId,
      clientId: rating.clientId,
      developerId: rating.developerId,
      rating: rating.rating,
      contractAddress: rating.contractAddress,
      createdAt: rating.createdAt,
      updatedAt: rating.updatedAt,
    };
  }
}


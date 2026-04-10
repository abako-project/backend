import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from '../../database/entities/rating.entity';
import {
  RatingResponse,
  DeveloperRatingsResponse,
  ClientRatingsResponse
} from './types';

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating) private ratingRepo: Repository<Rating>,
  ) { }

  async createRatings(
    projectId: string,
    clientId: string,
    ratings: Array<[string, number]>,
    contractAddress?: string,
  ): Promise<Rating[]> {
    try {
      const ratingEntities = ratings.map(([developerId, rating]) =>
        this.ratingRepo.create({
          projectId,
          clientId,
          developerId,
          rating,
          contractAddress,
        })
      );

      const createdRatings = await this.ratingRepo.save(ratingEntities);
      console.log(`Created ${createdRatings.length} ratings for project ${projectId}`);

      return createdRatings;
    } catch (error: any) {
      console.error('Error creating ratings:', error);
      throw error;
    }
  }

  async getRatingsByClient(clientId: string): Promise<ClientRatingsResponse> {
    const ratings = await this.ratingRepo.find({ where: { clientId } });

    return {
      clientId,
      totalRatings: ratings.length,
      ratings: ratings.map(r => this.mapToResponse(r)),
    };
  }

  async getRatingsByDeveloper(developerId: string): Promise<DeveloperRatingsResponse> {
    const ratings = await this.ratingRepo.find({ where: { developerId } });

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
    const ratings = await this.ratingRepo.find({ where: { projectId } });
    return ratings.map(r => this.mapToResponse(r));
  }

  private mapToResponse(rating: Rating): RatingResponse {
    return {
      id: rating.id.toString(),
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

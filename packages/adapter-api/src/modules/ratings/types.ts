export class Rating {
  projectId: string;
  clientId: string;
  developerId: string;
  rating: number;
  contractAddress?: string;
}

export class RatingResponse {
  id: string;
  projectId: string;
  clientId: string;
  developerId: string;
  rating: number;
  contractAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class DeveloperRatingsResponse {
  developerId: string;
  averageRating: number;
  totalRatings: number;
  ratings: RatingResponse[];
}

export class ClientRatingsResponse {
  clientId: string;
  totalRatings: number;
  ratings: RatingResponse[];
}

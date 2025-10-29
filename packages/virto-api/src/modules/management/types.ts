export interface Membership {
  address: string; 
  membershipId: number; 
  communityId: number; 
}

export interface CreateCommunityRequest {
  communityId: number;
  name: string;
  decisionMethod: {
    type: 'Membership' | 'Rank' | 'NativeToken' | 'CommunityAsset';
    id?: number;
    minVote?: number;
  };
}

export interface CreateCommunityWithMembershipRequest {
  communityId: number;
  name: string;
  decisionMethod: {
    type: 'Membership' | 'Rank' | 'NativeToken' | 'CommunityAsset';
    id?: number;
    minVote?: number;
  };
}

export interface AddMemberRequest {
  communityId: number;
  memberAddress: string;
}

export interface CheckMembershipRequest {
  communityId: number;
  address: string;
}

export interface CommunityAddressResponse {
  address: string;
}

export interface MembershipResponse {
  isMember: boolean;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  service: string;
}

export interface RemoveMemberRequest {
  memberAddress: string;
  communityId: number;
}

export interface GetMembersRequest {
  communityId: number;
  page?: number;
  limit?: number;
}

export interface GetMembersResponse {
  members: Membership[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GetMemberResponse {
  member: Membership;
}

export interface RemoveMemberResponse {
  success: boolean;
  membershipId: string;
}

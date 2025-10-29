import { Injectable } from '@nestjs/common';
import { createClient } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws-provider/node';
import { kreivo, MultiAddress } from '@polkadot-api/descriptors';
import { ConfigService } from '../../config/config.service';
import { polkadotSigner } from '../vos-mock/signer';
import {
  CreateCommunityRequest,
  CreateCommunityWithMembershipRequest,
  AddMemberRequest,
  CommunityAddressResponse,
  MembershipResponse,
  HealthResponse,
  Membership,
  RemoveMemberRequest,
  GetMembersRequest,
  GetMembersResponse,
  GetMemberResponse,
  RemoveMemberResponse
} from './types';

@Injectable()
export class ManagementService {
  constructor(private readonly configService: ConfigService) {}

  async getCommunityAddress(communityId: number): Promise<CommunityAddressResponse> {
    try {
      const client = createClient(
        getWsProvider(this.configService.getKreivoProvider())
      );

      const kreivoApi = client.getTypedApi(kreivo);

      const collectionDetails = await kreivoApi.query.CommunityMemberships.Collection.getValue(communityId);
      
      if (!collectionDetails) {
        client.destroy();
        throw new Error(`Community with ID ${communityId} not found`);
      }

      const communityAddress = collectionDetails.owner as string;

      client.destroy();

      console.log(`Community ${communityId} address: ${communityAddress}`);

      return {
        address: communityAddress
      };
    } catch (error) {
      console.error('Error getting community address from blockchain:', error);
      throw new Error(`Failed to get community address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async addMember(request: AddMemberRequest): Promise<{ success: boolean }> {
    try {
      const client = createClient(
        getWsProvider(this.configService.getKreivoProvider())
      );

      const kreivoApi = client.getTypedApi(kreivo);

      const addMemberTx = kreivoApi.tx.Communities.add_member({
        who: MultiAddress.Id(request.memberAddress),
      });

      console.log(`Adding member ${request.memberAddress} to community ${request.communityId}`);

      const result = await new Promise<{ ok: boolean; txHash: string; blockHash?: any }>((resolve, reject) => {
        addMemberTx.signSubmitAndWatch(polkadotSigner)
          .subscribe({
            next: (event) => {
              console.info('Add member transaction event:', event.type);
              if (event.type === 'txBestBlocksState') {
                resolve({ ok: true, txHash: event.txHash, blockHash: event.found });
              }
            },
            error: (error) => {
              console.error('Add member transaction error:', error);
              reject(error);
            }
          });
      });

      client.destroy();

      if (!result.ok) {
        throw new Error('Failed to add member to community');
      }

      console.log(`Member added successfully. TxHash: ${result.txHash}`);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error adding member to blockchain:', error);
      throw new Error(`Failed to add member: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkMembership(communityId: number, address: string): Promise<MembershipResponse> {
    try {
      const client = createClient(
        getWsProvider(this.configService.getKreivoProvider())
      );

      const kreivoApi = client.getTypedApi(kreivo);

      const membershipKeys = await kreivoApi.query.CommunityMemberships.Account.getEntries(
        address, 
        communityId
      );

      client.destroy();

      const isMember = membershipKeys.length > 0;

      console.log(`Membership check for ${address} in community ${communityId}: ${isMember}`);

      return {
        isMember
      };
    } catch (error) {
      console.error('Error checking membership on blockchain:', error);
      throw new Error(`Failed to check membership: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async healthCheck(): Promise<HealthResponse> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'memberships'
    };
  }

  private async getMembershipId(address: string, communityId: number): Promise<number> {
    const client = createClient(
      getWsProvider(this.configService.getKreivoProvider())
    );

    const kreivoApi = client.getTypedApi(kreivo);

    const membershipKeys = await kreivoApi.query.CommunityMemberships.Account.getEntries(
      address, 
      communityId
    );

    client.destroy();

    if (membershipKeys.length === 0) {
      throw new Error(`Member ${address} not found in community ${communityId}`);
    }

    // keyArgs format: [owner_address, collection_id, item_id]
    const membershipId = membershipKeys[0].keyArgs[2] as number;
    
    return membershipId;
  }

  async removeMember(request: RemoveMemberRequest): Promise<RemoveMemberResponse> {
    try {
      const membershipId = await this.getMembershipId(request.memberAddress, request.communityId);
      
      console.log(`Found membership ID: ${membershipId} for member ${request.memberAddress}`);

      const client = createClient(
        getWsProvider(this.configService.getKreivoProvider())
      );

      const kreivoApi = client.getTypedApi(kreivo);

      const removeMemberTx = kreivoApi.tx.Communities.remove_member({
        who: MultiAddress.Id(request.memberAddress),
        membership_id: membershipId
      });

      console.log(`Removing member ${request.memberAddress} (membership ID: ${membershipId}) from community ${request.communityId}`);

      const result = await new Promise<{ ok: boolean; txHash: string; blockHash?: any }>((resolve, reject) => {
        removeMemberTx.signSubmitAndWatch(polkadotSigner)
          .subscribe({
            next: (event) => {
              console.info('Remove member transaction event:', event.type);
              if (event.type === 'txBestBlocksState') {
                resolve({ ok: true, txHash: event.txHash, blockHash: event.found });
              }
            },
            error: (error) => {
              console.error('Remove member transaction error:', error);
              reject(error);
            }
          });
      });

      client.destroy();

      if (!result.ok) {
        throw new Error('Failed to remove member from community');
      }

      console.log(`Member removed successfully. TxHash: ${result.txHash}`);

      return {
        success: true,
        membershipId: membershipId.toString()
      };
    } catch (error) {
      console.error('Error removing member from blockchain:', error);
      throw new Error(`Failed to remove member: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getMembers(request: GetMembersRequest): Promise<GetMembersResponse> {
    try {
      const client = createClient(
        getWsProvider(this.configService.getKreivoProvider())
      );

      const kreivoApi = client.getTypedApi(kreivo);

      const items = await kreivoApi.query.CommunityMemberships.Item.getEntries(request.communityId);
      
      console.log(`Community ${request.communityId} has ${items.length} members`);

      const communityMembers: Membership[] = items.map((item) => {
        const [collectionId, itemId] = item.keyArgs;
        const ownerAddress = item.value.owner as string;
        
        return {
          address: ownerAddress,
          membershipId: itemId as number,
          communityId: collectionId as number
        };
      });

      const page = request.page || 1;
      const limit = request.limit || 10;
      const total = communityMembers.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      
      const members = communityMembers.slice(startIndex, endIndex);

      client.destroy();

      return {
        members,
        total,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      console.error('Error getting members from blockchain:', error);
      throw new Error(`Failed to get members: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getMember(communityId: number, membershipId: number): Promise<GetMemberResponse> {
    try {
      const client = createClient(
        getWsProvider(this.configService.getKreivoProvider())
      );

      const kreivoApi = client.getTypedApi(kreivo);

      const item = await kreivoApi.query.CommunityMemberships.Item.getValue(communityId, membershipId);
      
      if (!item) {
        client.destroy();
        throw new Error(`Membership ${membershipId} not found in community ${communityId}`);
      }

      const ownerAddress = item.owner as string;

      client.destroy();

      const membership: Membership = {
        address: ownerAddress,
        membershipId: membershipId,
        communityId: communityId
      };

      return {
        member: membership
      };
    } catch (error) {
      console.error('Error getting member from blockchain:', error);
      throw new Error(`Failed to get member: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

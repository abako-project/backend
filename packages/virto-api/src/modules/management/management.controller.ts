import { Controller, Post, Get, Body, Param, Query, HttpException, HttpStatus, Delete } from '@nestjs/common';
import { ManagementService } from './management.service';
import {
  CommunityAddressResponse,
  MembershipResponse,
  HealthResponse,
  GetMembersResponse,
  GetMemberResponse,
  RemoveMemberResponse
} from './types';

@Controller('api/memberships')
export class ManagementController {
  constructor(private readonly managementService: ManagementService) {}

  @Get(':communityId/address')
  async getCommunityAddress(@Param('communityId') communityId: string): Promise<CommunityAddressResponse> {
    try {
      const communityIdNum = parseInt(communityId, 10);
      if (isNaN(communityIdNum)) {
        throw new HttpException('Invalid community ID', HttpStatus.BAD_REQUEST);
      }
      return await this.managementService.getCommunityAddress(communityIdNum);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to get community address',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':communityId/members')
  async getMembers(
    @Param('communityId') communityId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ): Promise<GetMembersResponse> {
    try {
      const parsedCommunityId = parseInt(communityId, 10);
      if (isNaN(parsedCommunityId)) {
        throw new HttpException('Invalid community ID', HttpStatus.BAD_REQUEST);
      }
      
      return await this.managementService.getMembers({
        communityId: parsedCommunityId,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to get members',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':communityId/members/:membershipId')
  async getMember(
    @Param('communityId') communityId: string,
    @Param('membershipId') membershipId: string
  ): Promise<GetMemberResponse> {
    try {
      const parsedCommunityId = parseInt(communityId, 10);
      const parsedMembershipId = parseInt(membershipId, 10);
      
      if (isNaN(parsedCommunityId) || isNaN(parsedMembershipId)) {
        throw new HttpException('Invalid community ID or membership ID', HttpStatus.BAD_REQUEST);
      }
      
      return await this.managementService.getMember(parsedCommunityId, parsedMembershipId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to get member',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':communityId/members/:address/check')
  async checkMembership(
    @Param('communityId') communityId: string,
    @Param('address') address: string
  ): Promise<MembershipResponse> {
    try {
      const parsedCommunityId = parseInt(communityId, 10);
      if (isNaN(parsedCommunityId)) {
        throw new HttpException('Invalid community ID', HttpStatus.BAD_REQUEST);
      }
      return await this.managementService.checkMembership(parsedCommunityId, address);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to check membership',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':communityId/members')
  async addMember(
    @Param('communityId') communityId: string,
    @Body() body: { memberAddress: string }
  ): Promise<{ success: boolean }> {
    try {
      const parsedCommunityId = parseInt(communityId, 10);
      if (isNaN(parsedCommunityId)) {
        throw new HttpException('Invalid community ID', HttpStatus.BAD_REQUEST);
      }
      
      return await this.managementService.addMember({
        communityId: parsedCommunityId,
        memberAddress: body.memberAddress
      });
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to add member',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':communityId/members/:address')
  async removeMember(
    @Param('communityId') communityId: string,
    @Param('address') address: string
  ): Promise<RemoveMemberResponse> {
    try {
      const parsedCommunityId = parseInt(communityId, 10);
      if (isNaN(parsedCommunityId)) {
        throw new HttpException('Invalid community ID', HttpStatus.BAD_REQUEST);
      }
      
      return await this.managementService.removeMember({
        communityId: parsedCommunityId,
        memberAddress: address
      });
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to remove member',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('health')
  async healthCheck(): Promise<HealthResponse> {
    try {
      return await this.managementService.healthCheck();
    } catch (error) {
      throw new HttpException('Service is unhealthy', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}

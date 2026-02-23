import { Controller, Post, Get, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { RampService } from './ramps.service';

@Controller('bramp')
export class RampController {
    constructor(private readonly brampClientService: RampService) { }

    @Post('users')
    async createUser(@Body('email') email: string) {
        return this.brampClientService.createUser(email);
    }

    @Get('users')
    async getUserByEmail(@Query('email') email: string) {
        return this.brampClientService.getUserByEmail(email);
    }

    @Post('deposit')
    async requestDeposit(
        @Body('userId') userId: number,
        @Body('amount') amount: string,
        @Body('toAddress') toAddress: string,
    ) {
        return this.brampClientService.requestDeposit(userId, amount, toAddress);
    }

    @Post('deposit/:depositId/confirm')
    async confirmDeposit(
        @Param('depositId') depositId: string,
        @Body('toAddress') toAddress: string,
    ) {
        return this.brampClientService.confirmDeposit(Number(depositId), toAddress);
    }

    @Post('withdrawal')
    async createWithdrawal(
        @Body('userId') userId: number,
        @Body('amount') amount: string,
    ) {
        return this.brampClientService.createWithdrawal(userId, amount);
    }
}

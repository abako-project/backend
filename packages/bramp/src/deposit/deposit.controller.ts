import { Controller, Post, Body, Param } from '@nestjs/common';
import { DepositService } from './deposit.service';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { ConfirmDepositDto } from './dto/confirm-deposit.dto';

@Controller('deposit')
export class DepositController {
    constructor(private readonly depositService: DepositService) { }

    @Post()
    request(@Body() createDepositDto: CreateDepositDto) {
        return this.depositService.requestDeposit(createDepositDto);
    }

    @Post(':id/confirm')
    confirm(@Param('id') id: string, @Body() body: ConfirmDepositDto) {
        return this.depositService.confirmDeposit(Number(id), body.toAddress);
    }
}

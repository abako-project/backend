import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { DaoService } from './dao.service';

@Controller('dao')
export class DaoController {
    constructor(private readonly daoService: DaoService) { }

    @Post('submit-remark')
    async submitRemark(
        @Body('remark') remark: string,
        @Headers('authorization') authHeader: string,
    ) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing or invalid authorization header');
        }

        const token = authHeader.split(' ')[1];
        return this.daoService.submitRemarkReferendum(remark, token);
    }
}

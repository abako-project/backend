import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WithdrawalService {
  private logger = new Logger(WithdrawalService.name);

  constructor(private prisma: PrismaService) { }

  async create(createWithdrawalDto: CreateWithdrawalDto) {
    const { userId, amount } = createWithdrawalDto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { depositAddress: true }
    });
    if (!user) throw new BadRequestException('User not found');

    this.logger.log(`Creating Withdraw (Ingress) Request for User ${userId}, Amount: ${amount}`);

    const tx = await this.prisma.transaction.create({
      data: {
        amount,
        type: 'WITHDRAWAL',
        status: 'PENDING',
        userId,
      }
    });

    return {
      message: 'Withdraw request created. Waiting for blockchain transfer.',
      withdrawalId: tx.id,
      depositAddress: user.depositAddress?.address || 'GENERATE_OR_FETCH',
      amount
    };
  }

  findAll() {
    return this.prisma.transaction.findMany({ where: { type: 'WITHDRAWAL' } });
  }

  findOne(id: number) {
    return this.prisma.transaction.findUnique({ where: { id } });
  }
}

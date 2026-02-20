import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PapiService } from '../papi/papi.service';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

const ALICE_URI = '//Alice';

@Injectable()
export class UsersService {
  private keyring: Keyring;
  private logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private papi: PapiService
  ) {
    this.keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });
  }

  async create(createUserDto: CreateUserDto) {
    this.logger.log(`Creating user with data: ${JSON.stringify(createUserDto)}`);
    await cryptoWaitReady();
    const { email } = createUserDto;

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          balance: "0",
        }
      });

      // Derive Address: //Alice//<userId>
      // We derive from the "Master" account.

      const derivationPath = `${ALICE_URI}//${user.id}`;
      const derivedPair = this.keyring.createFromUri(derivationPath);
      const derivedAddress = derivedPair.address;

      const depositAddress = await tx.depositAddress.create({
        data: {
          address: derivedAddress,
          derivationIndex: user.id,
          userId: user.id,
        }
      });

      return { ...user, depositAddress };
    });
  }

  findAll() {
    return this.prisma.user.findMany({ include: { depositAddress: true } });
  }

  findOne(id: number) {
    return this.prisma.user.findUnique({ where: { id }, include: { depositAddress: true } });
  }
}

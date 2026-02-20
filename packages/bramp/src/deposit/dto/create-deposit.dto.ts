import { IsNumber, IsString } from 'class-validator';

export class CreateDepositDto {
    @IsNumber()
    userId: number;

    @IsString()
    amount: string;

    @IsString()
    toAddress: string;
}

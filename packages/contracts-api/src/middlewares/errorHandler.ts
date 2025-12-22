import { Request, Response, NextFunction } from 'express'
import { ContractError } from '../util/contractError'
import { getStatusCodeFromContractError } from '../adapters/contractError';

export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Error middleware caught:', error);

    if (error instanceof ContractError) {
        const statusCode = getStatusCodeFromContractError(error.errorMessage);
        return res.status(statusCode).json({
            success: false,
            error: error.errorMessage,
            method: error.method,
            contractAddress: error.contractAddress,
            errorCode: error.errorCode,
        });
    }

    if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
            success: false,
            error: 'Contract not found',
            message: error.message
        });
    }

    if (error instanceof Error && error.message.includes('not found in contract')) {
        return res.status(400).json({
            success: false,
            error: 'Invalid method',
            message: error.message
        });
    }

    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
    });
};
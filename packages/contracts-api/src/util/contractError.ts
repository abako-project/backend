export class ContractError extends Error {
    public readonly method: string;
    public readonly contractAddress: string;
    public readonly errorCode: string | null;
    public readonly errorMessage: string;
  
    constructor(
      method: string,
      contractAddress: string,
      errorMessage: string,
      errorCode: string | null = null
    ) {
      super(`${errorMessage}`);
      this.name = 'ContractError';
      this.method = method;
      this.contractAddress = contractAddress;
      this.errorCode = errorCode;
      this.errorMessage = errorMessage;
  
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, ContractError);
      }
    }
  
    toJSON() {
      return {
        name: this.name,
        message: this.message,
        method: this.method,
        contractAddress: this.contractAddress,
        errorCode: this.errorCode,
        errorMessage: this.errorMessage,
      };
    }
  }
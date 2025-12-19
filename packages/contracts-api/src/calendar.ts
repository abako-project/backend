import { contracts, kreivo } from "@polkadot-api/descriptors"
import { createInkV5Sdk } from "@polkadot-api/sdk-ink"
import { createClient, Binary } from "polkadot-api"
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat"
import { getWsProvider } from "polkadot-api/ws-provider/node"
import contractMetadata from '../.papi/contracts/calendar_v5.json'
import { adminPublicAddress, adminPolkadotSigner } from "./util/signer"
import { ContractError } from "./util/contractError"
import { errorExtractor, decodeErrorMessage } from "./util/errorExtractor"

export class CalendarService {
  private client: any
  private typedApi: any
  private calendarSdk: any
  private contracts: Map<string, any> = new Map()
  private availableMethods: string[]
  private contractErrors: Map<number, string>

  constructor() {
    this.availableMethods = contractMetadata.spec.messages.map((message: any) => message.label)
    this.contractErrors = errorExtractor(contractMetadata)
    console.log("Available methods", this.availableMethods)
    console.log("Loaded calendar contract errors:", Array.from(this.contractErrors.entries()))
  }

  async initialize() {
    this.client = createClient(
      withPolkadotSdkCompat(getWsProvider(process.env.KREIVO_PROVIDER || "ws://localhost:21000")),
    )
    this.typedApi = this.client.getTypedApi(kreivo)
    this.calendarSdk = createInkV5Sdk(this.typedApi, contracts.calendar_v5)

    console.log("CalendarService initialized")

    return this
  }

  private getContract(contractAddress: string) {
    if (!this.contracts.has(contractAddress)) {
      const contract = this.calendarSdk.getContract(contractAddress)
      this.contracts.set(contractAddress, contract)
    }
    return this.contracts.get(contractAddress)
  }

  getAvailableMethods(): string[] {
    return this.availableMethods
  }

  getAvailableConstructors(): string[] {
    return contractMetadata.spec.constructors.map((constructor: any) => constructor.label)
  }

  validateMethod(methodName: string): boolean {
    return this.availableMethods.includes(methodName)
  }

  validateConstructor(constructorName: string): boolean {
    return this.getAvailableConstructors().includes(constructorName)
  }

  private serializeBigInt(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj
    }

    if (typeof obj === 'bigint') {
      return obj.toString()
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.serializeBigInt(item))
    }

    if (typeof obj === 'object') {
      const serialized: any = {}
      for (const [key, value] of Object.entries(obj)) {
        serialized[key] = this.serializeBigInt(value)
      }
      return serialized
    }

    return obj
  }

  async queryMethod(contractAddress: string, methodName: string, data: any = {}) {
    if (!this.validateMethod(methodName)) {
      throw new Error(`Method "${methodName}" not found in contract. Available methods: ${this.availableMethods.join(", ")}`)
    }

    console.log(`Querying method: ${methodName} on contract: ${contractAddress}`)
    console.log({data})

    try {
      const contract = this.getContract(contractAddress)
      const response = await contract.query(methodName as any, {
        origin: adminPublicAddress,
        data: data,
      })

      console.log(response)

      // Handle successful response
      if (response.success) {
        const serializedResponse = response.value.response ? this.serializeBigInt(response.value.response) : null;
        return {
          success: true,
          method: methodName,
          contractAddress: contractAddress,
          response: serializedResponse ?? null,
        };
      }

      // Handle Module error (contract not found)
      if (response.value?.type === 'Module') {
        throw new Error(`Contract ${contractAddress} not found on chain. Please verify the contract address.`);
      }

      // Handle FlagReverted error
      let errorMessage = 'Query failed';
      let errorCode: string | null = null;

      if (response.value?.type === 'FlagReverted' && response.value.value?.message) {
        const decodedError = decodeErrorMessage(response.value.value.message, this.contractErrors);
        errorMessage = decodedError;
        errorCode = response.value.value.message;
      }

      throw new ContractError(
        methodName,
        contractAddress,
        errorMessage,
        errorCode
      );
    } catch (error) {
      // Re-throw ContractError as-is
      if (error instanceof ContractError) {
        throw error;
      }

      // Handle contract not found error
      if (error instanceof Error && error.message.includes('not found')) {
        throw new Error(`Contract ${contractAddress} not found on chain. Please verify the contract address.`);
      }

      console.error(`Error querying method ${methodName} on contract ${contractAddress}:`, error)
      throw new Error(`Failed to query method ${methodName} on contract ${contractAddress}: ${error}`)
    }
  }

  async callMethod(contractAddress: string, methodName: string, data: any = {}) {
    if (!this.validateMethod(methodName)) {
      throw new Error(`Method "${methodName}" not found in contract. Available methods: ${this.availableMethods.join(", ")}`)
    }

    console.log(`Calling method: ${methodName} on contract: ${contractAddress}`)

    console.log("Data:", data)

    try {
      const contract = this.getContract(contractAddress)

      const { caller, ...rest } = data;

      console.log("Caller:", caller)
      console.log("Rest:", rest)

      console.log("Method name:", methodName)

      const txResponse = await contract.query(methodName as any, {
        origin: caller || adminPublicAddress,
        data: rest,
        gas_limit: {
          ref_time: 10000000000n,
          proof_size: 1000000n
        },
        storage_deposit_limit: 100000000000n,
      })

      console.log('txResponse:', txResponse);

      // Check if the query failed with a revert
      if (!txResponse.success) {
        // Extract error information from the reverted response and throw exception
        let errorMessage = 'Contract call would fail';
        let errorCode: string | null = null;

        if (txResponse.value?.type === 'FlagReverted') {
          const revertedValue = txResponse.value.value;

          // Decode the error message from hex code
          if (revertedValue.message) {
            const decodedError = decodeErrorMessage(revertedValue.message, this.contractErrors);
            console.log('decodedError:', decodedError)
            errorMessage = decodedError;
            errorCode = revertedValue.message;
          }
        }

        throw new ContractError(
          methodName,
          contractAddress,
          errorMessage,
          errorCode,
        );
      }


      const tx = methodName == 'set_availability' ?
        await contract.send("set_availability", {
          origin: caller,
          data: rest.data,
          gas_limit: {
            ref_time: 10000000000n,
            proof_size: 1000000n
          },
          storage_deposit_limit: 100000000000n,
        })
        : await contract.send(methodName as any, { 
          origin: adminPublicAddress, 
          data: rest.data 
        });

      const callData = await tx.decodedCall
      const callDataHex = callData.value.value.data.asHex()

      console.log("Data to send:", callDataHex)
      console.log("Gas limit:", callData.value.value.gas_limit)

      if (methodName === 'set_availability') {
        console.log("Setting availability with custom tx")
        const setAvailabilityTx = this.typedApi.tx.Contracts.call({
          dest: {
            type: "Id",
            value: contractAddress
          },
          value: 0n,
          gas_limit: {
            ref_time: 10000000000n,
            proof_size: 1000000n
          },
          storage_deposit_limit: 100000000000n,
          data: Binary.fromHex(callDataHex)
        })
        const encodedData = await setAvailabilityTx.getEncodedData()
        console.log("Encoded data:", encodedData.asHex())
        return {
          method: methodName,
          encodedData: encodedData.asHex(),
        }
      }

      const dispatchTx = this.typedApi.tx.Communities.dispatch_as_account({
        call: {
          type: "Contracts",
          value: {
            type: "call",
            value: {
              dest: {
                type: "Id",
                value: contractAddress
              },
              value: 0n,
              gas_limit: {
                ref_time: 10000000000n,  
                proof_size: 1000000n
              },
              storage_deposit_limit: 100000000000n, 
              data: Binary.fromHex(callDataHex)
            }
          }
        }
      })

      console.log(`Signing and submitting method: ${methodName}`)
      const result = await dispatchTx.signAndSubmit(adminPolkadotSigner);
      return {
        method: methodName,
        success: result.ok,  
        transactionHash: result.txHash,
        blockHash: result.blockHash,
        blockNumber: result.blockNumber,
      }
    } catch (error) {
      console.log('error:', error)
      console.log('error.message:', error instanceof Error ? error.message : 'Unknown error')
      console.log('error.toJSON():', error instanceof ContractError ? error.toJSON() : 'Unknown error')

       // Re-throw ContractError as-is
       if (error instanceof ContractError) {
        console.error(`[callMethod] ========== END ${methodName} CONTRACT ERROR ==========`)
        throw error;
      }

      // Handle contract not found error
      if (error instanceof Error && error.message.includes('not found')) {
        console.error(`[callMethod] ========== END ${methodName} CONTRACT NOT FOUND ==========`)
        throw new Error(`Contract ${contractAddress} not found on chain. Please verify the contract address.`);
      }

      // Log and wrap other errors
      console.error(`[callMethod] ========== END ${methodName} ERROR ==========`)
      console.error(`[callMethod] Error:`, error)
      throw new Error(`Failed to call method ${methodName} on contract ${contractAddress}: ${error}`)
    }
  }

  async destroy() {
    if (this.client) {
      this.client.destroy()
      console.log("CalendarService client destroyed")
    }
  }
}


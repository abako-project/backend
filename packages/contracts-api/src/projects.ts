import { contracts, kreivo } from "@polkadot-api/descriptors"
import { createInkV5Sdk } from "@polkadot-api/sdk-ink"
import { createClient, Binary } from "polkadot-api"
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat"
import { getWsProvider } from "polkadot-api/ws-provider/node"
import { ADDRESS } from "./util/address"
import contractMetadata from '../.papi/contracts/projects_v5.json'
import { adminPolkadotSigner, adminPublicAddress } from "./util/signer"
import { ss58Encode } from '@polkadot-labs/hdkd-helpers'
import { ContractError } from "./util/contractError"
import { errorExtractor, decodeErrorMessage } from "./util/errorExtractor"

export class ProjectsService {
  private client: any
  private typedApi: any
  private projectsSdk: any
  private contracts: Map<string, any> = new Map()
  private availableMethods: string[]
  private contractErrors: Map<number, string>

  constructor() {
    this.availableMethods = contractMetadata.spec.messages.map((message: any) => message.label)
    this.contractErrors = errorExtractor(contractMetadata)
    console.log("Available methods", this.availableMethods)
    console.log("Loaded contract errors:", Array.from(this.contractErrors.entries()))
  }

  async initialize() {
    this.client = createClient(
      withPolkadotSdkCompat(getWsProvider(process.env.KREIVO_PROVIDER || "ws://localhost:21000")),
    )
    this.typedApi = this.client.getTypedApi(kreivo)
    this.projectsSdk = createInkV5Sdk(this.typedApi, contracts.projects_v5)

    console.log("ProjectsService initialized")

    return this
  }

  private getContract(contractAddress: string) {
    if (!this.contracts.has(contractAddress)) {
      try {
        const contract = this.projectsSdk.getContract(contractAddress)
        this.contracts.set(contractAddress, contract)
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new Error(`Contract ${contractAddress} not found on chain. Please verify the contract address.`);
        }
        // Re-throw other errors
        throw error;
      }
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

  private convertNumbersToBigInt(data: any, methodName: string): any {
    console.log(`[convertNumbersToBigInt] Method: ${methodName}`)
    console.log(`[convertNumbersToBigInt] Input data:`, data)

    // For propose_scope, we need to convert the task costs (u128) to BigInt and dependencies to Binary
    if (methodName === 'propose_scope' && data.tasks) {
      const convertedData = {
        ...data,
        tasks: data.tasks.map((task: any, index: number) => {
          // task is [id, complexity, cost, dependencies]
          if (Array.isArray(task) && task.length >= 4) {
            const [id, complexity, cost, dependencies] = task

            // Keep complexity as-is (should be { type: 'Days', value: 5 } format)
            console.log(`[convertNumbersToBigInt] Task ${index}: complexity =`, complexity)

            // Convert cost to BigInt
            const costType = typeof cost
            const convertedCost = typeof cost === 'number' || typeof cost === 'string' ? BigInt(cost) : cost
            console.log(`[convertNumbersToBigInt] Task ${index}: cost=${cost} (${costType}) -> ${convertedCost}n`)

            // Convert dependencies to Binary
            let convertedDependencies
            if (Array.isArray(dependencies)) {
              // Convert array of numbers to Uint8Array
              convertedDependencies = Binary.fromBytes(new Uint8Array(dependencies))
              console.log(`[convertNumbersToBigInt] Task ${index}: dependencies array converted to Binary`)
            } else if (dependencies instanceof Uint8Array) {
              convertedDependencies = Binary.fromBytes(dependencies)
              console.log(`[convertNumbersToBigInt] Task ${index}: dependencies Uint8Array converted to Binary`)
            } else {
              // Assume it's already Binary or similar
              convertedDependencies = dependencies
              console.log(`[convertNumbersToBigInt] Task ${index}: dependencies kept as-is`)
            }

            console.log(`[convertNumbersToBigInt] Task ${index}: convertedCost =`, convertedCost)

            return [
              id,
              complexity,
              convertedCost,
              convertedDependencies
            ]
          }
          return task
        })
      }

      // Convert document_hash from hex string to Binary
      if (data.document_hash && typeof data.document_hash === 'string') {
        console.log(`[convertNumbersToBigInt] Converting document_hash from string to Binary`)
        console.log(`[convertNumbersToBigInt] Original hash: ${data.document_hash}`)

        // Use Binary.fromHex to convert the hex string to Binary type
        const hexString = data.document_hash.startsWith('0x')
          ? data.document_hash
          : `0x${data.document_hash}`

        convertedData.document_hash = Binary.fromHex(hexString)

        console.log(`[convertNumbersToBigInt] Converted hash to Binary: ${hexString}`)
      }

      console.log(`[convertNumbersToBigInt] Output data:`, convertedData)

      return convertedData
    }

    // For approve_scope, convert approved_task_ids array to Binary
    if (methodName === 'approve_scope' && data.approved_task_ids) {
      const convertedData = { ...data }

      if (Array.isArray(data.approved_task_ids)) {
        console.log(`[convertNumbersToBigInt] Converting approved_task_ids array to Binary`)
        convertedData.approved_task_ids = Binary.fromBytes(new Uint8Array(data.approved_task_ids))
        console.log(`[convertNumbersToBigInt] Converted approved_task_ids:`, convertedData.approved_task_ids)
      } else if (data.approved_task_ids instanceof Uint8Array) {
        console.log(`[convertNumbersToBigInt] Converting approved_task_ids Uint8Array to Binary`)
        convertedData.approved_task_ids = Binary.fromBytes(data.approved_task_ids)
      } else {
        console.log(`[convertNumbersToBigInt] approved_task_ids kept as-is`)
      }

      return convertedData
    }

    console.log(`[convertNumbersToBigInt] No conversion needed, returning original data`)
    return data
  }

  async queryMethod(contractAddress: string, methodName: string, data: any = {}) {
    if (!this.validateMethod(methodName)) {
      throw new Error(`Method "${methodName}" not found in contract. Available methods: ${this.availableMethods.join(", ")}`)
    }

    console.log(`Querying method: ${methodName} on contract: ${contractAddress}`)
    console.log(data)

    try {
      const contract = this.getContract(contractAddress)
      const response = await contract.query(methodName as any, {
        origin: adminPublicAddress,
        data: data,
        gas_limit: {
          ref_time: 200000000000n,
          proof_size: 10000000n
        },
        storage_deposit_limit: null,
      })

      console.log("before response hdp", response)

      // Handle successful response
      if (response.success) {
        const serializedResponse = response.value.response ? this.serializeBigInt(response.value.response) : null;

        console.log('serializedResponse:', serializedResponse);
        return {
          success: true,
          method: methodName,
          contractAddress: contractAddress,
          response: serializedResponse ?? null,
        };
      }

      console.log('response:', response);

      // Handle error response - throw exception to propagate as HTTP error
      console.log('errorResponse type:', response.value?.type);
      console.log('errorResponse message:', response.value?.value?.message);
      console.log('errorResponse is FlagReverted:', response.value?.type === 'FlagReverted');

      // Handle Module error (usually means contract not found or other blockchain-level error)
      if (response.value?.type === 'Module') {
        throw new Error(`Contract ${contractAddress} not found on chain. Please verify the contract address.`);
      }

      // Decode error if it's a FlagReverted
      let errorMessage = 'Query failed';
      let errorCode: string | null = null;
      let gasRequired: { ref_time: string; proof_size: string } | undefined;
      let storageDeposit: string | undefined;

      if (response.value?.type === 'FlagReverted' && response.value.value?.message) {
        const decodedError = decodeErrorMessage(response.value.value.message, this.contractErrors);
        errorMessage = decodedError;
        errorCode = response.value.value.message;
      }

      throw new ContractError(
        methodName,
        contractAddress,
        errorMessage,
        errorCode,
      );
    } catch (error) {
      console.log('error:', error)
      console.log('error.message:', error instanceof Error ? error.message : 'Unknown error')
      console.log('error.toJSON():', error instanceof ContractError ? error.toJSON() : 'Unknown error')

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

    // Methods that only return encodedData to be signed by the user
    const encodedDataMethods = [
      'assign_team',
      'set_calendar_contract',
      'propose_scope',
      'submit_task_for_review',
      'approve_scope',
      'complete_task',
      'mark_completed',
      'submit_coordinator_ratings',
      'submit_developer_rating',
    ]

    try {
      const contract = this.getContract(contractAddress)

      const { caller, ...rest } = data;

      console.log(`[callMethod] ========== START ${methodName} ==========`)
      console.log(`[callMethod] Caller:`, caller)
      console.log(`[callMethod] Rest data:`, rest)

      console.log(`[callMethod] encodedDataMethods list:`, encodedDataMethods)
      console.log(`[callMethod] Is ${methodName} in list?`, encodedDataMethods.includes(methodName))

      if (encodedDataMethods.includes(methodName)) {
        console.log(`[callMethod] Method ${methodName} is in encodedDataMethods list`)

        // Convert numbers to BigInt for methods that need it
        let contractData = rest.data || rest
        console.log(`[callMethod] Initial contract data:`, contractData)

        if (methodName === 'propose_scope' || methodName === 'approve_scope') {
          console.log(`[callMethod] Starting data conversion for ${methodName}`)
          contractData = this.convertNumbersToBigInt(contractData, methodName)
          console.log(`[callMethod] Final contract data after conversion:`, contractData)
        }

        const txResponse = await contract.query(methodName as any, {
          origin: caller || adminPublicAddress,
          data: contractData,
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

        console.log(`[callMethod] Preparing to send transaction to contract`)
        const tx = await contract.send(methodName as any, {
          origin: caller || adminPublicAddress,
          data: contractData,
          gas_limit: {
            ref_time: 10000000000n,
            proof_size: 1000000n
          },
          storage_deposit_limit: 100000000000n,
        })

        console.log(`[callMethod] Transaction prepared successfully`)

        const callData = await tx.decodedCall
        const callDataHex = callData.value.value.data.asHex()

        console.log(`[callMethod] Decoded call data (hex):`, callDataHex)
        console.log(`[callMethod] Gas limit:`, callData.value.value.gas_limit)

        console.log(`[callMethod] Creating encoded transaction for Contracts.call`)
        const encodedDataTx = this.typedApi.tx.Contracts.call({
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

        const encodedData = await encodedDataTx.getEncodedData()
        console.log(`[callMethod] Final encoded data (hex):`, encodedData.asHex())
        console.log(`[callMethod] ========== END ${methodName} SUCCESS ==========`)

        return {
          method: methodName,
          encodedData: encodedData.asHex(),
        }
      }

      // assign_coordinator executes and returns the coordinator AccountId
      if (methodName === 'assign_coordinator') {
        console.log(`[callMethod] Executing assign_coordinator`)

        const txResponse = await contract.query(methodName as any, {
          origin: caller || adminPublicAddress,
          data: {},
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

        try {
          const tx = await contract.send(methodName as any, {
            origin: caller || adminPublicAddress,
            data: {},
            gas_limit: {
              ref_time: 10000000000n,
              proof_size: 1000000n
            },
            storage_deposit_limit: 100000000000n,
          })

          console.log(`[callMethod] Transaction prepared for assign_coordinator`)

          const result = await tx.signAndSubmit(adminPolkadotSigner);
          console.log('assign_coordinator result:', result);

          // Find the ContractEmitted event to extract coordinator
          const contractEmittedEvent = result.events.find((event: any) =>
            event.type === 'Contracts' && event.value?.type === 'ContractEmitted'
          );

          console.log('ContractEmitted event:', contractEmittedEvent);

          // The coordinator AccountId is in the event topics
          let coordinator = null;

          if (contractEmittedEvent) {
            console.log('Event data:', contractEmittedEvent.value);

            // Try to get data as hex and decode it
            const eventData = contractEmittedEvent.value?.value?.data;
            if (eventData && typeof eventData.asHex === 'function') {
              const dataHex = eventData.asHex();
              console.log('Event data hex:', dataHex);
            }

            // Topics contain indexed event data
            // topics[0] = event signature (CoordinatorAssigned event hash)
            // topics[1] = project name (indexed String)
            // topics[2] = coordinator AccountId (indexed AccountId)
            const topics = contractEmittedEvent.topics;
            if (topics && topics.length >= 3) {
              console.log('Event topics count:', topics.length);

              // Extract coordinator from Topic 2
              const coordinatorTopic = topics[2];
              if (coordinatorTopic && typeof coordinatorTopic.asHex === 'function') {
                const coordinatorHex = coordinatorTopic.asHex();
                console.log('Coordinator topic hex:', coordinatorHex);

                // Remove 0x prefix and convert to Uint8Array
                const hexWithout0x = coordinatorHex.startsWith('0x') ? coordinatorHex.slice(2) : coordinatorHex;
                const coordinatorBytes = new Uint8Array(
                  hexWithout0x.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []
                );

                // Encode to SS58 address with prefix 42 (Substrate standard)
                // virto-api stores addresses with prefix 42, so we convert from prefix 2 to 42
                coordinator = ss58Encode(coordinatorBytes, 42);
                console.log('Coordinator SS58 address (prefix 42):', coordinator);
              }

              // Log all topics for debugging
              topics.forEach((topic: any, index: number) => {
                if (typeof topic.asHex === 'function') {
                  console.log(`Topic ${index}:`, topic.asHex());
                }
              });
            }
          }

          return {
            method: methodName,
            success: result.ok,
            coordinator: coordinator,
            transactionHash: result.txHash,
            blockHash: result.blockHash,
            blockNumber: result.blockNumber,
          }
        } catch (error) {
          console.error(`[callMethod] Error in assign_coordinator:`, error);
          // Re-throw the error to propagate it
          throw error;
        }
      }



      // Normal flow for other methods
      const tx = await contract.send(methodName as any, {
        origin: adminPublicAddress,
        data: data,
      })

      console.log(`Signing and submitting method: ${methodName}`)

      const result = await tx.signAndSubmit(adminPolkadotSigner);

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
      console.log("ProjectsService client destroyed")
    }
  }
}

/**
 * Extracts error definitions from contract metadata
 * @param metadata Contract metadata JSON
 * @returns Map of error index to error name
 */
export function errorExtractor(metadata: any): Map<number, string> {
  const errors = new Map<number, string>();
  
  try {
    // Find the Error type in the metadata types
    const errorType = metadata.types?.find((type: any) => {
      const path = type.type?.path;
      return Array.isArray(path) &&
        path.length >= 2 &&
        path[path.length - 1] === 'Error';
    });

    if (!errorType) {
      console.warn('Error type not found in contract metadata');
      return errors;
    }

    const variants = errorType.type?.def?.variant?.variants;
    if (!Array.isArray(variants)) {
      console.warn('Error variants not found in contract metadata');
      return errors;
    }

    // Map each variant to its index
    variants.forEach((variant: any) => {
      const index = variant.index;
      const name = variant.name;
      
      if (typeof index === 'number' && typeof name === 'string') {
        // For Detailed error with fields, provide more context
        if (name === 'Detailed' && Array.isArray(variant.fields)) {
          errors.set(index, `${name}: Check error details for more information`);
        } else {
          errors.set(index, name);
        }
      }
    });

    console.log(`Loaded ${errors.size} error definitions from contract metadata`);
  } catch (error) {
    console.error('Failed to extract errors from metadata:', error);
  }

  return errors;
}

/**
 * Decodes a contract error code into a human-readable message
 * @param errorCode Hexadecimal error code (e.g., '0x000107')
 * @param errorMap Map of error indices to error names
 * @returns Decoded error message
 */
export function decodeErrorMessage(errorCode: string, errorMap: Map<number, string>): string {
  try {
    // Remove '0x' prefix if present
    const hexString = errorCode.startsWith('0x') ? errorCode.slice(2) : errorCode;
    
    // The error format is typically: [Result flag][Error type flag][Error index]
    // For '0x000107': 00 = Result::Err, 01 = Error variant, 07 = error index (7 in decimal)
    
    // Get the last byte which represents the error index
    const errorIndex = parseInt(hexString.slice(-2), 16);
    
    const errorName = errorMap.get(errorIndex);
    
    if (errorName) {
      return errorName;
    }
    
    return `Unknown error (code: ${errorCode}, index: ${errorIndex})`;
  } catch (error) {
    return `Failed to decode error (code: ${errorCode})`;
  }
}

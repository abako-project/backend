export const getStatusCodeFromContractError = (errorMessage: string): number => {
    if (errorMessage.includes('NotAuthorized')) {
      return 403;
    }
  
    if (
      errorMessage.includes('NotFound') ||
      errorMessage.includes('TaskNotFound') ||
      errorMessage.includes('TeamMemberNotFound')
    ) {
      return 404;
    }
  
    if (
      errorMessage.includes('AlreadyExists') ||
      errorMessage.includes('AlreadyCompleted') ||
      errorMessage.includes('AlreadyDefined') ||
      errorMessage.includes('AlreadyDecided') ||
      errorMessage.includes('DuplicateTaskId') ||
      errorMessage.includes('TaskIdAlreadyExists')
    ) {
      return 409;
    }
  
    if (
      errorMessage.includes('CircularDependency') ||
      errorMessage.includes('DependenciesNotCompleted') ||
      errorMessage.includes('DependenciesNotApproved') ||
      errorMessage.includes('TasksNotCompleted')
    ) {
      return 422;
    }
  
    if (
      errorMessage.includes('NotSet') ||
      errorMessage.includes('NotDefined') ||
      errorMessage.includes('NotAssigned')
    ) {
      return 412;
    }
  
    if (
      errorMessage.includes('Invalid') ||
      errorMessage.includes('TooLong') ||
      errorMessage.includes('TooMany') ||
      errorMessage.includes('Mismatch') ||
      errorMessage.includes('NoPending') ||
      errorMessage.includes('NoAvailable')
    ) {
      return 400;
    }
  
    if (
      errorMessage.includes('ArithmeticFailure') ||
      errorMessage.includes('ConversionType')
    ) {
      return 422;
    }
  
    // Default to 400 Bad Request for unknown contract errors
    return 400;
  }
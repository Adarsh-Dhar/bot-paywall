// Centralized error message system for dummy transactions
// Ensures consistency with real blockchain integration error patterns

export interface ErrorMessagePattern {
  code: string;
  message: string;
  details?: string;
}

/**
 * Standard error messages that match real blockchain integration patterns
 */
export const DummyErrorMessages = {
  // Transaction not found errors
  TRANSACTION_NOT_FOUND: {
    code: 'TRANSACTION_NOT_FOUND',
    message: 'Transaction not found',
    details: 'The specified transaction hash does not exist in the blockchain'
  },

  // Transaction failure errors
  TRANSACTION_FAILED: {
    code: 'TRANSACTION_FAILED',
    message: 'Transaction failed on-chain',
    details: 'The transaction was included in a block but failed during execution'
  },

  // Payment validation errors
  INSUFFICIENT_PAYMENT: {
    code: 'INSUFFICIENT_PAYMENT',
    message: 'Insufficient payment amount',
    details: 'The payment amount is below the required threshold'
  },

  WRONG_RECIPIENT: {
    code: 'WRONG_RECIPIENT',
    message: 'Payment sent to wrong wallet',
    details: 'The payment recipient does not match the expected wallet address'
  },

  // Format validation errors
  INVALID_TRANSACTION_FORMAT: {
    code: 'INVALID_TRANSACTION_FORMAT',
    message: 'Invalid transaction format',
    details: 'The transaction does not conform to the expected blockchain format'
  },

  INVALID_COIN_TRANSFER: {
    code: 'INVALID_COIN_TRANSFER',
    message: 'Not a valid coin transfer transaction',
    details: 'The transaction is not a recognized coin transfer operation'
  },

  // Network and RPC errors (simulated)
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    message: 'Network connection failed',
    details: 'Unable to connect to the blockchain network'
  },

  RPC_TIMEOUT: {
    code: 'RPC_TIMEOUT',
    message: 'RPC request timed out',
    details: 'The blockchain RPC request exceeded the timeout limit'
  },

  // Configuration errors
  INVALID_CONFIGURATION: {
    code: 'INVALID_CONFIGURATION',
    message: 'Invalid configuration',
    details: 'The dummy transaction configuration contains invalid values'
  },

  // Generic errors
  VERIFICATION_FAILED: {
    code: 'VERIFICATION_FAILED',
    message: 'Payment verification failed',
    details: 'An unexpected error occurred during payment verification'
  }
} as const;

/**
 * Format error messages consistently across the system
 */
export class DummyErrorFormatter {
  /**
   * Format an insufficient payment error with specific amounts
   */
  static formatInsufficientPayment(
    sentAmount: string | bigint,
    requiredAmount: string | bigint,
    currency: 'wei' | 'octas' = 'wei'
  ): string {
    const currencyName = currency === 'wei' ? '' : ' octas';
    return `${DummyErrorMessages.INSUFFICIENT_PAYMENT.message}. Sent ${sentAmount}${currencyName}, needed ${requiredAmount}${currencyName}`;
  }

  /**
   * Format a transaction format validation error
   */
  static formatTransactionFormatError(details: string): string {
    return `Transaction format validation error: ${details}`;
  }

  /**
   * Format a network simulation error
   */
  static formatNetworkError(operation: string): string {
    return `${DummyErrorMessages.NETWORK_ERROR.message} during ${operation}`;
  }

  /**
   * Format a configuration validation error
   */
  static formatConfigurationError(field: string, value: any): string {
    return `${DummyErrorMessages.INVALID_CONFIGURATION.message}: Invalid ${field} value '${value}'`;
  }

  /**
   * Get a standardized error message by code
   */
  static getErrorMessage(code: keyof typeof DummyErrorMessages): ErrorMessagePattern {
    return DummyErrorMessages[code];
  }

  /**
   * Create a blockchain-style error response
   */
  static createBlockchainError(
    code: keyof typeof DummyErrorMessages,
    customDetails?: string
  ): { error: ErrorMessagePattern } {
    const baseError = DummyErrorMessages[code];
    return {
      error: {
        ...baseError,
        details: customDetails || baseError.details
      }
    };
  }
}

/**
 * Validate error message format consistency
 */
export class ErrorMessageValidator {
  /**
   * Check if an error message follows the expected pattern
   */
  static isValidErrorFormat(message: string): boolean {
    // Error messages should be descriptive but concise
    if (message.length < 10 || message.length > 200) {
      return false;
    }

    // Should not contain placeholder text
    if (message.includes('TODO') || message.includes('FIXME')) {
      return false;
    }

    // Should start with a capital letter and not end with a period (for consistency)
    if (!/^[A-Z]/.test(message) || message.endsWith('.')) {
      return false;
    }

    return true;
  }

  /**
   * Validate that error messages are consistent across blockchain formats
   */
  static validateCrossFormatConsistency(
    movementError: string,
    aptosError: string,
    expectedPattern: RegExp
  ): boolean {
    return expectedPattern.test(movementError) && expectedPattern.test(aptosError);
  }

  /**
   * Check if error message contains required information
   */
  static containsRequiredInfo(
    message: string,
    requiredElements: string[]
  ): boolean {
    return requiredElements.every(element => 
      message.toLowerCase().includes(element.toLowerCase())
    );
  }
}
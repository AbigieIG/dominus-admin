// Enhanced Banking Data Generator with Uniqueness Guarantees
class UniqueBankingGenerator {
  private generatedRoutingNumbers = new Set<string>();
  private generatedAccountNumbers = new Set<string>();
  private generatedSwiftBics = new Set<string>();
  private generatedIbans = new Set<string>();
  private generatedPins = new Set<string>();
  private generatedSortCodes = new Set<string>();

  // US Routing Number with guaranteed uniqueness
  generateUniqueRoutingNumber(): string {
    let routingNumber: string;
    let attempts = 0;
    const maxAttempts = 1000;

    do {
      routingNumber = this.generateRoutingNumber();
      attempts++;
      
      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique routing number after maximum attempts');
      }
    } while (this.generatedRoutingNumbers.has(routingNumber));

    this.generatedRoutingNumbers.add(routingNumber);
    return routingNumber;
  }

  private generateRoutingNumber(): string {
    const federalReserveDistricts = [
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'
    ];
    
    const district = federalReserveDistricts[Math.floor(Math.random() * federalReserveDistricts.length)];
    const institutionId = Math.floor(100000 + Math.random() * 900000).toString();
    const first8 = district + institutionId;
    const checkDigit = this.calculateABACheckDigit(first8);
    
    return first8 + checkDigit;
  }

  // Enhanced SWIFT/BIC with much larger pool
  generateUniqueSwiftBic(): string {
    let swiftBic: string;
    let attempts = 0;
    const maxAttempts = 1000;

    do {
      swiftBic = this.generateSwiftBic();
      attempts++;
      
      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique SWIFT/BIC after maximum attempts');
      }
    } while (this.generatedSwiftBics.has(swiftBic));

    this.generatedSwiftBics.add(swiftBic);
    return swiftBic;
  }

  private generateSwiftBic(): string {
    // Expanded bank codes for more uniqueness
    const bankCodes = [
      'UNTB',
      'CHAS', 'BOFA', 'WFBI', 'CITI', 'HSBC', 'USBK', 'PNCC', 'TRVS', 'SNTR', 'IRVT',
      'AMEX', 'DISC', 'CAPT', 'ALLY', 'SCHW', 'ETRD', 'TDBN', 'BNYM', 'STST', 'REGN',
      'FIFTH', 'HUNT', 'COME', 'ZION', 'SYNO', 'ASSOC', 'FIRST', 'UNION', 'METRO', 'COMM'
    ];
    
    const baseCode = bankCodes[Math.floor(Math.random() * bankCodes.length)];
    const countryCode = 'US';
    
    // More location codes for variety
    const locationCodes = [
      '33', '3N', '6S', '44', '3A', 'NY', 'SF', 'CH', 'LA', 'MI', 'TX', 'FL',
      'WA', 'OR', 'NV', 'AZ', 'CO', 'GA', 'NC', 'VA', 'PA', 'OH', 'IL', 'MN', 'MI',
      'CT', 'MA', 'NJ', 'NY', 'RI', 'SC', 'TN', 'VA', 'WV', 'DC', 'MD', 'DE',
      'CA', 'WA', 'OR', 'NV', 'AZ', 'CO', 'GA', 'NC', 'VA', 'PA', 'OH', 'IL',
      'MN', 'MI', 'CT', 'MA', 'NJ', 'NY', 'RI', 'SC', 'TN', 'VA', 'WV', 'DC',
      'MD', 'DE', 'CA', 'WA', 'OR', 'NV', 'AZ', 'CO', 'GA', 'NC', 'VA', 'PA',
      
    ];
    const locationCode = locationCodes[Math.floor(Math.random() * locationCodes.length)];
    
    // Optional branch code with more variety
    let branchCode = '';
    if (Math.random() > 0.3) {
      const branches = ['XXX', '001', '002', '003', 'NYC', 'LAX', 'CHI', 'MIA'];
      branchCode = branches[Math.floor(Math.random() * branches.length)];
    }
    
    return `${baseCode}${countryCode}${locationCode}${branchCode}`;
  }

  // Unique Account Number Generator with prefix support
  generateUniqueAccountNumber(options?: {
    prefix?: string;
    length?: number;
    separator?: string;
  }): string {
    let accountNumber: string;
    let attempts = 0;
    const maxAttempts = 1000;

    do {
      accountNumber = this.generateAccountNumber(options);
      attempts++;
      
      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique account number after maximum attempts');
      }
    } while (this.generatedAccountNumbers.has(accountNumber));

    this.generatedAccountNumbers.add(accountNumber);
    return accountNumber;
  }

  private generateAccountNumber(options?: {
    prefix?: string;
    length?: number;
    separator?: string;
  }): string {
    // If no prefix specified, use realistic bank account patterns
    if (!options?.prefix) {
      return this.generateRealisticAccountNumber();
    }

    const config = {
      prefix: '475',
      length: 10,
      separator: '',
      ...options
    };

    // Calculate remaining length after prefix and separator
    const prefixLength = config.prefix.length;
    const separatorLength = config.separator.length;
    const remainingLength = config.length - prefixLength - separatorLength;
    
    if (remainingLength <= 0) {
      throw new Error('Invalid account number configuration: prefix + separator exceeds total length');
    }

    const firstDigit = Math.floor(1 + Math.random() * 9).toString();
    const remainingDigits = Array.from({ length: remainingLength - 1 }, () => 
      Math.floor(Math.random() * 10).toString()
    ).join('');

    return `${config.prefix}${config.separator}${firstDigit}${remainingDigits}`;
  }

  private generateRealisticAccountNumber(): string {
    // Real bank account patterns used by major banks
    const patterns = [
      // Chase Bank (10-12 digits)
      () => Math.floor(1000000000 + Math.random() * 9000000000).toString(),
      
      // Bank of America (12 digits, often starts with 0)
      () => '0' + Math.floor(10000000000 + Math.random() * 90000000000).toString(),
      
      // Wells Fargo (10 digits)
      () => Math.floor(1000000000 + Math.random() * 9000000000).toString(),
      
      // Citibank (8 digits)
      () => Math.floor(10000000 + Math.random() * 90000000).toString(),
      
      // US Bank (10-12 digits)
      () => Math.floor(1000000000 + Math.random() * 900000000000).toString(),
      
      // PNC Bank (10 digits)
      () => Math.floor(1000000000 + Math.random() * 9000000000).toString(),
      
      // TD Bank (7-10 digits)
      () => Math.floor(1000000 + Math.random() * 9000000000).toString(),
      
      // Capital One (10-14 digits)
      () => Math.floor(1000000000 + Math.random() * 90000000000000).toString(),
      
      // American Express Bank (15 digits, starts with 8)
      () => '8' + Math.floor(10000000000000 + Math.random() * 90000000000000).toString(),
      
      // Discover Bank (11 digits, starts with 6)
      () => '6' + Math.floor(1000000000 + Math.random() * 9000000000).toString()
    ];

    const selectedPattern = patterns[Math.floor(Math.random() * patterns.length)];
    return selectedPattern();
  }

  // Unique IBAN Generator
  generateUniqueIBAN(swiftBic?: string, accountNumber?: string, country?: string): string {
    let iban: string;
    let attempts = 0;
    const maxAttempts = 1000;

    do {
      // If not provided, generate new ones
      const bic = swiftBic || this.generateSwiftBic();
      const account = accountNumber || this.generateAccountNumber();
      const countryCode = country || 'GB';
      
      iban = this.generateIBAN(bic, account, countryCode);
      attempts++;
      
      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique IBAN after maximum attempts');
      }
    } while (this.generatedIbans.has(iban));

    this.generatedIbans.add(iban);
    return iban;
  }

  private generateIBAN(swiftBic: string, accountNumber: string, country?: string): string {
    const countryCode = country || 'GB';
    const bankIdentifier = swiftBic.substring(0, 4);
    const paddedAccount = accountNumber.padStart(10, '0').substring(0, 10);
    const bban = bankIdentifier + paddedAccount;
    const checkDigits = this.calculateIBANCheckDigits(countryCode + '00' + bban);
    
    return `${countryCode}${checkDigits}${bban}`;
  }

  // Unique PIN Generator (4 digits)
  generateUniquePin(): string {
    let pin: string;
    let attempts = 0;
    const maxAttempts = 10000; // Higher limit since there are only 10,000 possible PINs

    do {
      pin = this.generatePin();
      attempts++;
      
      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique PIN after maximum attempts - all PINs may be exhausted');
      }
    } while (this.generatedPins.has(pin));

    this.generatedPins.add(pin);
    return pin;
  }

  private generatePin(): string {
    // Generate 4-digit PIN, avoiding common weak patterns
    const weakPatterns = [
      '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
      '1234', '4321', '0123', '3210', '1122', '2233', '3344', '4455', '5566', '6677', '7788', '8899',
      
    ];

    let pin: string;
    let attempts = 0;

    do {
      pin = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      attempts++;
    } while (weakPatterns.includes(pin) && attempts < 50);

    return pin;
  }

  // Unique Sort Code Generator (UK-style 6 digits in XX-XX-XX format)
  generateUniqueSortCode(): string {
    let sortCode: string;
    let attempts = 0;
    const maxAttempts = 1000;

    do {
      sortCode = this.generateSortCode();
      attempts++;
      
      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique sort code after maximum attempts');
      }
    } while (this.generatedSortCodes.has(sortCode));

    this.generatedSortCodes.add(sortCode);
    return sortCode;
  }

  private generateSortCode(): string {
    // Real UK bank sort code ranges for major banks
    const bankRanges = [
      // Major UK banks first two digits
      { prefix: '20', name: 'Barclays' },
      { prefix: '40', name: 'HSBC' },
      { prefix: '30', name: 'Lloyds' },
      { prefix: '60', name: 'NatWest' },
      { prefix: '80', name: 'Bank of Scotland' },
      { prefix: '83', name: 'Bank of Scotland' },
      { prefix: '16', name: 'Starling Bank' },
      { prefix: '04', name: 'Monzo' },
      { prefix: '23', name: 'Metro Bank' },
      { prefix: '77', name: 'Revolut' },
      { prefix: '09', name: 'Santander' },
      { prefix: '72', name: 'Nationwide' },
      { prefix: '11', name: 'Halifax' },
      { prefix: '55', name: 'TSB' },
      { prefix: '65', name: 'Royal Bank of Scotland' }
    ];

    const selectedBank = bankRanges[Math.floor(Math.random() * bankRanges.length)];
    
    // Generate remaining 4 digits
    const middle = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const last = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    
    return `${selectedBank.prefix}-${middle}-${last}`;
  }

  // Generate complete unique banking record with PIN and Sort Code
  generateUniqueBankingRecord(options?: {
    accountPrefix?: string;
    accountLength?: number;
    accountSeparator?: string;
  }): {
    routingNumber: string;
    accountNumber: string;
    swiftBic: string;
    iban: string;
    pin: string;
    sortCode: string;
  } {
    const routingNumber = this.generateUniqueRoutingNumber();
    const accountNumber = this.generateUniqueAccountNumber({
      prefix: options?.accountPrefix || '475',
      length: options?.accountLength || 10,
      separator: options?.accountSeparator || ''
    });
    const swiftBic = this.generateUniqueSwiftBic();
    const iban = this.generateUniqueIBAN(swiftBic, accountNumber);
    const pin = this.generateUniquePin();
    const sortCode = this.generateUniqueSortCode();

    return {
      routingNumber,
      accountNumber,
      swiftBic,
      iban,
      pin,
      sortCode
    };
  }

  // Helper methods (keeping your existing logic)
  private calculateABACheckDigit(first8Digits: string): string {
    const weights = [3, 7, 1, 3, 7, 1, 3, 7];
    let sum = 0;
    
    for (let i = 0; i < 8; i++) {
      sum += parseInt(first8Digits[i]) * weights[i];
    }
    
    const remainder = sum % 10;
    return remainder === 0 ? '0' : (10 - remainder).toString();
  }

  private calculateIBANCheckDigits(iban: string): string {
    const rearranged = iban.substring(4) + iban.substring(0, 4);
    const numericString = rearranged.replace(/[A-Z]/g, (char) => 
      (char.charCodeAt(0) - 55).toString()
    );
    
    const remainder = this.mod97(numericString);
    const checkDigits = 98 - remainder;
    
    return checkDigits.toString().padStart(2, '0');
  }

  private mod97(numStr: string): number {
    let remainder = 0;
    for (let i = 0; i < numStr.length; i++) {
      remainder = (remainder * 10 + parseInt(numStr[i])) % 97;
    }
    return remainder;
  }

  // Statistics and management
  getGeneratedCounts(): {
    routingNumbers: number;
    accountNumbers: number;
    swiftBics: number;
    ibans: number;
    pins: number;
    sortCodes: number;
  } {
    return {
      routingNumbers: this.generatedRoutingNumbers.size,
      accountNumbers: this.generatedAccountNumbers.size,
      swiftBics: this.generatedSwiftBics.size,
      ibans: this.generatedIbans.size,
      pins: this.generatedPins.size,
      sortCodes: this.generatedSortCodes.size
    };
  }

  // Reset all generated records
  reset(): void {
    this.generatedRoutingNumbers.clear();
    this.generatedAccountNumbers.clear();
    this.generatedSwiftBics.clear();
    this.generatedIbans.clear();
    this.generatedPins.clear();
    this.generatedSortCodes.clear();
  }

  // Check if value was already generated
  isAlreadyGenerated(type: 'routing' | 'account' | 'swift' | 'iban' | 'pin' | 'sortcode', value: string): boolean {
    switch (type) {
      case 'routing': return this.generatedRoutingNumbers.has(value);
      case 'account': return this.generatedAccountNumbers.has(value);
      case 'swift': return this.generatedSwiftBics.has(value);
      case 'iban': return this.generatedIbans.has(value);
      case 'pin': return this.generatedPins.has(value);
      case 'sortcode': return this.generatedSortCodes.has(value);
      default: return false;
    }
  }

  // Get available PIN count (useful for monitoring exhaustion)
  getAvailablePinCount(): number {
    return 10000 - this.generatedPins.size;
  }
}

// Usage example
const bankingGenerator = new UniqueBankingGenerator();

// Generate realistic banking records (no fake prefixes)
const records = [];

for (let i = 0; i < 10; i++) {
  records.push(bankingGenerator.generateUniqueBankingRecord());
}

// console.log('Generated realistic banking records:');
// records.forEach((record, index) => {
//   console.log(`Record ${index + 1}:`, record);
// });

// If you want custom prefixes for testing, you can still use:
const customRecord = bankingGenerator.generateUniqueBankingRecord({
  accountPrefix: '475',  // Like a real bank internal code
  accountLength: 10,
  accountSeparator: ''
});



// Export for use
export { UniqueBankingGenerator };

// Also export standalone functions with uniqueness (maintains your original API)
const globalGenerator = new UniqueBankingGenerator();

export function generateUniqueRoutingNumber(): string {
  return globalGenerator.generateUniqueRoutingNumber();
}

export function generateUniqueAccountNumber(options?: {
  prefix?: string;
  length?: number;
  separator?: string;
}): string {
  return globalGenerator.generateUniqueAccountNumber(options);
}

export function generateUniqueSwiftBic(): string {
  return globalGenerator.generateUniqueSwiftBic();
}

export function generateUniqueIBAN(swiftBic?: string, accountNumber?: string, country?: string): string {
  return globalGenerator.generateUniqueIBAN(swiftBic, accountNumber, country);
}

export function generateUniquePin(): string {
  return globalGenerator.generateUniquePin();
}

export function generateUniqueSortCode(): string {
  return globalGenerator.generateUniqueSortCode();
}





export type CardBrand = "debit" | "credit" | "Amex";

export class CardGenerator {
  static generateCard(brand: CardBrand) {
    let bin = "";
    let length = 16;
    let cvvLength = 3;
     // Visa Card
    if (brand === "debit") {
      bin = "4";
    } else if (brand === "credit") {
      const prefixes = ["51", "52", "53", "54", "55"];
      bin = prefixes[Math.floor(Math.random() * prefixes.length)];
    } else if (brand === "Amex") {
      const prefixes = ["34", "37"];
      bin = prefixes[Math.floor(Math.random() * prefixes.length)];
      length = 15;
      cvvLength = 4;
    }

    // ---- Card Number ----
    let cardNumber = bin;
    while (cardNumber.length < length - 1) {
      cardNumber += Math.floor(Math.random() * 10).toString();
    }
    cardNumber += this.getCheckDigit(cardNumber);

    // ---- Format ----
    const formattedCardNumber =
      brand === "Amex"
        ? cardNumber.replace(/(\d{4})(\d{6})(\d{5})/, "$1 $2 $3")
        : cardNumber.replace(/(.{4})/g, "$1 ").trim();


    return formattedCardNumber
  }

  static generateCVV(length: number = 3): string {
    let cvv = "";
    for (let i = 0; i < length; i++) {
      cvv += Math.floor(Math.random() * 10).toString();
    }
    return cvv;
  }

  static generatePIN(length: number = 4): string {
    let pin = "";
    for (let i = 0; i < length; i++) {
      pin += Math.floor(Math.random() * 10).toString();
    }
    return pin;
  }

  private static getCheckDigit(number: string): string {
    let sum = 0;
    let shouldDouble = true;

    for (let i = number.length - 1; i >= 0; i--) {
      let digit = parseInt(number[i], 10);

      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      shouldDouble = !shouldDouble;
    }

    const mod = sum % 10;
    return (mod === 0 ? 0 : 10 - mod).toString();
  }
}

/**
 * Generate a 16-digit bank-style reference number
 * Format: YYMMDD + 10-digit random number
 * Example: 2509041234567890
 */
export function generateBankReference(): string {
  const now = new Date();
  
  // Date part (YYMMDD)
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const datePart = `${year}${month}${day}`;

  // Random 10-digit number (padded)
  const randomPart = Math.floor(Math.random() * 1_000_000_0000) // up to 10 digits
    .toString()
    .padStart(10, "0");

  return `${datePart}${randomPart}`;
}

// Example usage:
// e.g. 2509041234567890






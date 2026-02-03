// app/utils/user.server.ts
import { getUserModel } from '~/models/user.server';

export interface UpdateUserProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dob?: Date;
}

export interface UpdateAddressData {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface UpdatePreferencesData {
  language?: string;
  currency?: string;
}

export interface UpdateNotificationsData {
  email: boolean;
  sms: boolean;
  push: boolean;
}

export class UserService {
  /**
   * Update user profile information
   */
  static async updateProfile(userId: string, data: UpdateUserProfileData) {
    const User = await getUserModel();
    
    // Validate email uniqueness if email is being updated
    if (data.email) {
      const existingUser = await User.findOne({
        email: data.email.toLowerCase(),
        _id: { $ne: userId },
      });

      if (existingUser) {
        throw new Error('Email address is already in use');
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (data.firstName) updateData.firstName = data.firstName.trim();
    if (data.lastName) updateData.lastName = data.lastName.trim();
    if (data.email) updateData.email = data.email.toLowerCase().trim();
    if (data.phone) updateData.phone = data.phone.trim();
    if (data.dob) updateData.dob = data.dob;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -verificationToken -passwordResetToken');

    return updatedUser;
  }

  /**
   * Update user address
   */
  static async updateAddress(userId: string, addressData: UpdateAddressData) {
    const User = await getUserModel();

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        'address.street': addressData.street.trim(),
        'address.city': addressData.city.trim(),
        'address.state': addressData.state.trim(),
        'address.postalCode': addressData.postalCode.trim(),
        'address.country': addressData.country.trim(),
      },
      { new: true, runValidators: true }
    ).select('-password -verificationToken -passwordResetToken');

    return updatedUser;
  }

  /**
   * Update user preferences
   */
  static async updatePreferences(userId: string, preferences: UpdatePreferencesData) {
    const User = await getUserModel();

    const updateData: any = {};
    
    if (preferences.currency) {
      // Validate currency
      const allowedCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD'];
      if (!allowedCurrencies.includes(preferences.currency)) {
        throw new Error('Invalid currency selection');
      }
      updateData['account.currency'] = preferences.currency;
    }

    // Note: Add language field to your schema if you want to store language preference
    if (preferences.language) {
      updateData.language = preferences.language;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -verificationToken -passwordResetToken');

    return updatedUser;
  }

  /**
   * Update notification preferences
   */
  static async updateNotifications(userId: string, notifications: UpdateNotificationsData) {
    const User = await getUserModel();

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        'notifications.email': notifications.email,
        'notifications.sms': notifications.sms,
        'notifications.push': notifications.push,
      },
      { new: true, runValidators: true }
    ).select('-password -verificationToken -passwordResetToken');

    return updatedUser;
  }

  /**
   * Get user by ID with selected fields
   */
  static async getUserById(userId: string) {
    const User = await getUserModel();
    
    const user = await User.findById(userId)
      .select('-password -verificationToken -passwordResetToken -passwordResetExpires')
      .lean();

    return user;
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(userId: string) {
    const User = await getUserModel();
    
    await User.findByIdAndUpdate(
      userId,
      { lastLogin: new Date() },
      { new: true }
    );
  }

  /**
   * Change user PIN (for transaction PIN changes)
   */
  static async updateTransactionPin(userId: string, newPin: string) {
    const User = await getUserModel();
    
    // Validate PIN format (should be 4-6 digits)
    if (!/^\d{4,6}$/.test(newPin)) {
      throw new Error('PIN must be 4-6 digits');
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 'account.pin': newPin },
      { new: true, runValidators: true }
    ).select('-password -verificationToken -passwordResetToken');

    return updatedUser;
  }

  /**
   * Validate user data before updates
   */
  static validateProfileData(data: UpdateUserProfileData): string[] {
    const errors: string[] = [];

    if (data.firstName && (data.firstName.length < 2 || data.firstName.length > 50)) {
      errors.push('First name must be between 2 and 50 characters');
    }

    if (data.lastName && (data.lastName.length < 2 || data.lastName.length > 50)) {
      errors.push('Last name must be between 2 and 50 characters');
    }

    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        errors.push('Please enter a valid email address');
      }
    }

    if (data.phone) {
      const phoneRegex = /^[+]?[\d\s\-\(\)]{10,}$/;
      if (!phoneRegex.test(data.phone)) {
        errors.push('Please enter a valid phone number');
      }
    }

    if (data.dob) {
      const today = new Date();
      const birthDate = new Date(data.dob);
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 18) {
        errors.push('You must be at least 18 years old');
      }
      
      if (birthDate > today) {
        errors.push('Date of birth cannot be in the future');
      }
    }

    return errors;
  }

  /**
   * Validate address data
   */
  static validateAddressData(data: UpdateAddressData): string[] {
    const errors: string[] = [];

    if (!data.street || data.street.length < 5 || data.street.length > 200) {
      errors.push('Street address must be between 5 and 200 characters');
    }

    if (!data.city || data.city.length < 2 || data.city.length > 100) {
      errors.push('City must be between 2 and 100 characters');
    }

    if (!data.state || data.state.length < 2 || data.state.length > 100) {
      errors.push('State/Province must be between 2 and 100 characters');
    }

    if (!data.postalCode || data.postalCode.length < 3 || data.postalCode.length > 20) {
      errors.push('Postal code must be between 3 and 20 characters');
    }

    if (!data.country || data.country.length < 2 || data.country.length > 100) {
      errors.push('Country must be between 2 and 100 characters');
    }

    return errors;
  }
}

// Utility functions for formatting and validation
export const formatters = {
  /**
   * Format phone number for display
   */
  formatPhoneNumber: (phone: string): string => {
    // Simple US phone number formatting
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
  },

  /**
   * Format currency amount
   */
  formatCurrency: (amount: number, currency: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  },

  /**
   * Format date for display
   */
  formatDate: (date: Date | string): string => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  },

  /**
   * Format date for input fields (YYYY-MM-DD)
   */
  formatDateForInput: (date: Date | string): string => {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
  },

  /**
   * Mask sensitive data (account numbers, etc.)
   */
  maskAccountNumber: (accountNumber: string, visibleDigits: number = 4): string => {
    if (!accountNumber || accountNumber.length <= visibleDigits) return accountNumber;
    const masked = '*'.repeat(accountNumber.length - visibleDigits);
    return masked + accountNumber.slice(-visibleDigits);
  },
};

// Export types for use in components

import { createCookieSessionStorage, redirect } from 'react-router';
import { getAdminModel } from '~/models/admin.server';
import type { IAdmin } from '~/models/admin.server';

// Types
export interface CreateAdminData {
  name: string;
  email: string;
  password: string;
  contact: {
    phone: string;
    email: string;
  }
}

export interface LoginData {
  email: string;
  password: string;
}

export interface UpdateAdminData {
  name?: string;
  email?: string;
  password?: string;
  contact?: {
    phone?: string;
    email?: string;
  }
}

interface ResponseData  { 
    error?: string
    success?: boolean
    message?: string
    admin?: IAdmin

 } 
export interface AdminSession {
  adminId: string;
  name: string;
  email: string;
}

// Session configuration
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error('SESSION_SECRET must be set');
}

const storage = createCookieSessionStorage({
  cookie: {
    name: 'x-4tu5a',
    secure: process.env.NODE_ENV === 'production',
    secrets: [sessionSecret],
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 1, // 1 hour
    httpOnly: true,
  },
});

// Session helpers
export async function createAdminSession(admin: IAdmin, redirectTo: string = '/admin') {
  const session = await storage.getSession();
  session.set('adminId', admin._id.toString());
  session.set('adminName', admin.name);
  session.set('adminEmail', admin.email);
  
  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': await storage.commitSession(session),
    },
  });
}

export async function getAdminSession(request: Request): Promise<AdminSession | null> {
  const session = await storage.getSession(request.headers.get('Cookie'));
  const adminId = session.get('adminId');
  const adminName = session.get('adminName');
  const adminEmail = session.get('adminEmail');
  
  if (!adminId || !adminName || !adminEmail) {
    return null;
  }
  
  return {
    adminId,
    name: adminName,
    email: adminEmail,
  };
}

export async function requireAdminSession(request: Request): Promise<AdminSession> {
  const adminSession = await getAdminSession(request);
  
  if (!adminSession) {
    throw redirect('/');
  }
  
  return adminSession;
}

export async function logout(request: Request, redirectTo: string = '/') {
  const session = await storage.getSession(request.headers.get('Cookie'));
  
  throw redirect(redirectTo, {
    headers: {
      'Set-Cookie': await storage.destroySession(session),
    },
  });
}



// Admin CRUD Services
export class AdminService {
  /**
   * Create a new admin
   */
  static async createAdmin(data: CreateAdminData): Promise<IAdmin> {
    try {
      const AdminModel = await getAdminModel();
      
      // Check if admin with email already exists
      const existingAdmin = await AdminModel.findByEmail(data.email);
      if (existingAdmin) {
        throw new Error('Admin with this email already exists');
      }
      
      // Validate password length
      if (data.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      
      const admin = new AdminModel({
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        password: data.password,
        contact: {
          phone: data.contact.phone.trim(),
          email: data.contact.email.trim(),
        },
      });
      
      await admin.save();
      return admin;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create admin: ${error.message}`);
      }
      throw new Error('Failed to create admin');
    }
  }
  
  /**
   * Authenticate admin login
   */
  static async login(data: LoginData): Promise<ResponseData> {
    try {
      const AdminModel = await getAdminModel();
      
      // Find admin by email
      const admin = await AdminModel.findByEmail(data.email);
      if (!admin) {
        return { error: 'Invalid email or password' }
      }
      
      // Check password
      const isPasswordValid = await admin.comparePassword(data.password);
      if (!isPasswordValid) {
        return { error: 'Invalid email or password' }
      }
      
      return { success: true, message: 'Login successful', admin };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Login failed');
    }
  }
  
  /**
   * Get admin by ID
   */
  static async getAdminById(id: string): Promise<IAdmin | null> {
    try {
      const AdminModel = await getAdminModel();
      return await AdminModel.findById(id);
    } catch (error) {
      console.error('Error fetching admin by ID:', error);
      return null;
    }
  }
  
  /**
   * Get admin by email
   */
  static async getAdminByEmail(email: string): Promise<IAdmin | null> {
    try {
      const AdminModel = await getAdminModel();
      return await AdminModel.findByEmail(email);
    } catch (error) {
      console.error('Error fetching admin by email:', error);
      return null;
    }
  }
  
  /**
   * Get all admins with pagination
   */
  static async getAllAdmins(page: number = 1, limit: number = 10) {
    try {
      const AdminModel = await getAdminModel();
      const skip = (page - 1) * limit;
      
      const [admins, total] = await Promise.all([
        AdminModel.find({})
          .select('-password')
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 }),
        AdminModel.countDocuments({})
      ]);
      
      return {
        admins,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error fetching admins:', error);
      throw new Error('Failed to fetch admins');
    }
  }
  
  /**
   * Update admin
   */
  static async updateAdmin(id: string, data: UpdateAdminData): Promise<IAdmin> {
    try {
      const AdminModel = await getAdminModel();
      
      const admin = await AdminModel.findById(id);
      if (!admin) {
        throw new Error('Admin not found');
      }
      
      // Check if email is being changed and if it's already taken
      if (data.email && data.email !== admin.email) {
        const existingAdmin = await AdminModel.findByEmail(data.email);
        if (existingAdmin) {
          throw new Error('Email already in use by another admin');
        }
        admin.email = data.email.toLowerCase().trim();
      }
      
      // Update name if provided
      if (data.name) {
        admin.name = data.name.trim();
      }
      
      // Update password if provided
      if (data.password) {
        if (data.password.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }
        admin.password = data.password;
      }
      
      await admin.save();
      return admin;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update admin: ${error.message}`);
      }
      throw new Error('Failed to update admin');
    }
  }
  
  /**
   * Delete admin
   */
  static async deleteAdmin(id: string): Promise<boolean> {
    try {
      const AdminModel = await getAdminModel();
      
      const admin = await AdminModel.findById(id);
      if (!admin) {
        throw new Error('Admin not found');
      }
      
      await AdminModel.findByIdAndDelete(id);
      return true;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to delete admin: ${error.message}`);
      }
      throw new Error('Failed to delete admin');
    }
  }
  
  /**
   * Change admin password
   */
  static async changePassword(id: string, currentPassword: string, newPassword: string): Promise<ResponseData> {
    try {
      const AdminModel = await getAdminModel();
      
      const admin = await AdminModel.findById(id);
      if (!admin) {
        return { error: 'Admin not found', success: false }
      }
      
      // Verify current password
      const isCurrentPasswordValid = await admin.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return { error: 'Current password is incorrect', success: false }
      }
      
      // Validate new password
      if (newPassword.length < 6) {
        return { error: 'New password must be at least 6 characters long', success: false }
      }
      
      // Update password
      admin.password = newPassword;
      await admin.save();
      
      return { message: 'Password changed successfully', success: true }
    } catch (error) {
      if (error instanceof Error) {
        return { error: error.message, success: false }
      }
      return { error: 'Failed to change password', success: false }
    }
  }
  
  /**
   * Search admins by name or email
   */
  static async searchAdmins(query: string, page: number = 1, limit: number = 10) {
    try {
      const AdminModel = await getAdminModel();
      const skip = (page - 1) * limit;
      
      const searchRegex = new RegExp(query, 'i');
      const searchQuery = {
        $or: [
          { name: searchRegex },
          { email: searchRegex },
        ],
      };
      
      const [admins, total] = await Promise.all([
        AdminModel.find(searchQuery)
          .select('-password')
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 }),
        AdminModel.countDocuments(searchQuery)
      ]);
      
      return {
        admins,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error searching admins:', error);
      throw new Error('Failed to search admins');
    }
  }
  
  /**
   * Get admin statistics
   */
  static async getAdminStats() {
    try {
      const AdminModel = await getAdminModel();
      
      const [total, recentCount] = await Promise.all([
        AdminModel.countDocuments({}),
        AdminModel.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        })
      ]);
      
      return {
        total,
        recentCount,
      };
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      throw new Error('Failed to fetch admin statistics');
    }
  }
}

// Utility functions for form validation
export function validateEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return 'Email is required';
  if (!emailRegex.test(email)) return 'Please enter a valid email address';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters long';
  return null;
}

export function validateName(name: string): string | null {
  if (!name) return 'Name is required';
  if (name.trim().length < 2) return 'Name must be at least 2 characters long';
  return null;
}
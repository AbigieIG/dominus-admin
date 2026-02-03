

import { v2 as cloudinary } from 'cloudinary';
import { getUserModel } from '~/models/user.server';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
  secure: true,
});

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export class CloudinaryService {
  /**
   * Upload avatar image to Cloudinary
   */
  static async uploadAvatar(
    fileBuffer: Buffer,
    userId: string,
    fileName?: string
  ): Promise<CloudinaryUploadResult> {
    try {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'avatars',
            public_id: `avatar_${userId}_${Date.now()}`,
            transformation: [
              { width: 400, height: 400, crop: 'fill', gravity: 'face' },
              { quality: 'auto' },
              { format: 'jpg' }
            ],
            resource_type: 'image',
          },
          (error, result) => {
            if (error) {
              console.error('Cloudinary upload error:', error);
              reject(new Error('Failed to upload image'));
            } else if (result) {
              resolve(result as CloudinaryUploadResult);
            } else {
              reject(new Error('No result from Cloudinary'));
            }
          }
        );

        uploadStream.end(fileBuffer);
      });
    } catch (error) {
      console.error('Avatar upload error:', error);
      throw new Error('Failed to upload avatar');
    }
  }

  /**
   * Delete avatar from Cloudinary
   */
  static async deleteAvatar(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Failed to delete avatar from Cloudinary:', error);
      // Don't throw error as user update should still proceed
    }
  }

  /**
   * Generate avatar URL with transformations
   */
  static getAvatarUrl(
    publicId: string,
    options: {
      width?: number;
      height?: number;
      crop?: string;
      quality?: string;
    } = {}
  ): string {
    return cloudinary.url(publicId, {
      width: options.width || 200,
      height: options.height || 200,
      crop: options.crop || 'fill',
      quality: options.quality || 'auto',
      gravity: 'face',
      format: 'jpg',
      secure: true,
    });
  }

  /**
   * Validate image file
   */
  static validateImageFile(file: File): { isValid: boolean; error?: string } {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: 'Invalid file type. Please upload JPEG, PNG, or WebP images only.',
      };
    }

    if (file.size > maxSize) {
      return {
        isValid: false,
        error: 'File size too large. Please upload images under 5MB.',
      };
    }

    return { isValid: true };
  }
}

// 3. Update UserService to handle avatar operations
// Add to ~/utils/user.server.ts

export interface UpdateAvatarData {
  url: string;
  publicId: string;
}

// Add to UserService class:
export class AvatarService {
  // ... existing methods

  /**
   * Update user avatar
   */
 static async updateAvatar(userId: string, data: { file: File }): Promise<string> {
    try {
      // Validate the file first
      const validation = CloudinaryService.validateImageFile(data.file);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Convert File to Buffer for Cloudinary upload
      const arrayBuffer = await data.file.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      // Upload to Cloudinary
      const uploadResult = await CloudinaryService.uploadAvatar(
        fileBuffer,
        userId,
        data.file.name
      );

      // Update user in database with new avatar info
      const User = await getUserModel();
      
      // Get current user to delete old avatar if exists
      const currentUser = await User.findById(userId);
      if (currentUser?.avatar?.publicId) {
        // Delete old avatar from Cloudinary (don't await to avoid blocking)
        CloudinaryService.deleteAvatar(currentUser.avatar.publicId).catch(console.error);
      }

      // Update user with new avatar data
      await User.findByIdAndUpdate(
        userId,
        {
          avatar: {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            uploadedAt: new Date(),
          },
        },
        { new: true, runValidators: true }
      );

      return uploadResult.secure_url;
    } catch (error) {
      console.error('Avatar update error:', error);
      throw new Error('Failed to update avatar');
    }
  }

  /**
   * Remove user avatar
   */
  static async removeAvatar(userId: string) {
    const User = await getUserModel();

    // Get current user to delete avatar from Cloudinary
    const currentUser = await User.findById(userId);
    if (currentUser?.avatar?.publicId) {
      await CloudinaryService.deleteAvatar(currentUser.avatar.publicId);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $unset: { avatar: 1 } },
      { new: true, runValidators: true }
    ).select('-password -verificationToken -passwordResetToken');

    return updatedUser;
  }

  /**
   * Get avatar URL with transformations
   */
  static getAvatarUrl(user: any, size: 'sm' | 'md' | 'lg' = 'md'): string {
    if (!user?.avatar?.publicId) {
      return this.getDefaultAvatarUrl(user);
    }

    const dimensions = {
      sm: { width: 40, height: 40 },
      md: { width: 80, height: 80 },
      lg: { width: 200, height: 200 },
    };

    return CloudinaryService.getAvatarUrl(user.avatar.publicId, dimensions[size]);
  }

  /**
   * Generate default avatar URL (using initials)
   */
  static getDefaultAvatarUrl(user: any): string {
    const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=0ea5e9&color=fff&size=200`;
  }
}
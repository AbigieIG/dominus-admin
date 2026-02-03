import { createCookieSessionStorage, redirect } from "react-router";
import { getUserModel } from "~/models/user.server";
import type { IUser } from "~/models/user.server";
import { 
  generateUniqueRoutingNumber,
  generateUniqueAccountNumber,
  generateUniqueSwiftBic,
  generateUniqueIBAN,
  generateUniqueSortCode,
  generateUniquePin

} from '~/utils/banknumber';
import { notificationService } from "./notification.server";


type ReturnUser = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationalId?: string;
  dob: Date;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  account: {
    type: string;
    number: string;
    balance: number;
    currency: string;
    status: string;
    iban?: string;
    swiftBic: string;
    routingNumber: string;
    pin: string;
    sortCode: string;
  }
  security?: {
    twoFactorEnabled: boolean;
  }
  notifications?: {
    email: boolean;
    sms: boolean;
    push: boolean;
  }
 joinDate?: Date;
  isVerified: boolean;
  lastLogin?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

type AuthResult = {
  user?: ReturnUser;
  data?: ReturnUser;
  success?: boolean;
  message?: string;
  error?: string;
};

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set");
}

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "banking_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [sessionSecret],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
});

function userToReturnUser(user: IUser): ReturnUser {
  return {
    _id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    nationalId: user.nationalId,
    dob: user.dob,
    account: user.account,  
    address: user.address,
    notifications: user.notifications,
    security: user.security,
    joinDate: user.joinDate,
    isVerified: user.isVerified,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function register({
  firstName,
  lastName,
  email,
  password,
  phone,
  dob,
  joinDate,
  nationalId,
  isVerified,
  address,
  account
}: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  nationalId: string;
  joinDate: string;
  isVerified?: boolean;
  dob: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  account: {
    type: string;
    number: string;
    balance: number;
    currency: string;
    status: string;
    iban: string;
    swiftBic: string;
    routingNumber: string;
    pin: string;
    sortCode: string;
  };
}): Promise<AuthResult> {
  try {
    const User = await getUserModel();
    
    // Check for existing user by email
    const existingUserByEmail = await User.findOne({
      email: email.toLowerCase().trim()
    });
    
    if (existingUserByEmail) {
      return { error: "User already exists with this email", success: false };
    }

    // Check for existing user by national ID (if provided)
    if (nationalId?.trim()) {
      const existingUserByNationalId = await User.findOne({
        nationalId: nationalId.trim()
      });
      
      if (existingUserByNationalId) {
        return { error: "User already exists with this national ID", success: false };
      }
    }

    // Check for duplicate banking details (additional safety)
    const duplicateChecks = await Promise.all([
      User.findOne({ 'account.number': account.number }),
      User.findOne({ 'account.routingNumber': account.routingNumber }),
      User.findOne({ 'account.swiftBic': account.swiftBic }),
      User.findOne({ 'account.iban': account.iban }),
      User.findOne({ 'account.pin': account.pin }),
      User.findOne({ 'account.sortCode': account.sortCode }),
    ]);

    const [dupAccount, dupRouting, dupSwift, dupIban] = duplicateChecks;
    
    if (dupAccount) {
      return { error: "Account number already exists", success: false };
    }
    if (dupRouting) {
      return { error: "Routing number already exists", success: false };
    }
    if (dupSwift) {
      return { error: "SWIFT/BIC already exists", success: false };
    }
    if (dupIban) {
      return { error: "IBAN already exists", success: false };
    }

    // Create new user
    const user = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone.trim(),
      dob: new Date(dob),
      isVerified: isVerified || false,
      joinDate: joinDate ? new Date(joinDate) : new Date(),
      address: {
        street: address.street.trim(),
        city: address.city.trim(),
        state: address.state.trim(),
        postalCode: address.postalCode.trim(),
        country: address.country.trim(),
      },
      nationalId: nationalId?.trim() || undefined, 
      account: {
        ...account,
        // Ensure all banking details are present
        number: account.number || generateUniqueAccountNumber({ length: 10, prefix: "475" }),
        routingNumber: account.routingNumber || generateUniqueRoutingNumber(),
        swiftBic: account.swiftBic || generateUniqueSwiftBic(),
        pin: account.pin || generateUniquePin(),
        sortCode: account.sortCode || generateUniqueSortCode(),
        iban: account.iban || generateUniqueIBAN(
          account.swiftBic || generateUniqueSwiftBic(), 
          account.number || generateUniqueAccountNumber(),
          address.country || "GB"
        )
      }
    });

    const savedUser = await user.save();

    await notificationService.sendWelcomeNotification(savedUser._id, savedUser.firstName, joinDate); 
    
    // Return user data without sensitive fields
    const userData = {
      _id: savedUser._id,
      firstName: savedUser.firstName,
      lastName: savedUser.lastName,
      email: savedUser.email,
      phone: savedUser.phone,
      dob: savedUser.dob,
      address: savedUser.address,
      account: {
        type: savedUser.account.type,
        number: savedUser.account.number,
        balance: savedUser.account.balance,
        currency: savedUser.account.currency,
        status: savedUser.account.status,
        iban: savedUser.account.iban,
        swiftBic: savedUser.account.swiftBic,
        routingNumber: savedUser.account.routingNumber,
        pin: savedUser.account.pin,
        sortCode: savedUser.account.sortCode
      },
      isVerified: savedUser.isVerified,
      createdAt: savedUser.createdAt
    };

    return {
      success: true,
      message: "User created successfully",
      data: userData
    };

  } catch (error: any) {
    console.error("Registration error:", error);
    
    // Handle duplicate key errors more specifically
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const friendlyFieldNames: { [key: string]: string } = {
        email: 'email address',
        nationalId: 'national ID',
        'account.number': 'account number',
        'account.routingNumber': 'routing number',
        'account.swiftBic': 'SWIFT/BIC code',
        'account.pin': 'PIN',
        'account.sortCode': 'sort code',
        'account.iban': 'IBAN'
      };
      
      const fieldName = friendlyFieldNames[field] || field;
      return {
        error: `A user with this ${fieldName} already exists`,
        success: false
      };
    }
    
    if (error.name === 'ValidationError') {
      const firstError = Object.values(error.errors)[0] as any;
      return {
        error: firstError?.message || "Validation failed",
        success: false
      };
    }
    
    return {
      error: "Registration failed. Please try again.",
      success: false
    };
  }
}



export const getUserData = async (userId: string) => {
  const User = await getUserModel();
  const user = await User.findById(userId).select("-password") as IUser;
  return userToReturnUser(user);
}
export async function login({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  try {
    const User = await getUserModel();
    const user = await User.findOne({ 
      email: email.toLowerCase().trim() 
    }).select("+password");

    if (!user) {
      return { error: "Invalid email or password", success: false };
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return { error: "Invalid email or password", success: false };
    }

    user.lastLogin = new Date();
    await user.save();

    const userData = userToReturnUser(user);

    return { 
      success: true, 
      message: "Login successful", 
      data: userData 
    };
  } catch (error) {
    console.error("Login error:", error);
    return { 
      error: "Login failed. Please try again.", 
      success: false 
    };
  }
}

export async function logout(request: Request) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

export async function createUserSession(
  userId: string,
  redirectTo: string
) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function getUserId(request: Request): Promise<string | null> {
  const session = await getSession(request);
  const userId = session.get("userId");
  return userId || null;
}

export async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname
): Promise<string> {
  const userId = await getUserId(request);
  if (!userId) {
    const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }
  return userId;
}

export async function getUser(request: Request): Promise<ReturnUser | null> {
  const userId = await getUserId(request);
  if (!userId) return null;

  try {
    const User = await getUserModel();
    const user = await User.findById(userId).select("-password");
    return user ? userToReturnUser(user) : null;
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}
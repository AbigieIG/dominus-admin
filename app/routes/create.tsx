import type { ActionFunction, MetaFunction,  } from "react-router";
import { redirect, useFetcher } from "react-router";
import Input from "~/components/input";
import { register } from "~/utils/auth.server";
import CustomSelect from "~/components/customSelect";
import countryOptions from "~/assets/country.json";
import {
  generateUniqueRoutingNumber,
  generateUniqueAccountNumber,
  generateUniqueSwiftBic,
  generateUniqueIBAN,
  generateUniqueSortCode,
  generateUniquePin,
} from "~/utils/banknumber";

import settings from '~/assets/settings.json';
export const meta: MetaFunction = () => {
  return [
    {title: `Create User | ${settings.site.title}`},
  ];
};
type Account = {
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
export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();

  // Extract form data
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const country = formData.get("country") as string;
  const state = formData.get("state") as string;
  const city = formData.get("city") as string;
  const street = formData.get("street") as string;
  const zipCode = formData.get("zipCode") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const phone = formData.get("phone") as string;
  const nationalId = formData.get("nationalId") as string;
  const dob = formData.get("dob") as string;
  const joinDate = formData.get("joinDate") as string;
  const postalCode = formData.get("postalCode") as string;
  const isVerified = formData.get("isVerified") === "on";

  // Basic validation - check for required fields
  const requiredFields = {
    email,
    password,
    firstName,
    lastName,
    phone,
    nationalId,
    dob,
    country,
    state,
    city,
    street,
    joinDate,
    zipCode: zipCode || postalCode,
  };

  // Check for missing required fields
  for (const [key, value] of Object.entries(requiredFields)) {
    if (!value || value.trim() === "") {
      return Response.json({
        error: `${key.charAt(0).toUpperCase() + key.slice(1)} is required`,
        success: false,
      });
    }
  }



  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return Response.json({
      error: "Please enter a valid email address",
      success: false,
    });
  }

  // Password strength validation (example)
  if (password.length < 8) {
    return Response.json({
      error: "Password must be at least 8 characters long",
      success: false,
    });
  }

  const account: Account = {
    type: "savings",
    currency: "USD",
    balance: 0,
    status: "active",
    number: generateUniqueAccountNumber({ length: 10, prefix: "475" }),
    routingNumber: generateUniqueRoutingNumber(),
    swiftBic: generateUniqueSwiftBic(),
    iban: "",
    pin: generateUniquePin(),
    sortCode: generateUniqueSortCode(),
  };

  account.iban = generateUniqueIBAN(account.swiftBic, account.number, country);

  // Prepare data for registration
  const registrationData = {
    email: email.trim().toLowerCase(),
    password,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone: phone.trim(),
    nationalId: nationalId.trim(),
    dob,
    joinDate,
    isVerified,
    address: {
      country: country.trim(),
      state: state.trim(),
      city: city.trim(),
      street: street.trim(),
      postalCode: (postalCode || zipCode).trim(),
    },
    account: account,
  };

  try {
    const result = await register(registrationData);

    if (!result.success) {
      return Response.json({
        error: result.error || "Registration failed",
        success: false,
      });
    }

    return redirect(`/admin/user/${result.data?._id}`);
  } catch (error) {
    console.error("Registration error:", error);
    return Response.json({
      error: "An unexpected error occurred. Please try again.",
      success: false,
    });
  }
};






export default function Create() {
  const fetcher = useFetcher<{ error?: string; success?: string }>();
  const isLoading = fetcher.state === "submitting";


  return (
   <div className="max-w-4xl mx-auto min-h-screen ">
     <fetcher.Form method="post" className="p-4 sm:p-6 lg:p-8 bg-white shadow-sm ">
      <div className="mb-8">
       

        <h3 className="text-base sm:text-lg font-medium text-gray-800 mb-4">
          Create Account
        </h3>

        {fetcher.data && fetcher.data.error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            <span className="block sm:inline">{fetcher.data.error}</span>
          </div>
        )}

        {fetcher.data && fetcher.data.success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">
            <span className="block sm:inline">{fetcher.data.success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <Input
            label="First Name"
            name="firstName"
            type="text"
            placeholder="Enter your first name"
            id="first_name"
            required
          />
          <Input
            label="Last Name"
            name="lastName"
            type="text"
            placeholder="Enter your last name"
            id="last_name"
            required
          />
          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="Enter your email"
            id="email"
            required
          />
          <Input
            label="Phone Number"
            name="phone"
            type="text"
            placeholder="Enter your phone number"
            id="phone"
            required
          />
          <Input
            label="Date of Birth"
            name="dob"
            type="date"
            placeholder="MM/DD/YYYY"
            id="date_of_birth"
            required
          />
          <Input
            label="Join Date"
            name="joinDate"
            type="date"
            placeholder="MM/DD/YYYY"
            id="joinDate"
            required
          />
          <Input
            label="Social Security Number / Tax ID"
            name="nationalId"
            type="text"
            placeholder="XXX-XX-XXXX"
            id="nationalId"
            required
          />
          <Input
            label="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            id="password"
            required
          />
          <div className="sm:col-span-2">
            <Input
              label="Street Address"
              name="street"
              type="text"
              placeholder="Enter your street address"
              id="address"
              required
            />
          </div>
          <Input
            label="City"
            name="city"
            type="text"
            placeholder="Enter your city"
            id="city"
            required
          />
          <Input
            label="State"
            name="state"
            type="text"
            placeholder="State"
            id="state"
            required
          />

          <div className="grid grid-cols-2 gap-4">
           
       

            <div className="flex flex-col space-y-1">
              <label
                htmlFor="country"
                className="text-sm font-medium text-gray-700"
              >
                country <span className="text-red-500">*</span>
              </label>
              <CustomSelect
                id="country"
                name="country"
                placeholder="Country"
                options={countryOptions}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
              />
            </div>

            <Input
              label="Zip Code"
              name="postalCode"
              type="text"
              placeholder="12345"
              id="zip_code"
              required
            />
          </div>
        </div>
        <div className="flex items-center mt-5 text-sm space-x-2">
            <span className="text-gray-700">Verify Account</span>
            <input type="checkbox" defaultChecked id="isVerified" name="isVerified" className="w-4 h-4"  />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
       

        <button
          type="submit"
          disabled={isLoading}
          className={`
                  w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-200
                  ${
                    isLoading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 focus:ring-4 focus:ring-green-200"
                  }
                `}
        >
          {isLoading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Loading...</span>
            </div>
          ) : (
            "Continue"
          )}
        </button>
      </div>
    </fetcher.Form>
   </div>
  );
}

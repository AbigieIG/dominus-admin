import type { LoaderFunction } from "react-router";
import { requireAdminSession } from "~/utils/admin.server";
import { transactionService } from "~/utils/transactions.server";

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const accountNumber = url.searchParams.get("accountNumber") as string;

  try {
    const admin = await requireAdminSession(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user =
      await transactionService.findUserByAccountNumber(accountNumber);

    if (!user) {
      return Response.json(
        {
          error: `User with account number ${accountNumber} not found`,
          success: false,
          userName: null,
        },
        { status: 400 }
      );
    }

    const data = {
      firstName: user?.firstName,
      lastName: user?.lastName,
      accountNumber: user?.account.number,
      currency: user?.account.currency,
      status: user?.account.status,
    };
    return Response.json({ success: true, data }, { status: 200 });
  } catch (error) {
    return Response.json(
      { error: "User not found", success: false, userName: null },
      { status: 400 }
    );
  }
};

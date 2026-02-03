import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("./routes/login.tsx"),
  // parent route
  route("/admin", "./dashboard.tsx", [
    // child routes
    index("./routes/home.tsx"),
    route("user/:userId", "./routes/user.tsx"),
    route("edit/:userId", "./routes/edit.tsx"),
    route("transactions/:userId", "./routes/transactions.tsx"),
    route("cards/:userId", "./routes/cards.tsx"),
    route("notifications/:userId", "./routes/notifications.tsx"),
    route("transfer/:userId", "./routes/transfer.tsx"),
    route("create", "./routes/create.tsx"),
    route("settings", "./routes/settings.tsx"),
    route("otp", "./routes/otp.tsx"),
    route("send-mails", "./routes/send-mails.tsx"),
    route("create-trans/:userId", "./routes/create-trans.tsx"),
    route("edit-notification/:id/:userId", "./routes/edit-notification.tsx"),
    route("create-notification/:userId", "./routes/create-notification.tsx"),
    route("deposit/:userId", "./routes/deposit.tsx"),
    route("edit-trans/:id", "./routes/edit-trans.tsx"),
    route("card/create-trans/:id/:userId", "./routes/card-trans.tsx"),
    route("card/edit-card/:userId/:cardId/:transactionId", "./routes/edit-card.tsx"),
  ]),
   route("chats", "./routes/chats.tsx"),
   route("/api/get-recipient", "./api/get-recipient.tsx"),
   route("/api/send-mail", "./api/mail.tsx"),
   route("/api/x1/create", "./api/create-admin.tsx"),
   route("/api/get-data", "./api/get-admin.tsx"),
   route("/api/logout", "./api/logout.tsx"),
   route("*", "./routes/404.tsx"),

] satisfies RouteConfig;

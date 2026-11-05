
import AuthProvider from "./auth/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminProtectedRoute from "./components/AdminProtectedRoute";

import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";

import Login from "./pages/Login/Login";
import Signup from "./pages/Signup/Signup";
import NotFound from "./pages/NotFound";
import VerifyEmail from "./pages/VerifyEmail/VerifyEmail";
import VerificationSuccess from "./pages/EmailVerificationSuccess/EmailVerificationSuccess";
import EmailVerificationExpired from "./pages/EmailVerificationExpired/EmailVerificationExpired";

import ListItem from "./pages/ListItem/ListItem";
import ItemDetails from "./pages/ItemDetails/ItemDetails";
import Messages from "./pages/Messages/Messages";
import Home from "./pages/Home/Home";
import SavedItem from "./pages/SavedItems/SavedItem";
import Profile from "./pages/Profile/Profile";
import EditListing from "./pages/EditListing/EditListing";
import OfferDetails from "./pages/Offers/OfferDetails";

import AdminUsers from "./pages/Admin/AdminUsers";

import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import CheckYourInbox from "./pages/CheckYourInbox/CheckYourInbox";
import ResetPassword from "./pages/ResetPassword/ResetPassword";
import PasswordUpdated from "./pages/PasswordUpdated/PasswordUpdated";
import PasswordResetExpired from "./pages/PasswordResetExpired/PasswordResetExpired";

const protectedPage = (element) => (
  <ProtectedRoute>{element}</ProtectedRoute>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: protectedPage(<Home />),
  },
  {
    path: "/home",
    element: protectedPage(<Home />),
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/signup",
    element: <Signup />,
  },
  {
    path: "/verify-email",
    element: <VerifyEmail />,
  },
  {
    path: "/verification-success",
    element: <VerificationSuccess />,
  },
  {
    path: "/verification-expired",
    element: <EmailVerificationExpired />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPassword />,
  },
  {
    path: "/check-your-inbox",
    element: <CheckYourInbox />,
  },
  {
    path: "/reset-password",
    element: <ResetPassword />,
  },
  {
    path: "/password-reset-expired",
    element: <PasswordResetExpired />,
  },
  {
    path: "/password-updated",
    element: <PasswordUpdated />,
  },
  {
    path: "/messages",
    element: protectedPage(<Messages />),
  },
  {
    path: "/messages/:conversationId",
    element: protectedPage(<Messages />),
  },
  {
    path: "/list-an-item",
    element: protectedPage(<ListItem />),
  },
  {
    path: "/saved-item",
    element: protectedPage(<SavedItem />),
  },
  {
    path: "/profile",
    element: protectedPage(<Profile />),
  },
  {
    path: "/edit-listing/:id",
    element: protectedPage(<EditListing />),
  },
  {
    path: "/items/:id",
    element: protectedPage(<ItemDetails />),
  },
  {
    path: "/offers/:offerId",
    element: protectedPage(<OfferDetails />),
  },
  {
    element: <AdminProtectedRoute />,
    children: [
      {
        path: "/admin/users",
        element: <AdminUsers />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;

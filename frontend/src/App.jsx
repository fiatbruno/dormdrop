
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

import AdminUserDetails from "./pages/Admin/AdminUserDetails";
import AdminLogin from "./pages/Admin/AdminLogin";
import AdminUsers from "./pages/Admin/AdminUsers";

const router = createBrowserRouter([


  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Home />
      </ProtectedRoute>
    ),
  },
  {
    path: "/home",
    element: (
      <ProtectedRoute>
        <Home />
      </ProtectedRoute>
    ),
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
    path: "/messages",
    element: (
      <ProtectedRoute>
        <Messages />
      </ProtectedRoute>
    ),
  },
  {
    path: "/messages/:conversationId",
    element: (
      <ProtectedRoute>
        <Messages />
      </ProtectedRoute>
    ),
  },
  {
    path: "/list-an-item",
    element: (
      <ProtectedRoute>
        <ListItem />
      </ProtectedRoute>
    ),
  },
  {
    path: "/saved-item",
    element: (
      <ProtectedRoute>
        <SavedItem />
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile",
    element: (
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    ),
  },
  {
    path: "/edit-listing/:id",
    element: (
      <ProtectedRoute>
        <EditListing />
      </ProtectedRoute>
    ),
  },
  {
    path: "/items/:id",
    element: (
      <ProtectedRoute>
        <ItemDetails />
      </ProtectedRoute>
    ),
  },
  {
    path: "/offers/:offerId",
    element: (
      <ProtectedRoute>
        <OfferDetails />
      </ProtectedRoute>
    ),
  },



  {
    path: "/admin/login",
    element: <AdminLogin />,
  },



  {
    element: <AdminProtectedRoute />,
    children: [
      {
        path: "/admin/users",
        element: <AdminUsers />,
      },
      {
        path: "/admin/users/:userId",
        element: <AdminUserDetails />,
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

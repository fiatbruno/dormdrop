import AuthProvider from "./auth/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

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

/*
 * We use the react-router-dom library to load pages based
 * on path. This object configures which paths map to which
 * page.
 *
 * Matching happens from top to bottom; the last path is "*",
 * which is the fall-through case when no other path matches.
 */

const router = createBrowserRouter([
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
    path: "/",
    element: (
      <ProtectedRoute>
        <Home />
      </ProtectedRoute>
    ),
  },

  {
    path: "/verify-email",
    element: <VerifyEmail />,
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
    path: "/verification-success",
    element: <VerificationSuccess />,
  },
  {
    path: "/verification-expired",
    element: <EmailVerificationExpired />,
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
    path: "/home",
    element: (
      <ProtectedRoute>
        <Home />
      </ProtectedRoute>
    ),
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

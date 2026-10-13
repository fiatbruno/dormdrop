import { createBrowserRouter, RouterProvider } from "react-router-dom";

import Login from "./pages/Login/Login";
import Signup from "./pages/Signup/Signup";
import NotFound from "./pages/NotFound";
import VerifyEmail from "./pages/VerifyEmail/VerifyEmail";
import VerificationSuccess from "./pages/EmailVerificationSuccess/EmailVerificationSuccess";
import EmailVerificationExpired from "./pages/EmailVerificationExpired/EmailVerificationExpired";
import ListItem from "./pages/ListItem/ListItem";
import Home from "./pages/Home/Home";
import SavedItem from "./pages/SavedItems/SavedItem";
import EditListing from "./pages/EditListing/EditListing";
import { Link } from "react-router-dom";
/*
 * We use the react-router-dom library to load pages based
 * on path. This object configures which paths map to which
 * page.
 *
 * Matching happens from top to bottom; the last path is "*",
 * which is the fall-through case when no other path matches.
 */

const testItems = [
  {
    id: "test-1",
    title: "Sony WH-1000XM4 Headphones",
    category: "Electronics",
    price: 120,
    imageUrl: "/images/headphones.jpg",
    available: true,
  },
];

const router = createBrowserRouter([
  {
    path: "/",
    element: <Login />,
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
    element: <ListItem />,
  },
  { path: "/saved-item",
    element: <SavedItem />

  },
  {
    path: "/home",
    element: <Home />,
  },

  {
    path: "/edit-listing/:id",
    element: <EditListing />,
  },
  

  {
    path: "*",
    element: <NotFound />,
  },
]);

<Link to={`/edit-listing/${listing.id}`}>
  Edit listing
</Link>
function App() {
  return (
    <>
      <RouterProvider router={router} />
    </>
  );
}

export default App;

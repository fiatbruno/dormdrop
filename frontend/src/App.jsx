import { createBrowserRouter, RouterProvider } from "react-router-dom";

import Login from "./pages/Login/Login";
import Signup from "./pages/Signup/Signup";
import NotFound from "./pages/NotFound";
import VerifyEmail from "./pages/VerifyEmail/VerifyEmail";
import VerificationSuccess from "./pages/EmailVerificationSuccess/EmailVerificationSuccess";
import EmailVerificationExpired from "./pages/EmailVerificationExpired/EmailVerificationExpired";
import ListItem from "./pages/ListItem/ListItem";
import Home from "./pages/Home/Home";

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
  {
    path: "/home",
    element: <Home />,
  },
  

  {
    path: "*",
    element: <NotFound />,
  },
]);

function App() {
  return (
    <>
      <RouterProvider router={router} />
    </>
  );
}

export default App;

import { createBrowserRouter, RouterProvider, Link } from "react-router-dom";

import GettingStarted from "./pages/GettingStarted";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

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
    path: "/",
    element: <GettingStarted />,
  },
  {
    path: "/login",
    element: <Login />,
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

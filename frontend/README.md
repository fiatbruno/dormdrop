# CSC 305 Starter Code: Frontend

This directory contains a frontend web application written using
[React](https://react.dev/). The project uses
[Vite](https://vite.dev/) to build.

## Running

To run the application locally, first install dependencies:

``` shell
$ npm install
```

Then start the development server:

``` shell
$ npm run dev
```

## Project Structure

The root directory of the project contains the projects `package.json`
and `vite.config.js`, as well as the main `index.html`. (You likely
want to change the `title` in the latter.)

### Public

The `public` directory contains static assets that the application
should serve. It currently contains the site's
[favicon](https://en.wikipedia.org/wiki/Favicon), the small icon
that represents the site in browser tabs and bookmarks.

### Source Code

The `src` directory contains the source JavaScript and CSS which
generates the site. The main entry point for the application is
`src/App.jsx`, which essentially just wraps a router to load the
different views in `src/pages`.

The `src/pages` directory contains different high-level views for the
site. It starts with the following:

  + `GettingStarted.jsx` gives some helpful information for
    getting started with this project, as well as an example
    API call to test connection with the backend.

  + `Login.jsx` gives an example login page to help get you
    started with user authentication.

  + `NotFound.jsx` is a simple 404 page that displays whenever
    a browser requests a page that doesn't exist. (As with any
    of the starter code, you are welcome to customize this page
    as you see fit.)

The `src/api/` directory contains a `backendApi.js` file which sets up
API interaction using the Axios library. (See comments in that file
for more.)

The `src/assets` directory contains static files that are part of the
site. Currently it contains the Augustana logo that displays on the
"Getting Started" page.

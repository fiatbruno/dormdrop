# CSC 305 Starter Code: Backend

This directory contains a backend server written in Java using the
[Spring Boot](https://spring.io/projects/spring-boot) framework.

The main entry point for the application is `Application.java` in the
root directory. See `resources/application.properties` for other
application-wide settings.

## Running the Application

You can run the service locally either from your IDE or the command
line. From your IDE, run the main entry point at
`src/main/java/.../project/Application.java`. From the command line,
run with [Maven](https://maven.apache.org/):

``` shell
$ mvn spring-boot:run
```

### Environment Variables

Running the application *requires* the following environment variables
to be set:

  + `MONGODB_URI`: the URI for your backing MongoDB cluster. The URI
    should include your credentials (username and password).
  + `JWT_SECRET`: a base-64 encoded secret key for generating JWT
    tokens, which are used as part of user authentication. You can
    generate a key on the command line by saying `openssl rand -base64
    32`, or by using a website like
    [this one](https://randomkeygen.com/jwt-secret).

Set `APP_FRONTEND_URL` to the public frontend URL (for example,
`https://dormdrop.example.edu`) so password-reset emails link to the deployed
site and verification redirects return there. Set `APP_BACKEND_URL` to the
public backend base URL, without the API prefix (for example,
`https://api.dormdrop.example.edu`); verification email links append the
configured `api.prefix`. These default to `http://localhost:5173` and
`http://localhost:8080` for local development. Set
`MAIL_USERNAME` and `MAIL_PASSWORD` for the configured SMTP account as well.

First administrator provisioning is disabled by default. To bootstrap a new,
empty database, set `ADMIN_BOOTSTRAP_ENABLED=true`, `ADMIN_EMAIL` to an
Augustana address, and `ADMIN_PASSWORD` to a password of at least eight
characters. `ADMIN_NAME` is optional and defaults to `Administrator`. Startup
fails on invalid bootstrap configuration. Provisioning only runs when the user
collection is empty; it never promotes or changes an existing account. Disable
the flag after provisioning and keep the credentials out of source control.

The bootstrapped administrator starts with an **unverified** email, just like
other accounts. Use the normal resend-verification flow to send a verification
link, and complete that flow before treating the account as a verified campus
member. Bootstrap itself does not send a verification email.

In your IDE, set environment variables in your run configuration. In
the shell, set them with `export`. You may find it helpful to store
your environment variables in a `.env` file, **just be sure not to
commit this file to git**.

## Project Structure

### Current user and capabilities

`GET /api/v1/users/me` requires a bearer JWT and returns `id`, `name`,
`email`, `emailVerified`, `campus`, `aboutYou`, `role`, and `capabilities`.
`role` is `STUDENT`, `MODERATOR`, or `ADMIN`; a legacy missing or null role
is treated as `STUDENT`. `capabilities` is a stable, ordered array of names
defined by `PermissionPolicy.Capability`. Students receive `MARKETPLACE`,
`OWN_REPORTS`, and `OWN_APPEALS`. Moderators also receive `REVIEW_REPORTS`,
`REVIEW_EVIDENCE`, `ASSIGN_CASES`, `MODERATE_LISTINGS`, `ISSUE_WARNINGS`,
`VIEW_SELLER_CONTEXT`, `MANAGE_INTERNAL_NOTES`, and `VIEW_SCOPED_ACTIVITY`.
Admins additionally receive `MANAGE_SUSPENSIONS`, `DECIDE_APPEALS`,
`MANAGE_ROLES`, `MANAGE_CAMPUS_POLICY`, `VIEW_CAMPUS_ACTIVITY`, and
`VIEW_MEMBER_DIRECTORY`. The role and capabilities come from the current
stored account on each request, so an existing JWT reflects role changes.
Unauthenticated requests return 401. Capabilities guide the UI; the server
still enforces access. No restriction summary is included yet.

### Listing search

`GET /api/v1/home` accepts an optional `q` parameter. After trimming,
an empty or absent `q` applies no search filter. Nonempty queries are split
into words, each of which must appear as a case-insensitive literal substring
in the title, description, or category. Words can appear in any order and in
different fields. Queries over 200 characters
after trimming receive HTTP 400. Search combines with the existing filters;
the response remains the same listing array in the same order.

MongoDB evaluates the substring search along with the existing filters and
sort. Case-insensitive substring matching can require scanning candidates;
inspect query plans on representative data before adding indexes. Database-backed
search tests run when `MONGODB_TEST_URI` points
to a MongoDB instance; they create and drop an isolated test database.

The starter code ships with the following packages:

### Config

The `config` package contains two pieces of Spring Boot configuration:

  + `ApiPrefixConfig.java` sets a common prefix (`api/v1`) on all API
     endpoints.
  + `MongoCodecConfig.java` configures Mongo's POJO codex so that you can
     more seamlessly use model classes in MongoDB queries.

This configuration code is designed to make your project implementation
easier, but you are of course welcome to modify it however you want.

### Controller

A "controller" is a piece of code that handles responding to a sever
request. The `controller` package contains the following `RestController`s:

  + `AuthController.java` handles user authentication requests.
  + `HealthCheckController.java` exposes a single endpoint which simply
    responds "OK" to indicate the server is running.

Note that each controller class is annotated as a `@RestController`, which
is how Spring Boot knows to instantiate the class for handling service
requests. Note also the annotations like `@RequestMapping` and `@PostMapping`.
These are what tell Spring Boot the *routes* to your request handlers; these
are the paths to your REST API endpoints.

### DTO

The `dto` package defines the data structures we want to use in our API
interaction. (We had some slides depicting DTOs in our lecture on API
design that might be a useful reference if you've forgotten how DTOs
are used.) Spring Boot will convert these objects to and from JSON when
handling API requests and responses.

The starter code contains a basic `UserDto` class. You will likely want
to modify the starter code and define your own DTOs.

### Model

The `model` package defines the data structures we want to use in our
database interaction. (We had some slides depicting model objects in our
lecture on API design that might be a useful reference if you've forgotten
what model objects are.) Data in these classes will be automatically
converted to and from BSON as part of MongoDB interactions.

The starter code contains a basic `User` model class. You will likely want
to modify the starter code and define your own model classes.

### Repository

A `Repository` handles making calls to the MongoDB API to interact with
the backing database. Currently, the `repository` package contains a
`UserRepository` class which handles some basic reading and writing of
`User` data.

The starter implementation of `UserRepository` uses the MongoDB API directly
to illustrate how the repository class operates. Once you are comfortable
writing queries in this way and understand how the repository pattern works,
you may transition to automatically generating repositories with
[Spring Data MongoDB](https://spring.io/guides/gs/accessing-data-mongodb).

### Security

*Warning: The user authentication in this project is optimized for making the
project understandable for CSC 305 students.* While this project strives to use
widely accepted authentication best practices, you should do your homework on
what kind of authentication is right for you before deploying in real-world
applications.

The `security` package contains some code to get you started with user
authentication:

  + `AdminSeeder.java` optionally provisions the first administrator for an
    empty database when explicitly enabled and configured.
  + `JwtService.java` is responsible for generating and verifying
    [JWT tokens](https://en.wikipedia.org/wiki/JSON_Web_Token).
  + `JwtAuthenticationFilter.java` checks the token sent with each request
    (in its `Authorization: Bearer <token>` header) and marks the request as
    authenticated if the token is valid. In a controller, you can get the
    logged-in user's email with a parameter like
    `@AuthenticationPrincipal String email`.
  + `LoginRequest.java` and `LoginResponse.java` specify the input and output
    data format for login requests.
  + `SecurityConfig.java` contains Spring Boot configuration for handling
    user authentication and secure endpoints.

You should be able to get started with authenticated users using this
scaffolding, but you may need to learn more about authenticated REST
if you want to build more security infrastructure.
[This Spring Boot tutorial](https://spring.io/guides/gs/securing-web)
is a good starting point.

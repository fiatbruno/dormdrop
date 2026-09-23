import React, { useState } from 'react';
import api from '../api/backendApi.js';
import './Login.css';

/*
 * A simple login page to help you get started with authenticating
 * users.
 */
function Login() {

  // This component needs to track state, namely the user's credentials
  // and a possible error message.
  //
  // To declare UI state in react, call the `useState` function. This
  // function takes as input the initial state, and outputs both an
  // object with that state and setter. For example, saying:
  //
  //   [isCold, setCold] = useState(true)
  //
  // gives us a state `isCold` and a function `setCold`. The value of
  // `isCold` is initially `true`, but will change if `setCold` is
  // called. Crucially, whenever `setCold` is called, any UI
  // componenent that depends on the value of `isCold` will
  // automatically be re-rendered.
  //
  // Here we set up state for user credentials and an error message:
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  // This is a function that gets called whenever the email or password
  // text field is updated by the user.
  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  // This is a function that gets called when the login button is clicked.
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Call the login endpoint. On success, store the authorization
      // token.
      const response = await api.post('auth/login', credentials);
      localStorage.setItem('token', response.data.token);

      // ***
      // ***  Instead of alert(...), redirect to authenticated home
      // ***  screen (or wherever you want to go after login) here.
      // ***
      alert('Login successful!');
    } catch (err) {
      // On failure, set an error message.
      setError('Invalid email or password.');
    }
  };

  // We are now ready to construct and return the login page HTML.
  return (
    <div id="loginPage">
      <h1>Login</h1>
      <form onSubmit={handleSubmit}>
        <div className="input">
          <label htmlFor="email">Email:</label>
          <input type="text" id="email" name="email" onChange={handleChange} className="credentialField" />
        </div>
        <div className="input">
          <label htmlFor="password">Password:</label>
          <input type="password" id="password" name="password" onChange={handleChange} className="credentialField" />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="submit">Submit</button>
      </form>
    </div>
  );
};

export default Login;

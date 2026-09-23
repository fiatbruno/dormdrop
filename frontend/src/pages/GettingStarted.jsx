import React, { useState, useEffect } from 'react';
import api from '../api/backendApi.js';

import augustanaLogo from '../assets/augustana-logo.png'
import './GettingStarted.css'

/*
 * A component which attempts to talk to the backend and
 * displays "OK" if the connection succeeded, and "FAILED"
 * otherwise.
 */
function BackendConnection() {
  const [healthy, setHealthy] = useState(false);

  useEffect(() => {
    api.get('/healthCheck')
      .then(response => {
        setHealthy(true);
      })
      .catch(error => {
        setHealthy(false);
      });
  }, []);

  if (healthy) {
    return <span className="success">OK</span>
  } else {
    return <span className="failure">FAILED</span>
  }
}

/*
 * A "getting started" page that shows some information to help
 * start working with the project frontend.
 */
function GettingStarted() {
  return (
    <>
      <div id="header">
        <img src={augustanaLogo} width="200" alt="Round Augustana logo" />
        <h1>CSC 305 Frontend Starter Code</h1>
      </div>
      <div id="backendConnection">
        Connection to backend: <BackendConnection />
      </div>
      <div id="getting-started">
        <h2>Getting Started</h2>
        <p>
          Take a look above to see if your backend service is running. (You'll see a green "OK" if a test call to the backed service succeeded, and a red "FAILED" if not.)
        </p><br/>
        <p>
          Try making a small edit to <code>src/App.jsx</code> or <code>src/pages/GettingStarted.jsx</code>. After you save your edit, you should see this page automatically update to reflect the change.
        </p><br/>
        A list of some of the technologies used in this application is given below. The <a href="https://developer.mozilla.org/en-US/">Mozilla Developer Network (MDN)</a> is a good resource for more on HTML, CSS, and JavaScript.
      </div>
      <div id="documentation">
        <h2>Technologies</h2>
        <p>This project uses <a href="https://react.dev/">React</a>, a <a href="https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting">JavaScript</a> framework.</p>
        <p>React serves pages in <a href="https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content">HTML</a>.</p>
        <p>Styling is handled with <a href="https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics">CSS</a>.</p>
        <p>Project builds are managed by <a href="https://vite.dev/">Vite</a>.</p>
        <p>API calls happen using the <a href="https://www.digitalocean.com/community/tutorials/react-axios-react">Axios</a> library.</p>
      </div>
    </>
  )
}

export default GettingStarted;

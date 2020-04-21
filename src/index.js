import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';

import CogitatorComponent from './components/cogitator.js';
import QuotationsComponent from './components/quotations.js';

import Firebase, { FirebaseContext } from './components/firebase';

ReactDOM.render(
  <React.StrictMode>
    <FirebaseContext.Provider value={new Firebase()}>
      <div id="page-container">
        <nav>
          <a href="#home">Home</a>
          <a href="#contact">Contact</a>
        </nav>

        <img id="skull" src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/clans/11027763/1b71819403d5c8c398f62e6d888703853ec24cd2.png" />

        <article id="content-wrap">
          <CogitatorComponent />
          <QuotationsComponent />
        </article>
        <footer>
          Footer text
        </footer>
      </div>
    </FirebaseContext.Provider>
  </React.StrictMode>,
  document.getElementById('root'),
);

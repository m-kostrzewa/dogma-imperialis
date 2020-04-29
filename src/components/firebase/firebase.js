import * as firebase from 'firebase';
import 'firebase/firestore';
import 'firebase/auth';

const config = {
  apiKey: 'AIzaSyAHXoy1DgjukC9DjN3JKdV6Nns3Lui5hqA',
  authDomain: 'dogma-imperialis.firebaseapp.com',
  databaseURL: 'https://dogma-imperialis.firebaseio.com',
  projectId: 'dogma-imperialis',
  storageBucket: 'dogma-imperialis.appspot.com',
  messagingSenderId: '676512219546',
  appId: '1:676512219546:web:bb8c0388fe3e9c2814ba23',
  measurementId: 'G-C8GJ8DKR7T',
};

class Firebase {
  constructor() {
    firebase.initializeApp(config);
    // app.analytics();
    this.db = firebase.firestore();
    this.authProvider = new firebase.auth.GoogleAuthProvider();
    this.authProvider.addScope('https://www.googleapis.com/auth/datastore');

    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        console.log(' user is ', firebase.auth().currentUser);
      } else {
        console.log(' no user ', firebase.auth().currentUser);
      }
      if (this.onSignCallback) {
        this.onSignCallback(user);
      }
    });
  }

  getCurrentUsername() {
    return firebase.auth().currentUser ? firebase.auth().currentUser.displayName : '';
  }

  signIn() {
    firebase.auth().signInWithRedirect(this.authProvider);
  }

  signOut() {
    firebase.auth().signOut();
  }

  setOnSignCallback(cb) {
    this.onSignCallback = cb;
  }
}

export default Firebase;

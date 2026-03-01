import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithRedirect, signOut as firebaseSignOut } from 'firebase/auth';

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
    const app = initializeApp(config);
    this.db = getFirestore(app);
    this.auth = getAuth(app);
    this.authProvider = new GoogleAuthProvider();
    this.authProvider.addScope('https://www.googleapis.com/auth/datastore');

    this.currentUser = null;
    onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.currentUser = user;
      } else {
        this.currentUser = null;
      }
      if (this.onSignCallback) {
        this.onSignCallback(user);
      }
    });
  }

  getCurrentUsername() {
    return this.auth.currentUser ? this.auth.currentUser.displayName : '';
  }

  signIn() {
    signInWithRedirect(this.auth, this.authProvider);
  }

  signOut() {
    firebaseSignOut(this.auth);
  }

  setOnSignCallback(cb) {
    this.onSignCallback = cb;
  }
}

export default Firebase;

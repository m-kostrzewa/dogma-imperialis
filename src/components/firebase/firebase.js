import * as firebase from 'firebase';
import 'firebase/firestore';

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
    console.log(config);
    firebase.initializeApp(config);
    // app.analytics();
    this.db = firebase.firestore();
  }
}

export default Firebase;

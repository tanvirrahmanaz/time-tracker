// Firebase client initialization using your config
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyB27uL8ekv7q-pFcT-Kg0sHcEPkOBKDAMU",
  authDomain: "time-tracker-bd.firebaseapp.com",
  projectId: "time-tracker-bd",
  storageBucket: "time-tracker-bd.firebasestorage.app",
  messagingSenderId: "225421320673",
  appId: "1:225421320673:web:cb0a004b5e0e091e9b72a0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();


import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBiuX4eQjRXP-kRK0s8w-rxp3v2PJpR6SE",
  authDomain: "content-partnerships-status.firebaseapp.com",
  projectId: "content-partnerships-status",
  storageBucket: "content-partnerships-status.firebasestorage.app",
  messagingSenderId: "994875499391",
  appId: "1:994875499391:web:2ace01420b2ca38c9ab04a"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

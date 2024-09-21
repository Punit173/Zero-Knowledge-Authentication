// firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

// Firebase configuration (use environment variables for security)
const firebaseConfig = {
    apiKey: "AIzaSyBAUhQnvst1RvP-JQfcoeR80ui4VstKK6Y",
    authDomain: "testing-88bc3.firebaseapp.com",
    databaseURL: "https://testing-88bc3-default-rtdb.firebaseio.com",
    projectId: "testing-88bc3",
    storageBucket: "testing-88bc3.appspot.com",
    messagingSenderId: "633592353172",
    appId: "1:633592353172:web:5fa3678eacc9125a90bf81",
    measurementId: "G-DX55Q8CSS2"
    
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Services
const auth = getAuth(app);
const db = getFirestore(app); // Firestore instance
const realtimeDb = getDatabase(app); // Realtime Database instance

export { app, auth, db, realtimeDb };

// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // Import Firestore

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, // Replace with your actual web API key from Firebase Project Settings
  authDomain: "major-pro-8b1c9.firebaseapp.com",
  projectId: "major-pro-8b1c9", // Firestore connects completely via your project ID
  storageBucket: "major-pro-8b1c9.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, // Replace with your actual Sender ID
  appId: import.meta.env.VITE_FIREBASE_APP_ID // Replace with your actual App ID
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Export Authentication and Firestore (completely independent of Realtime Database)
export const auth = getAuth(app);
export const db = getFirestore(app); 

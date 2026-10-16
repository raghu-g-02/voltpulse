// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // Import Firestore

const firebaseConfig = {
  apiKey: "AIzaSyCbgYhbUbm2q9IQTLvmPTOX5upfKv6YrkI", // Replace with your actual web API key from Firebase Project Settings
  authDomain: "major-pro-8b1c9.firebaseapp.com",
  projectId: "major-pro-8b1c9", // Firestore connects completely via your project ID
  storageBucket: "major-pro-8b1c9.appspot.com",
  messagingSenderId: "147348529576", // Replace with your actual Sender ID
  appId: "1:147348529576:web:d98924e985541c5e337d9d" // Replace with your actual App ID
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Export Authentication and Firestore (completely independent of Realtime Database)
export const auth = getAuth(app);
export const db = getFirestore(app); 

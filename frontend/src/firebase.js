/**
 * Firebase configuration for Learn_64.
 */
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyBTjfOPshLrZNflOHAK4wQWKYad-uFKzRE",
  authDomain: "chess-46e00.firebaseapp.com",
  projectId: "chess-46e00",
  storageBucket: "chess-46e00.firebasestorage.app",
  messagingSenderId: "974958328730",
  appId: "1:974958328730:web:18d21fc2fea4a83ed2d823",
  measurementId: "G-MKFCWD8EPZ",
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export default app

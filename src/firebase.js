import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC7CotYEoHoQTSXjrMjrjtVcuUOImmqAuE",
  authDomain: "kavach-503eb.firebaseapp.com",
  projectId: "kavach-503eb",
  storageBucket: "kavach-503eb.firebasestorage.app",
  messagingSenderId: "552895889692",
  appId: "1:552895889692:web:b353e24287452df413fad9",
  measurementId: "G-KH5QXKMECS"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;

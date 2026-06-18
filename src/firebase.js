import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCRvnt34XsXwwlbARGV9mfZlGO3oh0QlpU",
  authDomain: "kavach-7a032.firebaseapp.com",
  projectId: "kavach-7a032",
  storageBucket: "kavach-7a032.firebasestorage.app",
  messagingSenderId: "563808813936",
  appId: "1:563808813936:web:55add17d8bc5d62cbb05b5",
  measurementId: "G-9F6HDX97DF"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export default app;

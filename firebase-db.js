import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCamdr2XG0gKIUrPPCFP9mkTELyZnQc3eo",
  authDomain: "twze3-f8b36.firebaseapp.com",
  projectId: "twze3-f8b36",
  storageBucket: "twze3-f8b36.firebasestorage.app",
  messagingSenderId: "802913095152",
  appId: "1:802913095152:web:a46e4fa5185d5a42ece135",
  measurementId: "G-SGZN8ZBFW0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DOC_REF = doc(db, 'schedule_app', 'main_data');

export async function fetchScheduleData() {
    try {
        const docSnap = await getDoc(DOC_REF);
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return {
                teachers: [],
                homeroomAssignments: {},
                tableState: {}
            };
        }
    } catch (e) {
        console.error("Error fetching document: ", e);
        return null;
    }
}

export async function saveScheduleData(data) {
    try {
        await setDoc(DOC_REF, data, { merge: true });
    } catch (e) {
        console.error("Error writing document: ", e);
    }
}

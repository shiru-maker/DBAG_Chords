// Music Team Chords App - Firebase Version
let songs = [];
let selectedId = null;

// Admin password
const ADMIN_PASSWORD = "shiru0123";

// Musical notes
const sharpNotes = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const flatNotes  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

// ---------- FIREBASE SETUP ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const songsRef = collection(db, "songs");

// ---------- CHORD FUNCTIONS ----------
function isChord(word) {
    return /^([A-G](#|b)?)(m|maj|min|dim|aug|sus|add|7|9|11|13)?[0-9]*$/i.test(word);
}

function transposeChord(chord, step) {
    let m = chord.match(/^([A-G](#|b)?)(.*)/i);
    if (!m) return chord;
    let root = m[1], suffix = m[3];
    let scale = sharpNotes.includes(root) ? sharpNotes : flatNotes;
    let idx = scale.indexOf(root);
    return scale[(idx + step + 12) % 12] + suffix;
}

function highlight(text) {
    return text.split("\n")
        .map(line => line.split(" ")
            .map(w => isChord(w) ? `<span class="chord">${w}</span>` : w)
            .join(" "))
        .join("\n");
}

// ---------- SHOW / SEARCH ----------
function showSongs(list = songs) {
    const container = document.getElementById("songList");
    container.innerHTML = "";
    list.forEach(song => {
        const div = document.createElement("div");
        div.className = "song-item";
        div.innerHTML = `<strong>${song.title}</strong><br><small>${song.artist || ""}</small>`;
        div.onclick = () => selectSong(song.id);
        container.appendChild(div);
    });
}

function searchSongs() {
    const q = document.getElementById("search").value.toLowerCase();
    showSongs(songs.filter(s => s.title.toLowerCase().includes(q)));
}

// ---------- SELECT SONG ----------
function selectSong(id) {
    const song = songs.find(s => s.id === id);
    if (!song) return;
    selectedId = id;
    document.getElementById("songHeader").innerText = `${song.title} (${song.key})`;
    document.getElementById("songChords").innerHTML = highlight(song.chords);
    document.getElementById("editDeleteButtons").style.display = "none";
}

// ---------- ADMIN CHECK ----------
function checkAdmin(callback) {
    const pass = prompt("Enter admin password:");
    if (pass === ADMIN_PASSWORD) callback();
    else alert("Incorrect password. Only Admin can perform this action.");
}

// ---------- ADD SONG ----------
function showAddForm() {
    checkAdmin(() => {
        document.getElementById("editorCard").style.display = "block";
        document.getElementById("title").value = "";
        document.getElementById("artist").value = "";
        document.getElementById("key").value = "";
        document.getElementById("chords").value = "";
        selectedId = null;
    });
}

async function addSong() {
    const title = document.getElementById("title").value.trim();
    if (!title) return alert("Title required!");

    await addDoc(songsRef, {
        title,
        artist: document.getElementById("artist").value.trim(),
        key: document.getElementById("key").value.trim(),
        chords: document.getElementById("chords").value.trim(),
        createdAt: Date.now()
    });

    hideEditor();
}

// ---------- EDIT SONG ----------
function showEditForm() {
    if (!selectedId) return alert("Select a song first");
    checkAdmin(() => {
        const song = songs.find(s => s.id === selectedId);
        document.getElementById("editorCard").style.display = "block";
        document.getElementById("title").value = song.title;
        document.getElementById("artist").value = song.artist;
        document.getElementById("key").value = song.key;
        document.getElementById("chords").value = song.chords;
    });
}

async function editSong() {
    if (!selectedId) return alert("No song selected");
    const title = document.getElementById("title").value.trim();
    if (!title) return alert("Title is required");

    await updateDoc(doc(db, "songs", selectedId), {
        title,
        artist: document.getElementById("artist").value.trim(),
        key: document.getElementById("key").value.trim(),
        chords: document.getElementById("chords").value.trim()
    });

    hideEditor();
}

// ---------- DELETE SONG ----------
function deleteSong() {
    if (!selectedId) return alert("Select a song first");
    checkAdmin(async () => {
        if (!confirm("Are you sure you want to delete this song?")) return;
        await deleteDoc(doc(db, "songs", selectedId));
        selectedId = null;
        document.getElementById("songHeader").innerText = "Select a song from the list or add a new song.";
        document.getElementById("songChords").innerText = "";
        document.getElementById("editDeleteButtons").style.display = "none";
    });
}

// ---------- TRANSPOSE ----------
function transpose(step) {
    if (!selectedId) return;
    const song = songs.find(s => s.id === selectedId);
    song.chords = song.chords.split("\n")
        .map(line => line.split(" ")
            .map(w => isChord(w) ? transposeChord(w, step) : w)
            .join(" "))
        .join("\n");
    updateDoc(doc(db, "songs", selectedId), { chords: song.chords });
    selectSong(selectedId);
}

// ---------- HIDE EDITOR ----------
function hideEditor() {
    document.getElementById("editorCard").style.display = "none";
}

function setupEventHandlers() {
    const byId = id => document.getElementById(id);

    byId("search")?.addEventListener("keyup", searchSongs);
    byId("btnAddSong")?.addEventListener("click", showAddForm);
    byId("btnAdd")?.addEventListener("click", addSong);
    byId("btnSaveEdit")?.addEventListener("click", editSong);
    byId("btnCancel")?.addEventListener("click", hideEditor);
    byId("btnTransposeUp")?.addEventListener("click", () => transpose(1));
    byId("btnTransposeDown")?.addEventListener("click", () => transpose(-1));
    byId("btnShowEdit")?.addEventListener("click", showEditForm);
    byId("btnDelete")?.addEventListener("click", deleteSong);
}

// ---------- REAL-TIME LOAD ----------
onSnapshot(songsRef, snapshot => {
    songs = [];
    snapshot.forEach(doc => {
        songs.push({ id: doc.id, ...doc.data() });
    });
    showSongs();
});

// ---------- INITIALIZE ----------
setupEventHandlers();
showSongs();

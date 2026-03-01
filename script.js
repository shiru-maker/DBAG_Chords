// Music Team Chords App - Firebase Version
let songs = [];
let selectedId = null;

// Admin password
const ADMIN_PASSWORD = "shiru0123";

// ---------- FIREBASE SETUP ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const songsRef = collection(db, "songs");

// ---------- HELPERS ----------
function isChord(word) {
  return /^([A-G](#|b)?)(m|maj|min|dim|aug|sus|add|7|9|11|13)?[0-9]*$/i.test(word);
}

function highlight(text = "") {
  return text.split("\n").map(line =>
    line.split(" ").map(w => isChord(w) ? `<span class="chord">${w}</span>` : w).join(" ")
  ).join("\n");
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
  document.getElementById("songHeader").innerText = `${song.title} (${song.key || ""})`;
  document.getElementById("songChords").innerHTML = highlight(song.chords);
  document.getElementById("editDeleteButtons").style.display = "flex";
}

// ---------- ADMIN CHECK ----------
function checkAdmin(callback) {
  const pass = prompt("Enter admin password:");
  if (pass === ADMIN_PASSWORD) callback();
  else alert("Unauthorized");
}

// ---------- ADD SONG ----------
function showAddForm() {
  checkAdmin(() => {
    document.getElementById("editorCard").style.display = "block";
    title.value = "";
    artist.value = "";
    key.value = "";
    chords.value = "";
    selectedId = null;
  });
}

async function addSong() {
  if (!title.value.trim()) return alert("Title required!");
  await addDoc(songsRef, {
    title: title.value.trim(),
    artist: artist.value.trim(),
    key: key.value.trim(),
    chords: chords.value.trim(),
    createdAt: Date.now()
  });
  hideEditor();
}

// ---------- EDIT SONG ----------
function showEditForm() {
  if (!selectedId) return alert("Select a song first");
  checkAdmin(() => {
    const s = songs.find(x => x.id === selectedId);
    editorCard.style.display = "block";
    title.value = s.title;
    artist.value = s.artist;
    key.value = s.key;
    chords.value = s.chords;
  });
}

async function editSong() {
  if (!selectedId) return;
  await updateDoc(doc(db, "songs", selectedId), {
    title: title.value.trim(),
    artist: artist.value.trim(),
    key: key.value.trim(),
    chords: chords.value.trim()
  });
  hideEditor();
}

// ---------- DELETE SONG ----------
function deleteSong() {
  if (!selectedId) return alert("Select a song first");
  checkAdmin(async () => {
    if (!confirm("Delete this song?")) return;
    await deleteDoc(doc(db, "songs", selectedId));
    selectedId = null;
    songHeader.innerText = "Select a song from the list or add a new song.";
    songChords.innerText = "";
    editDeleteButtons.style.display = "none";
  });
}

// ---------- HIDE EDITOR ----------
function hideEditor() { editorCard.style.display = "none"; }

// ---------- EVENTS ----------
search.addEventListener("keyup", searchSongs);
btnAddSong.addEventListener("click", showAddForm);
btnAdd.addEventListener("click", addSong);
btnSaveEdit.addEventListener("click", editSong);
btnCancel.addEventListener("click", hideEditor);
btnShowEdit.addEventListener("click", showEditForm);
btnDelete.addEventListener("click", deleteSong);

// ---------- REALTIME LOAD ----------
onSnapshot(songsRef, snapshot => {
  songs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  showSongs();
});
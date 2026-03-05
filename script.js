import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const STORAGE_KEY = "musicTeamChords.v1";

// ===== EDIT THIS TO CHANGE PASSWORD =====
const EDIT_PASSWORD = "MTChord@2026";
// ========================================

const FIREBASE_CONFIG = {
  apiKey: "PASTE_API_KEY_HERE",
  authDomain: "PASTE_AUTH_DOMAIN_HERE",
  projectId: "PASTE_PROJECT_ID_HERE",
  storageBucket: "PASTE_STORAGE_BUCKET_HERE",
  messagingSenderId: "PASTE_MESSAGING_SENDER_ID_HERE",
  appId: "PASTE_APP_ID_HERE",
};


const CLOUD_COLLECTION = "sharedChordData";
const CLOUD_DOCUMENT = "music-team-chords";

const chordListEl = document.getElementById("chordList");
const countBadgeEl = document.getElementById("countBadge");
const searchInputEl = document.getElementById("searchInput");

const modalOverlayEl = document.getElementById("modalOverlay");
const modalTitleEl = document.getElementById("modalTitle");
const chordFormEl = document.getElementById("chordForm");

const chordIdEl = document.getElementById("chordId");
const titleEl = document.getElementById("title");
const artistEl = document.getElementById("artist");
const keyEl = document.getElementById("key");
const bpmEl = document.getElementById("bpm");
const tagsEl = document.getElementById("tags");
const chordsEl = document.getElementById("chords");

const newChordBtn = document.getElementById("newChordBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelBtn = document.getElementById("cancelBtn");

const cardTemplate = document.getElementById("chordCardTemplate");

const SHARP_SCALE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_SCALE = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NOTE_INDEX = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

let chords = [];
let filterText = "";
let cloudDocRef = null;
let cloudWriteTimer = null;
let suppressRemoteApply = false;

newChordBtn.addEventListener("click", () => openModal());
closeModalBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);
modalOverlayEl.addEventListener("click", () => {
  // Prevent accidental close when clicking outside the modal.
});

searchInputEl.addEventListener("input", (event) => {
  filterText = event.target.value.trim().toLowerCase();
  render();
});

chordFormEl.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!assertEditorAccess("save chords")) return;

  const payload = {
    id: chordIdEl.value || crypto.randomUUID(),
    title: titleEl.value.trim(),
    artist: artistEl.value.trim(),
    key: keyEl.value.trim(),
    bpm: bpmEl.value.trim(),
    tags: parseTags(tagsEl.value),
    chords: chordsEl.value.trim(),
    updatedAt: new Date().toISOString(),
  };

  const existingIdx = chords.findIndex((entry) => entry.id === payload.id);
  if (existingIdx >= 0) {
    chords[existingIdx] = payload;
  } else {
    chords.unshift(payload);
  }

  persist();
  render();
  closeModal();
});

initialize();

async function initialize() {
  chords = loadChordsFromLocal();
  render();

  setupCloudSync();
  await hydrateFromCloud();
  subscribeToCloudChanges();
}

function render() {
  chordListEl.innerHTML = "";

  const filtered = chords.filter(matchesFilter);
  countBadgeEl.textContent = `${filtered.length} song${filtered.length === 1 ? "" : "s"}`;

  if (!filtered.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.innerHTML =
      filterText.length > 0
        ? "<strong>No matches.</strong><br />Try a different search term."
        : "<strong>No chords saved yet.</strong><br />Click <em>New Chord</em> to start.";
    chordListEl.appendChild(emptyState);
    return;
  }

  for (const chord of filtered) {
    const fragment = cardTemplate.content.cloneNode(true);

    fragment.querySelector(".card-title").textContent = chord.title || "Untitled Song";
    fragment.querySelector(".card-meta").textContent = buildMeta(chord);
    fragment.querySelector(".key-pill").textContent = chord.key ? `Key ${chord.key}` : "No Key";
    fragment.querySelector(".card-tags").textContent =
      chord.tags.length ? `#${chord.tags.join(" #")}` : "No tags";
    fragment.querySelector(".card-content").innerHTML = highlightChordSheet(chord.chords);

    fragment
      .querySelector(".transpose-up")
      .addEventListener("click", () => transposeChord(chord.id, 1));
    fragment
      .querySelector(".transpose-down")
      .addEventListener("click", () => transposeChord(chord.id, -1));
    fragment.querySelector(".edit-btn").addEventListener("click", () => openModal(chord.id));
    fragment.querySelector(".delete-btn").addEventListener("click", () => removeChord(chord.id));

    chordListEl.appendChild(fragment);
  }
}

function openModal(chordId = "") {
  if (!assertEditorAccess("add or edit chords")) return;

  chordFormEl.reset();
  chordIdEl.value = "";

  if (chordId) {
    const chord = chords.find((entry) => entry.id === chordId);
    if (!chord) return;

    modalTitleEl.textContent = "Edit Chord";
    chordIdEl.value = chord.id;
    titleEl.value = chord.title;
    artistEl.value = chord.artist;
    keyEl.value = chord.key;
    bpmEl.value = chord.bpm;
    tagsEl.value = chord.tags.join(", ");
    chordsEl.value = chord.chords;
  } else {
    modalTitleEl.textContent = "Add Chord";
  }

  modalOverlayEl.classList.remove("hidden");
  modalOverlayEl.setAttribute("aria-hidden", "false");
  titleEl.focus();
}

function closeModal() {
  modalOverlayEl.classList.add("hidden");
  modalOverlayEl.setAttribute("aria-hidden", "true");
}

function removeChord(chordId) {

  const song = chords.find((entry) => entry.id === chordId);
  if (!song) return;

  const confirmed = window.confirm(`Delete "${song.title || "Untitled Song"}"?`);
  if (!confirmed) return;

  chords = chords.filter((entry) => entry.id !== chordId);
  persist();
  render();
}

function buildMeta(chord) {
  const artist = chord.artist || "Unknown artist";
  const bpm = chord.bpm ? `${chord.bpm} BPM` : "No BPM";
  return `${artist} - ${bpm}`;
}

function matchesFilter(chord) {
  if (!filterText) return true;
  const haystack = [chord.title, chord.artist, chord.key, chord.tags.join(" "), chord.chords]
    .join(" ")
    .toLowerCase();
  return haystack.includes(filterText);
}

function parseTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeChordEntries(list) {
  return Array.isArray(list)
    ? list.map((entry) => ({
        id: entry.id || crypto.randomUUID(),
        title: entry.title || "",
        artist: entry.artist || "",
        key: entry.key || "",
        bpm: entry.bpm || "",
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        chords: entry.chords || "",
        updatedAt: entry.updatedAt || "",
      }))
    : [];
}

function loadChordsFromLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeChordEntries(JSON.parse(raw));
  } catch {
    return [];
  }
}

function persist() {
  persistLocal();
  scheduleCloudWrite();
}

function persistLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chords));
}

function hasValidFirebaseConfig() {
  return Object.values(FIREBASE_CONFIG).every(
    (value) => typeof value === "string" && value.length > 0 && !value.startsWith("PASTE_")
  );
}

function setupCloudSync() {
  if (!hasValidFirebaseConfig()) {
    console.warn("Cloud sync disabled: add your Firebase config in script.js.");
    return;
  }

  try {
    const app = initializeApp(FIREBASE_CONFIG);
    const db = getFirestore(app);
    cloudDocRef = doc(db, CLOUD_COLLECTION, CLOUD_DOCUMENT);
  } catch (error) {
    console.error("Cloud sync setup failed:", error);
  }
}
function assertEditorAccess(actionLabel) {
  const enteredPassword = window.prompt(`Enter edit password to ${actionLabel}:`);
  if (!enteredPassword) return false;

  if (enteredPassword !== EDIT_PASSWORD) {
    window.alert("Wrong password.");
    return false;
  }

  return true;
}

async function hydrateFromCloud() {
  if (!cloudDocRef) return;

  try {
    const snapshot = await getDoc(cloudDocRef);
    if (!snapshot.exists()) {
      if (chords.length > 0) {
        scheduleCloudWrite();
      }
      return;
    }

    const cloudChords = normalizeChordEntries(snapshot.data()?.chords);
    chords = mergeChordLists(chords, cloudChords);
    persistLocal();
    render();
  } catch (error) {
    console.error("Cloud load failed, using local data only:", error);
  }
}

function subscribeToCloudChanges() {
  if (!cloudDocRef) return;

  onSnapshot(
    cloudDocRef,
    (snapshot) => {
      if (suppressRemoteApply || !snapshot.exists()) return;

      const cloudChords = normalizeChordEntries(snapshot.data()?.chords);
      const merged = mergeChordLists(chords, cloudChords);

      if (!areChordListsEqual(chords, merged)) {
        chords = merged;
        persistLocal();
        render();
      }
    },
    (error) => {
      console.error("Cloud live sync failed:", error);
    }
  );
}

function mergeChordLists(localList, cloudList) {
  const mergedById = new Map();

  for (const entry of localList) {
    mergedById.set(entry.id, entry);
  }

  for (const entry of cloudList) {
    const current = mergedById.get(entry.id);
    if (!current || toTimestamp(entry.updatedAt) >= toTimestamp(current.updatedAt)) {
      mergedById.set(entry.id, entry);
    }
  }

  return Array.from(mergedById.values()).sort(
    (a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt)
  );
}

function scheduleCloudWrite() {
  if (!cloudDocRef) return;

  clearTimeout(cloudWriteTimer);
  cloudWriteTimer = setTimeout(() => {
    void writeCloudData();
  }, 300);
}

async function writeCloudData() {
  if (!cloudDocRef) return;

  try {
    suppressRemoteApply = true;
    await setDoc(cloudDocRef, {
      chords,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cloud save failed:", error);
  } finally {
    setTimeout(() => {
      suppressRemoteApply = false;
    }, 120);
  }
}

function areChordListsEqual(a, b) {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i += 1) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) {
      return false;
    }
  }

  return true;
}

function toTimestamp(value) {
  const ts = Date.parse(value || "");
  return Number.isFinite(ts) ? ts : 0;
}

function transposeChord(chordId, semitones) {

  const chord = chords.find((entry) => entry.id === chordId);
  if (!chord) return;

  chord.chords = transposeSongText(chord.chords, semitones);
  chord.key = chord.key ? transposeChordToken(chord.key, semitones) : chord.key;
  chord.updatedAt = new Date().toISOString();

  persist();
  render();
}

function transposeSongText(text, semitones) {
  return text
    .split(/(\s+)/)
    .map((token) => transposeChordToken(token, semitones))
    .join("");
}

function transposeChordToken(token, semitones) {
  const match = token.match(/^([([{\'"`]*)(.*?)([)\]}\'".,!?;:]*)$/);
  if (!match) return token;

  const leading = match[1];
  const core = match[2];
  const trailing = match[3];
  if (!isChordCore(core)) return token;

  const slashMatch = core.match(/^([A-G](?:#|b)?)(.*?)(?:\/([A-G](?:#|b)?))?$/);
  if (!slashMatch) return token;

  const root = transposeNote(slashMatch[1], semitones);
  const body = slashMatch[2] || "";
  const bass = slashMatch[3] ? `/${transposeNote(slashMatch[3], semitones)}` : "";
  return `${leading}${root}${body}${bass}${trailing}`;
}

function transposeNote(note, semitones) {
  const index = NOTE_INDEX[note];
  if (index === undefined) return note;

  const nextIndex = (index + semitones + 12) % 12;
  const useFlats = note.includes("b");
  return useFlats ? FLAT_SCALE[nextIndex] : SHARP_SCALE[nextIndex];
}

function highlightChordSheet(text) {
  return text
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s+$/.test(token)) return token;

      const match = token.match(/^([([{\'"`]*)(.*?)([)\]}\'".,!?;:]*)$/);
      if (!match) return escapeHtml(token);

      const leading = match[1];
      const core = match[2];
      const trailing = match[3];

      if (!isChordCore(core)) return escapeHtml(token);

      return `${escapeHtml(leading)}<span class="chord-highlight">${escapeHtml(
        core
      )}</span>${escapeHtml(trailing)}`;
    })
    .join("");
}

function isChordCore(value) {
  if (!value) return false;
  if (value.toUpperCase() === "N.C." || value.toUpperCase() === "NC") return false;

  const match = value.match(/^([A-G](?:#|b)?)(.*?)(?:\/([A-G](?:#|b)?))?$/);
  if (!match) return false;

  const suffix = match[2] || "";
  return /^(?:(?:maj|min|dim|aug|sus|add|m|M|no)|[0-9()+#b-])*$/i.test(suffix);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}















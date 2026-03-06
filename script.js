const STORAGE_KEY = "musicTeamChords.v1";
const SCHEDULE_STORAGE_KEY = "musicTeamSchedule.v1";
const CHORDS_API_URL = "chords.json";


const chordListEl = document.getElementById("chordList");
const countBadgeEl = document.getElementById("countBadge");
const searchInputEl = document.getElementById("searchInput");

const modalOverlayEl = document.getElementById("modalOverlay");
const modalTitleEl = document.getElementById("modalTitle");
const chordFormEl = document.getElementById("chordForm");
const viewOverlayEl = document.getElementById("viewOverlay");
const viewTitleEl = document.getElementById("viewTitle");
const viewMetaEl = document.getElementById("viewMeta");
const viewKeyPillEl = document.getElementById("viewKeyPill");
const viewTagsEl = document.getElementById("viewTags");
const viewContentEl = document.getElementById("viewContent");

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
const schedulePlayBtn = document.getElementById("schedulePlayBtn");
const scheduleListEl = document.getElementById("scheduleList");
const closeViewBtn = document.getElementById("closeViewBtn");
const viewTransposeDownBtn = document.getElementById("viewTransposeDown");
const viewTransposeUpBtn = document.getElementById("viewTransposeUp");
const viewEditBtn = document.getElementById("viewEditBtn");

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
let syncErrorShown = false;
let pendingDeleteId = null;
let schedule = [];
let scheduleModeIndex = null;

newChordBtn.addEventListener("click", () => openModal());
closeModalBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);
schedulePlayBtn.addEventListener("click", startScheduleFlow);

scheduleListEl.addEventListener("dragover", (event) => {
  event.preventDefault();
  scheduleListEl.classList.add("drag-over");
});
scheduleListEl.addEventListener("dragleave", () => {
  scheduleListEl.classList.remove("drag-over");
});
scheduleListEl.addEventListener("drop", (event) => {
  event.preventDefault();
  scheduleListEl.classList.remove("drag-over");
  const chordId = event.dataTransfer.getData("text/plain");
  if (chordId) {
    addScheduledSongById(chordId);
  }
});
modalOverlayEl.addEventListener("click", () => {
  // Prevent accidental close when clicking outside the modal.
});
viewOverlayEl.addEventListener("click", () => {
  // Prevent accidental close when clicking outside the modal.
});
closeViewBtn.addEventListener("click", closeViewModal);
viewTransposeDownBtn.addEventListener("click", () => handleViewTranspose(-1));
viewTransposeUpBtn.addEventListener("click", () => handleViewTranspose(1));
viewEditBtn.addEventListener("click", () => handleViewEdit());

searchInputEl.addEventListener("input", (event) => {
  filterText = event.target.value.trim().toLowerCase();
  render();
});

chordFormEl.addEventListener("submit", (event) => {
  event.preventDefault();

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
  schedule = loadScheduleFromLocal();
  render();
  renderSchedule();
  await hydrateFromApi();
}


function render() {
  chordListEl.innerHTML = "";

  const filtered = chords.filter(matchesFilter);
  countBadgeEl.textContent = `${filtered.length} song${filtered.length === 1 ? "" : "s"}`;

  if (!filtered.length && filterText.length > 0) {
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
    fragment.querySelector(".card-artist").textContent = chord.artist || "";
    fragment
      .querySelector(".card-title-btn")
      .addEventListener("click", () => openViewModal(chord.id));
    fragment.querySelector(".card-title-btn").setAttribute("draggable", "true");
    fragment.querySelector(".card-title-btn").addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", chord.id);
    });
    attachLongPressSchedule(fragment.querySelector(".card-title-btn"), chord.id);

    const deleteBtn = fragment.querySelector(".delete-btn");
    const confirmBtn = fragment.querySelector(".delete-confirm-btn");
    const cancelBtn = fragment.querySelector(".delete-cancel-btn");

    if (pendingDeleteId === chord.id) {
      deleteBtn.classList.add("hidden");
      confirmBtn.classList.remove("hidden");
      cancelBtn.classList.remove("hidden");
    }

    deleteBtn.addEventListener("click", () => armDelete(chord.id, deleteBtn, confirmBtn, cancelBtn));
    confirmBtn.addEventListener("click", () => removeChord(chord.id));
    cancelBtn.addEventListener("click", () => cancelDelete(deleteBtn, confirmBtn, cancelBtn));

    chordListEl.appendChild(fragment);
  }

  if (filterText.length === 0 && filtered.length < 3) {
    const placeholderCount = 3 - filtered.length;
    for (let i = 0; i < placeholderCount; i += 1) {
      const fragment = cardTemplate.content.cloneNode(true);
      const article = fragment.querySelector(".chord-card");
      const titleBtn = fragment.querySelector(".card-title-btn");

      article.classList.add("is-placeholder");
      fragment.querySelector(".card-title").textContent = "Your Song Here";
      fragment.querySelector(".card-artist").textContent = "Hold to add";
      titleBtn.disabled = true;
      titleBtn.removeAttribute("draggable");
      titleBtn.classList.add("is-placeholder-btn");

      const actions = fragment.querySelector(".card-actions");
      if (actions) actions.remove();

      chordListEl.appendChild(fragment);
    }
  }
}

function addScheduledSongById(chordId) {
  const match = chords.find((entry) => entry.id === chordId);
  if (!match) return;
  schedule.push({ id: chordId, title: match.title || "Untitled Song" });
  persistScheduleLocal();
  renderSchedule();
}

function attachLongPressSchedule(buttonEl, chordId) {
  let pressTimer = null;
  let longPressFired = false;

  const start = () => {
    longPressFired = false;
    pressTimer = setTimeout(() => {
      longPressFired = true;
      addScheduledSongById(chordId);
    }, 500);
  };

  const cancel = () => {
    clearTimeout(pressTimer);
    pressTimer = null;
  };

  buttonEl.addEventListener("mousedown", start);
  buttonEl.addEventListener("touchstart", start, { passive: true });
  buttonEl.addEventListener("mouseup", cancel);
  buttonEl.addEventListener("mouseleave", cancel);
  buttonEl.addEventListener("touchend", cancel);
  buttonEl.addEventListener("touchcancel", cancel);

  buttonEl.addEventListener("click", (event) => {
    if (longPressFired) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

function renderSchedule() {
  scheduleListEl.innerHTML = "";
  if (!schedule.length) {
    const item = document.createElement("li");
    item.className = "schedule-item schedule-placeholder";
    item.innerHTML = `
      <span class="schedule-title">Your Song Here</span>
      <span class="schedule-hint">Hold a song to add</span>
    `;
    scheduleListEl.appendChild(item);
    return;
  }
  for (let i = 0; i < schedule.length; i += 1) {
    const item = document.createElement("li");
    item.className = "schedule-item";
    item.innerHTML = `
      <span class="schedule-title"></span>
      <button class="btn btn-ghost btn-small schedule-remove" type="button" aria-label="Remove">
        &times;
      </button>
    `;
    item.querySelector(".schedule-title").textContent = schedule[i].title;
    item.querySelector(".schedule-remove").addEventListener("click", () => {
      schedule.splice(i, 1);
      persistScheduleLocal();
      renderSchedule();
    });
    scheduleListEl.appendChild(item);
  }
}

function startScheduleFlow() {
  if (!schedule.length) {
    window.alert("Add songs to the schedule first.");
    return;
  }

  scheduleListEl.scrollTop = 0;
  scheduleModeIndex = 0;
  openScheduledSong(scheduleModeIndex);
}

function openScheduledSong(index) {
  const entry = schedule[index];
  if (!entry || !entry.id) {
    window.alert("This scheduled item has no matching song in the list.");
    return;
  }
  openViewModal(entry.id);
  injectFlowControls();
}

function injectFlowControls() {
  const modal = viewOverlayEl.querySelector(".modal-view");
  const existing = modal.querySelector(".flow-controls");
  if (existing) existing.remove();

  const flow = document.createElement("div");
  flow.className = "view-actions flow-controls";
  flow.innerHTML = `
    <span class="transpose-label">Flow: ${scheduleModeIndex + 1} / ${schedule.length}</span>
    <button class="btn btn-small btn-ghost" id="flowPrevBtn" type="button">Prev</button>
    <button class="btn btn-small btn-ghost" id="flowNextBtn" type="button">Next</button>
  `;
  modal.appendChild(flow);

  const prevBtn = flow.querySelector("#flowPrevBtn");
  const nextBtn = flow.querySelector("#flowNextBtn");

  if (scheduleModeIndex <= 0) {
    prevBtn.disabled = true;
  } else {
    prevBtn.addEventListener("click", () => {
      scheduleModeIndex -= 1;
      openScheduledSong(scheduleModeIndex);
    });
  }

  if (scheduleModeIndex >= schedule.length - 1) {
    nextBtn.disabled = true;
  } else {
    nextBtn.addEventListener("click", () => {
      scheduleModeIndex += 1;
      openScheduledSong(scheduleModeIndex);
    });
  }
}

function openModal(chordId = "") {
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

function openViewModal(chordId) {
  const chord = chords.find((entry) => entry.id === chordId);
  if (!chord) return;

  viewOverlayEl.dataset.chordId = chord.id;
  viewTitleEl.textContent = chord.title || "Untitled Song";
  viewMetaEl.textContent = buildMeta(chord);
  viewTagsEl.textContent = chord.tags.length ? `#${chord.tags.join(" #")}` : "No tags";
  viewContentEl.innerHTML = highlightChordSheet(chord.chords || "");
  viewKeyPillEl.textContent = chord.key ? `Key ${chord.key}` : "No Key";

  viewOverlayEl.classList.remove("hidden");
  viewOverlayEl.setAttribute("aria-hidden", "false");
}

function closeViewModal() {
  delete viewOverlayEl.dataset.chordId;
  viewOverlayEl.classList.add("hidden");
  viewOverlayEl.setAttribute("aria-hidden", "true");
  scheduleModeIndex = null;
}

function handleViewTranspose(semitones) {
  const chordId = viewOverlayEl.dataset.chordId;
  if (!chordId) return;

  transposeChord(chordId, semitones);
  const chord = chords.find((entry) => entry.id === chordId);
  if (!chord) return;

  viewTitleEl.textContent = chord.title || "Untitled Song";
  viewMetaEl.textContent = buildMeta(chord);
  viewTagsEl.textContent = chord.tags.length ? `#${chord.tags.join(" #")}` : "No tags";
  viewContentEl.innerHTML = highlightChordSheet(chord.chords || "");
  viewKeyPillEl.textContent = chord.key ? `Key ${chord.key}` : "No Key";
}

function handleViewEdit() {
  const chordId = viewOverlayEl.dataset.chordId;
  if (!chordId) return;

  closeViewModal();
  openModal(chordId);
}

function removeChord(chordId) {
  const song = chords.find((entry) => entry.id === chordId);
  if (!song) return;
  pendingDeleteId = null;

  chords = chords.filter((entry) => entry.id !== chordId);
  if (schedule.length) {
    schedule = schedule.filter((entry) => entry.id !== chordId);
    persistScheduleLocal();
    renderSchedule();
  }
  persist();
  render();
}

function armDelete(chordId, deleteBtn, confirmBtn, cancelBtn) {
  if (pendingDeleteId && pendingDeleteId !== chordId) {
    pendingDeleteId = null;
    render();
  }

  if (pendingDeleteId === chordId) {
    pendingDeleteId = null;
    deleteBtn.classList.remove("hidden");
    confirmBtn.classList.add("hidden");
    cancelBtn.classList.add("hidden");
    return;
  }

  pendingDeleteId = chordId;
  deleteBtn.classList.add("hidden");
  confirmBtn.classList.remove("hidden");
  cancelBtn.classList.remove("hidden");
}

function cancelDelete(deleteBtn, confirmBtn, cancelBtn) {
  pendingDeleteId = null;
  deleteBtn.classList.remove("hidden");
  confirmBtn.classList.add("hidden");
  cancelBtn.classList.add("hidden");
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
    const parsed = JSON.parse(raw || "[]");
    return normalizeChordEntries(parsed);
  } catch {
    return [];
  }
}

function loadScheduleFromLocal() {
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed
          .map((entry) => ({
            id: typeof entry.id === "string" ? entry.id : "",
            title: typeof entry.title === "string" ? entry.title : "Untitled Song",
          }))
          .filter((entry) => entry.title)
      : [];
  } catch {
    return [];
  }
}

function persistScheduleLocal() {
  try {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(schedule));
  } catch {
    // Ignore local storage failures (private mode, quota, etc).
  }
}

function persist() {
  persistLocal();
}

function persistLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chords));
  } catch {
    // Ignore local storage failures (private mode, quota, etc).
  }
}

async function hydrateFromApi() {
  try {
    const payload = await readApiPayload();
    if (!payload) {
      return;
    }

    const apiChords = normalizeChordEntries(payload.chords);
    if (!chords.length && apiChords.length) {
      chords = apiChords;
      persistLocal();
      render();
    }
  } catch (error) {
    handleSyncError("Initial sync failed. Using local data.", error);
  }
}

async function readApiPayload() {
  const response = await fetch(CHORDS_API_URL, {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`API read failed (${response.status})`);
  return response.json();
}


function handleSyncError(message, error) {
  console.error(message, error);
  if (!syncErrorShown) {
    syncErrorShown = true;
  }
}

function transposeChord(chordId, semitones) {

  const chord = chords.find((entry) => entry.id === chordId);
  if (!chord) return;

  chord.chords = transposeSongText(chord.chords, semitones);
  chord.key = chord.key ? transposeChordToken(chord.key, semitones) : chord.key;
  chord.updatedAt = new Date().toISOString();

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

// Accords à 4 sons — version complète sans voicing close/open, mêmes noms de fichiers
document.addEventListener('DOMContentLoaded', () => {

  /* ============================
   0) RÉGLAGES AUDIO
   ============================ */
  const AUDIOCFG = {
    simult_volume: 0.88,
    simult_hold: 3200,
    simult_fade: 420,
    seq_gap: 600,
    seq_extra_hold: 300,
    seq_last_hold: 1500,
    seq_note_fade: 160,
    seq_last_fade: 220,
    ref_min_delay_simul: 1500,
    ref_hold_margin: 50,
    timings: {
      test:       { preDelayMs: 1500, playbackMs: 4000, noteGapMs: 0 },
      sequential: { preDelayMs: 800,  playbackMs: 2200, noteGapMs: 600 },
      training:   { preDelayMs: 400,  playbackMs: 5000, noteGapMs: 0 }
    }
  };

  /* ============================
     1) CONSTANTES / DOM
     ============================ */
  const EXAM_TIME_LIMIT_S = 60;
  const TOTAL_QUESTIONS_DEFAULT = 10;

  const SCORE_IMG_PATH = 'img';
  const SCORE_IMG = {
    success: `${SCORE_IMG_PATH}/success.png`,
    ok:      `${SCORE_IMG_PATH}/ok.png`,
    fail:    `${SCORE_IMG_PATH}/fail.png`,
  };

  const AUDIO_MIN_OCT = 2; // C2…B4
  const AUDIO_MAX_OCT = 4;
  const MAX_TOP_OCT   = 5;

  // DOM helpers
  const $ = (id)=>document.getElementById(id);
  const progressDiv = $('progress');
  const scoreDiv    = $('score');
  const timingDiv   = $('timing');
  const menu        = $('menu');
  const game        = $('game');
  const questionDiv = $('question');
  const validationDiv = $('validation-message');
  const resultDiv   = $('result');

  const startBtn    = $('start-game');
  const backBtn     = $('back-to-menu');
  const restartBtn  = $('restart-test');
  const nextBtn     = $('next-question');
  const replayBothBtn = $('replay-single-and-chord');
  const replayChordBtn = $('replay-chord-only');
  const submitBtn   = $('submit-answer');

  const chordSelect       = $('chord-select');
  const inversionSelect   = $('inversion-select');
  const fundamentalSelect = $('fundamental-select');

  const getGametype     = () => document.querySelector('[name="gametype"]:checked')?.value || 'training';
  const getSelectedMode = () => document.querySelector('[name="mode"]:checked')?.value || 'sequential';

  // Sélecteur d'accords (menu)
  const chordPicker      = $('chord-picker');
  const chordChecksWrap  = $('chord-checks');
  const chordWarning     = $('chord-warning');
  const selectAllBtnChords   = $('select-all-chords');
  const deselectAllBtnChords = $('deselect-all-chords');
  const selectedCountEl  = $('selected-count');

  // Notes / enharmonie
  const noteMap = { 'C':0,'Db':1,'D':2,'Eb':3,'E':4,'F':5,'Gb':6,'G':7,'Ab':8,'A':9,'Bb':10,'B':11 };
  const reverseNoteMap = Object.keys(noteMap).reduce((acc, k) => (acc[noteMap[k]] = k, acc), {});
  const enharm = { 'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#' };

  const ALL_CHORDS = ['Maj7','Min7','7sus4','7','-7b5'];
  const INVERSIONS = ['Root Position','First Inversion','Second Inversion','Third Inversion'];

  /* ============================
     2) STRUCTURES 4-SONS (VOICING UNIQUE)
     ============================ */
  const chordStructuresMaster = [
    // PF
    { type: 'Maj7',  intervals: [4, 3, 4], inversion: 'PF' },
    { type: 'Min7',  intervals: [3, 4, 3], inversion: 'PF' },
    { type: '7sus4', intervals: [5, 2, 3], inversion: 'PF' },
    { type: '7',     intervals: [4, 3, 3], inversion: 'PF' },
    { type: '-7b5',  intervals: [3, 3, 4], inversion: 'PF' },
    // R1
    { type: 'Maj7',  intervals: [3, 4, 1], inversion: 'R1' },
    { type: 'Min7',  intervals: [4, 3, 2], inversion: 'R1' },
    { type: '7sus4', intervals: [2, 3, 2], inversion: 'R1' },
    { type: '7',     intervals: [3, 3, 2], inversion: 'R1' },
    { type: '-7b5',  intervals: [3, 4, 2], inversion: 'R1' },
    // R2
    { type: 'Maj7',  intervals: [4, 1, 4], inversion: 'R2' },
    { type: 'Min7',  intervals: [3, 2, 3], inversion: 'R2' },
    { type: '7sus4', intervals: [3, 2, 5], inversion: 'R2' },
    { type: '7',     intervals: [3, 2, 4], inversion: 'R2' },
    { type: '-7b5',  intervals: [4, 2, 3], inversion: 'R2' },
    // R3
    { type: 'Maj7',  intervals: [1, 4, 3], inversion: 'R3' },
    { type: 'Min7',  intervals: [2, 3, 4], inversion: 'R3' },
    { type: '7sus4', intervals: [2, 5, 2], inversion: 'R3' },
    { type: '7',     intervals: [2, 4, 3], inversion: 'R3' },
    { type: '-7b5',  intervals: [2, 3, 3], inversion: 'R3' },
  ];

  /* ============================
     3) AUDIO HTML5 + TIMERS
     ============================ */
  const notes = {};
  for (let o = AUDIO_MIN_OCT; o <= AUDIO_MAX_OCT; o++) {
    Object.keys(noteMap).forEach(n => notes[`${n}${o}`] = `audio/${n}${o}.mp3`);
  }
  const audioCache   = {};
  const activeAudios = new Set();

  const pendingTimers = new Set();
  function later(cb, ms){
    const id = setTimeout(()=>{ pendingTimers.delete(id); try{cb();}catch(_){ } }, ms);
    pendingTimers.add(id);
    return id;
  }
  function clearAllTimers(){
    pendingTimers.forEach(id=>clearTimeout(id));
    pendingTimers.clear();
  }

  function getAudioSafe(noteKey){
    if (!audioCache[noteKey]) {
      const a = new Audio(notes[noteKey]);
      a.preload = 'auto';
      audioCache[noteKey] = a;
    }
    const src = audioCache[noteKey].src;
    const clone = new Audio(src);
    clone.preload = 'auto';
    return clone;
  }

  function stopWithFade(audio, fadeMs=160){
    try {
      const steps = 8;
      const stepDur = Math.max(10, Math.floor(fadeMs/steps));
      let i = 0;
      const startVol = audio.volume;
      const id = setInterval(()=>{
        i++;
        const ratio = Math.max(0, 1 - i/steps);
        audio.volume = startVol * ratio;
        if (i >= steps){
          clearInterval(id);
          try { audio.pause(); audio.currentTime = 0; } catch(_){}
          audio.volume = startVol;
          activeAudios.delete(audio);
        }
      }, stepDur);
    } catch(_){}
  }

  function stopAllAudioNow(){
    try {
      activeAudios.forEach(a => { try { a.pause(); a.currentTime = 0; } catch(_){ } });
      activeAudios.clear();
      clearAllTimers();
    } catch(_){}
  }

  function playNote(noteKey, {volume=1, startDelayMs=0, maxDurMs=1200, fadeOutMs=0}={}){
    const a = getAudioSafe(noteKey);
    a.volume = volume;
    activeAudios.add(a);

    later(() => { try { a.currentTime = 0; a.play().catch(()=>{}); } catch(_){ } }, Math.max(0,startDelayMs));

    if (maxDurMs > 0){
      later(() => {
        if (fadeOutMs > 0) stopWithFade(a, fadeOutMs);
        else { try { a.pause(); a.currentTime = 0; } catch(_){ } activeAudios.delete(a); }
      }, startDelayMs + maxDurMs);
    }
  }

  function playChordArray(arr){
    if (getSelectedMode() === 'sequential') {
      const gap   = Math.max(400, AUDIOCFG.seq_gap);
      const lastH = AUDIOCFG.seq_last_hold;

      arr.forEach((n, i) => {
        const start = i * gap;
        const isLast = (i === arr.length - 1);
        const hold   = isLast ? lastH : (gap + AUDIOCFG.seq_extra_hold);
        const fade   = isLast ? AUDIOCFG.seq_last_fade : AUDIOCFG.seq_note_fade;

        playNote(n, { volume: 1.0, startDelayMs: start, maxDurMs: hold, fadeOutMs: fade });
      });

    } else {
      const hold = AUDIOCFG.simult_hold;
      arr.forEach(n => playNote(n, {
        volume: AUDIOCFG.simult_volume, startDelayMs: 0, maxDurMs: hold, fadeOutMs: AUDIOCFG.simult_fade
      }));
    }
  }

  /* ============================
     4) ÉTAT
     ============================ */
  let config = {
    gametype: 'training',
    mode: 'sequential',
    allowedChords: ALL_CHORDS.slice(),
    preDelayMs: AUDIOCFG.timings.training.preDelayMs,
    playbackMs: AUDIOCFG.timings.training.playbackMs,
    noteGapMs: AUDIOCFG.timings.training.noteGapMs,
    totalQuestions: TOTAL_QUESTIONS_DEFAULT,
  };

  let chordPool = chordStructuresMaster;

  let currentNotes  = null;
  let firstNotePlayed = null;
  let correctAnswer = '';
  let questionIndex = -1;

  // Test
  let scoreTotal = 0;
  let examPointsByIndex = [];
  let gamePointsByIndex = [];

  // Commun
  let startTime = null, questionStartTime = null;
  let answeredThisQuestion = false;

  /* ============================
     5) UTILS MUSICAUX
     ============================ */
  const getRandom = (arr) => arr[Math.floor(Math.random()*arr.length)];
  function enhNoteText(note){
    const name=note.slice(0,-1), oct=note.slice(-1);
    return enharm[name]?`${name}/${enharm[name]}${oct}`:note;
  }
  function splitNote(n){ return { idx: noteMap[n.slice(0,-1)], oct: parseInt(n.slice(-1),10) }; }
  function makeNote(idx, oct){ return `${reverseNoteMap[(idx+12)%12]}${oct}`; }
  function midiIndex(n){ const s=splitNote(n); return s.idx + 12*s.oct; }

  function getRandomBaseNote(){
    const startOctave = AUDIO_MIN_OCT;
    const endOctave   = Math.max(AUDIO_MIN_OCT, AUDIO_MAX_OCT - 1);
    const oct = Math.floor(Math.random() * (endOctave - startOctave + 1)) + startOctave;
    const name = getRandom(Object.keys(noteMap));
    return `${name}${oct}`;
  }

  // Construit ACCORD (voicing unique) depuis la note basse + intervalles (len=3).
  function generateChordFromStructure(baseNote, structure) {
    const base = splitNote(baseNote);
    const arr = [ baseNote ];
    let curIdx = base.idx;
    let curOct = base.oct;

    structure.intervals.forEach((step) => {
      const next = (curIdx + step) % 12;
      if (next < curIdx) curOct = Math.min(AUDIO_MAX_OCT, curOct + 1);
      arr.push(makeNote(next, curOct));
      curIdx = next;
    });

    // Tri + contrainte ~1 octave
    arr.sort((a,b)=>midiIndex(a)-midiIndex(b));
    constrainToOneOctaveSpan(arr);

    // Clamp final sur la note du haut
    const top = splitNote(arr[arr.length-1]);
    if (top.oct > MAX_TOP_OCT) arr[arr.length-1] = makeNote(top.idx, MAX_TOP_OCT);

    return arr;
  }

  function constrainToOneOctaveSpan(noteArr) {
    const lowOct = splitNote(noteArr[0]).oct;
    const maxOct = lowOct + 1;
    for (let i = 1; i < noteArr.length; i++) {
      const s = splitNote(noteArr[i]);
      if (s.oct > maxOct) noteArr[i] = makeNote(s.idx, maxOct);
    }
  }

  /* ============================
     6) ANALYSE / PARSE
     ============================ */
  function analyzeChord(arr){
    const [n1,n2,n3,n4]=arr;
    const i1=(noteMap[n2.slice(0,-1)]-noteMap[n1.slice(0,-1)]+12)%12;
    const i2=(noteMap[n3.slice(0,-1)]-noteMap[n2.slice(0,-1)]+12)%12;
    const i3=(noteMap[n4.slice(0,-1)]-noteMap[n3.slice(0,-1)]+12)%12;

    // Cherche correspondance exacte
    const found = chordStructuresMaster.find(s => (s.intervals[0]===i1 && s.intervals[1]===i2 && s.intervals[2]===i3));
    if (!found) return { chordType:'', inversion:'', fundamental:'' };

    let fundamental = n1.slice(0,-1);
    if (found.inversion==='R1') fundamental = n4.slice(0,-1);
    else if (found.inversion==='R2') fundamental = n3.slice(0,-1);
    else if (found.inversion==='R3') fundamental = n2.slice(0,-1);

    return { chordType: found.type, inversion: found.inversion, fundamental };
  }

  function parseAnswer(str){
    // "CMaj7PF" -> { fund:'C', chord:'Maj7', inv:'PF' }
    const invs = ['PF','R1','R2','R3'];
    const inv = invs.find(s => str.endsWith(s)) || 'PF';
    const body = str.slice(0, -inv.length);
    const types = ALL_CHORDS.slice();
    let chord = '', tonic = '';
    for (const t of types){
      if (body.endsWith(t)){ chord = t; tonic = body.slice(0, body.length - t.length); break; }
    }
    return { fund: tonic, chord, inv };
  }

  /* ============================
     7) CHECKBOXES (menu)
     ============================ */
  function ensureChordChecks(){
    // si jamais le HTML est vide (style agressif), on regénère
    const existing = chordChecksWrap.querySelectorAll('input[type="checkbox"]').length;
    if (existing > 0) return;
    const frag = document.createDocumentFragment();
    ['Maj7','Min7','7sus4','7','-7b5'].forEach(label => {
      const l=document.createElement('label');
      l.style.display='inline-flex'; l.style.alignItems='center'; l.style.gap='8px'; l.style.marginRight='10px';
      const c=document.createElement('input'); c.type='checkbox'; c.value=label; c.checked=true;
      l.appendChild(c); l.append(label);
      frag.appendChild(l);
    });
    chordChecksWrap.appendChild(frag);
  }
  function updateSelectedCount(){
    const n = chordChecksWrap.querySelectorAll('input[type="checkbox"]:checked').length;
    selectedCountEl.textContent = `${n} sélectionnée${n>1?'s':''}`;
  }
  ensureChordChecks();
  updateSelectedCount();

  chordChecksWrap.addEventListener('change', (e)=>{
    if (e.target && e.target.matches('input[type="checkbox"]')) {
      updateSelectedCount();
      applySettings();
    }
  });
  selectAllBtnChords.onclick   = ()=>{ chordChecksWrap.querySelectorAll('input').forEach(c=>c.checked=true);  updateSelectedCount(); applySettings(); };
  deselectAllBtnChords.onclick = ()=>{ chordChecksWrap.querySelectorAll('input').forEach(c=>c.checked=false); updateSelectedCount(); applySettings(); };

  /* ============================
     8) RÉGLAGES & AFFICHAGES
     ============================ */
  function applySettings(){
    config.gametype = getGametype();
    config.mode     = getSelectedMode();

    chordPicker.style.display = 'block';

    // Familles autorisées
    const checked = Array.from(chordChecksWrap.querySelectorAll('input:checked')).map(c=>c.value);
    config.allowedChords = checked;
    chordWarning.style.display = checked.length ? 'none' : 'block';

    // Timings
    const base = (config.gametype==='training') ? AUDIOCFG.timings.training :
                 (config.mode==='sequential' ? AUDIOCFG.timings.sequential : AUDIOCFG.timings.test);
    config.preDelayMs = base.preDelayMs;
    config.playbackMs = base.playbackMs;
    config.noteGapMs  = base.noteGapMs || 0;

    // Test
    config.totalQuestions = TOTAL_QUESTIONS_DEFAULT;

    // Pool accords
    chordPool = chordStructuresMaster.filter(s=>config.allowedChords.includes(s.type));

    // HUD
    if (config.gametype === 'training') {
      progressDiv.textContent = 'Entraînement libre';
      scoreDiv.textContent    = '';
      nextBtn.textContent     = 'Nouvel accord';
      restartBtn.style.display = 'none';
      resultDiv.innerHTML = '';
    } else {
      nextBtn.textContent = 'Question suivante';
      restartBtn.style.display = 'inline-block';
    }
  }
  document.querySelectorAll('[name="gametype"]').forEach(r=>r.addEventListener('change', applySettings));
  document.querySelectorAll('[name="mode"]').forEach(r=>r.addEventListener('change', applySettings));
  applySettings();

  /* ============================
     9) LANCEMENT / NAV
     ============================ */
  startBtn.onclick = startGame;
  backBtn.onclick  = ()=>backToMenu();
  restartBtn.onclick = startGame;

  nextBtn.onclick = () => {
    stopAllAudioNow();
    if (config.gametype === 'test') {
      if (!answeredThisQuestion && questionIndex >= 0 && questionIndex < config.totalQuestions) {
        examPointsByIndex[questionIndex] = 0;
        gamePointsByIndex[questionIndex] = 0;
        answeredThisQuestion = true;
      }
      advance();
    } else {
      nextTrainingQuestion();
    }
  };
  replayBothBtn.onclick  = () => { stopAllAudioNow(); playOneThenChord(); };
  replayChordBtn.onclick = () => { stopAllAudioNow(); playChordArray(currentNotes); };
  submitBtn.onclick      = () => { stopAllAudioNow(); validateAnswer(); };

  async function startGame(){
    applySettings();
    if (!config.allowedChords.length){ chordWarning.style.display='block'; return; }

    menu.style.display='none';
    game.style.display='block';
    resultDiv.textContent='';
    validationDiv.textContent='';

    stopAllAudioNow();
    answeredThisQuestion = false;

    buildSelects();

    startTime = Date.now();
    startHudTimer();
    try{ window.scrollTo({top:0,behavior:'smooth'}); }catch(_){}

    if (config.gametype === 'test') {
      questionIndex = -1;
      scoreTotal = 0;
      examPointsByIndex = new Array(config.totalQuestions).fill(null);
      gamePointsByIndex = new Array(config.totalQuestions).fill(0);
      advance();
    } else {
      questionIndex = 0;
      nextTrainingQuestion();
    }
  }

  function backToMenu(){
    stopAllAudioNow();
    stopHudTimer();
    game.style.display='none';
    menu.style.display='block';
  }

  /* ============================
     10) TEST — SÉRIE & FIN
     ============================ */
  function advance(){
    questionIndex += 1;
    if (questionIndex >= config.totalQuestions) { endGame(); return; }
    nextQuestionCommon();
  }

  function endGame(){
    stopHudTimer();
    const timeTaken = ((Date.now()-startTime)/1000);
    const timeTakenText = timeTaken.toFixed(2);

    const finalizedExam = examPointsByIndex.map(v => (v==null ? 0 : v)).slice(0, config.totalQuestions);
    const grade20 = finalizedExam.reduce((a,b)=>a+b,0);

    const twoPts = finalizedExam.filter(v=>v===2).length;
    const onePt  = finalizedExam.filter(v=>v===1).length;
    const zeroPt = config.totalQuestions - twoPts - onePt;

    let label, img;
    if (grade20 >= 16) { label='Très bien'; img=SCORE_IMG.success; }
    else if (grade20 >= 10) { label='Correct'; img=SCORE_IMG.ok; }
    else { label='Insuffisant'; img=SCORE_IMG.fail; }

    resultDiv.innerHTML = `
      <section class="result-summary">
        <p class="result-title"><strong>Test terminé !</strong></p>
        <p class="result-grade">${label}</p>
        <div class="trophy-block">
          <img src="${img}" alt="${label}" class="score-img" onerror="this.style.display='none'"/>
        </div>
        <p class="result-line">Score : <strong>${scoreTotal}</strong></p>
        <p class="result-line">Note : <strong>${Math.round(grade20)}/20</strong>
           <span class="result-sub">(${twoPts}×2 pts, ${onePt}×1 pt, ${zeroPt}×0 pt)</span>
        </p>
        <p class="result-line">Temps total : ${timeTakenText}s</p>
      </section>
      <section id="scoreboard"></section>
    `;

    const avgPerQuestion = (config.totalQuestions > 0) ? (timeTaken / config.totalQuestions) : 0;
    saveScore({ validatedFull: twoPts, validatedHalf: onePt, grade20, score: scoreTotal, avgTime: avgPerQuestion });

    nextBtn.disabled=true;
    renderScoreboard();
    try{ window.scrollTo({top:0,behavior:'smooth'}); }catch(_){}
  }

  function renderScoreboard() {
    const mount = $('scoreboard');
    if (!mount) return;

    const all = loadScores();

    mount.innerHTML = '';
    if (!all || !all.length) return;

    const top5 = all.slice().sort((a, b) => {
      const g = (b.grade20 || 0) - (a.grade20 || 0);
      return g !== 0 ? g : ((b.score || 0) - (a.score || 0));
    }).slice(0, 5);

    const h3 = document.createElement('h3');
    h3.className = 'result-h3';
    h3.textContent = 'Top 5 — Meilleurs scores';

    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';

    const table = document.createElement('table');
    table.className = 'score-table';

    const thead = document.createElement('thead');
    thead.innerHTML =
      '<tr>' +
        '<th>Rang</th>' +
        '<th>Note</th>' +
        '<th>Score</th>' +
        '<th>Mode</th>' +
        '<th>Accords</th>' +
        '<th>Temps moyen</th>' +
      '</tr>';

    const tbody = document.createElement('tbody');

    top5.forEach((s, idx) => {
      const tr = document.createElement('tr');
      const td = (label, text) => {
        const cell = document.createElement('td');
        cell.setAttribute('data-label', label);
        cell.textContent = text;
        return cell;
      };
      const modeText = (s.gametype || '-') + ' / ' + (s.mode || '-');
      const chordsText = (Array.isArray(s.chords) && s.chords.length) ? s.chords.join(', ') : '—';
      const avgTimeText = (typeof s.avgTime === 'number' ? s.avgTime.toFixed(1) : '0.0') + 's';
      tr.appendChild(td('Rang', '#' + (idx + 1)));
      tr.appendChild(td('Note', String(Math.round(s.grade20 || 0)) + '/20'));
      tr.appendChild(td('Score', String(s.score || 0)));
      tr.appendChild(td('Mode', modeText));
      tr.appendChild(td('Accords', chordsText));
      tr.appendChild(td('Temps moyen', avgTimeText));
      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);
    mount.appendChild(h3);
    mount.appendChild(wrap);
  }

  const SCORE_KEY = 'tetradScores';
  function loadScores(){ try{ return JSON.parse(localStorage.getItem(SCORE_KEY)||'[]'); }catch(_){ return []; } }
  function saveScore(entry){
    const all=loadScores();
    all.push({
      date: new Date().toISOString(),
      mode: config.mode,
      gametype: config.gametype,
      chords: (config.allowedChords||[]).slice(),
      total: config.totalQuestions,
      validatedFull: entry.validatedFull,
      validatedHalf: entry.validatedHalf,
      grade20: Math.round(entry.grade20),
      score: entry.score,
      avgTime: entry.avgTime
    });
    localStorage.setItem(SCORE_KEY, JSON.stringify(all));
  }

  /* ============================
     11) QUESTIONS — COMMUN
     ============================ */
  function nextQuestionCommon(){
    validationDiv.textContent='';
    resultDiv.textContent='';
    nextBtn.disabled=false;

    answeredThisQuestion = false;
    submitBtn.disabled = false;

    chordSelect.selectedIndex = 0;
    inversionSelect.selectedIndex = 0;
    fundamentalSelect.selectedIndex = 0;

    updateHud();
    generateQuestion();
  }

  function nextTrainingQuestion(){
    validationDiv.textContent='';
    resultDiv.textContent='';
    nextBtn.disabled=false;
    answeredThisQuestion = false;
    submitBtn.disabled = false;

    chordSelect.selectedIndex = 0;
    inversionSelect.selectedIndex = 0;
    fundamentalSelect.selectedIndex = 0;

    progressDiv.textContent = 'Entraînement libre';
    scoreDiv.textContent = '';

    generateQuestion();
  }

  function buildSelects(){
    // Famille d'accord
    chordSelect.innerHTML = '';
    (config.allowedChords.length?config.allowedChords:ALL_CHORDS).forEach(t=>{
      const o=document.createElement('option'); o.value=t; o.textContent=t; chordSelect.appendChild(o);
    });

    // Inversions
    inversionSelect.innerHTML = '';
    INVERSIONS.forEach(inv=>{ const o=document.createElement('option'); o.value=inv; o.textContent=inv; inversionSelect.appendChild(o); });

    // Fondamentales
    fundamentalSelect.innerHTML = '';
    Object.keys(noteMap).forEach(n=>{
      const o=document.createElement('option'); const e=enharm[n]; o.value=n; o.textContent = e?`${n}/${e}`:n; fundamentalSelect.appendChild(o);
    });
  }

  function generateQuestion(){
    const structure = getRandom(chordPool);
    const baseNote  = getRandomBaseNote();

    currentNotes = generateChordFromStructure(baseNote, structure);

    const a = analyzeChord(currentNotes);
    correctAnswer = `${a.fundamental}${a.chordType}${a.inversion}`;

    // Note repère = aléatoire parmi les 4
    firstNotePlayed = currentNotes[Math.floor(Math.random()*4)];

    questionDiv.textContent = `Note jouée : ${enhNoteText(firstNotePlayed)}`;

    questionStartTime = Date.now();
    playOneThenChord();
  }

  function getRefAndChordDelay() {
    let base = Math.max(80, config.preDelayMs || 400);
    if (getSelectedMode() === 'simultaneous') {
      base = Math.max(base, AUDIOCFG.ref_min_delay_simul);
    } else {
      const gap = Math.max( Math.max(400, config.noteGapMs || AUDIOCFG.seq_gap), 0 );
      base += gap;
    }
    return base;
  }

  function playOneThenChord(){
    stopAllAudioNow();
    const delay   = getRefAndChordDelay();
    const refHold = Math.max(300, delay - AUDIOCFG.ref_hold_margin);
    playNote(firstNotePlayed, { volume: 1.0, startDelayMs: 0, maxDurMs: refHold, fadeOutMs: 0 });
    later(() => { playChordArray(currentNotes); }, delay);
  }

  /* ============================
     12) HUD / VALIDATION (déclaration unique)
     ============================ */
  let hudTimerId = null;
  let hudTimerActive = false;

  function updateHud(){
    if (config.gametype === 'test') {
      const qShown = Math.max(0, Math.min(questionIndex+1, config.totalQuestions));
      progressDiv.textContent = `Question ${qShown}/${config.totalQuestions}`;
      scoreDiv.textContent    = `Score : ${scoreTotal}`;
    } else {
      progressDiv.textContent = 'Entraînement libre';
      scoreDiv.textContent    = '';
    }
    timingDiv.textContent = `Temps: ${ startTime ? ((Date.now()-startTime)/1000).toFixed(1) : '0.0'}s`;
  }

  function startHudTimer(){
    stopHudTimer();
    hudTimerActive = true;
    updateHud();
    hudTimerId = setInterval(() => {
      if (!hudTimerActive) { stopHudTimer(); return; }
      updateHud();
    }, 500);
  }

  function stopHudTimer(){
    hudTimerActive = false;
    if (hudTimerId){ clearInterval(hudTimerId); hudTimerId = null; }
  }

  function getDifficultyMultiplier(cfg){
    const chordBoost = 1 + 0.10 * Math.max(0, (cfg.allowedChords?.length||1) - 1);
    const modeBoost  = (cfg.mode==='sequential') ? 1.00 : 1.20;
    return Math.min(2.00, Number((chordBoost * modeBoost).toFixed(2)));
  }
  function getTimeBonus(s){
    const t=Math.max(0,s);
    if (t<=1.5) return 150;
    if (t<=3)   return 120;
    if (t<=5)   return 100;
    if (t<=8)   return 80;
    if (t<=12)  return 60;
    if (t<=18)  return 45;
    if (t<=25)  return 35;
    if (t<=35)  return 25;
    if (t<=45)  return 15;
    return 5;
  }
  function computeQuestionPoints(ok, s, cfg){
    if(!ok) return 0;
    return Math.round((100 + getTimeBonus(s)) * getDifficultyMultiplier(cfg));
  }

  function getInvLabel(ui){
    switch(ui){
      case 'Root Position': return 'PF';
      case 'First Inversion': return 'R1';
      case 'Second Inversion': return 'R2';
      case 'Third Inversion': return 'R3';
      default: return '';
    }
  }

  function validateAnswer(){
    if (answeredThisQuestion) return;

    const chord = chordSelect.value;
    const fund  = fundamentalSelect.value;
    const invUi = inversionSelect.value;
    const inv   = getInvLabel(invUi);

    const t = (Date.now()-questionStartTime)/1000;
    const within = (config.gametype === 'test') ? (t <= EXAM_TIME_LIMIT_S) : true;

    const exp = parseAnswer(correctAnswer);
    const isTypeMatch = (chord === exp.chord) && (inv === exp.inv);
    const isFundMatch = (fund === exp.fund);

    let gained = 0;
    let examPoints = 0;
    let feedbackHTML = '';

    answeredThisQuestion = true;
    submitBtn.disabled = true;

    const orderPlayed = currentNotes.map(enhNoteText).join(' – ');

    if (within && isTypeMatch && isFundMatch) {
      if (config.gametype === 'test') {
        gained = computeQuestionPoints(true, t, config);
        scoreTotal += gained;
        examPoints = 2;
        feedbackHTML = `
          <span style="color:#1f8b24; font-weight:700;">Correct ! ✅</span>
          <div style="margin-top:6px; font-size:14px;">
            Base 100 + Bonus temps ${getTimeBonus(t)} (${t.toFixed(1)}s)
            • Mult. ×${getDifficultyMultiplier(config).toFixed(2)}
            → <strong>${gained} pts</strong>
          </div>
          <div style="margin-top:6px;font-size:14px;opacity:.85;">Notes jouées : ${orderPlayed}</div>`;
        nextBtn.disabled = true;
        later(()=>{ nextBtn.disabled=false; advance(); }, 1200);
      } else {
        feedbackHTML = `<span style="color:#1f8b24; font-weight:700;">Correct ! ✅</span>
                        <div style="margin-top:6px;font-size:14px;opacity:.85;">Notes jouées : ${orderPlayed}</div>`;
      }

    } else if (within && isTypeMatch && !isFundMatch) {
      if (config.gametype === 'test') {
        gained = Math.round(computeQuestionPoints(true, t, config) / 2);
        scoreTotal += gained;
        examPoints = 1;
        feedbackHTML = `
          <span style="color:#2e7dd7; font-weight:700;">Presque ! ✳️</span>
          <div style="margin-top:6px; font-size:14px;">
            Type + renversement OK, mais tonique incorrecte<br>
            → <strong>${gained} pts</strong> • <strong>+1 pt (examen)</strong><br>
            Bonne réponse : <strong>${correctAnswer}</strong>
          </div>
          <div style="margin-top:6px;font-size:14px;opacity:.85;">Notes jouées : ${orderPlayed}</div>`;
      } else {
        feedbackHTML = `
          <span style="color:#2e7dd7; font-weight:700;">Type/renversement OK</span>
          <div style="margin-top:6px; font-size:14px;">
            Tonique attendue : <strong>${correctAnswer}</strong>
          </div>
          <div style="margin-top:6px;font-size:14px;opacity:.85;">Notes jouées : ${orderPlayed}</div>`;
      }

    } else if (!within && config.gametype === 'test') {
      if (isTypeMatch && isFundMatch) {
        examPoints = 0;
        feedbackHTML = `
          <span style="color:#c62828;">⏱️ Temps dépassé (&gt; ${EXAM_TIME_LIMIT_S}s) — 0 pt</span>
          <div style="margin-top:6px;">Ta réponse était <strong>correcte</strong>, mais au-delà de la limite.</div>
          <div style="margin-top:6px;font-size:14px;opacity:.85;">Notes jouées : ${orderPlayed}</div>`;
      } else if (isTypeMatch && !isFundMatch) {
        examPoints = 0;
        feedbackHTML = `
          <span style="color:#c62828;">⏱️ Temps dépassé (&gt; ${EXAM_TIME_LIMIT_S}s) — 0 pt</span>
          <div style="margin-top:6px;">Tu avais <strong>type + renversement</strong>, mais tonique incorrecte.</div>
          <div style="margin-top:6px;">Bonne réponse : <strong>${correctAnswer}</strong></div>
          <div style="margin-top:6px;font-size:14px;opacity:.85;">Notes jouées : ${orderPlayed}</div>`;
      } else {
        feedbackHTML = `
          <span style="color:#c62828;">⏱️ Temps dépassé (&gt; ${EXAM_TIME_LIMIT_S}s) — 0 pt</span>
          <div style="margin-top:6px;font-size:14px;opacity:.85;">Notes jouées : ${orderPlayed}</div>`;
      }

    } else {
      feedbackHTML = `
        <span style="color:#c62828;">Incorrect ❌ — bonne réponse : <strong>${correctAnswer}</strong></span>
        <div class="hint-relisten">Réécoute puis “${config.gametype==='test'?'Question suivante':'Nouvel accord'}”.</div>
        <div style="margin-top:6px;font-size:14px;opacity:.85;">Notes jouées : ${orderPlayed}</div>`;
      examPoints = 0;
    }

    if (config.gametype === 'test' && questionIndex >= 0 && questionIndex < config.totalQuestions) {
      examPointsByIndex[questionIndex] = examPoints;
      gamePointsByIndex[questionIndex] = gained;
    }

    validationDiv.innerHTML = feedbackHTML;
    updateHud();
  }

});
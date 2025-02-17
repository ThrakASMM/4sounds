document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('start-game').addEventListener('click', startGame);
    document.getElementById('back-to-menu').addEventListener('click', backToMenu);
    document.getElementById('restart-test').addEventListener('click', restartTest);
    document.getElementById('next-question').addEventListener('click', skipQuestion);

    const notes = {};
    const noteMap = {
        'C': 0, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11
    };
    const reverseNoteMap = Object.keys(noteMap).reduce((acc, key) => {
        acc[noteMap[key]] = key;
        return acc;
    }, {});
    const enharmonicMap = {
        'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
    };
    const fourSoundsStructures = [
        { type: 'Maj7', intervals: [4, 3, 4], inversion: 'PF' },
        { type: 'Min7', intervals: [3, 4, 3], inversion: 'PF' },
        { type: '7sus4', intervals: [5, 2, 3], inversion: 'PF' },
        { type: '7', intervals: [4, 3, 3], inversion: 'PF' },
        { type: '-7b5', intervals: [3, 3, 4], inversion: 'PF' },

        { type: 'Maj7', intervals: [3, 4, 1], inversion: 'R1' },
        { type: 'Min7', intervals: [4, 3, 2], inversion: 'R1' },
        { type: '7sus4', intervals: [2, 3, 2], inversion: 'R1' },
        { type: '7', intervals: [3, 3, 2], inversion: 'R1' },
        { type: '-7b5', intervals: [3, 4, 2], inversion: 'R1' },

        { type: 'Maj7', intervals: [4, 1, 4], inversion: 'R2' },
        { type: 'Min7', intervals: [3, 2, 3], inversion: 'R2' },
        { type: '7sus4', intervals: [3, 2, 5], inversion: 'R2' },
        { type: '7', intervals: [3, 2, 4], inversion: 'R2' },
        { type: '-7b5', intervals: [4, 2, 3], inversion: 'R2' },

        { type: 'Maj7', intervals: [1, 4, 3], inversion: 'R3' },
        { type: 'Min7', intervals: [2, 3, 4], inversion: 'R3' },
        { type: '7sus4', intervals: [2, 5, 2], inversion: 'R3' },
        { type: '7', intervals: [2, 4, 3], inversion: 'R3' },
        { type: '-7b5', intervals: [2, 3, 3], inversion: 'R3' },

    ];
    const triads = [
        { name: 'Major 7', label: 'Maj7' },
        { name: 'Minor 7', label: 'Min7' },
        { name: '7sus4', label: '7sus4' },
        { name: 'Dominant 7', label: '7' },
        { name: 'Min7b5', label: '-7b5' },

    ];
    const inversions = ['Root Position', 'First Inversion', 'Second Inversion', 'Third Inversion'];

    for (let octave = 2; octave <= 5; octave++) {
        Object.keys(noteMap).forEach(note => {
            notes[`${note}${octave}`] = `audio/${note}${octave}.mp3`;
        });
    }

    let currentTriad;
    let currentNotes;
    let correctAnswer;
    let questionCount = 0;
    let correctAnswers = 0;
    const totalQuestions = 10;
    let preloadedSounds = {};
    let startTime;
    let endTime;
    let firstNotePlayed;

    function startGame() {
        document.getElementById('menu').style.display = 'none';
        document.getElementById('game').style.display = 'block';
        document.getElementById('back-to-menu').style.display = 'block';
        document.getElementById('restart-test').style.display = 'block';
        document.getElementById('next-question').style.display = 'block';
        questionCount = 0;
        correctAnswers = 0;
        startTime = new Date();
        preloadSounds();
        nextQuestion();
    }

    function preloadSounds() {
        Object.keys(notes).forEach(note => {
            preloadedSounds[note] = new Audio(notes[note]);
            preloadedSounds[note].addEventListener('canplaythrough', () => {
                console.log(`Preloaded sound: ${note}`);
            }, false);
            preloadedSounds[note].addEventListener('error', () => {
                console.error(`Failed to preload sound: ${note}`);
            });
        });
    }

    function stopAllSounds() {
        Object.values(preloadedSounds).forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
    }

    function backToMenu() {
        document.getElementById('game').style.display = 'none';
        document.getElementById('menu').style.display = 'block';
        document.getElementById('back-to-menu').style.display = 'none';
        document.getElementById('restart-test').style.display = 'none';
        document.getElementById('next-question').style.display = 'none';
    }

    function restartTest() {
        document.getElementById('game').style.display = 'none';
        startGame();
    }

    function endGame() {
        endTime = new Date();
        const timeTaken = (endTime - startTime) / 1000;
        const resultDiv = document.getElementById('result');
        resultDiv.innerHTML = `
            <p>Test terminé !</p>
            <p>Nombre de bonnes réponses : ${correctAnswers} sur ${totalQuestions}</p>
            <p>Temps écoulé : ${timeTaken.toFixed(2)} secondes</p>
        `;
        document.getElementById('back-to-menu').style.display = 'block';
        document.getElementById('restart-test').style.display = 'block';
        document.getElementById('next-question').style.display = 'none';
    }

    function replay() {
        stopAllSounds();
        if (!currentNotes || currentNotes.length === 0) {
            console.error("No notes available to replay.");
            document.getElementById('question').innerText = "Aucune note à rejouer.";
            return;
        }
        document.getElementById('question').innerText = `Note jouée : ${getEnharmonicEquivalent(firstNotePlayed)}`;
        playSingleNoteThenTriad(currentNotes, firstNotePlayed);
    }

    function skipQuestion() {
        questionCount++;
        setTimeout(nextQuestion, 2000);
    }

    function nextQuestion() {
        document.getElementById('validation-message').textContent = '';
        if (questionCount < totalQuestions) {
            document.getElementById('result').textContent = '';
            generateQuestion();
        } else {
            endGame();
        }
    }

    function generateQuestion() {
        const baseNote = getRandomNoteInRange(3, 2);
        const structure = getRandomTriadStructure();
        currentNotes = generate4NotesFromStructure(baseNote, structure);

        const analysis = analyze4Sounds(currentNotes);
        correctAnswer = `${analysis.fundamental}${analysis.triadType}${analysis.inversion}`;

        console.log(`Generated triad: ${currentNotes.join(', ')}`);
        console.log(`Correct Answer: ${correctAnswer}`);

        firstNotePlayed = currentNotes[Math.floor(Math.random() * 4)];
        document.getElementById('question').innerText = `Note jouée : ${getEnharmonicEquivalent(firstNotePlayed)}`;
        
        playSingleNoteThenTriad(currentNotes, firstNotePlayed);
        updateOptions();
    }

    function getRandomTriadStructure() {
        return fourSoundsStructures[Math.floor(Math.random() * fourSoundsStructures.length)];
    }

    function generate4NotesFromStructure(baseNote, structure) {
        let noteIndex = noteMap[baseNote.slice(0, -1)];
        let octave = parseInt(baseNote.slice(-1));
        let notes = [baseNote];
        let currentIndex = noteIndex;

        structure.intervals.forEach(interval => {
            currentIndex = (currentIndex + interval) % 12;

            if (currentIndex < noteIndex) {
                octave++;
                if (octave > 5) octave = 5;
            }

            const nextNoteName = reverseNoteMap[currentIndex];
            if (nextNoteName !== undefined) {
                const nextNote = `${nextNoteName}${octave}`;
                notes.push(nextNote);
                noteIndex = currentIndex;
            } else {
                console.error(`Invalid note index: ${currentIndex}`);
            }
        });

        if (notes.length === 4) {
            notes.sort((a, b) => {
                const noteValueA = noteMap[a.slice(0, -1)] + parseInt(a.slice(-1)) * 12;
                const noteValueB = noteMap[b.slice(0, -1)] + parseInt(b.slice(-1)) * 12;
                return noteValueA - noteValueB;
            });
        } else {
            console.error("La génération de l'accord n'a pas produit 4 notes.");
        }

        return notes;
    }

    function analyze4Sounds(notes) {
        const [note1, note2, note3, note4] = notes;
        const interval1 = (noteMap[note2.slice(0, -1)] - noteMap[note1.slice(0, -1)] + 12) % 12;
        const interval2 = (noteMap[note3.slice(0, -1)] - noteMap[note2.slice(0, -1)] + 12) % 12;
        const interval3 = (noteMap[note4.slice(0, -1)] - noteMap[note3.slice(0, -1)] + 12) % 12;
    
        let triadType = '';
        let inversion = '';
        let fundamental = note1.slice(0, -1); // Default to the first note
    
        if (interval1 === 4 && interval2 === 3 && interval3 === 4) {
            triadType = 'Maj7';
            inversion = 'PF';
        } else if (interval1 === 3 && interval2 === 4 && interval3 === 3) {
            triadType = 'Min7';
            inversion = 'PF';
        } else if (interval1 === 5 && interval2 === 2 && interval3 === 3) {
            triadType = '7sus4';
            inversion = 'PF';
        } else if (interval1 === 4 && interval2 === 3 && interval3 === 3) {
            triadType = '7';
            inversion = 'PF';
        } else if (interval1 === 3 && interval2 === 3 && interval3 === 4) {
            triadType = '-7b5';
            inversion = 'PF';
        } else if (interval1 === 3 && interval2 === 4 && interval3 === 1) {
            triadType = 'Maj7';
            inversion = 'R1';
            fundamental = note4.slice(0, -1);
        } else if (interval1 === 4 && interval2 === 3 && interval3 === 2) {
            triadType = 'Min7';
            inversion = 'R1';
            fundamental = note4.slice(0, -1);
        } else if (interval1 === 2 && interval2 === 3 && interval3 === 2) {
            triadType = '7sus4';
            inversion = 'R1';
            fundamental = note4.slice(0, -1);
        } else if (interval1 === 3 && interval2 === 3 && interval3 === 2) {
            triadType = '7';
            inversion = 'R1';
        } else if (interval1 === 3 && interval2 === 4 && interval3 === 2) {
            triadType = '-7b5';
            inversion = 'R1';
            fundamental = note4.slice(0, -1);
        } else if (interval1 === 4 && interval2 === 1 && interval3 === 4) {
            triadType = 'Maj7';
            inversion = 'R2';
            fundamental = note3.slice(0, -1);
        } else if (interval1 === 3 && interval2 === 2 && interval3 === 3) {
            triadType = 'Min7';
            inversion = 'R2';
            fundamental = note3.slice(0, -1);
        } else if (interval1 === 3 && interval2 === 2 && interval3 === 5) {
            triadType = '7sus4';
            inversion = 'R2';
            fundamental = note3.slice(0, -1);
        } else if (interval1 === 3 && interval2 === 2 && interval3 === 4) {
            triadType = '7';
            inversion = 'R2';
        } else if (interval1 === 4 && interval2 === 2 && interval3 === 3) {
            triadType = '-7b5';
            inversion = 'R2';
            fundamental = note3.slice(0, -1);
        } else if (interval1 === 1 && interval2 === 4 && interval3 === 3) {
            triadType = 'Maj7';
            inversion = 'R3';
            fundamental = note2.slice(0, -1);
        } else if (interval1 === 2 && interval2 === 3 && interval3 === 4) {
            triadType = 'Min7';
            inversion = 'R3';
            fundamental = note2.slice(0, -1);
        } else if (interval1 === 2 && interval2 === 5 && interval3 === 2) {
            triadType = '7sus4';
            inversion = 'R3';
            fundamental = note2.slice(0, -1);
        } else if (interval1 === 2 && interval2 === 4 && interval3 === 3) {
            triadType = '7';
            inversion = 'R3';
        } else if (interval1 === 2 && interval2 === 3 && interval3 === 3) {
            triadType = '-7b5';
            inversion = 'R3';
            fundamental = note2.slice(0, -1);
        } else {
            console.error("Aucune correspondance trouvée pour l'accord analysé.");
        }
    
        return { triadType, inversion, fundamental };
    }
    
    

    function getRandomNoteInRange(octaveRange, startOctave = 2) {
        const randomOctave = Math.floor(Math.random() * octaveRange) + startOctave;
        const randomNote = Object.keys(noteMap)[Math.floor(Math.random() * Object.keys(noteMap).length)];
        return `${randomNote}${randomOctave}`;
    }

    function getEnharmonicEquivalent(note) {
        const noteName = note.slice(0, -1);
        const octave = note.slice(-1);
        const enharmonic = enharmonicMap[noteName];
        return enharmonic ? `${noteName}/${enharmonic}${octave}` : note;
    }

    function playSingleNoteThenTriad(notesArray, firstNote) {
        if (!preloadedSounds[firstNote]) {
            console.error(`Audio not preloaded for note: ${firstNote}`);
            document.getElementById('question').innerText = `Erreur: Le son de ${firstNote} n'a pas pu être chargé.`;
            return;
        }

        preloadedSounds[firstNote].play().then(() => {
            setTimeout(() => {
                stopAllSounds();
                notesArray.forEach(note => {
                    if (preloadedSounds[note]) {
                        preloadedSounds[note].currentTime = 0;
                        preloadedSounds[note].play().catch(error => console.error('Error playing audio:', error));
                    } else {
                        console.error(`Audio not preloaded for note: ${note}`);
                    }
                });
                setTimeout(stopAllSounds, 8000);
            }, 4000);
        }).catch(error => console.error('Error playing audio:', error));
    }

    function updateOptions() {
        const optionsDiv = document.getElementById('options');
        optionsDiv.innerHTML = '';

        const triadSelect = document.createElement('select');
        triadSelect.id = 'triad-select';
        triads.forEach(triad => {
            const option = document.createElement('option');
            option.value = triad.label;
            option.textContent = triad.label;
            triadSelect.appendChild(option);
        });

        const inversionSelect = document.createElement('select');
        inversionSelect.id = 'inversion-select';
        inversions.forEach(inversion => {
            const option = document.createElement('option');
            option.value = inversion;
            option.textContent = inversion;
            inversionSelect.appendChild(option);
        });

        const fundamentalSelect = document.createElement('select');
        fundamentalSelect.id = 'fundamental-select';
        Object.keys(noteMap).forEach(note => {
            const option = document.createElement('option');
            const enharmonic = enharmonicMap[note];
            option.value = note;
            option.textContent = enharmonic ? `${note}/${enharmonic}` : note;
            fundamentalSelect.appendChild(option);
        });

        const submitButton = document.createElement('button');
        submitButton.textContent = 'Submit';
        submitButton.style.backgroundColor = 'green';
        submitButton.style.color = 'white';
        submitButton.addEventListener('click', () => {
            const selectedTriad = triadSelect.value;
            const selectedInversion = inversionSelect.value;
            const selectedFundamental = fundamentalSelect.value;
            const selectedAnswer = `${selectedFundamental}${selectedTriad}${getInversionLabel(selectedInversion)}`;

            const validationMessage = document.getElementById('validation-message');
            if (selectedAnswer === correctAnswer) {
                validationMessage.textContent = 'Correcte !';
                validationMessage.style.color = 'green';
                correctAnswers++;
            } else {
                validationMessage.textContent = `Incorrect, la bonne réponse était ${correctAnswer}.`;
                validationMessage.style.color = 'red';
            }
            questionCount++;
            setTimeout(nextQuestion, 2000);
        });

        const replayButton = document.createElement('button');
        replayButton.textContent = 'Replay';
        replayButton.style.backgroundColor = 'yellow';
        replayButton.style.color = 'black';
        replayButton.addEventListener('click', replay);

        optionsDiv.appendChild(triadSelect);
        optionsDiv.appendChild(inversionSelect);
        optionsDiv.appendChild(fundamentalSelect);
        optionsDiv.appendChild(submitButton);
        optionsDiv.appendChild(replayButton);

        triadSelect.addEventListener('change', () => {
            inversionSelect.style.display = triadSelect.value === 'Aug' ? 'none' : 'block';
        });
        triadSelect.dispatchEvent(new Event('change'));
    }

    function getInversionLabel(inversion) {
        switch (inversion) {
            case 'Root Position':
                return 'PF';
            case 'First Inversion':
                return 'R1';
            case 'Second Inversion':
                return 'R2';
            case 'Third Inversion':
                return 'R3';
            default:
                return '';
        }
    }
});
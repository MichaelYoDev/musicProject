const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay("render");

const toggleButton = document.getElementById('mode-toggle');
toggleButton.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
});

function compile() {
    const input = document.getElementById("input").value.trim().split("\n");

    const textarea = document.getElementById("input");
    function autoExpand(el) {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
    }
    autoExpand(textarea);
    textarea.addEventListener("input", () => autoExpand(textarea));

    const title = document.getElementById("title").value;
    const partName = document.getElementById("partName").value;
    const clef = document.getElementById("clef").value;
    const key = parseInt(document.getElementById("key").value);
    const beats = parseInt(document.getElementById("beats").value);
    const beatType = parseInt(document.getElementById("beatType").value);

    const divisionsPerBeat = 8;
    const totalDivisionsPerMeasure = beats * divisionsPerBeat;

    let measureFilled = 0;
    let beamGroup = [];

    function flushBeamGroup() {
        if (beamGroup.length > 1) {
            beamGroup.forEach((n, i) => {
                if (i === 0) n.beam = '<beam number="1">begin</beam>';
                else if (i === beamGroup.length - 1) n.beam = '<beam number="1">end</beam>';
                else n.beam = '<beam number="1">continue</beam>';
            });
        }
        beamGroup.forEach(n => {
            musicxml += n.xml.replace("<!--BEAM-->", n.beam || "");
        });
        beamGroup = [];
    }

    let musicxml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<score-partwise version="3.1">
    <work><work-title>${title}</work-title></work>
    <part-list>
        <score-part id="P1"><part-name>${partName}</part-name></score-part>
    </part-list>
    <part id="P1">
        <measure number="1">
            <attributes>
                <divisions>${divisionsPerBeat}</divisions>
                <key><fifths>${key}</fifths></key>
                <time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>
                <clef><sign>${clef}</sign><line>${clef === "F" ? 4 : 2}</line></clef>
            </attributes>
`;

    input.forEach(line => {
        const [durStr, note] = line.split(/\s+/);
        if (!durStr || !note) return;

        const rawDur = parseFloat(durStr);
        const dotted = durStr.includes(".5");
        const durationVal = rawDur * divisionsPerBeat;

        let isRest = note.toLowerCase() === "rest";
        let remaining = durationVal;

        while (remaining > 0) {
            const space = totalDivisionsPerMeasure - measureFilled;
            const durThisMeasure = Math.min(remaining, space);

            let isTiedStart = remaining > durThisMeasure;
            let isTiedStop = measureFilled === 0 && remaining < durationVal;

            let noteXML = "";
            if (isRest) {
                noteXML = `<note><rest/><duration>${durThisMeasure}</duration>${dotted ? "<dot/>" : ""}</note>`;
                musicxml += noteXML;
                flushBeamGroup();
            } else {
                const match = note.match(/^([A-Ga-g])([#b]*)(\d)$/);
                if (!match) return;
                let step = match[1].toUpperCase();
                let accidental = match[2];
                let octave = match[3];
                let alter = accidental.includes("#") ? `<alter>${accidental.length}</alter>` :
                    accidental.includes("b") ? `<alter>-${accidental.length}</alter>` : "";

                noteXML = `<note>
                    <pitch><step>${step}</step>${alter}<octave>${octave}</octave></pitch>
                    <duration>${durThisMeasure}</duration>
                    ${dotted ? "<dot/>" : ""}
                    ${isTiedStart ? '<tie type="start"/><notations><tied type="start"/></notations>' : ""}
                    ${isTiedStop ? '<tie type="stop"/><notations><tied type="stop"/></notations>' : ""}
                    <!--BEAM-->
                </note>`;

                if (durThisMeasure <= divisionsPerBeat / 2) {
                    beamGroup.push({ xml: noteXML, beam: "" });
                } else {
                    flushBeamGroup();
                    musicxml += noteXML.replace("<!--BEAM-->", "");
                }
            }

            remaining -= durThisMeasure;
            measureFilled += durThisMeasure;

            if (measureFilled >= totalDivisionsPerMeasure) {
                flushBeamGroup();
                musicxml += "\n</measure>\n<measure>\n";
                measureFilled = 0;
            }
        }
    });

    flushBeamGroup();
    musicxml += `</measure></part></score-partwise>`;

    osmd.load(musicxml).then(() => osmd.render());
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });

    const renderDiv = document.getElementById("render");

    osmd.render();

    html2canvas(renderDiv, { scale: 2 }).then(function(canvas) {
        const imgData = canvas.toDataURL("image/png");

        const pdfWidth = 8.5 * 72;
        const pdfHeight = 11 * 72;

        const scale = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
        const width = canvas.width * scale;
        const height = canvas.height * scale;

        pdf.addImage(imgData, "PNG", (pdfWidth - width) / 2, 20, width, height);
        pdf.save("score.pdf");
    });
}

compile();

["input", "title", "partName", "clef", "key", "beats", "beatType"].forEach(id => {
    document.getElementById(id).addEventListener("input", compile);
});

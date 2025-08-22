const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay("render");

document.getElementById("mode-toggle").addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
});

function autoExpand(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
}

function flushBeamGroup(beamGroup, musicxml) {
    if (beamGroup.length > 1) {
        beamGroup.forEach((n, i) => {
            if (i === 0) {
                n.beam = '<beam number="1">begin</beam>';
            } else if (i === beamGroup.length - 1) {
                n.beam = '<beam number="1">end</beam>';
            } else {
                n.beam = '<beam number="1">continue</beam>';
            }
        });
    }

    beamGroup.forEach(n => {
        musicxml += n.xml.replace("<!--BEAM-->", n.beam || "");
    });

    return musicxml;
}

function compile() {
    const textarea = document.getElementById("input");
    autoExpand(textarea);
    textarea.removeEventListener("input", handleAutoExpand);
    textarea.addEventListener("input", handleAutoExpand);

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

    const lines = textarea.value.trim().split("\n");
    lines.forEach(line => {
        const [durStr, note] = line.split(/\s+/);
        if (!durStr || !note) return;

        const rawDur = parseFloat(durStr);
        const dotted = durStr.includes(".5");
        const durationVal = rawDur * divisionsPerBeat;

        const isRest = note.toLowerCase() === "rest";
        let remaining = durationVal;

        while (remaining > 0) {
            const space = totalDivisionsPerMeasure - measureFilled;
            const durThisMeasure = Math.min(remaining, space);

            const isTiedStart = remaining > durThisMeasure;
            const isTiedStop = measureFilled === 0 && remaining < durationVal;

            let noteXML = "";

            if (isRest) {
                noteXML = `<note>
    <rest/>
    <duration>${durThisMeasure}</duration>
    ${dotted ? "<dot/>" : ""}
</note>`;
                musicxml += noteXML;
                musicxml = flushBeamGroup(beamGroup, musicxml);
                beamGroup = [];
            } else {
                const match = note.match(/^([A-Ga-g])([#b]*)(\d)$/);
                if (!match) return;

                const [, stepRaw, accidental, octave] = match;
                const step = stepRaw.toUpperCase();
                const alter = accidental.includes("#")
                    ? `<alter>${accidental.length}</alter>`
                    : accidental.includes("b")
                        ? `<alter>-${accidental.length}</alter>`
                        : "";

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
                    musicxml = flushBeamGroup(beamGroup, musicxml);
                    beamGroup = [];
                    musicxml += noteXML.replace("<!--BEAM-->", "");
                }
            }

            remaining -= durThisMeasure;
            measureFilled += durThisMeasure;

            if (measureFilled >= totalDivisionsPerMeasure) {
                musicxml = flushBeamGroup(beamGroup, musicxml);
                beamGroup = [];
                musicxml += "\n</measure>\n<measure>\n";
                measureFilled = 0;
            }
        }
    });

    musicxml = flushBeamGroup(beamGroup, musicxml);
    musicxml += `</measure></part></score-partwise>`;

    osmd.load(musicxml).then(() => osmd.render());
}

function handleAutoExpand(e) {
    autoExpand(e.target);
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });

    const renderDiv = document.getElementById("render");
    const title = document.getElementById("title").value || "score";


    osmd.render();

    html2canvas(renderDiv, { scale: 2 }).then(canvas => {
        const imgData = canvas.toDataURL("image/png");

        const pdfWidth = 8.5 * 72;
        const pdfHeight = 11 * 72;

        const scale = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
        const width = canvas.width * scale;
        const height = canvas.height * scale;

        pdf.addImage(imgData, "PNG", (pdfWidth - width) / 2, 20, width, height);
        pdf.save(`${title}.pdf`);
    });
}

function exportToTXT() {
    const content = document.getElementById("input").value;
    const blob = new Blob([content], { type: "text/plain" });
    const title = document.getElementById("title").value || "score";

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${title}.txt`;
    link.click();

    URL.revokeObjectURL(link.href);
}

compile();

[
    "input",
    "title",
    "partName",
    "clef",
    "key",
    "beats",
    "beatType"
].forEach(id => {
    document.getElementById(id).addEventListener("input", compile);
});

const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay("render");

function compile() {
  const input = document.getElementById("input").value.trim().split("\n");

  const title = document.getElementById("title").value;
  const partName = document.getElementById("partName").value;
  const clef = document.getElementById("clef").value;
  const key = parseInt(document.getElementById("key").value);
  const beats = parseInt(document.getElementById("beats").value);
  const beatType = parseInt(document.getElementById("beatType").value);

  const divisionsPerBeat = 2;
  const totalDivisionsPerMeasure = beats * divisionsPerBeat;

  let measureFilled = 0;

  let musicxml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC
    "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
    "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work>
    <work-title>${title}</work-title>
  </work>
  <part-list>
    <score-part id="P1">
      <part-name>${partName}</part-name>
    </score-part>
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

    let remainingDuration = durationVal;

    while (remainingDuration > 0) {
      const spaceLeft = totalDivisionsPerMeasure - measureFilled;
      const durInThisMeasure = Math.min(remainingDuration, spaceLeft);

      const isTiedStart = remainingDuration > durInThisMeasure;
      const isTiedStop = measureFilled === 0 && remainingDuration < totalDivisionsPerMeasure;

      if (isRest) {
        musicxml += `
        <note>
          <rest/>
          <duration>${durInThisMeasure}</duration>
          ${dotted ? "<dot/>" : ""}
        </note>`;
      } else {
        const match = note.match(/^([A-Ga-g])([#b]*)(\d)$/);
        if (!match) return;

        let step = match[1].toUpperCase();
        let accidentals = match[2];
        let octave = match[3];

        let alter = "";
        if (accidentals.includes("#")) alter = `<alter>${accidentals.length}</alter>`;
        if (accidentals.includes("b")) alter = `<alter>-${accidentals.length}</alter>`;

        musicxml += `
        <note>
          <pitch>
            <step>${step}</step>
            ${alter}
            <octave>${octave}</octave>
          </pitch>
          <duration>${durInThisMeasure}</duration>
          ${dotted ? "<dot/>" : ""}
          ${isTiedStart ? '<tie type="start"/>' : ""}
          ${isTiedStop ? '<tie type="stop"/>' : ""}
          <notations>
            ${isTiedStart ? '<tied type="start"/>' : ""}
            ${isTiedStop ? '<tied type="stop"/>' : ""}
          </notations>
        </note>`;
      }

      remainingDuration -= durInThisMeasure;
      measureFilled += durInThisMeasure;

      if (measureFilled >= totalDivisionsPerMeasure) {
        musicxml += "\n</measure>\n<measure>\n";
        measureFilled = 0;
      }
    }
  });

  musicxml += `
    </measure>
  </part>
</score-partwise>`;

  osmd.load(musicxml).then(() => osmd.render());
}

async function exportToPDF() {
  await osmd.render();

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "letter"
  });

  const renderDiv = document.getElementById("render");

  const canvas = await html2canvas(renderDiv, { scale: 2 });
  const imgData = canvas.toDataURL("image/png");

  const pdfWidth = 8.5 * 72;
  const pdfHeight = 11 * 72;

  const scale = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
  const width = canvas.width * scale;
  const height = canvas.height * scale;

  pdf.addImage(imgData, "PNG", (pdfWidth - width) / 2, 20, width, height);

  pdf.save("score.pdf");
}

compile();

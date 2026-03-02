/**
 * Apps Script doPost for /api/exec proxy
 * - Accepts both shapes:
 *    { action:"saveSlot", slot: {...}, year, term, weekStartISO }
 *    OR
 *    { action:"saveSlot", scopeKey:"...", range:"", context:"", day:"", time:"", person:"", participantScheduled:true, participantCount:2, ... }
 */
function doPost(e) {
  try {
    const raw = e.postData && e.postData.type === "application/json" ? e.postData.contents : (e.postData && e.postData.contents) || "";
    const body = raw ? JSON.parse(raw) : {};
    const action = body.action || "";

    if (action !== "saveSlot") {
      return jsonResponse({ ok: false, error: "unsupported action" });
    }

    // Normalize slot: support nested slot or flattened
    let slot = {};
    if (body.slot && typeof body.slot === "object") {
      slot = body.slot;
    } else {
      // copy known keys from top-level into slot
      const fields = ["scopeKey","range","context","day","time","timeRaw","slotKey","person","participantScheduled","participantCount","updatedAtISO","updatedBy","year","term","weekStartISO"];
      fields.forEach(k => { if (typeof body[k] !== "undefined") slot[k] = body[k]; });
    }

    // Basic validation
    const required = ["scopeKey","range","context","day","time"];
    const missing = required.filter(x => !slot[x]);
    if (missing.length) {
      return jsonResponse({ ok: false, error: "Missing slot coordinates."});
    }

    // Normalize types
    slot.participantScheduled = !!slot.participantScheduled;
    slot.participantCount = Number.isFinite(Number(slot.participantCount)) ? Number(slot.participantCount) : (slot.participantScheduled ? 1 : 0);
    slot.person = (typeof slot.person === "string") ? slot.person : String(slot.person || "");
    slot.updatedAtISO = slot.updatedAtISO || (new Date()).toISOString();
    slot.updatedBy = (slot.updatedBy && String(slot.updatedBy).trim()) ? String(slot.updatedBy).trim() : "unknown";

    // Open the sheet and find headers -> column indices
    const ss = SpreadsheetApp.openById(SHEET_ID); // set SHEET_ID above or retrieve by name
    const sh = ss.getSheetByName(SHEET_NAME); // e.g., "sheet1"
    const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(h => String(h||"").trim());

    // Map column indices by header name
    const idx = (name) => {
      const i = headers.indexOf(name);
      return i >= 0 ? i + 1 : -1;
    };

    // Define header names you expect in the sheet (adjust if your sheet uses different names)
    const COL_SCOPEKEY = idx("scopeKey");
    const COL_SLOTKEY  = idx("slotKey");
    const COL_RANGE    = idx("range");
    const COL_CONTEXT  = idx("context");
    const COL_DAY      = idx("day");
    const COL_TIME     = idx("time");
    const COL_PERSON   = idx("person");
    const COL_PART_SCH = idx("participantScheduled");
    const COL_PART_CNT = idx("participantCount");
    const COL_UPDATED  = idx("updatedAtISO");
    const COL_UPDATED_BY = idx("updatedBy");

    // Build a normalized key to find the row: prefer slotKey, else match by scopeKey+range+context+day+time
    const targetKey = slot.slotKey || `${slot.range}::${slot.context}::${slot.day}::${slot.time}`;
    const data = sh.getDataRange().getValues();
    let rowIndex = -1;

    // Search rows (skip header row 1)
    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      // Try direct slotKey column if available
      if (COL_SLOTKEY > 0 && row[COL_SLOTKEY - 1] && String(row[COL_SLOTKEY - 1]).trim() === targetKey) { rowIndex = r + 1; break; }
      // Else try matching scopeKey + range + context + day + time
      const matchScope = (COL_SCOPEKEY>0?String(row[COL_SCOPEKEY-1]).trim():"") === String(slot.scopeKey).trim();
      const matchRange = (COL_RANGE>0?String(row[COL_RANGE-1]).trim():"") === String(slot.range).trim();
      const matchCtx   = (COL_CONTEXT>0?String(row[COL_CONTEXT-1]).trim():"") === String(slot.context).trim();
      const matchDay   = (COL_DAY>0?String(row[COL_DAY-1]).trim():"") === String(slot.day).trim();
      const matchTime  = (COL_TIME>0?String(row[COL_TIME-1]).trim():"") === String(slot.time).trim();
      if (matchScope && matchRange && matchCtx && matchDay && matchTime) { rowIndex = r + 1; break; }
    }

    // If not found, append a new row at bottom
    if (rowIndex === -1) {
      const newRow = [];
      for (let c=0;c<headers.length;c++){
        const h = headers[c];
        switch(String(h).trim()){
          case "scopeKey": newRow.push(slot.scopeKey); break;
          case "range": newRow.push(slot.range); break;
          case "context": newRow.push(slot.context); break;
          case "day": newRow.push(slot.day); break;
          case "time": newRow.push(slot.time); break;
          case "slotKey": newRow.push(targetKey); break;
          case "person": newRow.push(slot.person); break;
          case "participantScheduled": newRow.push(slot.participantScheduled ? "TRUE" : "FALSE"); break;
          case "participantCount": newRow.push(slot.participantCount); break;
          case "updatedAtISO": newRow.push(slot.updatedAtISO); break;
          case "updatedBy": newRow.push(slot.updatedBy); break;
          default: newRow.push(""); break;
        }
      }
      sh.appendRow(newRow);
      return jsonResponse({ ok:true, updated:true, message:"appended" });
    }

    // Write into the found row using the mapped columns
    const writes = [];
    if (COL_PERSON>0) writes.push({col:COL_PERSON, val:slot.person});
    if (COL_PART_SCH>0) writes.push({col:COL_PART_SCH, val: slot.participantScheduled ? "TRUE" : "FALSE"});
    if (COL_PART_CNT>0) writes.push({col:COL_PART_CNT, val: slot.participantCount});
    if (COL_UPDATED>0) writes.push({col:COL_UPDATED, val: slot.updatedAtISO});
    if (COL_UPDATED_BY>0) writes.push({col:COL_UPDATED_BY, val: slot.updatedBy});
    // Also ensure slotKey is present if column exists
    if (COL_SLOTKEY>0) writes.push({col:COL_SLOTKEY, val: targetKey});
    // perform writes as batch
    writes.forEach(w => { sh.getRange(rowIndex, w.col).setValue(w.val); });

    return jsonResponse({ ok:true, updated:true, message:"updated" });

  } catch (err) {
    return jsonResponse({ ok:false, error: String(err) });
  }
}

// helper to return ContentService JSON
function jsonResponse(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

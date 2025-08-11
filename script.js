/**
 * @typedef {('M'|'T'|'W'|'H'|'F'|'S')} Days
 */
/**
 * @typedef {Object} MLSClassSchedule
 * @property {Array<Days>} day
 * @property {string} room
 * @property {number} startTime - minutes from 7:30am
 * @property {number} endTime - minutes from 7:30am
 */
/**
 * @typedef {Object} MLSClass
 * @property {string} queryString
 * @property {string} section
 * @property {string} professor
 * @property {Array<MLSClassSchedule>} schedule
 */

// look if table exists
const tableString =
    "body > table:nth-child(5) > tbody > tr > td > table > tbody > tr:nth-child(3) > td > table > tbody > tr > td:nth-child(2) > form > table";
// from MLS

/** @type {HTMLTableElement} */
const table = document.querySelector(tableString);
if (table) {
    // parse table
    const rows = Array.from(table.querySelectorAll("tr")).entries();
    rows.next(); // skip header row

    /** @type {Array<MLSClass>} */
    const classes = [];

    /** @type {Partial<MLSClass>} */
    var currentClass;
    let invalidFlag = false;
    /** @type {Array<Days>} */
    let dayBuffer = [];
    for (const [index, row] of rows) {
        // check if row is a new class
        const cells = row.querySelectorAll("td");

        // skip prof lines
        if (cells.length != 9) continue;

        const firstCellTextLen = cells[0]?.textContent?.trim().length ?? 0;
        if (firstCellTextLen > 0) {
            // new class
            if (currentClass) {
                // save current class
                classes.push(/** @type {MLSClass} */ (currentClass));

                // reset current class
                currentClass = {
                    schedule: [],
                };
            }
            if (invalidFlag) {
                if ((cells[0]?.textContent?.trim().length ?? 0) === 0) {
                    // continue until next class
                    continue;
                } else {
                    invalidFlag = false;
                }
            }

            // check if it is a valid class
            // day/s field
            const dayPath = "td:nth-child(4)";
            const dayText =
                row.querySelector(dayPath)?.textContent?.trim() ?? "";
            if (
                !dayText
                    .split("")
                    .every((v) => ["M", "T", "W", "H", "F", "S"].includes(v)) ||
                dayText.length == 0
            ) {
                // invalid class
                invalidFlag = true;
                continue;
            }

            // new class (validated)
            currentClass = {};
            currentClass.schedule = [];

            for (const [cellIndex, cell] of Array.from(cells).entries()) {
                const text = cell.textContent?.trim() || "";
                switch (cellIndex) {
                    case 0: // class number
                    case 1: // course code
                    case 5: // room (already handled by time)
                    case 6: // enrollment cap
                    case 7: // enrolled
                    case 8: // remarks
                        continue;
                    case 2: // section
                        currentClass.section = text;
                        break;
                    case 3: // day/s
                        /** @type {Array<Days>} */
                        dayBuffer = text.split("");
                        break;
                    case 4: // time
                        /**
                         * @param {string} time
                         * @returns {number}
                         */
                        const timeConvert = (time) => {
                            const hour = time.slice(0, 2);
                            const minute = time.slice(2, 4);
                            return parseInt(hour) * 60 + parseInt(minute) - 450; // mins since 7:30am
                        };
                        const times = text.split(" - ").map(timeConvert);

                        currentClass.schedule.push({
                            day: dayBuffer,
                            room: cells[5]?.textContent?.trim() || "",
                            startTime: times[0] ?? 0,
                            endTime: times[1] ?? 0,
                        });

                        // reset day buffer
                        dayBuffer = [];
                        break;
                }
            }
        } else {
            // continuation
            for (const [cellIndex, cell] of Array.from(cells).entries()) {
                if (invalidFlag) continue;
                if (cellIndex <= 2) continue;
                if (cellIndex >= 5) break;

                const text = cell.textContent?.trim() || "";
                switch (cellIndex) {
                    case 3: // day/s
                        /** @type {Array<Days>} */
                        dayBuffer = text.split("");
                        break;
                    case 4: // time
                        /**
                         * @param {string} time
                         * @returns {number}
                         */
                        const timeConvert = (time) => {
                            const hour = time.slice(0, 2);
                            const minute = time.slice(2, 4);
                            return parseInt(hour) * 60 + parseInt(minute) - 450; // mins since 7:30am
                        };
                        const times = text.split(" - ").map(timeConvert);

                        currentClass.schedule?.push({
                            day: dayBuffer,
                            room: cells[5]?.textContent?.trim() || "",
                            startTime: times[0] ?? 0,
                            endTime: times[1] ?? 0,
                        });

                        // reset day buffer
                        dayBuffer = [];
                        break;
                }
            }
        }
    }

    if (classes.length != 0) {
        // remove margins of table
        table.style.setProperty("margin-inline", "0");

        // create parent flex div
        const flexDiv = document.createElement("div");
        flexDiv.style.setProperty("display", "flex");
        flexDiv.style.setProperty("justify-content", "space-around");

        table.parentElement.insertBefore(flexDiv, table);
        // remove table
        flexDiv.appendChild(table);
        // table.remove();

        // create and insert a div immediately after the table
        const scheduleDiv = document.createElement("div");
        scheduleDiv.style.setProperty("display", "inline-flex");
        scheduleDiv.style.setProperty("flex-grow", "1");
        scheduleDiv.style.setProperty("gap", "1rem");
        scheduleDiv.style.setProperty("min-height", "80vh");
        scheduleDiv.style.setProperty("max-height", "150vh");

        for (const day of ["M", "T", "W", "H", "F", "S"]) {
            const dayDiv = document.createElement("div");
            dayDiv.style.setProperty("display", "flex");
            dayDiv.style.setProperty("flex-direction", "column");
            dayDiv.style.setProperty("background", "lightgray");
            dayDiv.style.setProperty("flex-basis", "16%");
            // add day label
            const label = document.createElement("p");
            label.textContent = day;
            dayDiv.appendChild(label);

            const relDiv = document.createElement("div");
            relDiv.style.setProperty("position", "relative");
            relDiv.style.setProperty("flex-grow", "1");
            dayDiv.appendChild(relDiv);

            // process classes
            const filteredClasses = classes.filter((v) =>
                v.schedule.some((s) => s.day.includes(day))
            );

            /**
             * @type {{[key: string]: MLSClass[]}}
             */
            const blocks = filteredClasses.reduce((p, v) => {
                let keyString;
                for (const sched of v.schedule) {
                    if (!sched.day.includes(day)) continue;
                    keyString = `${sched.startTime}-${sched.endTime}`;
                }
                if (keyString in p) {
                    p[keyString].push(v);
                } else {
                    p[keyString] = [v];
                }
                return p;
            }, {});

            const blocksArray = Object.entries(blocks);
            blocksArray.sort((a, b) => a[0].split("-")[0] - b[0].split("-")[0]);

            /** @param {number} time */
            const normalize = (time) => (time / 825) * 100;
            for (const [key, clsList] of blocksArray) {
                const scheduleBlock = document.createElement("div");
                const [start, end] = key.split("-");
                scheduleBlock.style.setProperty("position", "absolute");
                scheduleBlock.style.setProperty("display", "flex");
                scheduleBlock.style.setProperty("top", `${normalize(start)}%`);
                scheduleBlock.style.setProperty(
                    "height",
                    `${normalize(end - start)}%`
                );
                scheduleBlock.style.setProperty("flex-direction", "column");
                scheduleBlock.style.setProperty(
                    "justify-content",
                    "space-between"
                );

                let p = document.createElement("p");
                p.textContent = start;
                p.style.setProperty("margin", "0");
                p.style.setProperty("font-size", "0.80rem");
                scheduleBlock.appendChild(p);
                for (const sect of clsList) {
                    p = document.createElement("p");
                    p.style.setProperty("margin", "0");
                    p.textContent = sect.section;
                    scheduleBlock.appendChild(p);
                }
                p = document.createElement("p");
                p.textContent = end;
                p.style.setProperty("margin", "0");
                p.style.setProperty("font-size", "0.80rem");
                scheduleBlock.appendChild(p);
                relDiv.appendChild(scheduleBlock);
            }
            scheduleDiv.appendChild(dayDiv);
        }

        table.insertAdjacentElement("afterend", scheduleDiv);
    }
}

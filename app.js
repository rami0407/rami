import { fetchScheduleData, saveScheduleData } from './firebase-db.js';

// State Management
let teachers = [];
let homeroomAssignments = {};
let tableState = {};
const subjects = [
    "ערבית", 
    "היסטוריה", 
    "גיאוגרפיה", 
    "דת אסלאם", 
    "מולדת",
    "חינוך גופני", 
    "אומנות", 
    "מפתח הלב", 
    "כישורי חיים", 
    "חשבון", 
    "מדעים", 
    "אנגלית", 
    "עברית",
    "העשרה",
    "זהירות בדרכים"
];
const classes = [
    'א1', 'א2', 'א3',
    'ב1', 'ב2', 'ב3',
    'ג1', 'ג2', 'ג3',
    'ד1', 'ד2', 'ד3',
    'ה1', 'ה2', 'ה3',
    'ו1', 'ו2', 'ו3', 'ו4'
];

// DOM Elements
const addTeacherForm = document.getElementById('add-teacher-form');
const teacherNameInput = document.getElementById('teacher-name');
const teacherMaxHoursInput = document.getElementById('teacher-max-hours');
const teachersListDiv = document.getElementById('teachers-list');
const totalTeachersSpan = document.getElementById('total-teachers');
const scheduleBody = document.getElementById('schedule-body');
const clearBoardBtn = document.getElementById('clear-board-btn');
const exportExcelBtn = document.getElementById('export-excel-btn');
const exportPdfBtn = document.getElementById('export-pdf-btn');


// Initialize App
function ensureTeacherColors() {
    let changed = false;
    teachers.forEach((t, i) => {
        if (!t.color) {
            const hue = (i * 137.5) % 360; // Golden angle for even distribution
            t.color = `hsl(${Math.round(hue)}, 70%, 85%)`;
            changed = true;
        }
    });
    if (changed) saveToLocalStorage();
}

async function init() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-overlay';
    loadingDiv.innerHTML = '<div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(255,255,255,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; font-size:24px; font-weight:bold; color:var(--primary-color);">جاري تحميل البيانات من السحابة...</div>';
    document.body.appendChild(loadingDiv);

    const data = await fetchScheduleData();
    if (data) {
        teachers = data.teachers || [];
        homeroomAssignments = data.homeroomAssignments || {};
        tableState = data.tableState || {};
    }

    if (document.getElementById('loading-overlay')) {
        document.body.removeChild(document.getElementById('loading-overlay'));
    }

    ensureTeacherColors();
    renderTeachersList();
    renderHomeroomRow();
    renderTable();
    updateAllAllocations();
}

// Event Listeners
addTeacherForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = teacherNameInput.value.trim();
    const maxHours = parseInt(teacherMaxHoursInput.value);
    
    if (name && maxHours > 0) {
        // Check if teacher already exists
        if (teachers.some(t => t.name === name)) {
            alert('מורה בשם זה כבר קיים במערכת.');
            return;
        }

        const hue = (teachers.length * 137.5) % 360;
        const newTeacher = {
            id: Date.now().toString(),
            name: name,
            maxHours: maxHours,
            assignedHours: 0,
            color: `hsl(${Math.round(hue)}, 70%, 85%)`
        };
        
        teachers.push(newTeacher);
        saveToLocalStorage();
        
        teacherNameInput.value = '';
        teacherMaxHoursInput.value = '';
        
        updateSelectDropdowns();
        renderTeachersList();
    }
});

clearBoardBtn.addEventListener('click', () => {
    if(confirm('האם אתה בטוח שברצונך למחוק את כל השיבוצים בטבלה? (פעולה זו לא תמחק את המורים)')) {
        const inputs = document.querySelectorAll('.cell-hours');
        const selects = document.querySelectorAll('.cell-select');
        
        inputs.forEach(input => input.value = '');
        selects.forEach(select => {
            select.value = '';
            select.parentElement.classList.remove('has-data');
            select.parentElement.style.backgroundColor = '';
        });
        
        updateAllAllocations();
        saveTableState();
    }
});

if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', () => {
        const originalTable = document.getElementById('schedule-table');
        if (!originalTable) return;
        
        const clonedTable = originalTable.cloneNode(true);
        
        const homeroomSelectsOrig = originalTable.querySelectorAll('.homeroom-select');
        const homeroomSelectsCloned = clonedTable.querySelectorAll('.homeroom-select');
        homeroomSelectsOrig.forEach((select, i) => {
            let text = '';
            if (select.value) {
                const opt = select.options[select.selectedIndex];
                if(opt) text = opt.textContent.split(' (')[0];
            }
            homeroomSelectsCloned[i].parentElement.textContent = text;
        });

        const cellsOrig = originalTable.querySelectorAll('.cell-content');
        const cellsCloned = clonedTable.querySelectorAll('.cell-content');
        cellsOrig.forEach((cell, i) => {
            const select = cell.querySelector('.cell-select');
            const input = cell.querySelector('.cell-hours');
            let text = '';
            if (select && input && select.value && input.value) {
                const opt = select.options[select.selectedIndex];
                if (opt) {
                    const teacherName = opt.textContent.split(' (')[0];
                    text = `${teacherName} (${input.value} ש"ש)`;
                }
            }
            cellsCloned[i].parentElement.textContent = text;
        });

        const wb = XLSX.utils.table_to_book(clonedTable, { sheet: "שיבוץ שעות", raw: true });
        
        const ws = wb.Sheets["שיבוץ שעות"];
        if (!ws['!views']) ws['!views'] = [];
        ws['!views'].push({ rightToLeft: true });

        XLSX.writeFile(wb, "מערכת_שיבוץ_מורים.xlsx");
    });
}

if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
        const originalTable = document.getElementById('schedule-table');
        if (!originalTable) return;
        
        exportPdfBtn.textContent = 'מכין PDF...';
        exportPdfBtn.disabled = true;
        
        setTimeout(() => {
            try {
                const clonedTable = originalTable.cloneNode(true);
                clonedTable.style.width = '100%';
                clonedTable.style.borderCollapse = 'collapse';
                clonedTable.style.direction = 'rtl';
                clonedTable.style.fontFamily = "'Rubik', sans-serif";
                
                const homeroomSelectsOrig = originalTable.querySelectorAll('.homeroom-select');
                const homeroomSelectsCloned = clonedTable.querySelectorAll('.homeroom-select');
                homeroomSelectsOrig.forEach((select, i) => {
                    const val = select.value;
                    let text = 'מחנך/ת';
                    if (val) {
                        const opt = select.options[select.selectedIndex];
                        if(opt) text = opt.textContent.split(' (')[0];
                    }
                    const span = document.createElement('span');
                    span.textContent = text;
                    span.style.fontWeight = 'bold';
                    span.style.display = 'block';
                    span.style.marginTop = '4px';
                    
                    homeroomSelectsCloned[i].replaceWith(span);
                });

                const cellsOrig = originalTable.querySelectorAll('.cell-content');
                const cellsCloned = clonedTable.querySelectorAll('.cell-content');
                cellsOrig.forEach((cell, i) => {
                    const select = cell.querySelector('.cell-select');
                    const input = cell.querySelector('.cell-hours');
                    let text = '';
                    if (select && input && select.value && input.value) {
                        const opt = select.options[select.selectedIndex];
                        if (opt) {
                            const teacherName = opt.textContent.split(' (')[0];
                            text = `${teacherName}\n(${input.value} ש"ש)`;
                        }
                    }
                    
                    cellsCloned[i].innerHTML = '';
                    if (text) {
                        const span = document.createElement('span');
                        span.innerText = text;
                        span.style.fontSize = '12px';
                        span.style.fontWeight = 'bold';
                        span.style.color = '#2b2d42';
                        span.style.textAlign = 'center';
                        cellsCloned[i].appendChild(span);
                    }
                });

                const thsAndTds = clonedTable.querySelectorAll('th, td');
                thsAndTds.forEach(el => {
                    el.style.border = '1px solid #cbd5e1';
                    el.style.padding = '8px';
                    el.style.position = 'static'; 
                });

                const pdfContainer = document.createElement('div');
                pdfContainer.style.padding = '20px';
                pdfContainer.style.background = '#ffffff';
                // Set container to LTR to bypass html2canvas RTL bug
                pdfContainer.style.direction = 'ltr'; 
                pdfContainer.style.fontFamily = "'Rubik', sans-serif";
                pdfContainer.style.width = 'max-content'; 
                
                const title = document.createElement('h2');
                title.textContent = 'שיבוץ שעות מרכזי';
                title.style.textAlign = 'center';
                title.style.color = '#4361ee';
                title.style.marginBottom = '20px';
                title.style.fontSize = '24px';
                title.style.direction = 'rtl'; // Keep title RTL
                
                clonedTable.style.direction = 'rtl'; // Keep table RTL
                
                pdfContainer.appendChild(title);
                pdfContainer.appendChild(clonedTable);

                // Append to body temporarily so html2canvas renders the full node
                pdfContainer.style.position = 'absolute';
                pdfContainer.style.left = '-15000px'; 
                pdfContainer.style.top = '0';
                document.body.appendChild(pdfContainer);

                setTimeout(() => {
                    const rect = pdfContainer.getBoundingClientRect();
                    const opt = {
                        margin:       10,
                        filename:     'מערכת_שיבוץ_מורים.pdf',
                        image:        { type: 'jpeg', quality: 1 },
                        html2canvas:  { 
                            scale: 2, 
                            useCORS: true,
                            width: rect.width,
                            height: rect.height,
                            windowWidth: rect.width + 100,
                            onclone: (clonedDoc) => {
                                // Force the cloning iframe to LTR so html2canvas calculates X coordinates correctly
                                clonedDoc.documentElement.dir = 'ltr';
                                clonedDoc.body.dir = 'ltr';
                            }
                        },
                        jsPDF:        { unit: 'mm', format: 'a2', orientation: 'landscape' }
                    };

                    html2pdf().set(opt).from(pdfContainer).save().then(() => {
                        exportPdfBtn.textContent = 'ייצוא ל-PDF';
                        exportPdfBtn.disabled = false;
                        document.body.removeChild(pdfContainer);
                    }).catch(err => {
                        console.error('PDF Error:', err);
                        alert('שגיאה ביצירת PDF. נסה שוב.');
                        exportPdfBtn.textContent = 'ייצוא ל-PDF';
                        exportPdfBtn.disabled = false;
                        document.body.removeChild(pdfContainer);
                    });
                }, 100);

            } catch (err) {
                console.error(err);
                exportPdfBtn.textContent = 'ייצוא ל-PDF';
                exportPdfBtn.disabled = false;
            }
        }, 100);
    });
}


// Remove Teacher
window.removeTeacher = function(id) {
    if(confirm('האם להסיר מורה זה? כל השיבוצים שלו יתאפסו.')) {
        teachers = teachers.filter(t => t.id !== id);
        
        // Remove from table
        const selects = document.querySelectorAll('.cell-select');
        selects.forEach(select => {
            if(select.value === id) {
                select.value = '';
                const hoursInput = select.nextElementSibling;
                hoursInput.value = '';
                select.parentElement.classList.remove('has-data');
                select.parentElement.style.backgroundColor = '';
            }
        });
        
        saveToLocalStorage();
        saveTableState();
        updateSelectDropdowns();
        updateAllAllocations();
        renderTeachersList();
    }
}

// Edit Teacher
window.editTeacher = function(id) {
    const teacher = teachers.find(t => t.id === id);
    if (!teacher) return;
    
    const newName = prompt("הכנס שם מורה חדש:", teacher.name);
    if (newName === null) return;
    
    const newHoursStr = prompt("הכנס מכסת שעות חדשה:", teacher.maxHours);
    if (newHoursStr === null) return;
    
    const newHours = parseInt(newHoursStr);
    
    if (newName.trim() !== '' && !isNaN(newHours) && newHours > 0) {
        if (newName.trim() !== teacher.name && teachers.some(t => t.name === newName.trim())) {
            alert('מורה בשם זה כבר קיים במערכת.');
            return;
        }
        
        teacher.name = newName.trim();
        teacher.maxHours = newHours;
        
        saveToLocalStorage();
        updateSelectDropdowns();
        updateAllAllocations();
        renderTeachersList();
    } else {
        alert('נתונים לא חוקיים. אנא ודא שהשם אינו ריק ומספר השעות גדול מ-0.');
    }
}

// Helper for dynamic teacher text
function getTeacherStatusText(teacher) {
    const remaining = teacher.maxHours - teacher.assignedHours;
    if (remaining === 0) return `${teacher.name} (מלאה)`;
    if (remaining < 0) return `${teacher.name} (חריגה ${Math.abs(remaining)})`;
    return `${teacher.name} (נותרו ${remaining})`;
}

function updateDropdownText() {
    const selects = document.querySelectorAll('.cell-select, .homeroom-select');
    selects.forEach(select => {
        Array.from(select.options).forEach(opt => {
            if (opt.value) {
                const teacher = teachers.find(t => t.id === opt.value);
                if (teacher) {
                    opt.textContent = getTeacherStatusText(teacher);
                }
            }
        });
    });
}

// Rendering Functions
function renderTeachersList() {
    totalTeachersSpan.textContent = teachers.length;
    
    if (teachers.length === 0) {
        teachersListDiv.innerHTML = '<div class="empty-state">לא הוגדרו מורים עדיין. הוסף מורה כדי להתחיל.</div>';
        return;
    }

    // Sort by name
    const sortedTeachers = [...teachers].sort((a, b) => a.name.localeCompare(b.name, 'he'));
    
    teachersListDiv.innerHTML = '';
    
    sortedTeachers.forEach(teacher => {
        const remaining = teacher.maxHours - teacher.assignedHours;
        let statusClass = 'status-good';
        let statusText = `נותרו ${remaining} שעות`;
        
        if (remaining === 0) {
            statusClass = 'status-perfect';
            statusText = 'מכסה מלאה';
        } else if (remaining < 0) {
            statusClass = 'status-danger';
            statusText = `חריגה ב-${Math.abs(remaining)} שעות!`;
        }

        const percentage = Math.min((teacher.assignedHours / teacher.maxHours) * 100, 100);

        const card = document.createElement('div');
        card.className = `teacher-card ${statusClass}`;
        card.innerHTML = `
            <div class="teacher-header">
                <span class="teacher-name"><span style="display:inline-block; width:12px; height:12px; border-radius:50%; background-color:${teacher.color}; margin-left:8px; border:1px solid rgba(0,0,0,0.1);"></span>${teacher.name}</span>
                <div class="teacher-actions">
                    <button class="teacher-edit" onclick="editTeacher('${teacher.id}')" title="ערוך מורה">✎</button>
                    <button class="teacher-delete" onclick="removeTeacher('${teacher.id}')" title="הסר מורה">×</button>
                </div>
            </div>
            <div class="teacher-stats">
                <span>מכסה: ${teacher.maxHours}</span>
                <span>שובצו: <strong>${teacher.assignedHours}</strong></span>
            </div>
            <div class="teacher-stats" style="margin-top: 2px;">
                <span style="font-weight: 500;">${statusText}</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${percentage}%"></div>
            </div>
        `;
        teachersListDiv.appendChild(card);
    });
}

function renderTable() {
    scheduleBody.innerHTML = '';
    const savedState = tableState;

    subjects.forEach((subject, rowIndex) => {
        const tr = document.createElement('tr');
        
        // Subject Name Cell
        const tdSubject = document.createElement('td');
        tdSubject.className = 'subject-name';
        tdSubject.textContent = subject;
        tr.appendChild(tdSubject);
        
        // Classes Cells
        classes.forEach((cls, colIndex) => {
            const cellId = `cell-${rowIndex}-${colIndex}`;
            const td = document.createElement('td');
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'cell-content';
            
            const select = document.createElement('select');
            select.className = 'cell-select';
            select.dataset.cellId = cellId;
            select.innerHTML = '<option value="">בחר מורה</option>';
            
            // Populate options from teachers array
            [...teachers].sort((a, b) => a.name.localeCompare(b.name, 'he')).forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = getTeacherStatusText(t);
                select.appendChild(opt);
            });

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'cell-hours';
            input.dataset.cellId = cellId;
            input.min = '0';
            input.max = '20';
            input.placeholder = 'ש"ש';
            
            if (savedState && savedState[cellId]) {
                select.value = savedState[cellId].teacherId || '';
                input.value = savedState[cellId].hours || '';
                if(select.value && input.value) {
                    contentDiv.classList.add('has-data');
                    const teacher = teachers.find(t => t.id === select.value);
                    if (teacher && teacher.color) {
                        contentDiv.style.backgroundColor = teacher.color;
                    }
                }
            }

            // Listeners for changes
            select.addEventListener('change', () => {
                handleCellChange(select, input, contentDiv);
            });
            input.addEventListener('input', () => {
                handleCellChange(select, input, contentDiv);
            });

            contentDiv.appendChild(select);
            contentDiv.appendChild(input);
            td.appendChild(contentDiv);
            tr.appendChild(td);
        });
        
        // Total Cell
        const tdTotal = document.createElement('td');
        tdTotal.className = 'row-total';
        tdTotal.id = `total-${rowIndex}`;
        tdTotal.textContent = '0';
        tr.appendChild(tdTotal);
        scheduleBody.appendChild(tr);
    });

    // Render footer
    const footer = document.getElementById('schedule-footer');
    if (footer) {
        footer.innerHTML = '';
        const footerTr = document.createElement('tr');
        
        const footerTitle = document.createElement('td');
        footerTitle.className = 'subject-name';
        footerTitle.textContent = 'סה"כ שעות לכיתה';
        footerTitle.style.backgroundColor = '#eef2f6';
        footerTr.appendChild(footerTitle);

        classes.forEach((cls, colIndex) => {
            const tdColTotal = document.createElement('td');
            tdColTotal.className = 'col-total';
            tdColTotal.id = `col-total-${colIndex}`;
            tdColTotal.textContent = '0';
            tdColTotal.style.fontWeight = 'bold';
            tdColTotal.style.backgroundColor = '#eef2f6';
            tdColTotal.style.color = 'var(--primary-color)';
            footerTr.appendChild(tdColTotal);
        });

        const tdGrandTotal = document.createElement('td');
        tdGrandTotal.className = 'grand-total';
        tdGrandTotal.id = 'grand-total';
        tdGrandTotal.textContent = '0';
        tdGrandTotal.style.backgroundColor = '#3a53d0';
        tdGrandTotal.style.color = 'white';
        tdGrandTotal.style.fontWeight = 'bold';
        footerTr.appendChild(tdGrandTotal);

        footer.appendChild(footerTr);
    }
}

function updateSelectDropdowns() {
    const selects = document.querySelectorAll('.cell-select');
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">בחר מורה</option>';
        [...teachers].sort((a, b) => a.name.localeCompare(b.name, 'he')).forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = getTeacherStatusText(t);
            select.appendChild(opt);
        });
        // Restore value if teacher still exists
        if(teachers.some(t => t.id === currentValue)) {
            select.value = currentValue;
        } else {
            select.parentElement.classList.remove('has-data');
            select.nextElementSibling.value = '';
        }
    });

    const homeroomSelects = document.querySelectorAll('.homeroom-select');
    homeroomSelects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">מחנך/ת</option>';
        [...teachers].sort((a, b) => a.name.localeCompare(b.name, 'he')).forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = getTeacherStatusText(t);
            select.appendChild(opt);
        });
        if(teachers.some(t => t.id === currentValue)) {
            select.value = currentValue;
        } else {
            const colIndex = select.dataset.colIndex;
            delete homeroomAssignments[colIndex];
            saveHomeroomAssignments();
        }
    });
}

function handleCellChange(select, input, container) {
    if (select.value && input.value && input.value > 0) {
        container.classList.add('has-data');
        const teacher = teachers.find(t => t.id === select.value);
        if (teacher && teacher.color) {
            container.style.backgroundColor = teacher.color;
        } else {
            container.style.backgroundColor = '';
        }
    } else {
        container.classList.remove('has-data');
        container.style.backgroundColor = '';
    }
    updateAllAllocations();
    saveTableState();
}

function updateAllAllocations() {
    // Reset all
    teachers.forEach(t => t.assignedHours = 0);
    
    const selects = document.querySelectorAll('.cell-select');
    const inputs = document.querySelectorAll('.cell-hours');
    
    selects.forEach((select, index) => {
        const teacherId = select.value;
        const hours = parseInt(inputs[index].value) || 0;
        
        if (teacherId && hours > 0) {
            const teacher = teachers.find(t => t.id === teacherId);
            if (teacher) {
                teacher.assignedHours += hours;
            }
        }
    });
    
    saveToLocalStorage();
    renderTeachersList();
    updateRowTotals();
    updateDropdownText();
    renderMiniSidebar();
}

function renderMiniSidebar() {
    const container = document.getElementById('mini-teachers-list');
    if (!container) return;
    
    if (teachers.length === 0) {
        container.innerHTML = '<div class="empty-state">לא הוגדרו מורים</div>';
        return;
    }

    const sortedTeachers = [...teachers].sort((a, b) => a.name.localeCompare(b.name, 'he'));
    container.innerHTML = '';
    
    sortedTeachers.forEach(teacher => {
        const remaining = teacher.maxHours - teacher.assignedHours;
        let statusClass = 'status-good';
        
        if (remaining === 0) statusClass = 'status-perfect';
        else if (remaining < 0) statusClass = 'status-danger';

        const card = document.createElement('div');
        card.className = `mini-teacher-card ${statusClass}`;
        card.innerHTML = `
            <div class="name">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${teacher.color}; border:1px solid rgba(0,0,0,0.1);"></span>
                ${teacher.name}
            </div>
            <div class="stats">
                <span>מכסה: ${teacher.maxHours}</span>
                <span style="font-weight: 500;">שובצו: ${teacher.assignedHours}</span>
            </div>
        `;
        container.appendChild(card);
    });
}

function updateRowTotals() {
    let grandTotal = 0;
    const colTotals = new Array(classes.length).fill(0);

    subjects.forEach((subject, rowIndex) => {
        let sum = 0;
        classes.forEach((cls, colIndex) => {
            const input = document.querySelector(`.cell-hours[data-cell-id="cell-${rowIndex}-${colIndex}"]`);
            if (input && input.value) {
                const val = parseInt(input.value) || 0;
                sum += val;
                colTotals[colIndex] += val;
            }
        });
        const totalCell = document.getElementById(`total-${rowIndex}`);
        if (totalCell) {
            totalCell.textContent = sum;
            if (sum > 0) {
                totalCell.style.fontWeight = 'bold';
                totalCell.style.color = 'var(--primary-color)';
                totalCell.style.backgroundColor = 'rgba(76, 201, 240, 0.15)';
            } else {
                totalCell.style.fontWeight = 'normal';
                totalCell.style.color = 'inherit';
                totalCell.style.backgroundColor = 'transparent';
            }
        }
        grandTotal += sum;
    });

    classes.forEach((cls, colIndex) => {
        const colCell = document.getElementById(`col-total-${colIndex}`);
        if (colCell) {
            colCell.textContent = colTotals[colIndex];
        }
    });

    const grandCell = document.getElementById('grand-total');
    if (grandCell) {
        grandCell.textContent = grandTotal;
    }
}

// Firebase Handlers
function saveToLocalStorage() {
    saveScheduleData({ teachers });
}

function saveHomeroomAssignments() {
    saveScheduleData({ homeroomAssignments });
}

function renderHomeroomRow() {
    const tr = document.getElementById('homeroom-row');
    if (!tr) return;
    tr.innerHTML = '';
    
    classes.forEach((cls, index) => {
        const th = document.createElement('th');
        th.className = 'homeroom-th';
        
        const label = document.createElement('div');
        label.className = 'class-number';
        label.textContent = `כיתה ${cls.slice(-1)}`; 
        
        const select = document.createElement('select');
        select.className = 'homeroom-select';
        select.dataset.colIndex = index;
        select.innerHTML = '<option value="">מחנך/ת</option>';
        
        [...teachers].sort((a, b) => a.name.localeCompare(b.name, 'he')).forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = getTeacherStatusText(t);
            select.appendChild(opt);
        });
        
        if (homeroomAssignments[index]) {
            select.value = homeroomAssignments[index];
            const teacher = teachers.find(t => t.id === select.value);
            if (teacher && teacher.color) select.style.backgroundColor = teacher.color;
        }
        
        select.addEventListener('change', (e) => {
            homeroomAssignments[index] = e.target.value;
            const teacher = teachers.find(t => t.id === e.target.value);
            if (teacher && teacher.color) {
                e.target.style.backgroundColor = teacher.color;
            } else {
                e.target.style.backgroundColor = '';
            }
            saveHomeroomAssignments();
        });
        
        th.appendChild(label);
        th.appendChild(select);
        tr.appendChild(th);
    });
}

function saveTableState() {
    const state = {};
    const selects = document.querySelectorAll('.cell-select');
    const inputs = document.querySelectorAll('.cell-hours');
    
    selects.forEach((select, index) => {
        const cellId = select.dataset.cellId;
        if(select.value || inputs[index].value) {
             state[cellId] = {
                 teacherId: select.value,
                 hours: inputs[index].value
             };
        }
    });
    tableState = state;
    saveScheduleData({ tableState: state });
}

// Tab Switching Logic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// Run init on load
init();

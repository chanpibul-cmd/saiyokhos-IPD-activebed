const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw4kWnajdQAcS_jBedRX31MIlvoT5S-mHZl0Z5AEBpYZnRvRJjowtAgaPVEzMhXtqh5/exec";

let globalData = [];
let latestDataDateStr = "";

document.addEventListener("DOMContentLoaded", () => {
    if (APPS_SCRIPT_URL === "YOUR_WEB_APP_URL_HERE") {
        generateMockData();
        processData();
    } else {
        fetchData();
    }

    // ทำให้ Filter เดือนทำงาน เมื่อมีการเปลี่ยนเดือน
    document.getElementById('monthFilter').addEventListener('change', function() {
        renderTable(this.value);
    });
});

function fetchData() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('pills-tabContent').style.display = 'none';

    fetch(APPS_SCRIPT_URL, { redirect: "follow" })
        .then(response => response.json())
        .then(result => {
            if (result.status === 'success') {
                globalData = result.data;
                processData();
            } else {
                alert("Error: " + result.error);
            }
        })
        .catch(error => {
            console.error("Fetch Error:", error);
            alert("เกิดข้อผิดพลาดในการดึงข้อมูล");
        });
}

function processData() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('pills-tabContent').style.display = 'block';

    // 1. หา "วันที่ล่าสุด" ที่มีข้อมูลในระบบ
    latestDataDateStr = "1970-01-01";
    globalData.forEach(row => {
        if (row.admitDate && row.admitDate > latestDataDateStr) latestDataDateStr = row.admitDate;
        if (row.dischargeDate && row.dischargeDate > latestDataDateStr) latestDataDateStr = row.dischargeDate;
    });
    
    if (latestDataDateStr === "1970-01-01") {
        latestDataDateStr = new Date().toISOString().split('T')[0];
    }

    document.getElementById('latestDataDateDisplay').innerHTML = `ข้อมูลล่าสุด: <span class="text-primary">${formatDateThaiFull(latestDataDateStr)}</span>`;
    
    const defaultMonth = latestDataDateStr.substring(0, 7);
    document.getElementById('monthFilter').value = defaultMonth;

    // 2. คำนวณ KPI ของ "วันที่ข้อมูลล่าสุด"
    let todayAdmit = 0;
    let todayDischarge = 0;
    let currentActiveBed = 0;
    let wardCounts = {};

    globalData.forEach(row => {
        if (row.admitDate === latestDataDateStr) todayAdmit++;
        if (row.dischargeDate === latestDataDateStr) todayDischarge++;
        
        if (row.admitDate && row.admitDate <= latestDataDateStr) {
            if (!row.dischargeDate || row.dischargeDate > latestDataDateStr) {
                currentActiveBed++;
                let w = row.ward || "ไม่ระบุ";
                wardCounts[w] = (wardCounts[w] || 0) + 1;
            }
        }
    });

    document.getElementById('todayAdmit').innerText = todayAdmit;
    document.getElementById('todayDischarge').innerText = todayDischarge;
    document.getElementById('currentActiveBed').innerText = currentActiveBed;

    // 3. Render Ward Stats
    let wardHtml = '';
    let sortedWards = Object.keys(wardCounts).sort((a,b) => wardCounts[b] - wardCounts[a]);
    sortedWards.forEach(w => {
        wardHtml += `<div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                        <span class="fw-bold text-secondary">${w}</span>
                        <span class="badge bg-primary rounded-pill px-3 py-2 fs-6 shadow-sm">${wardCounts[w]} เตียง</span>
                     </div>`;
    });
    document.getElementById('wardStatsContainer').innerHTML = wardHtml || '<p class="text-muted text-center py-3">ไม่มีข้อมูล Active Bed</p>';

    // 4. Generate Daily Stats สำหรับกราฟ 14 วันย้อนหลัง
    let dailyStats = {};
    for(let i=0; i<14; i++) {
        let d = new Date(latestDataDateStr);
        d.setDate(d.getDate() - i);
        let dateStr = d.toISOString().split('T')[0];
        dailyStats[dateStr] = { admit: 0, discharge: 0, active: 0 };
    }

    Object.keys(dailyStats).forEach(targetDate => {
        globalData.forEach(row => {
            if (row.admitDate === targetDate) dailyStats[targetDate].admit++;
            if (row.dischargeDate === targetDate) dailyStats[targetDate].discharge++;
            if (row.admitDate && row.admitDate <= targetDate) {
                if (!row.dischargeDate || row.dischargeDate > targetDate) {
                    dailyStats[targetDate].active++;
                }
            }
        });
    });

    renderChart(dailyStats);
    renderTable(defaultMonth);
}

let activeBedChart;
function renderChart(dailyStats) {
    const ctx = document.getElementById('activeBedChart').getContext('2d');
    const dates = Object.keys(dailyStats).sort();
    
    const activeData = dates.map(d => dailyStats[d].active);
    const admitData = dates.map(d => dailyStats[d].admit);
    const dischargeData = dates.map(d => dailyStats[d].discharge);

    if (activeBedChart) activeBedChart.destroy();

    activeBedChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates.map(d => formatDateThai(d)),
            datasets: [
                {
                    label: 'Active Bed (รวม)',
                    data: activeData,
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.05)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Admit (รับใหม่)',
                    data: admitData,
                    borderColor: '#198754',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.3
                },
                {
                    label: 'Discharge (จำหน่าย)',
                    data: dischargeData,
                    borderColor: '#0dcaf0',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [2, 2],
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'bottom' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function renderTable(selectedMonth) {
    const tbody = document.getElementById('dailyTableBody');
    tbody.innerHTML = '';
    
    if(!selectedMonth) return;
    const [year, month] = selectedMonth.split('-');
    const daysInMonth = new Date(year, month, 0).getDate();
    
    let datesToRender = [];
    for(let i=1; i<=daysInMonth; i++) {
        let dStr = `${year}-${month}-${i.toString().padStart(2, '0')}`;
        if(dStr <= latestDataDateStr) {
            datesToRender.push(dStr);
        }
    }
    datesToRender.sort((a,b) => b.localeCompare(a));

    if(datesToRender.length === 0) {
       tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">ไม่มีข้อมูลในเดือนที่เลือก</td></tr>';
       return;
    }

    let hasDataInMonth = false;

    datesToRender.forEach(targetDate => {
        let wardData = {}; 
        
        globalData.forEach(row => {
            let w = row.ward || 'ไม่ระบุ';
            if(!wardData[w]) wardData[w] = { active: 0, beds: new Set(), admits: 0, discharges: 0, depts: new Set() };
            
            if (row.admitDate && row.admitDate <= targetDate) {
                if (!row.dischargeDate || row.dischargeDate > targetDate) {
                    wardData[w].active++;
                    if(row.bed && row.bed.trim() !== '') wardData[w].beds.add(row.bed);
                }
            }
            if (row.admitDate === targetDate) {
                wardData[w].admits++;
                if(row.dept && row.dept.trim() !== '') wardData[w].depts.add(row.dept);
            }
            if (row.dischargeDate === targetDate) {
                wardData[w].discharges++;
            }
        });

        let activeWards = Object.keys(wardData).filter(w => wardData[w].active > 0 || wardData[w].admits > 0 || wardData[w].discharges > 0);
        
        if(activeWards.length === 0) return;
        hasDataInMonth = true;
        
        activeWards.sort();

        // คำนวณหาผลรวม Active Bed ของทุกวอร์ดในวันนี้
        let totalActiveInDate = activeWards.reduce((sum, w) => sum + wardData[w].active, 0);

        activeWards.forEach((w, index) => {
            let wd = wardData[w];
            let tr = document.createElement('tr');
            
            // ปรับแต่งให้ช่องวันที่แสดงผลรวม Active Bed ด้านล่างวันที่
            let dateCell = index === 0 ? `
                <td rowspan="${activeWards.length}" class="align-middle text-center bg-light border-end" style="width:150px; min-width:150px;">
                    <div class="fw-bold text-dark mb-2">${formatDateThaiFull(targetDate)}</div>
                    <div class="pt-1 mt-1 border-top border-secondary border-opacity-10">
                        <small class="text-muted d-block" style="font-size:0.75rem;">Active Bed รวม</small>
                        <span class="badge bg-success shadow-sm px-2 py-1 mt-1 fs-6">${totalActiveInDate} เตียง</span>
                    </div>
                </td>` : '';
            
            let bedArray = Array.from(wd.beds);
            bedArray.sort();
            let bedList = bedArray.join(', ');
            
            let deptList = Array.from(wd.depts).join(', ');
            
            tr.innerHTML = `
                ${dateCell}
                <td class="fw-bold text-secondary">${w}</td>
                <td class="text-center text-success fw-bold fs-5">${wd.active}</td>
                <td style="max-width: 250px; font-size: 0.85rem;" class="text-wrap text-muted">${bedList || '-'}</td>
                <td class="text-center text-primary fw-bold">${wd.admits}</td>
                <td class="text-center text-info fw-bold">${wd.discharges}</td>
                <td style="max-width: 200px; font-size: 0.85rem;" class="text-wrap text-muted">${deptList || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    });

    if(!hasDataInMonth) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">ไม่พบความเคลื่อนไหวในเดือนที่เลือก</td></tr>';
    }
}

function formatDateThai(dateString) {
    if (!dateString) return '';
    const parts = dateString.split('-');
    return `${parts[2]}/${parts[1]}`;
}

function formatDateThaiFull(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
}

function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

function generateMockData() {
    globalData = [];
    const wards = ["ตึกสามัญ", "ตึกพิเศษ", "กุมารเวชกรรม"];
    const depts = ["อายุรกรรม", "ศัลยกรรม", "ER", "OPD"];
    const beds = ["M01", "M02", "F01", "F02", "V01", "V02", "M05", "M06"];
    
    for (let i = 0; i < 150; i++) {
        let d1 = new Date();
        d1.setDate(d1.getDate() - Math.floor(Math.random() * 40)); 
        let d2 = new Date(d1);
        d2.setDate(d2.getDate() + Math.floor(Math.random() * 8) + 1);
        
        globalData.push({
            admitDate: d1.toISOString().split('T')[0],
            dischargeDate: Math.random() > 0.4 ? d2.toISOString().split('T')[0] : '',
            ward: wards[Math.floor(Math.random() * wards.length)],
            bed: beds[Math.floor(Math.random() * beds.length)],
            dept: depts[Math.floor(Math.random() * depts.length)]
        });
    }
}

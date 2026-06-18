// ใส่ URL ของ Web App ที่ได้จาก Apps Script ที่นี่
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxOHlkqLZSvTC_UK0nx2yxRQo8zByapBoMX9bp64iNQR1h_ToJts48k6U3FAR1cgIkY/exec";

let globalData = [];

document.addEventListener("DOMContentLoaded", () => {
    // กำหนดค่าเริ่มต้นของ Month Filter เป็นเดือนปัจจุบัน
    const now = new Date();
    document.getElementById('monthFilter').value = now.toISOString().slice(0, 7);
    
    // โหลดข้อมูล (สำหรับการทดสอบในกรณีที่ยังไม่มี URL ให้จำลองข้อมูล)
    if (APPS_SCRIPT_URL === "YOUR_WEB_APP_URL_HERE") {
        console.warn("ยังไม่ได้ใส่ APPS_SCRIPT_URL ใช้ข้อมูลจำลองแทน");
        generateMockData();
        processData();
    } else {
        fetchData();
    }
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

    const todayStr = getTodayString();
    
    // 1. Calculate Today's KPIs
    let todayAdmit = 0;
    let todayDischarge = 0;
    let currentActiveBed = 0;
    let wardCounts = {};

    globalData.forEach(row => {
        if (row.admitDate === todayStr) todayAdmit++;
        if (row.dischargeDate === todayStr) todayDischarge++;
        
        // Active Bed Logic: Admit date <= today AND (Discharge date > today OR Discharge is empty)
        if (row.admitDate && row.admitDate <= todayStr) {
            if (!row.dischargeDate || row.dischargeDate > todayStr) {
                currentActiveBed++;
                let w = row.ward || "ไม่ระบุ";
                wardCounts[w] = (wardCounts[w] || 0) + 1;
            }
        }
    });

    document.getElementById('todayAdmit').innerText = todayAdmit;
    document.getElementById('todayDischarge').innerText = todayDischarge;
    document.getElementById('currentActiveBed').innerText = currentActiveBed;

    // 2. Render Ward Stats
    let wardHtml = '';
    for (let w in wardCounts) {
        wardHtml += `<div class="d-flex justify-content-between align-items-center mb-2 border-bottom pb-2">
                        <span>${w}</span>
                        <span class="badge bg-primary rounded-pill px-3 py-2 fs-6">${wardCounts[w]}</span>
                     </div>`;
    }
    document.getElementById('wardStatsContainer').innerHTML = wardHtml || '<p class="text-muted">ไม่มีข้อมูล</p>';

    // 3. Generate Daily Stats (Last 14 days for chart, 30 days for table)
    let dailyStats = {};
    for(let i=0; i<30; i++) {
        let d = new Date();
        d.setDate(d.getDate() - i);
        let dateStr = d.toISOString().split('T')[0];
        dailyStats[dateStr] = { admit: 0, discharge: 0, active: 0 };
    }

    // Calculate historical active beds & daily admits/discharges
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
    renderTable(dailyStats);
}

let activeBedChart;
function renderChart(dailyStats) {
    const ctx = document.getElementById('activeBedChart').getContext('2d');
    
    // Sort dates ascending for chart (last 14 days)
    const dates = Object.keys(dailyStats).slice(0, 14).reverse();
    const activeData = dates.map(d => dailyStats[d].active);
    const admitData = dates.map(d => dailyStats[d].admit);

    if (activeBedChart) activeBedChart.destroy();

    activeBedChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates.map(d => formatDateThai(d)),
            datasets: [{
                label: 'Active Bed',
                data: activeData,
                borderColor: '#0d6efd',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function renderTable(dailyStats) {
    const tbody = document.getElementById('dailyTableBody');
    tbody.innerHTML = '';
    
    // Sort descending for table
    const dates = Object.keys(dailyStats).sort((a,b) => b.localeCompare(a));
    
    dates.forEach(d => {
        const stats = dailyStats[d];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold">${formatDateThaiFull(d)}</td>
            <td class="text-center text-primary fw-bold">${stats.admit}</td>
            <td class="text-center text-info">${stats.discharge}</td>
            <td class="text-center text-success fw-bold">${stats.active}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Utility Functions
function getTodayString() {
    return new Date().toISOString().split('T')[0];
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

// Mock Data Generator for UI Testing
function generateMockData() {
    globalData = [];
    const wards = ["ตึกสามัญ", "ตึกพิเศษ", "ตึกคลอด", "กุมารเวชกรรม"];
    for (let i = 0; i < 200; i++) {
        let d1 = new Date();
        d1.setDate(d1.getDate() - Math.floor(Math.random() * 30));
        let d2 = new Date(d1);
        d2.setDate(d2.getDate() + Math.floor(Math.random() * 10) + 1);
        
        globalData.push({
            admitDate: d1.toISOString().split('T')[0],
            dischargeDate: Math.random() > 0.3 ? d2.toISOString().split('T')[0] : '', // 30% still active
            ward: wards[Math.floor(Math.random() * wards.length)]
        });
    }
}

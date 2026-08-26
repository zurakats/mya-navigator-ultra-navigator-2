import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics untuk memisahkan hasil per endpoint di laporan skripsi
const navigateLatency = new Trend('req_latency_navigate');
const searchLatency = new Trend('req_latency_search');
const errorRate = new Rate('error_rate');

// Konfigurasi skenario pengujian bertahap (Ramp-up)
export const options = {
    // Skenario bertingkat (Bisa disesuaikan untuk Bab 4 Skripsi)
    stages: [
        { duration: '30s', target: 10 },  // Tahap 1: Naik perlahan ke 10 User bersamaan
        { duration: '1m', target: 50 },   // Tahap 2: Naik ke 50 User (Beban Menengah)
        { duration: '1m', target: 100 },  // Tahap 3: Naik ke 100 User (Beban Tinggi)
        { duration: '30s', target: 0 },   // Tahap 4: Turun perlahan (Cooldown)
    ],
    thresholds: {
        // Toleransi kegagalan untuk Skripsi
        error_rate: ['rate<0.05'], // Error maksimal 5%
        req_latency_navigate: ['p(95)<3000'], // 95% request /navigate harus di bawah 3 detik
        req_latency_search: ['p(95)<1000'],   // 95% request /search harus di bawah 1 detik
    },
};

// URL Backend (Cloudflare Tunnel). BISA DIUBAH VIA ENVIRONMENT VARIABLE
const BASE_URL = __ENV.BASE_URL || 'https://backend-anda.trycloudflare.com/api';

export default function () {
    // -----------------------------------------------------------
    // SKENARIO 1: Pencarian Halte (Menguji Database Full Scan)
    // -----------------------------------------------------------
    const searchQuery = 'blok'; // Contoh query pencarian halte
    const resSearch = http.get(`${BASE_URL}/stops/search?q=${searchQuery}`);
    
    // Catat latensi khusus untuk search
    searchLatency.add(resSearch.timings.duration);
    
    // Validasi apakah request sukses (Status 200)
    const searchSuccess = check(resSearch, {
        'Search status is 200': (r) => r.status === 200,
    });
    errorRate.add(!searchSuccess);

    // Jeda sejenak mensimulasikan user membaca hasil pencarian
    sleep(1);

    // -----------------------------------------------------------
    // SKENARIO 2: Navigasi Rute (Menguji RAPTOR Algorithm & OSRM)
    // -----------------------------------------------------------
    // Contoh koordinat (Blok M ke Monas) - Sesuaikan dengan koordinat riil di Jakarta
    const startLat = -6.2433;
    const startLon = 106.8016;
    const destLat = -6.1754;
    const destLon = 106.8271;
    
    const navigateUrl = `${BASE_URL}/navigate?startLat=${startLat}&startLon=${startLon}&destLat=${destLat}&destLon=${destLon}`;
    
    // Request utama yang membebani CPU
    const resNavigate = http.get(navigateUrl);
    
    // Catat latensi khusus untuk routing
    navigateLatency.add(resNavigate.timings.duration);

    // Validasi apakah request sukses dan mengembalikan itineraries
    const navSuccess = check(resNavigate, {
        'Navigate status is 200': (r) => r.status === 200,
        'Has itineraries array': (r) => {
            try {
                const body = JSON.parse(r.body);
                return Array.isArray(body.itineraries);
            } catch (e) {
                return false;
            }
        },
    });
    errorRate.add(!navSuccess);

    // Jeda sebelum user melakukan request lagi
    sleep(2);
}

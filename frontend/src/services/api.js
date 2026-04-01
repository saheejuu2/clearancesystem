// import axios from 'axios';

// const API_BASE_URL = 'http://localhost/hospital-clearance/api';

// const api = axios.create({
//     baseURL: API_BASE_URL,
//     headers: {
//         'Content-Type': 'application/json',
//     }
// });

// export default api;
import axios from 'axios';

// CHANGE THIS: Match your frontend domain (hesed-pc)
const API_BASE_URL = 'http://hesed-pc/hospital-clearance/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    // Add this if you plan to use PHP Sessions or Cookies later
    withCredentials: true 
});

export default api;
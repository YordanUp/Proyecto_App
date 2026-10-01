const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

const config = {
  apiBaseUrl: (configuredBaseUrl || 'https://proyecto-app-backend-k3tn.onrender.com').replace(/\/$/, ''),
  requestTimeoutMs: 45000,
  coldStartNoticeMs: 2200
};

module.exports = config;

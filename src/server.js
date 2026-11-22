'use strict';

const { createApp } = require('./app');
const { API_PREFIX } = require('./constants');

const PORT = Number(process.env.PORT) || 3000;
const { server } = createApp();

server.listen(PORT, () => {
  console.log(`CampusCare API listening on http://localhost:${PORT}`);
  console.log(`Greeting page:  http://localhost:${PORT}${API_PREFIX}/greeting`);
  console.log('Mock tokens: user-a-token, user-b-token, staff-token, admin-token (data resets on restart)');
});

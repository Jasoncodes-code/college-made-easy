'use strict';

const http = require('node:http');
const { handleLocalRequest } = require('./app-handler');

const PORT = Number(process.env.PORT || 3000);

http.createServer(handleLocalRequest).listen(PORT, () => {
  console.log(`College made easy is running at http://localhost:${PORT}`);
});

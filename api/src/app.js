const express = require('express');

function createApp() {
  const app = express();
  app.use(express.json());
  return app;
}

module.exports = { createApp };
